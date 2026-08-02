# WatchSync wire protocol (v2)

A small read-only HTTP/JSON API served **by the watch**, consumed **by the
iPhone**, over the local Wi-Fi network. The watch is the server because it is the
only device that can collect the data; the phone pulls on demand.

## The central design decision: deltas, not totals

Health Services reports steps, calories and distance as **cumulative daily
totals** — a number that climbs all day and resets at midnight. The same day is
therefore reported many times with a larger value each time. Handing those to a
consumer means the consumer must *replace* what it wrote before, which requires
the ability to delete previously written samples.

Apple Shortcuts cannot delete health samples. That single limitation dictates the
protocol.

So the watch differences the totals at collection time and stores **append-only
interval deltas**: "142 steps between 14:05 and 14:20". Every record is immutable
once written, maps to exactly one HealthKit sample, and a day's records sum back
to the daily total. Nothing ever needs deleting, so both a native client and a
Shortcut can consume the same stream.

A total that moves *backwards* means the day rolled over, so the new value is
taken as the whole delta rather than producing a negative one.

## Delivery position lives on the watch

There is no client-side watermark. The watch tracks what has been acknowledged;
the client fetches whatever is outstanding and confirms with `/ack` once the data
is committed. Reinstalling the phone app therefore cannot silently skip data.

Acknowledged rows are deleted from the watch, which is also what keeps its
storage bounded.

### The known duplicate window

Acknowledgement happens *after* the write, which makes delivery **at-least-once**:

| Failure point | Result |
| --- | --- |
| Before writing | Redelivered next sync. No loss. |
| Between write and ack | Redelivered and written twice. **Duplicate.** |
| After ack | Nothing outstanding. Correct. |

The middle row is a real defect, not an oversight. Closing it needs the client to
deduplicate against what it has already stored, which the Shortcuts path cannot
do. Acking *before* writing would trade duplicates for silent data loss, which is
worse — an inflated number is visible, a missing one is not.

The window is milliseconds wide and only opens if the app or Shortcut dies
mid-run. `verify_protocol.py` asserts this behaviour explicitly so it stays a
documented property rather than a surprise.

## Discovery

The watch advertises over mDNS as `_watchsync._tcp` on port `8787`, which the
native client browses for with `NWBrowser`.

**Shortcuts has no Bonjour support**, so the Shortcut addresses the watch by IP.
The watch displays its own address on the pairing screen for this reason. A DHCP
reservation on your router keeps it from moving.

## Authentication

The watch generates a random 128-bit token on first launch and shows the first
6 characters as a pairing code. All endpoints except `/pair` require:

```
Authorization: Bearer <token>
```

This stops other devices on the same Wi-Fi from reading your health data. It is
not defence against someone who already controls your network — the transport is
plain HTTP, deliberately, since a self-signed certificate would add a trust
problem without adding real protection on a LAN.

### `GET /pair?code=<6-char code>`

The only unauthenticated endpoint, and only answered while the pairing screen is
open on the watch. That window is what bounds an unpaired device's chance to
claim the token.

```json
{ "token": "9f2c…", "device": "SM-R870" }
```

Returns `403` on a wrong code or a closed window.

## Endpoints

### `GET /health`

```json
{ "ok": true, "device": "SM-R870", "protocol": 2 }
```

### `GET /samples`

Everything unacknowledged, in full fidelity. For a native client.

```json
{
  "protocol": 2,
  "device": "SM-R870",
  "cursorInterval": 412,
  "cursorHeartRate": 1754140800000,
  "intervals": [
    { "start": 1754139000000, "end": 1754139900000, "field": "steps", "value": 142 }
  ],
  "heartRate": [
    { "t": 1754139000000, "bpm": 62.0 }
  ]
}
```

Cursors are taken from the rows actually returned, not from the store's current
maximum, so data arriving mid-response is carried to the next sync rather than
acknowledged unseen.

