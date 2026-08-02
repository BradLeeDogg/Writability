package com.watchsync.wear

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.Closeable
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.URLDecoder
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * A deliberately small HTTP/1.1 server exposing the read-only sync API.
 *
 * Hand-rolled on [ServerSocket] rather than pulling in a web framework: the
 * surface is three GET endpoints on a LAN, and every dependency added to a Wear
 * build is another thing that can fail to resolve or bloat the APK.
 *
 * Data access goes through [DataSource] so the protocol can be exercised without
 * an Android device or a real sensor stream.
 */
class SyncHttpServer(
    private val port: Int,
    private val deviceName: String,
    private val source: DataSource,
    private val auth: Auth
) : Closeable {

    /** Everything the server needs from storage. */
    interface DataSource {
        fun heartRateSince(since: Long): List<HeartRateSample>
        fun dailySince(since: Long): List<DailyTotals>
        fun watermark(): Long
    }

    /** Everything the server needs from pairing, kept injectable for tests. */
    interface Auth {
        fun tokenMatches(bearer: String?): Boolean
        fun codeMatches(code: String?): Boolean
        fun issueToken(): String
        fun pairingWindowOpen(): Boolean
    }

    private var serverSocket: ServerSocket? = null
    private val workers = Executors.newFixedThreadPool(2)
    @Volatile private var running = false

    fun start() {
        if (running) return
        running = true
        val socket = ServerSocket(port).apply { reuseAddress = true }
        serverSocket = socket
        Thread({ acceptLoop(socket) }, "watchsync-accept").apply {
            isDaemon = true
            start()
        }
        Log.i(TAG, "Listening on :$port")
    }

    private fun acceptLoop(socket: ServerSocket) {
        while (running) {
            val client = try {
                socket.accept()
            } catch (e: Exception) {
                if (running) Log.w(TAG, "Accept failed", e)
                continue
            }
            workers.execute {
                try {
                    client.soTimeout = 10_000
                    handle(client)
                } catch (e: Exception) {
                    Log.w(TAG, "Request failed", e)
                } finally {
                    runCatching { client.close() }
                }
            }
        }
    }

    private fun handle(client: Socket) {
        val reader = BufferedReader(InputStreamReader(client.getInputStream()))
        val requestLine = reader.readLine() ?: return

        val parts = requestLine.split(" ")
        if (parts.size < 2) return respond(client.getOutputStream(), 400, errorBody("malformed request"))
        val (method, target) = parts[0] to parts[1]

        // Collect headers; we only care about Authorization.
        var bearer: String? = null
        while (true) {
            val line = reader.readLine()
            if (line.isNullOrEmpty()) break
            val idx = line.indexOf(':')
            if (idx > 0 && line.take(idx).equals("Authorization", ignoreCase = true)) {
                bearer = line.substring(idx + 1).trim().removePrefix("Bearer ").trim()
            }
        }

        val out = client.getOutputStream()
        if (method != "GET") return respond(out, 405, errorBody("method not allowed"))

        val path = target.substringBefore('?')
        val query = parseQuery(target.substringAfter('?', ""))

        when (path) {
            "/pair" -> handlePair(out, query["code"])
            "/health" -> {
                if (!auth.tokenMatches(bearer)) return respond(out, 401, errorBody("unauthorized"))
                respond(out, 200, JSONObject().apply {
                    put("ok", true)
                    put("device", deviceName)
                    put("protocol", PROTOCOL_VERSION)
                }.toString())
            }
            "/samples" -> {
                if (!auth.tokenMatches(bearer)) return respond(out, 401, errorBody("unauthorized"))
                val since = query["since"]?.toLongOrNull() ?: 0L
                respond(out, 200, samplesBody(since))
            }
            else -> respond(out, 404, errorBody("not found"))
        }
    }

    private fun handlePair(out: OutputStream, code: String?) {
        if (!auth.pairingWindowOpen()) {
            return respond(out, 403, errorBody("pairing window closed"))
        }
        if (!auth.codeMatches(code)) {
            return respond(out, 403, errorBody("bad pairing code"))
        }
        respond(out, 200, JSONObject().apply {
            put("token", auth.issueToken())
            put("device", deviceName)
        }.toString())
    }

    /**
     * Note the ordering: the watermark is read *before* the samples, so any sample
     * that lands mid-response is simply re-sent next time rather than being skipped.
     * Re-delivery is harmless (heart rate is keyed by timestamp, daily totals are
     * replaced); a gap would be permanent data loss.
     */
    internal fun samplesBody(since: Long): String {
        val watermark = source.watermark()
        val heartRate = JSONArray()
        source.heartRateSince(since).forEach { sample ->
            heartRate.put(JSONObject().apply {
                put("t", sample.epochMillis)
                put("bpm", sample.bpm)
            })
        }
        val daily = JSONArray()
        source.dailySince(since).forEach { day ->
            daily.put(JSONObject().apply {
                put("date", day.date)
                put("updatedAt", day.updatedAt)
                put("steps", day.steps)
                put("calories", day.calories)
                put("distanceMeters", day.distanceMeters)
            })
        }
        return JSONObject().apply {
            put("protocol", PROTOCOL_VERSION)
            put("device", deviceName)
            put("watermark", watermark)
            put("heartRate", heartRate)
            put("daily", daily)
        }.toString()
    }

    private fun parseQuery(raw: String): Map<String, String> =
        raw.split('&')
            .filter { it.contains('=') }
            .associate { pair ->
                val k = URLDecoder.decode(pair.substringBefore('='), "UTF-8")
                val v = URLDecoder.decode(pair.substringAfter('='), "UTF-8")
                k to v
            }

    private fun errorBody(message: String) = JSONObject().put("error", message).toString()

    private fun respond(out: OutputStream, status: Int, body: String) {
        val reason = when (status) {
            200 -> "OK"; 400 -> "Bad Request"; 401 -> "Unauthorized"
            403 -> "Forbidden"; 404 -> "Not Found"; 405 -> "Method Not Allowed"
            else -> "Error"
        }
        val bytes = body.toByteArray(Charsets.UTF_8)
        val header = buildString {
            append("HTTP/1.1 $status $reason\r\n")
            append("Content-Type: application/json; charset=utf-8\r\n")
            append("Content-Length: ${bytes.size}\r\n")
            append("Connection: close\r\n")
            append("\r\n")
        }
        out.write(header.toByteArray(Charsets.US_ASCII))
        out.write(bytes)
        out.flush()
    }

    override fun close() {
        running = false
        runCatching { serverSocket?.close() }
        workers.shutdownNow()
        runCatching { workers.awaitTermination(2, TimeUnit.SECONDS) }
    }

    companion object {
        const val PROTOCOL_VERSION = 1
        const val DEFAULT_PORT = 8787
        private const val TAG = "SyncHttpServer"
    }
}
