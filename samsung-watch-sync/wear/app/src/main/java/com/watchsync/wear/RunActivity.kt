package com.watchsync.wear

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Start and stop a run, with live distance, pace and heart rate.
 *
 * Keeps the screen on for the duration. An exercise session survives the screen
 * turning off — Health Services keeps recording — but a run screen that blanks
 * mid-run is not much use, and the alternative is the user tapping the watch
 * every few minutes.
 */
class RunActivity : Activity() {

    private lateinit var recorder: RunRecorder
    private lateinit var primary: TextView
    private lateinit var secondary: TextView
    private lateinit var gpsView: TextView
    private lateinit var button: Button

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private val listener = object : RunRecorder.Listener {
        override fun onRunUpdate(distanceMeters: Double, activeMillis: Long, bpm: Double?) {
            runOnUiThread {
                val km = distanceMeters / 1000.0
                val paceSeconds = if (km > 0) (activeMillis / 1000.0) / km else 0.0
                primary.text = "%.2f km".format(km)
                secondary.text = buildString {
                    append(formatPace(paceSeconds)).append(" /km")
                    bpm?.let { append("   ").append(Math.round(it)).append(" bpm") }
                }
            }
        }

        override fun onRunFinished(runId: Long) {
            runOnUiThread {
                primary.text = "Saved"
                secondary.text = "Run #$runId — sync from your phone"
                button.text = "Start run"
            }
        }

        override fun onGpsAvailabilityChanged(hasGps: Boolean) {
            runOnUiThread {
                // Distance still works without a fix, from step estimation, so
                // this is information rather than an error.
                gpsView.text = if (hasGps) "GPS ready" else "Acquiring GPS…"
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        recorder = RunRecorder(this)
        setContentView(buildLayout())
        ensurePermissions()
    }

    private fun ensurePermissions() {
        val needed = listOf(
            Manifest.permission.BODY_SENSORS,
            Manifest.permission.ACCESS_FINE_LOCATION
        ).filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), REQUEST_PERMISSIONS)
        }
    }

    private fun toggle() {
        scope.launch {
            try {
                if (recorder.isRecording) {
                    button.isEnabled = false
                    recorder.stop()
                } else {
                    recorder.start(listener)
                    button.text = "Stop"
                    primary.text = "0.00 km"
                    secondary.text = "—"
                }
            } catch (e: Exception) {
                // The common cause is another app already owning the exercise
                // session, since Wear OS permits only one at a time.
                primary.text = "Can't start"
                secondary.text = "Close Samsung Health workouts first"
            } finally {
                button.isEnabled = true
            }
        }
    }

    private fun formatPace(secondsPerKm: Double): String {
        if (secondsPerKm <= 0 || secondsPerKm.isInfinite()) return "--:--"
        val total = Math.round(secondsPerKm)
        return "%d:%02d".format(total / 60, total % 60)
    }

    private fun buildLayout(): ViewGroup {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(20, 20, 20, 20)
        }
        primary = TextView(this).apply {
            text = "Ready"
            textSize = 26f
            gravity = Gravity.CENTER
        }
        secondary = TextView(this).apply {
            text = "—"
            textSize = 14f
            gravity = Gravity.CENTER
        }
        gpsView = TextView(this).apply {
            text = ""
            textSize = 10f
            gravity = Gravity.CENTER
        }
        button = Button(this).apply {
            text = "Start run"
            setOnClickListener { toggle() }
        }
        root.addView(primary)
        root.addView(secondary)
        root.addView(gpsView)
        root.addView(button)
        return root
    }

    override fun onDestroy() {
        // Deliberately does not stop an in-progress run: leaving the screen
        // should not end the workout. Health Services keeps the session alive.
        scope.cancel()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_PERMISSIONS = 2
    }
}
