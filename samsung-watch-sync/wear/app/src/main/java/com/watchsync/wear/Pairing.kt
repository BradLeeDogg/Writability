package com.watchsync.wear

import android.content.Context
import java.security.SecureRandom

/**
 * Shared-secret pairing between this watch and one phone.
 *
 * The token is generated once and never leaves the watch except through
 * /pair, which is only answered while the pairing screen is open. That window
 * is what stops another device on the same Wi-Fi from claiming it.
 */
object Pairing {

    private const val PREFS = "watchsync_pairing"
    private const val KEY_TOKEN = "token"

    /** True only while the user has the pairing screen open on the watch. */
    @Volatile
    var pairingWindowOpen: Boolean = false

    fun token(context: Context): String {
        val prefs = context.applicationContext
            .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        prefs.getString(KEY_TOKEN, null)?.let { return it }

        val bytes = ByteArray(16).also { SecureRandom().nextBytes(it) }
        val token = bytes.joinToString("") { "%02x".format(it) }
        prefs.edit().putString(KEY_TOKEN, token).apply()
        return token
    }

    /** The first 6 characters, shown on the watch and typed into the phone. */
    fun pairingCode(context: Context): String = token(context).take(6).uppercase()

    fun codeMatches(context: Context, candidate: String?): Boolean {
        if (candidate == null) return false
        val expected = pairingCode(context)
        // Constant-time-ish comparison; the code is short and rate-limited by the
        // pairing window, but there is no reason to leak position of first mismatch.
        if (candidate.length != expected.length) return false
        var diff = 0
        for (i in expected.indices) diff = diff or (expected[i].code xor candidate[i].uppercase()[0].code)
        return diff == 0
    }
}
