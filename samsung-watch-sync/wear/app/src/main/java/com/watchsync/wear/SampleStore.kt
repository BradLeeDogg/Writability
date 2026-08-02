package com.watchsync.wear

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * On-watch buffer for collected samples.
 *
 * The important design decision lives here: Health Services reports steps,
 * calories and distance as *cumulative daily totals* that climb all day and
 * reset at midnight. Storing them that way forces every consumer to handle
 * restatement, which Apple Shortcuts cannot do — it has no way to delete a
 * previously written health sample.
 *
 * So totals are converted to **append-only interval deltas** at collection
 * time: "142 steps between 14:05 and 14:20". Every row is immutable once
 * written, each maps to exactly one HealthKit sample, and summing a day's rows
 * reproduces the daily total. `daily_progress` holds the bookkeeping needed to
 * turn one representation into the other.
 */
class SampleStore(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "watchsync.db", null, 2) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE heart_rate (
                t   INTEGER PRIMARY KEY,
                bpm REAL NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE intervals (
                id       INTEGER PRIMARY KEY AUTOINCREMENT,
                start_ms INTEGER NOT NULL,
                end_ms   INTEGER NOT NULL,
                field    TEXT    NOT NULL,
                value    REAL    NOT NULL
            )
            """.trimIndent()
        )
        // Last cumulative total seen per (day, field), so the next delivery can
        // be differenced against it.
        db.execSQL(
            """
            CREATE TABLE daily_progress (
                date       TEXT NOT NULL,
                field      TEXT NOT NULL,
                last_total REAL NOT NULL,
                last_time  INTEGER NOT NULL,
                PRIMARY KEY (date, field)
            )
            """.trimIndent()
        )
        db.execSQL("CREATE TABLE sync_state (key TEXT PRIMARY KEY, value INTEGER NOT NULL)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // v1 stored restated daily totals; the delta model supersedes it and the
        // buffer is a cache, not a system of record.
        db.execSQL("DROP TABLE IF EXISTS daily")
        onCreate(db)
    }

    // MARK: - Writes

    fun insertHeartRate(epochMillis: Long, bpm: Double) {
        writableDatabase.insertWithOnConflict(
            "heart_rate",
            null,
            ContentValues().apply {
                put("t", epochMillis)
                put("bpm", bpm)
            },
            SQLiteDatabase.CONFLICT_REPLACE
        )
    }

    /**
     * Records a cumulative total, converting it to an interval delta.
     *
     * Returns silently when the total has not moved, so idle periods don't
     * accumulate zero-valued rows.
     */
    fun recordCumulative(date: String, field: DailyField, total: Double, atMillis: Long) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val cursor = db.rawQuery(
                "SELECT last_total, last_time FROM daily_progress WHERE date = ? AND field = ?",
                arrayOf(date, field.key)
            )
            val (previousTotal, previousTime) = cursor.use { c ->
                if (c.moveToFirst()) c.getDouble(0) to c.getLong(1) else 0.0 to 0L
            }

            // A total that moves backwards means the day rolled over or the
            // counter reset; treat the new value as the whole delta rather than
            // emitting a negative one.
            val delta = if (total < previousTotal) total else total - previousTotal

            if (delta > 0) {
                db.insert(
                    "intervals",
                    null,
                    ContentValues().apply {
                        // First delta of a day has no predecessor to span from.
                        put("start_ms", if (previousTime > 0) previousTime else atMillis)
                        put("end_ms", atMillis)
                        put("field", field.key)
                        put("value", delta)
                    }
                )
            }

            db.insertWithOnConflict(
                "daily_progress",
                null,
                ContentValues().apply {
                    put("date", date)
                    put("field", field.key)
                    put("last_total", total)
                    put("last_time", atMillis)
                },
                SQLiteDatabase.CONFLICT_REPLACE
            )
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    // MARK: - Reads

    fun heartRateAfter(t: Long, limit: Int = 5000): List<HeartRateSample> =
        readableDatabase.rawQuery(
            "SELECT t, bpm FROM heart_rate WHERE t > ? ORDER BY t ASC LIMIT ?",
            arrayOf(t.toString(), limit.toString())
        ).use { c ->
            buildList {
                while (c.moveToNext()) add(HeartRateSample(c.getLong(0), c.getDouble(1)))
            }
        }

    fun intervalsAfter(id: Long, limit: Int = 2000): List<IntervalSample> =
        readableDatabase.rawQuery(
            "SELECT id, start_ms, end_ms, field, value FROM intervals " +
                "WHERE id > ? ORDER BY id ASC LIMIT ?",
            arrayOf(id.toString(), limit.toString())
        ).use { c ->
            buildList {
                while (c.moveToNext()) {
                    add(
                        IntervalSample(
                            id = c.getLong(0),
                            startMillis = c.getLong(1),
                            endMillis = c.getLong(2),
                            field = c.getString(3),
                            value = c.getDouble(4)
                        )
                    )
                }
            }
        }

    /** Sum of a field's deltas after [id] — what the Shortcut path consumes. */
    fun totalAfter(id: Long, field: DailyField): Double =
        readableDatabase.rawQuery(
            "SELECT IFNULL(SUM(value), 0) FROM intervals WHERE id > ? AND field = ?",
            arrayOf(id.toString(), field.key)
        ).use { c -> if (c.moveToFirst()) c.getDouble(0) else 0.0 }

    fun intervalRange(id: Long): Pair<Long, Long>? =
        readableDatabase.rawQuery(
            "SELECT MIN(start_ms), MAX(end_ms) FROM intervals WHERE id > ?",
            arrayOf(id.toString())
        ).use { c ->
            if (c.moveToFirst() && !c.isNull(0)) c.getLong(0) to c.getLong(1) else null
        }

    fun maxIntervalId(): Long =
        readableDatabase.rawQuery("SELECT IFNULL(MAX(id), 0) FROM intervals", null)
            .use { c -> if (c.moveToFirst()) c.getLong(0) else 0L }

    fun maxHeartRateTime(): Long =
        readableDatabase.rawQuery("SELECT IFNULL(MAX(t), 0) FROM heart_rate", null)
            .use { c -> if (c.moveToFirst()) c.getLong(0) else 0L }

    // MARK: - Acknowledgement

    /**
     * The client confirms it has committed everything up to this point. Only
     * then does the watch consider those rows delivered.
     *
     * Deliberately at-least-once: acking after the write means a crash in the
     * gap between them re-delivers rather than drops. See the duplicate-window
     * note in PROTOCOL.md.
     */
    fun acknowledge(intervalId: Long, heartRateTime: Long) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            setState(db, STATE_ACKED_INTERVAL, intervalId)
            setState(db, STATE_ACKED_HEART_RATE, heartRateTime)
            // Delivered rows are dead weight on a watch; drop them.
            db.delete("intervals", "id <= ?", arrayOf(intervalId.toString()))
            db.delete("heart_rate", "t <= ?", arrayOf(heartRateTime.toString()))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun ackedIntervalId(): Long = getState(STATE_ACKED_INTERVAL)
    fun ackedHeartRateTime(): Long = getState(STATE_ACKED_HEART_RATE)

    private fun setState(db: SQLiteDatabase, key: String, value: Long) {
        db.insertWithOnConflict(
            "sync_state",
            null,
            ContentValues().apply {
                put("key", key)
                put("value", value)
            },
            SQLiteDatabase.CONFLICT_REPLACE
        )
    }

    private fun getState(key: String): Long =
        readableDatabase.rawQuery(
            "SELECT value FROM sync_state WHERE key = ?",
            arrayOf(key)
        ).use { c -> if (c.moveToFirst()) c.getLong(0) else 0L }

    enum class DailyField(val key: String) {
        STEPS("steps"),
        CALORIES("calories"),
        DISTANCE("distance");

        companion object {
            fun from(key: String) = entries.firstOrNull { it.key == key }
        }
    }

    companion object {
        private const val STATE_ACKED_INTERVAL = "acked_interval"
        private const val STATE_ACKED_HEART_RATE = "acked_heart_rate"
    }
}

data class HeartRateSample(val epochMillis: Long, val bpm: Double)

data class IntervalSample(
    val id: Long,
    val startMillis: Long,
    val endMillis: Long,
    val field: String,
    val value: Double
)
