package com.watchsync.wear

import java.time.Instant
import java.time.format.DateTimeFormatter

/**
 * Renders a run as Garmin TCX.
 *
 * TCX rather than GPX because it encodes laps as first-class elements with their
 * own distance, elapsed time and heart rate aggregates. GPX would carry the track
 * but push splits into vendor extensions, which importers treat inconsistently.
 * Strava, Garmin Connect and Runalyze all read TCX laps directly, so the splits
 * computed here survive the trip intact.
 *
 * Pace is deliberately not written: TCX has no pace element, and every consumer
 * derives it from DistanceMeters and TotalTimeSeconds. Emitting it would risk
 * disagreeing with the reader's own arithmetic.
 */
object TcxWriter {

    private val iso: DateTimeFormatter = DateTimeFormatter.ISO_INSTANT

    fun write(run: Run, points: List<Trackpoint>, splitMeters: Double = Splits.KILOMETRE): String {
        // Time splits from the run's own start, not the first sample — see Splits.compute.
        val splits = Splits.compute(points, splitMeters, run.startedAt)
        val sb = StringBuilder(points.size * 180)

        sb.append("""<?xml version="1.0" encoding="UTF-8"?>""").append('\n')
        sb.append(
            """<TrainingCenterDatabase """ +
                """xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" """ +
                """xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">"""
        ).append('\n')
        sb.append("  <Activities>\n")
        sb.append("""    <Activity Sport="Running">""").append('\n')
        sb.append("      <Id>").append(iso.format(Instant.ofEpochMilli(run.startedAt))).append("</Id>\n")

        if (splits.isEmpty()) {
            // A run too short to produce a split still deserves one lap, or
            // importers reject the file outright.
            appendLap(
                sb, run.startedAt, run.activeMillis / 1000.0, run.distanceMeters,
                run.calories, points, points
            )
        } else {
            splits.forEachIndexed { index, split ->
                // Half-open [start, end) so a point landing exactly on a lap
                // boundary belongs to one lap only. Emitting it in both would
                // duplicate a trackpoint and inflate distance for importers.
                // The final lap closes inclusively so the last point survives.
                val isLast = index == splits.lastIndex
                val lapPoints = points.filter {
                    it.epochMillis >= split.startMillis &&
                        if (isLast) it.epochMillis <= split.endMillis
                        else it.epochMillis < split.endMillis
                }
                appendLap(
                    sb = sb,
                    startMillis = split.startMillis,
                    totalSeconds = split.durationMillis / 1000.0,
                    distanceMeters = split.distanceMeters,
                    // Apportion calories by distance; Health Services reports
                    // them for the run, not per lap.
                    calories = if (run.distanceMeters > 0)
                        run.calories * (split.distanceMeters / run.distanceMeters) else 0.0,
                    lapPoints = lapPoints,
                    allPoints = points
                )
            }
        }

        sb.append("    </Activity>\n")
        sb.append("  </Activities>\n")
        sb.append("</TrainingCenterDatabase>\n")
        return sb.toString()
    }

    private fun appendLap(
        sb: StringBuilder,
        startMillis: Long,
        totalSeconds: Double,
        distanceMeters: Double,
        calories: Double,
        lapPoints: List<Trackpoint>,
        allPoints: List<Trackpoint>
    ) {
        val heartRates = lapPoints.mapNotNull { it.bpm }
        val maxSpeed = maxSpeed(lapPoints)

        sb.append("""      <Lap StartTime="""").append(iso.format(Instant.ofEpochMilli(startMillis))).append("\">\n")
        sb.append("        <TotalTimeSeconds>").append(round(totalSeconds, 2)).append("</TotalTimeSeconds>\n")
        sb.append("        <DistanceMeters>").append(round(distanceMeters, 2)).append("</DistanceMeters>\n")
        if (maxSpeed > 0) {
            sb.append("        <MaximumSpeed>").append(round(maxSpeed, 3)).append("</MaximumSpeed>\n")
        }
        sb.append("        <Calories>").append(Math.round(calories)).append("</Calories>\n")
        if (heartRates.isNotEmpty()) {
            sb.append("        <AverageHeartRateBpm><Value>")
                .append(Math.round(heartRates.average())).append("</Value></AverageHeartRateBpm>\n")
            sb.append("        <MaximumHeartRateBpm><Value>")
                .append(Math.round(heartRates.max())).append("</Value></MaximumHeartRateBpm>\n")
        }
        sb.append("        <Intensity>Active</Intensity>\n")
        sb.append("        <TriggerMethod>Distance</TriggerMethod>\n")
        sb.append("        <Track>\n")
        lapPoints.forEach { appendTrackpoint(sb, it) }
        sb.append("        </Track>\n")
        sb.append("      </Lap>\n")
    }

    private fun appendTrackpoint(sb: StringBuilder, point: Trackpoint) {
        sb.append("          <Trackpoint>\n")
        sb.append("            <Time>").append(iso.format(Instant.ofEpochMilli(point.epochMillis))).append("</Time>\n")
        if (point.latitude != null && point.longitude != null) {
            sb.append("            <Position>\n")
            sb.append("              <LatitudeDegrees>").append(round(point.latitude, 7)).append("</LatitudeDegrees>\n")
            sb.append("              <LongitudeDegrees>").append(round(point.longitude, 7)).append("</LongitudeDegrees>\n")
            sb.append("            </Position>\n")
        }
        point.altitudeMeters?.let {
            sb.append("            <AltitudeMeters>").append(round(it, 2)).append("</AltitudeMeters>\n")
        }
        sb.append("            <DistanceMeters>").append(round(point.distanceMeters, 2)).append("</DistanceMeters>\n")
        point.bpm?.let {
            sb.append("            <HeartRateBpm><Value>").append(Math.round(it)).append("</Value></HeartRateBpm>\n")
        }
        sb.append("          </Trackpoint>\n")
    }

    /** Fastest instantaneous speed between consecutive points, in m/s. */
    private fun maxSpeed(points: List<Trackpoint>): Double {
        var max = 0.0
        for (i in 1 until points.size) {
            val seconds = (points[i].epochMillis - points[i - 1].epochMillis) / 1000.0
            if (seconds <= 0) continue
            val metres = points[i].distanceMeters - points[i - 1].distanceMeters
            if (metres <= 0) continue
            max = maxOf(max, metres / seconds)
        }
        return max
    }

    private fun round(value: Double, places: Int): String {
        val factor = Math.pow(10.0, places.toDouble())
        return (Math.round(value * factor) / factor).toString()
    }
}