### `GET /shortcut`

The same data, flattened for Apple Shortcuts, which has no JSON path expressions,
cannot pass a variable into a health sample's type field, and loops slowly enough
that a few hundred heart rate points would take minutes.

Activity collapses to three scalars — one `Log Health Sample` action each — and
heart rate is averaged per hour. Timestamps are ISO 8601, which Shortcuts parses
directly.

```json
{
  "device": "SM-R870",
  "steps": 3184,
  "calories": 212.4,
  "distanceMeters": 2410.8,
  "windowStart": "2026-08-02T09:15:00Z",
  "windowEnd": "2026-08-02T14:20:00Z",
  "heartRate": [
    { "time": "2026-08-02T09:30:00Z", "bpm": 64.2 }
  ],
  "cursorInterval": 412,
  "cursorHeartRate": 1754140800000,
  "hasData": true
}
```

### `GET /ack?interval=<id>&heart=<epochMillis>`

Confirms delivery. Echo back the cursors from the response you just committed.
The watch retires those rows and will not send them again.

```json
{ "ok": true }
```

## Runs

Runs are a separate resource from the passive sample buffer, with a different
lifecycle: a sample is a transient reading that drains on acknowledgement,
whereas a run is a document that stays on the watch until you have exported it.

Splits are **derived, never stored**. Trackpoints carry cumulative distance, and
boundary crossings are linearly interpolated between the two points that straddle
them — so a kilometre boundary is accurate to well under a second even though it
almost never lands exactly on a sample. Changing the split distance re-slices an
existing run rather than requiring it to be re-recorded.

Pace is computed from distance and elapsed time rather than read from Health
Services' `PACE` data type, whose unit convention has moved between library
versions. TCX stores distance and time for the same reason.

### `GET /runs`

```json
{
  "device": "SM-R870",
  "runs": [
    {
      "id": 7,
      "start": "2026-08-02T07:15:00Z",
      "distanceMeters": 5420,
      "durationSeconds": 1632,
      "calories": 412,
      "exported": false,
      "tcx": "/runs/7.tcx"
    }
  ]
}
```

### `GET /runs/<id>[?split=mi]`

The split table, pre-formatted — Shortcuts cannot do arithmetic over a list
without a slow loop, so pace arrives ready to display. `split=mi` gives mile
splits; the default is kilometres.

```json
{
  "id": 7,
  "distanceMeters": 5420,
  "durationSeconds": 1632,
  "averagePace": "5:01",
  "hasRoute": true,
  "splits": [
    { "index": 1, "distanceMeters": 1000, "durationSeconds": 295,
      "pace": "4:55", "averageBpm": 152, "maxBpm": 161, "partial": false },
    { "index": 6, "distanceMeters": 420, "durationSeconds": 132,
      "pace": "5:14", "averageBpm": 168, "maxBpm": 174, "partial": true }
  ],
  "tcx": "/runs/7.tcx"
}
```

### `GET /runs/<id>.tcx[?split=mi]`

The run as Garmin TCX, served with a filename so it saves as a file rather than
rendering inline.

TCX rather than GPX because it encodes laps as first-class elements carrying
their own distance, elapsed time and heart rate aggregates. GPX would carry the
track but push splits into vendor extensions that importers treat inconsistently.
Strava, Garmin Connect and Runalyze all read TCX laps directly.

Each trackpoint appears in exactly one lap — lap ranges are half-open — because a
point emitted in two laps duplicates distance for importers.

### `GET /runs/<id>/exported` and `GET /runs/<id>/delete`

Mark a run as exported, or remove it and its trackpoints from the watch.

## What is deliberately absent

Sleep, stress, blood oxygen, ECG and body composition are not here because Wear OS
does not expose them to third-party apps. They are computed by Samsung's
proprietary algorithms behind the partner-only Privileged Health SDK. No amount of
protocol design recovers them.
