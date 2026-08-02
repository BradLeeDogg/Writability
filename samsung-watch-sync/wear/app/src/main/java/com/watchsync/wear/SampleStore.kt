package com.watchsync.wear

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * On-watch buffer for collected samples.
 *
 * Plain SQLite rather than Room: this schema is two tables and never migrates in
 * anger, and avoiding the annotation processor keeps the Wear build simple.
 *
 * The two tables have deliberately different semantics, mirroring PROTOCOL.md:
 * heart rate is append-only, daily totals are upserted in place because Health
 * Services restates them as they climb through the day.
 */
class SampleStore(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "watchsync.db", null, 1) {

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
            CREATE TABLE daily (
                date       TEXT PRIMARY KEY,
                updated_at INTEGER NOT NULL,
                steps      INTEGER NOT NULL DEFAULT 0,
                calories   REAL    NOT NULL DEFAULT 0,
                distance   REAL    NOT NULL DEFAULT 0
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX idx_daily_updated ON daily(updated_at)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        // No released versions to migrate from yet.
    }

    /**
     * Heart rate readings are keyed by timestamp, so a duplicate delivery of the
     * same instant collapses rather than double-counting.
     */
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
     * Upsert one field of a day's running totals. Health Services reports each
     * aggregate independently, so we merge per-field rather than replacing the row.
     */
    fun updateDaily(date: String, updatedAt: Long, field: DailyField, value: Double) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.execSQL(
                "INSERT OR IGNORE INTO daily(date, updated_at) VALUES(?, ?)",
                arrayOf(date, updatedAt)
            )
            db.execSQL(
                "UPDATE daily SET ${field.column} = ?, updated_at = ? WHERE date = ?",
                arrayOf(value, updatedAt, date)
            )
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun heartRateSince(since: Long): List<HeartRateSample> =
        readableDatabase.rawQuery(
            "SELECT t, bpm FROM heart_rate WHERE t > ? ORDER BY t ASC LIMIT 5000",
            arrayOf(since.toString())
        ).use { c ->
            buildList {
                while (c.moveToNext()) add(HeartRateSample(c.getLong(0), c.getDouble(1)))
            }
        }

    fun dailySince(since: Long): List<DailyTotals> =
        readableDatabase.rawQuery(
            "SELECT date, updated_at, steps, calories, distance FROM daily " +
                "WHERE updated_at > ? ORDER BY date ASC",
            arrayOf(since.toString())
        ).use { c ->
            buildList {
                while (c.moveToNext()) {
                    add(
                        DailyTotals(
                            date = c.getString(0),
                            updatedAt = c.getLong(1),
                            steps = c.getLong(2),
                            calories = c.getDouble(3),
                            distanceMeters = c.getDouble(4)
                        )
                    )
                }
            }
        }

    /**
     * The largest timestamp the phone will have seen once it commits the current
     * response. Returned to the client as its next `since`.
     */
    fun watermark(): Long =
        readableDatabase.rawQuery(
            "SELECT MAX(m) FROM (" +
                "SELECT IFNULL(MAX(t), 0) AS m FROM heart_rate " +
                "UNION ALL SELECT IFNULL(MAX(updated_at), 0) FROM daily)",
            null
        ).use { c -> if (c.moveToFirst()) c.getLong(0) else 0L }

    /**
     * Drop heart rate readings the phone has already taken, so the watch's storage
     * stays bounded. Daily rows are kept — they are tiny and get restated.
     */
    fun pruneHeartRateBefore(cutoff: Long) {
        writableDatabase.delete("heart_rate", "t <= ?", arrayOf(cutoff.toString()))
    }

    enum class DailyField(val column: String) {
        STEPS("steps"),
        CALORIES("calories"),
        DISTANCE("distance")
    }
}

data class HeartRateSample(val epochMillis: Long, val bpm: Double)

data class DailyTotals(
    val date: String,
    val updatedAt: Long,
    val steps: Long,
    val calories: Double,
    val distanceMeters: Double
)
