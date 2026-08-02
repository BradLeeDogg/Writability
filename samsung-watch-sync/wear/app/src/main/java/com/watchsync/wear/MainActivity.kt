package com.watchsync.wear

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.ViewGroup
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Minimal watch UI. Its only jobs are to obtain sensor permissions, start
 * [SyncService], and display the pairing code.
 *
 * Being on screen *is* the pairing window: /pair only answers while this
 * activity is resumed, so a phone can only claim the token while the user is
 * deliberately looking at the code.
 */
class MainActivity : Activity() {

    private lateinit var codeView: TextView

    private val requiredPermissions: Array<String>
        get() = buildList {
            add(Manifest.permission.BODY_SENSORS)
            add(Manifest.permission.ACTIVITY_RECOGNITION)
            if (Build.VERSION.SDK_INT >= 33) {
                add(Manifest.permission.POST_NOTIFICATIONS)
                add(Manifest.permission.BODY_SENSORS_BACKGROUND)
            }
        }.toTypedArray()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(buildLayout())

        val missing = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isEmpty()) {
            SyncService.start(this)
        } else {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), REQUEST_PERMISSIONS)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQUEST_PERMISSIONS) return

        // BODY_SENSORS is the only hard requirement; the rest degrade gracefully.
        val sensorsGranted = permissions.zip(grantResults.toTypedArray())
            .none { (name, result) ->
                name == Manifest.permission.BODY_SENSORS && result != PackageManager.PERMISSION_GRANTED
            }

        if (sensorsGranted) {
            SyncService.start(this)
        } else {
            codeView.text = "Sensor permission required"
        }
    }

    override fun onResume() {
        super.onResume()
        Pairing.pairingWindowOpen = true
        codeView.text = Pairing.pairingCode(this)
    }

    override fun onPause() {
        Pairing.pairingWindowOpen = false
        super.onPause()
    }

    private fun buildLayout(): ViewGroup {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(24, 24, 24, 24)
        }
        root.addView(TextView(this).apply {
            text = "Pairing code"
            textSize = 12f
            gravity = Gravity.CENTER
        })
        codeView = TextView(this).apply {
            textSize = 24f
            gravity = Gravity.CENTER
        }
        root.addView(codeView)
        root.addView(TextView(this).apply {
            text = "Enter on iPhone"
            textSize = 10f
            gravity = Gravity.CENTER
        })
        return root
    }

    companion object {
        private const val REQUEST_PERMISSIONS = 1
    }
}
