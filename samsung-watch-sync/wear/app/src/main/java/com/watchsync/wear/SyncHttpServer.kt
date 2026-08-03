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
import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * A deliberately small HTTP/1.1 server exposing the read-only sync API.
 *
 * Hand-rolled on [ServerSocket] rather than pulling in a web framework: the
 * surface is a handful of GET endpoints on a LAN, and every dependency added to
 * a Wear build is another thing that can fail to resolve or bloat the APK.
 *
 * Two shapes of the same data are served. `/samples` is the faithful one, for a
 * real client. `/shortcut` is flattened and pre-aggregated for Apple Shortcuts,
 * which has no JSON path expressions, cannot pass a variable into a health
 * sample's type field, and loops slowly enough that a few hundred heart rate
 * points would take minutes.
 */
class SyncHttpServer(
    private val port: Int,
    private val deviceName: String,
    private val source: DataSource,
    private val runs: RunSource,
    private val auth: Auth
) : Closeable {

    interface DataSource {
        fun heartRateAfter(t: Long): List<HeartRateSample>
        fun intervalsAfter(id: Long): List<IntervalSample>
        fun totalAfter(id: Long, field: SampleStore.DailyField): Double
        fun intervalRange(id: Long): Pair<Long, Long>?
        fun maxIntervalId(): Long
        fun maxHeartRateTime(): Long
        fun ackedIntervalId(): Long
        fun ackedHeartRateTime(): Long
        fun acknowledge(intervalId: Long, heartRateTime: Long)
    }

    interface Auth {
        fun tokenMatches(bearer: String?): Boolean
        fun codeMatches(code: String?): Boolean
        fun issueToken(): String
        fun pairingWindowOpen(): Boolean
    }

    /** Recorded runs, kept separate from the passive sample buffer. */
    interface RunSource {
        fun runs(): List<Run>
        fun run(id: Long): Run?
        fun trackpoints(runId: Long): List<Trackpoint>
        fun markExported(runId: Long)
        fun delete(runId: Long)
    }

    private var serverSocket: ServerSocket? = null
    private val workers = Executors.newFixedThreadPool(2)
    @Volatile private var running = false

    private val iso = DateTimeFormatter.ISO_INSTANT

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
        val out = client.getOutputStream()

        val parts = requestLine.split(" ")
        if (parts.size < 2) return respond(out, 400, errorBody("malformed request"))
        val (method, target) = parts[0] to parts[1]

        var bearer: String? = null
        while (true) {
            val line = reader.readLine()
            if (line.isNullOrEmpty()) break
            val idx = line.indexOf(':')
            if (idx > 0 && line.take(idx).equals("Authorization", ignoreCase = true)) {
                bearer = line.substring(idx + 1).trim().removePrefix("Bearer ").trim()
            }
        }

        if (method != "GET") return respond(out, 405, errorBody("method not allowed"))

        val path = target.substringBefore('?')
        val query = parseQuery(target.substringAfter('?', ""))

        if (path == "/pair") return handlePair(out, query["code"])
        if (!auth.tokenMatches(bearer)) return respond(out, 401, errorBody("unauthorized"))

        when (path) {
            "/health" -> respond(out, 200, JSONObject().apply {
                put("ok", true)
                put("device", deviceName)
                put("protocol", PROTOCOL_VERSION)
            }.toString())

            "/samples" -> respond(out, 200, samplesBody())
            "/shortcut" -> respond(out, 200, shortcutBody())

            "/runs" -> respond(out, 200, runListBody())

            "/ack" -> {
                val interval = query["interval"]?.toLongOrNull()
                val heart = query["heart"]?.toLongOrNull()
                if (interval == null || heart == null) {
                    respond(out, 400, errorBody("interval and heart required"))
                } else {
                    source.acknowledge(interval, heart)
                    respond(out, 200, JSONObject().put("ok", true).toString())
                }
            }

            else -> handleRunPath(out, path, query)
        }
    }

    /**
     * `/runs/<id>` for the split table, `/runs/<id>.tcx` for the file, and
     * `/runs/<id>/exported` to retire it.
     */
    private fun handleRunPath(out: OutputStream, path: String, query: Map<String, String>) {
        if (!path.startsWith("/runs/")) return respond(out, 404, errorBody("not found"))
        val rest = path.removePrefix("/runs/")

        when {
            rest.endsWith(".tcx") -> {
                val id = rest.removeSuffix(".tcx").toLongOrNull()
                val run = id?.let { runs.run(it) }
                    ?: return respond(out, 404, errorBody("no such run"))
                val tcx = TcxWriter.write(
                    run,
                    runs.trackpoints(run.id),
                    splitMetersFrom(query)
                )
                respondFile(out, tcx, "run-${run.id}.tcx")
            }

            rest.endsWith("/exported") -> {
                val id = rest.removeSuffix("/exported").toLongOrNull()
                    ?: return respond(out, 400, errorBody("bad run id"))
                runs.markExported(id)
                respond(out, 200, JSONObject().put("ok", true).toString())
            }

            rest.endsWith("/delete") -> {
                val id = rest.removeSuffix("/delete").toLongOrNull()
                    ?: return respond(out, 400, errorBody("bad run id"))
                runs.delete(id)
                respond(out, 200, JSONObject().put("ok", true).toString())
            }

            else -> {
                val id = rest.toLongOrNull()
                val run = id?.let { runs.run(it) }
                    ?: return respond(out, 404, errorBody("no such run"))
                respond(out, 200, runDetailBody(run, splitMetersFrom(query)))
            }
        }
    }

    /** `?split=mi` switches to mile splits; anything else means kilometres. */
    private fun splitMetersFrom(query: Map<String, String>): Double =
        if (query["split"]?.lowercase() in setOf("mi", "mile", "miles")) Splits.MILE
        else Splits.KILOMETRE

    private fun runListBody(): String {
        val array = JSONArray()
        runs.runs().forEach { run ->
            array.put(JSONObject().apply {
                put("id", run.id)
                put("start", iso.format(Instant.ofEpochMilli(run.startedAt)))
                put("distanceMeters", Math.round(run.distanceMeters))
                put("durationSeconds", run.activeMillis / 1000)
                put("calories", Math.round(run.calories))
                put("exported", run.exported)
                put("tcx", "/runs/${run.id}.tcx")
            })
        }
        return JSONObject().apply {
            put("device", deviceName)
            put("runs", array)
        }.toString()
    }

    /**
     * The split table, pre-formatted. Shortcuts cannot do arithmetic on a list
     * without a slow loop, so pace arrives ready to display.
     */
    private fun runDetailBody(run: Run, splitMeters: Double): String {
        val points = runs.trackpoints(run.id)
        // Same origin as the TCX, so the watch's own table and the exported file agree.
        val splits = Splits.compute(points, splitMeters, run.startedAt)

        val array = JSONArray()
        splits.forEach { split ->
            array.put(JSONObject().apply {
                put("index", split.index)
                put("distanceMeters", Math.round(split.distanceMeters))
                put("durationSeconds", split.durationMillis / 1000)
                put("pace", split.formattedPace())
                put("paceSecondsPerKm", Math.round(split.paceSecondsPerKm))
                split.averageBpm?.let { put("averageBpm", Math.round(it)) }
                split.maxBpm?.let { put("maxBpm", Math.round(it)) }
                put("partial", split.partial)
            })
        }

        val overall = if (run.distanceMeters > 0)
            (run.activeMillis / 1000.0) / (run.distanceMeters / 1000.0) else 0.0

        return JSONObject().apply {
            put("id", run.id)
            put("device", deviceName)
            put("start", iso.format(Instant.ofEpochMilli(run.startedAt)))
            put("distanceMeters", Math.round(run.distanceMeters))
            put("durationSeconds", run.activeMillis / 1000)
            put("calories", Math.round(run.calories))
            put("averagePace", "%d:%02d".format(Math.round(overall) / 60, Math.round(overall) % 60))
            put("hasRoute", points.any { it.latitude != null })
            put("splits", array)
            put("tcx", "/runs/${run.id}.tcx")
        }.toString()
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
     * Everything not yet acknowledged, in full fidelity.
     *
     * The cursor is captured from the rows actually returned rather than from
     * the store's current maximum, so data arriving mid-response is carried to
     * the next sync instead of being acknowledged unseen.
     */
    internal fun samplesBody(): String {
        val sinceInterval = source.ackedIntervalId()
        val sinceHeart = source.ackedHeartRateTime()

        val intervals = source.intervalsAfter(sinceInterval)
        val heartRate = source.heartRateAfter(sinceHeart)

        val intervalsJson = JSONArray()
        intervals.forEach { sample ->
            intervalsJson.put(JSONObject().apply {
                put("start", sample.startMillis)
                put("end", sample.endMillis)
                put("field", sample.field)
                put("value", sample.value)
            })
        }
        val heartRateJson = JSONArray()
        heartRate.forEach { sample ->
            heartRateJson.put(JSONObject().apply {
                put("t", sample.epochMillis)
                put("bpm", sample.bpm)
            })
        }

        return JSONObject().apply {
            put("protocol", PROTOCOL_VERSION)
            put("device", deviceName)
            put("cursorInterval", intervals.lastOrNull()?.id ?: sinceInterval)
            put("cursorHeartRate", heartRate.lastOrNull()?.epochMillis ?: sinceHeart)
            put("intervals", intervalsJson)
            put("heartRate", heartRateJson)
        }.toString()
    }

    /**
     * The same data, flattened for Apple Shortcuts.
     *
     * Activity totals collapse to three scalars, each becoming one Log Health
     * Sample action. Heart rate is averaged per hour, turning a loop over
     * hundreds of points into a loop over a handful.
     */
    internal fun shortcutBody(): String {
        val sinceInterval = source.ackedIntervalId()
        val sinceHeart = source.ackedHeartRateTime()

        val range = source.intervalRange(sinceInterval)
        val heartRate = source.heartRateAfter(sinceHeart)

        val hourly = JSONArray()
        heartRate.groupBy { it.epochMillis / HOUR_MS }.toSortedMap().forEach { (hour, samples) ->
            hourly.put(JSONObject().apply {
                // Midpoint of the hour: a sane instant to attribute the average to.
                put("time", iso.format(Instant.ofEpochMilli(hour * HOUR_MS + HOUR_MS / 2)))
                put("bpm", Math.round(samples.sumOf { it.bpm } / samples.size * 10.0) / 10.0)
            })
        }

        return JSONObject().apply {
            put("device", deviceName)
            put("steps", Math.round(source.totalAfter(sinceInterval, SampleStore.DailyField.STEPS)))
            put("calories", source.totalAfter(sinceInterval, SampleStore.DailyField.CALORIES))
            put("distanceMeters", source.totalAfter(sinceInterval, SampleStore.DailyField.DISTANCE))
            // Shortcuts parses ISO 8601 directly; epoch millis would need arithmetic.
            put("windowStart", iso.format(Instant.ofEpochMilli(range?.first ?: nowFloor())))
            put("windowEnd", iso.format(Instant.ofEpochMilli(range?.second ?: System.currentTimeMillis())))
            put("heartRate", hourly)
            // Echoed back to /ack once the Shortcut has logged everything.
            put("cursorInterval", source.maxIntervalId())
            put("cursorHeartRate", heartRate.lastOrNull()?.epochMillis ?: sinceHeart)
            put("hasData", range != null || hourly.length() > 0)
        }.toString()
    }

    private fun nowFloor() = System.currentTimeMillis()

    private fun parseQuery(raw: String): Map<String, String> =
        raw.split('&')
            .filter { it.contains('=') }
            .associate { pair ->
                URLDecoder.decode(pair.substringBefore('='), "UTF-8") to
                    URLDecoder.decode(pair.substringAfter('='), "UTF-8")
            }

    private fun errorBody(message: String) = JSONObject().put("error", message).toString()

    /**
     * Serves the TCX with a filename, so Shortcuts and Safari save it as a file
     * rather than rendering the XML inline.
     */
    private fun respondFile(out: OutputStream, body: String, filename: String) {
        val bytes = body.toByteArray(Charsets.UTF_8)
        val header = buildString {
            append("HTTP/1.1 200 OK\r\n")
            append("Content-Type: application/vnd.garmin.tcx+xml\r\n")
            append("Content-Disposition: attachment; filename=\"$filename\"\r\n")
            append("Content-Length: ${bytes.size}\r\n")
            append("Connection: close\r\n")
            append("\r\n")
        }
        out.write(header.toByteArray(Charsets.US_ASCII))
        out.write(bytes)
        out.flush()
    }

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
        const val PROTOCOL_VERSION = 2
        const val DEFAULT_PORT = 8787
        private const val HOUR_MS = 3_600_000L
        private const val TAG = "SyncHttpServer"
    }
}
