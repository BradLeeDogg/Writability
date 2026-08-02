package com.watchsync.wear

import android.content.Context
import android.os.SystemClock
import android.util.Log
import androidx.health.services.client.ExerciseUpdateCallback
import androidx.health.services.client.HealthServices
import androidx.health.services.client.data.Availability
import androidx.health.services.client.data.DataType
import androidx.health.services.client.data.ExerciseConfig
import androidx.health.services.client.data.ExerciseLapSummary
import androidx.health.services.client.data.ExerciseType
import androidx.health.services.client.data.ExerciseUpdate
import androidx.health.services.client.data.LocationAvailability
import kotlinx.coroutines.guava.await
import java.time.Instant

/**
 * Records a run using Health Services' [androidx.health.services.client.ExerciseClient].
 *
 * This is a different mode from the passive collection in [HealthCollectorService],
 * not an extension of it. Passive monitoring is cheap, batched and sensor-only —
 * it has no concept of a workout and never turns on GPS. An exercise session pins
 * the sensors and the GPS receiver on for its duration, which is what makes pace
 * and a route possible, and also why it must be started and stopped deliberately
 * rather than left running.
 *
 * Only one exercise may be active device-wide. Starting a run here while Samsung
 * Health is tracking one will fail; that is a platform constraint, not something
 * this class can arbitrate.
 */
class RunRecorder(private val context: Context) {

    interface Listener {
        fun onRunUpdate(distanceMeters: Double, activeMillis: Long, bpm: Double?)
        fun onRunFinished(runId: Long)
        fun onGpsAvailabilityChanged(hasGps: Boolean)
    }

    private val client = HealthServices.getClient(context).exerciseClient
    private val store = RunStore(context)

    private var runId: Long = -1
    private var listener: Listener? = null

    // Latest known values, carried between updates so every trackpoint is
    // complete even though Health Services delivers metrics independently.
    private var distanceMeters = 0.0
    private var calories = 0.0
    private var activeMillis = 0L
    private var latestBpm: Double? = null

    @Volatile
    var isRecording = false
        private set

    private val callback = object : ExerciseUpdateCallback {
        override fun onExerciseUpdateReceived(update: ExerciseUpdate) = handleUpdate(update)

        override fun onLapSummaryReceived(lapSummary: ExerciseLapSummary) {
            // Splits are derived from trackpoints in [Splits], which stays
            // accurate regardless of how Health Services chose to lap. This
            // callback is left unused on purpose.
        }

        override fun onAvailabilityChanged(dataType: DataType<*, *>, availability: Availability) {
            if (availability is LocationAvailability) {
                val acquired = availability == LocationAvailability.ACQUIRED_TETHERED ||
                    availability == LocationAvailability.ACQUIRED_UNTETHERED
                listener?.onGpsAvailabilityChanged(acquired)
            }
        }

        override fun onRegistered() = Log.i(TAG, "Exercise callback registered")

        override fun onRegistrationFailed(throwable: Throwable) =
            Log.e(TAG, "Exercise callback registration failed", throwable)
    }

    suspend fun start(listener: Listener) {
        if (isRecording) return
        this.listener = listener

        val config = ExerciseConfig.builder(ExerciseType.RUNNING)
            .setDataTypes(
                setOf(
                    DataType.HEART_RATE_BPM,
                    DataType.LOCATION,
                    DataType.DISTANCE_TOTAL,
                    DataType.CALORIES_TOTAL,
                    DataType.SPEED
                )
            )
            .setIsGpsEnabled(true)
            // Auto-pause is left off: it silently stops the clock at traffic
            // lights, which makes recorded splits disagree with a stopwatch.
            .setIsAutoPauseAndResumeEnabled(false)
            .build()

        runId = store.startRun(System.currentTimeMillis())
        distanceMeters = 0.0
        calories = 0.0
        activeMillis = 0L
        latestBpm = null

        client.setUpdateCallback(callback)
        client.startExerciseAsync(config).await()
        isRecording = true
        Log.i(TAG, "Run $runId started")
    }

    suspend fun stop() {
        if (!isRecording) return
        isRecording = false
        runCatching { client.endExerciseAsync().await() }
        runCatching { client.clearUpdateCallbackAsync(callback).await() }

        store.finishRun(
            runId = runId,
            endedAt = System.currentTimeMillis(),
            activeMillis = activeMillis,
            distanceM = distanceMeters,
            calories = calories
        )
        listener?.onRunFinished(runId)
        Log.i(TAG, "Run $runId finished: ${distanceMeters}m")
    }

    private fun handleUpdate(update: ExerciseUpdate) {
        if (!isRecording || runId < 0) return
        val metrics = update.latestMetrics
        val bootInstant = Instant.now().minusNanos(SystemClock.elapsedRealtimeNanos())

        metrics.getData(DataType.DISTANCE_TOTAL)?.let { distanceMeters = it.total }
        metrics.getData(DataType.CALORIES_TOTAL)?.let { calories = it.total }
        update.activeDurationCheckpoint?.let {
            activeMillis = it.activeDuration.toMillis()
        }
        metrics.getData(DataType.HEART_RATE_BPM).lastOrNull { it.value > 0 }?.let {
            latestBpm = it.value
        }

        // One trackpoint per location fix keeps the route and the distance series
        // in step. Without GPS — indoors, or before first fix — fall back to a
        // point per update so pace and splits still work from step-derived
        // distance, just without a map.
        val locations = metrics.getData(DataType.LOCATION)
        if (locations.isNotEmpty()) {
            locations.forEach { sample ->
                store.addTrackpoint(
                    runId,
                    Trackpoint(
                        epochMillis = sample.getTimeInstant(bootInstant).toEpochMilli(),
                        distanceMeters = distanceMeters,
                        latitude = sample.value.latitude,
                        longitude = sample.value.longitude,
                        altitudeMeters = sample.value.altitude,
                        bpm = latestBpm
                    )
                )
            }
        } else if (distanceMeters > 0) {
            store.addTrackpoint(
                runId,
                Trackpoint(
                    epochMillis = System.currentTimeMillis(),
                    distanceMeters = distanceMeters,
                    bpm = latestBpm
                )
            )
        }

        listener?.onRunUpdate(distanceMeters, activeMillis, latestBpm)
    }

    companion object {
        private const val TAG = "RunRecorder"
    }
}
