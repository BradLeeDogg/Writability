package com.watchsync.wear

/**
 * Slices a run's trackpoints into distance splits.
 *
 * Splits are *derived*, never recorded. Trackpoints arrive at whatever cadence
 * Health Services delivers them — typically around 1 Hz, but not guaranteed —
 * so a kilometre boundary almost never falls exactly on a sample. Each boundary
 * crossing is therefore linearly interpolated between the two points that
 * straddle it, which keeps split times accurate to well under a second even when
 * sampling is irregular.
 *
 * Pace is computed here from distance and elapsed time rather than read from
 * Health Services' PACE data type. That avoids depending on the unit convention
 * of a field whose meaning has shifted between library versions, and matches what
 * TCX stores — distance and time, with pace left to the reader.
 */
object Splits {

    const val KILOMETRE = 1000.0
    const val MILE = 1609.344

    /**
     * @param points cumulative-distance trackpoints in ascending time order
     * @param splitMeters boundary spacing, e.g. [KILOMETRE]
     * @param originMillis when the run actually began. The first sample often
     *   lands several seconds in and already some distance along, while GPS is
     *   still settling; timing the opening split from that sample drops
     *   everything before it and reports a first kilometre that is too fast by
     *   however long the lock took. Ignored if it is later than the first
     *   sample, so a bad clock cannot stretch the split instead.
     */
    fun compute(
        points: List<Trackpoint>,
        splitMeters: Double,
        originMillis: Long? = null
    ): List<Split> {
        if (points.size < 2 || splitMeters <= 0) return emptyList()

        val totalDistance = points.last().distanceMeters
        if (totalDistance <= 0) return emptyList()

        val splits = mutableListOf<Split>()
        var splitStartTime = originMillis?.takeIf { it <= points.first().epochMillis }
            ?: points.first().epochMillis
        var splitStartDistance = 0.0
        var boundary = splitMeters
        var cursor = 1

        while (boundary <= totalDistance) {
            // Advance to the first point at or beyond this boundary.
            while (cursor < points.size && points[cursor].distanceMeters < boundary) cursor++
            if (cursor >= points.size) break

            val crossingTime = interpolateTime(points[cursor - 1], points[cursor], boundary)
            splits += build(
                index = splits.size + 1,
                points = points,
                startTime = splitStartTime,
                endTime = crossingTime,
                distance = boundary - splitStartDistance
            )

            splitStartTime = crossingTime
            splitStartDistance = boundary
            boundary += splitMeters
        }

        // Whatever is left after the last full boundary. Reported so a 5.4 km run
        // shows its final 400 m rather than silently discarding it.
        val remainder = totalDistance - splitStartDistance
        if (remainder > 1.0) {
            splits += build(
                index = splits.size + 1,
                points = points,
                startTime = splitStartTime,
                endTime = points.last().epochMillis,
                distance = remainder,
                partial = true
            )
        }

        return splits
    }

    /**
     * Time at which cumulative distance [target] was reached, linearly
     * interpolated between two straddling points.
     */
    private fun interpolateTime(before: Trackpoint, after: Trackpoint, target: Double): Long {
        val distanceSpan = after.distanceMeters - before.distanceMeters
        // Two points at the same distance (a pause) give no basis to interpolate.
        if (distanceSpan <= 0) return after.epochMillis
        val fraction = (target - before.distanceMeters) / distanceSpan
        val timeSpan = after.epochMillis - before.epochMillis
        return before.epochMillis + Math.round(fraction * timeSpan)
    }

    private fun build(
        index: Int,
        points: List<Trackpoint>,
        startTime: Long,
        endTime: Long,
        distance: Double,
        partial: Boolean = false
    ): Split {
        val within = points.filter { it.epochMillis in startTime..endTime && it.bpm != null }
        val heartRates = within.mapNotNull { it.bpm }
        val durationMs = (endTime - startTime).coerceAtLeast(0)

        return Split(
            index = index,
            startMillis = startTime,
            endMillis = endTime,
            distanceMeters = distance,
            durationMillis = durationMs,
            averageBpm = heartRates.average().takeIf { heartRates.isNotEmpty() },
            maxBpm = heartRates.maxOrNull(),
            partial = partial
        )
    }
}

data class Split(
    val index: Int,
    val startMillis: Long,
    val endMillis: Long,
    val distanceMeters: Double,
    val durationMillis: Long,
    val averageBpm: Double?,
    val maxBpm: Double?,
    val partial: Boolean
) {
    /** Seconds per kilometre — the number runners actually read. */
    val paceSecondsPerKm: Double
        get() = if (distanceMeters <= 0) 0.0
        else (durationMillis / 1000.0) / (distanceMeters / 1000.0)

    val speedMetersPerSecond: Double
        get() = if (durationMillis <= 0) 0.0 else distanceMeters / (durationMillis / 1000.0)

    /** `5:32` — pace formatted the conventional way. */
    fun formattedPace(): String {
        val total = Math.round(paceSecondsPerKm)
        return "%d:%02d".format(total / 60, total % 60)
    }
}
