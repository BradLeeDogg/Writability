package com.watchsync.wear

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

/**
 * Recorded runs and their trackpoints.
 *
 * Separate database from [SampleStore] because the two have unrelated
 * lifecycles: passive samples are a rolling buffer that drains on acknowledgement,
 * whereas a run is a document that stays until the user has exported it.
 *
 * Trackpoints carry *cumulative* distance, matching what Health Services reports
 * and what TCX expects. Splits are derived from them rather than stored, so
 * changing the split distance re-slices an existing run instead of requiring it
 * to be re-recorded.
 */
class RunStore(context: Context) :
    SQLiteOpenHelper(context.applicationContext, "watchsync_runs.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE runs (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at   INTEGER NOT NULL,
                ended_at     INTEGER,
                active_ms    INTEGER NOT NULL DEFAULT 0,
                distance_m   REAL    NOT NULL DEFAULT 0,
                calories     REAL    NOT NULL DEFAULT 0,
                exported     INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE trackpoints (
                run_id     INTEGER NOT NULL,
                t          INTEGER NOT NULL,
                distance_m REAL    NOT NULL,
                lat        REAL,
                lon        REAL,
                altitude_m REAL,
                bpm        REAL,
                PRIMARY KEY (run_id, t)
            )
            """.trimIndent()
        )
        db.execSQL("CREATE INDEX idx_tp_run ON trackpoints(run_id, t)")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

    fun startRun(startedAt: Long): Long =
        writableDatabase.insert(
            "runs", null,
            ContentValues().apply { put("started_at", startedAt) }
        )

    /**
     * Trackpoints are keyed by (run, timestamp), so a duplicate delivery for the
     * same instant overwrites rather than creating a second point at the same
     * time — which would corrupt split interpolation.
     */
    fun addTrackpoint(runId: Long, point: Trackpoint) {
        writableDatabase.insertWithOnConflict(
            "trackpoints", null,
            ContentValues().apply {
                put("run_id", runId)
                put("t", point.epochMillis)
                put("distance_m", point.distanceMeters)
                point.latitude?.let { put("lat", it) }
                point.longitude?.let { put("lon", it) }
                point.altitudeMeters?.let { put("altitude_m", it) }
                point.bpm?.let { put("bpm", it) }
            },
            SQLiteDatabase.CONFLICT_REPLACE
        )
    }

    fun finishRun(runId: Long, endedAt: Long, activeMillis: Long, distanceM: Double, calories: Double) {
        writableDatabase.update(
            "runs",
            ContentValues().apply {
                put("ended_at", endedAt)
                put("active_ms", activeMillis)
                put("distance_m", distanceM)
                put("calories", calories)
            },
            "id = ?", arrayOf(runId.toString())
        )
    }

    /** Completed runs, newest first. In-progress runs are excluded. */
    fun runs(): List<Run> =
        readableDatabase.rawQuery(
            "SELECT id, started_at, ended_at, active_ms, distance_m, calories, exported " +
                "FROM runs WHERE ended_at IS NOT NULL ORDER BY started_at DESC LIMIT 50",
            null
        ).use { c ->
            buildList {
                while (c.moveToNext()) {
                    add(
                        Run(
                            id = c.getLong(0),
                            startedAt = c.getLong(1),
                            endedAt = c.getLong(2),
                            activeMillis = c.getLong(3),
                            distanceMeters = c.getDouble(4),
                            calories = c.getDouble(5),
                            exported = c.getInt(6) != 0
                        )
                    )
                }
            }
        }

    fun run(id: Long): Run? = runs().firstOrNull { it.id == id }

    fun trackpoints(runId: Long): List<Trackpoint> =
        readableDatabase.rawQuery(
            "SELECT t, distance_m, lat, lon, altitude_m, bpm FROM trackpoints " +
                "WHERE run_id = ? ORDER BY t ASC",
            arrayOf(runId.toString())
        ).use { c ->
            buildList {
                while (c.moveToNext()) {
                    add(
                        Trackpoint(
                            epochMillis = c.getLong(0),
                            distanceMeters = c.getDouble(1),
                            latitude = if (c.isNull(2)) null else c.getDouble(2),
                            longitude = if (c.isNull(3)) null else c.getDouble(3),
                            altitudeMeters = if (c.isNull(4)) null else c.getDouble(4),
                            bpm = if (c.isNull(5)) null else c.getDouble(5)
                        )
                    )
                }
            }
        }

    fun markExported(runId: Long) {
        writableDatabase.update(
            "runs",
            ContentValues().apply { put("exported", 1) },
            "id = ?", arrayOf(runId.toString())
        )
    }

    fun delete(runId: Long) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.delete("trackpoints", "run_id = ?", arrayOf(runId.toString()))
            db.delete("runs", "id = ?", arrayOf(runId.toString()))
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }
}

data class Run(
    val id: Long,
    val startedAt: Long,
    val endedAt: Long,
    val activeMillis: Long,
    val distanceMeters: Double,
    val calories: Double,
    val exported: Boolean
)

data class Trackpoint(
    val epochMillis: Long,
    val distanceMeters: Double,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val altitudeMeters: Double? = null,
    val bpm: Double? = null
)
