package com.watchsync.wear

import android.os.SystemClock
import android.util.Log
import androidx.health.services.client.PassiveListenerService
import androidx.health.services.client.data.DataPointContainer
import androidx.health.services.client.data.DataType
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Receives passive sensor data from Health Services.
 *
 * Health Services restarts this service on its own schedule, including after the
 * app process has been killed, which is why collection lives here rather than in
 * [SyncService]. Data accumulates in [SampleStore] whether or not the phone is
 * around to ask for it.
 *
 * This is the ceiling of what a third-party app can see on a Galaxy Watch4:
 * heart rate plus the daily activity aggregates. Sleep, stress, SpO2, ECG and
 * body composition are computed by Samsung's proprietary algorithms and are not
 * exposed through Health Services.
 */
class HealthCollectorService : PassiveListenerService() {

    private val dayFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd")

    override fun onNewDataPointsReceived(dataPoints: DataPointContainer) {
        val store = SampleStore(this)
        // Health Services stamps data points against boot-relative time; this
        // converts to wall clock. Recomputed per delivery so clock adjustments
        // between batches don't skew older readings.
        val bootInstant = Instant.now().minusNanos(SystemClock.elapsedRealtimeNanos())

        try {
            dataPoints.getData(DataType.HEART_RATE_BPM).forEach { point ->
                val t = point.getTimeInstant(bootInstant).toEpochMilli()
                // Health Services emits 0.0 when the sensor has no contact with skin.
                if (point.value > 0.0) store.insertHeartRate(t, point.value)
            }

            dataPoints.getData(DataType.STEPS_DAILY).forEach { point ->
                store.updateDaily(
                    date = point.dayOf(bootInstant),
                    updatedAt = point.getEndInstant(bootInstant).toEpochMilli(),
                    field = SampleStore.DailyField.STEPS,
                    value = point.value.toDouble()
                )
            }

            dataPoints.getData(DataType.CALORIES_DAILY).forEach { point ->
                store.updateDaily(
                    date = point.dayOf(bootInstant),
                    updatedAt = point.getEndInstant(bootInstant).toEpochMilli(),
                    field = SampleStore.DailyField.CALORIES,
                    value = point.value
                )
            }

            dataPoints.getData(DataType.DISTANCE_DAILY).forEach { point ->
                store.updateDaily(
                    date = point.dayOf(bootInstant),
                    updatedAt = point.getEndInstant(bootInstant).toEpochMilli(),
                    field = SampleStore.DailyField.DISTANCE,
                    value = point.value
                )
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to persist passive data batch", e)
        } finally {
            store.close()
        }
    }

    private fun androidx.health.services.client.data.IntervalDataPoint<*>.dayOf(
        bootInstant: Instant
    ): String = getEndInstant(bootInstant)
        .atZone(ZoneId.systemDefault())
        .toLocalDate()
        .format(dayFormat)

    companion object {
        private const val TAG = "HealthCollector"
    }
}
