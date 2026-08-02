package com.watchsync.wear

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.health.services.client.HealthServices
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.PassiveListenerConfig

/**
 * Long-lived holder for the three things that must stay alive together: the
 * sensor subscription, the LAN socket, and the mDNS advertisement.
 *
 * This runs as a foreground service because Wear OS will otherwise reclaim a
 * background process holding an open socket within minutes. The persistent
 * notification is the price of being reachable when the phone decides to sync.
 */
class SyncService : Service() {

    private var server: SyncHttpServer? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var nsdManager: NsdManager? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private lateinit var store: SampleStore
    private lateinit var runStore: RunStore

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        store = SampleStore(this)
        runStore = RunStore(this)
        startForeground(NOTIFICATION_ID, buildNotification())
        acquireLocks()
        startServer()
        subscribeToSensors()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int = START_STICKY

    /**
     * Without these the radio powers down whenever the screen sleeps and the phone
     * simply cannot reach the watch. They do not defeat Wear's power management
     * entirely — see the reliability notes in the README — but they help materially.
     */
    private fun acquireLocks() {
        val wifi = applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        wifiLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "watchsync:wifi")
            .apply { setReferenceCounted(false); acquire() }
        // mDNS is multicast; without this lock the advertisement is invisible.
        multicastLock = wifi.createMulticastLock("watchsync:mdns")
            .apply { setReferenceCounted(false); acquire() }
    }

    private fun startServer() {
        val auth = object : SyncHttpServer.Auth {
            override fun tokenMatches(bearer: String?) =
                bearer != null && bearer == Pairing.token(this@SyncService)

            override fun codeMatches(code: String?) = Pairing.codeMatches(this@SyncService, code)
            override fun issueToken() = Pairing.token(this@SyncService)
            override fun pairingWindowOpen() = Pairing.pairingWindowOpen
        }

        val source = object : SyncHttpServer.DataSource {
            override fun heartRateAfter(t: Long) = store.heartRateAfter(t)
            override fun intervalsAfter(id: Long) = store.intervalsAfter(id)
            override fun totalAfter(id: Long, field: SampleStore.DailyField) =
                store.totalAfter(id, field)

            override fun intervalRange(id: Long) = store.intervalRange(id)
            override fun maxIntervalId() = store.maxIntervalId()
            override fun maxHeartRateTime() = store.maxHeartRateTime()
            override fun ackedIntervalId() = store.ackedIntervalId()
            override fun ackedHeartRateTime() = store.ackedHeartRateTime()
            override fun acknowledge(intervalId: Long, heartRateTime: Long) =
                store.acknowledge(intervalId, heartRateTime)
        }

        val runSource = object : SyncHttpServer.RunSource {
            override fun runs() = runStore.runs()
            override fun run(id: Long) = runStore.run(id)
            override fun trackpoints(runId: Long) = runStore.trackpoints(runId)
            override fun markExported(runId: Long) = runStore.markExported(runId)
            override fun delete(runId: Long) = runStore.delete(runId)
        }

        try {
            server = SyncHttpServer(
                port = SyncHttpServer.DEFAULT_PORT,
                deviceName = Build.MODEL ?: "Galaxy Watch",
                source = source,
                runs = runSource,
                auth = auth
            ).also { it.start() }
            advertise(SyncHttpServer.DEFAULT_PORT)
        } catch (e: Exception) {
            Log.e(TAG, "Could not start sync server", e)
        }
    }

    private fun advertise(port: Int) {
        val info = NsdServiceInfo().apply {
            serviceName = SERVICE_NAME
            serviceType = SERVICE_TYPE
            this.port = port
        }
        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(info: NsdServiceInfo) =
                Log.i(TAG, "Advertising as ${info.serviceName}")

            override fun onRegistrationFailed(info: NsdServiceInfo, errorCode: Int) =
                Log.e(TAG, "mDNS registration failed: $errorCode")

            override fun onServiceUnregistered(info: NsdServiceInfo) = Unit
            override fun onUnregistrationFailed(info: NsdServiceInfo, errorCode: Int) = Unit
        }
        registrationListener = listener
        nsdManager = (getSystemService(Context.NSD_SERVICE) as NsdManager)
            .also { it.registerService(info, NsdManager.PROTOCOL_DNS_SD, listener) }
    }

    /**
     * Passive rather than active monitoring: active exercise tracking pins the
     * sensors on and would flatten the battery in a few hours. Passive lets Health
     * Services batch deliveries on its own schedule, which is what makes
     * all-day collection viable at all.
     */
    private fun subscribeToSensors() {
        val config = PassiveListenerConfig.builder()
            .setDataTypes(
                setOf(
                    DataType.HEART_RATE_BPM,
                    DataType.STEPS_DAILY,
                    DataType.CALORIES_DAILY,
                    DataType.DISTANCE_DAILY
                )
            )
            .build()

        try {
            HealthServices.getClient(this).passiveMonitoringClient
                .setPassiveListenerServiceAsync(HealthCollectorService::class.java, config)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to subscribe to Health Services", e)
        }
    }

    private fun buildNotification(): Notification {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "Sync", NotificationManager.IMPORTANCE_LOW)
        )
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("WatchSync")
            .setContentText("Collecting health data")
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        registrationListener?.let { listener ->
            runCatching { nsdManager?.unregisterService(listener) }
        }
        runCatching { server?.close() }
        runCatching { wifiLock?.release() }
        runCatching { multicastLock?.release() }
        runCatching { store.close() }
        runCatching { runStore.close() }
        super.onDestroy()
    }

    companion object {
        private const val TAG = "SyncService"
        private const val CHANNEL_ID = "watchsync"
        private const val NOTIFICATION_ID = 1
        const val SERVICE_NAME = "WatchSync"
        const val SERVICE_TYPE = "_watchsync._tcp"

        fun start(context: Context) {
            context.startForegroundService(Intent(context, SyncService::class.java))
        }
    }
}
