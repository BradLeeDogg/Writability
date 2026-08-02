# WatchSync wire protocol

A tiny read-only HTTP/JSON API served **by the watch**, consumed **by the iPhone**,
over the local Wi-Fi network. The watch is the server because it is the only device
that can collect the data; the phone pulls on demand.

## Discovery

The watch advertises via mDNS/Bonjour:

- Service type: `_watchsync._tcp`
- Port: `8787` (fixed; changed only if already bound)
- TXT record: `v=1`

The phone browses for `_watchsync._tcp`, resolves the first result to a host/port,
and talks plain HTTP to it. No TLS: traffic never leaves the LAN, and a self-signed
cert would add a trust-prompt problem without adding meaningful protection here.

## Authentication

The watch generates a random 128-bit token on first launch and displays the first
6 characters as a pairing code. The phone stores the full token after pairing.

Every request must carry:

```
Authorization: Bearer <token>
```

Missing or wrong token returns `401`. This exists so that other devices on the same
Wi-Fi (a guest laptop, a smart TV) cannot read your health data by scanning for the
service. It is not defence against an attacker who already controls your network.

### `GET /pair?code=<6-char code>`

The one endpoint that does **not** require the bearer token. Returns the full token
if `code` matches the displayed pairing code. The watch only answers this while the
pairing screen is open on the watch, which bounds the window in which an unpaired
device can claim the token.

```json
{ "token": "9f2c...", "device": "Galaxy Watch4" }
```

Wrong code or pairing screen closed returns `403`.

## Endpoints

### `GET /health`

Liveness check. Returns `200` with:

```json
{ "ok": true, "device": "Galaxy Watch4", "protocol": 1 }
```

### `GET /samples?since=<epochMillis>`

Returns everything recorded strictly after `since`. Pass `since=0` for a full dump.

```json
{
  "protocol": 1,
  "device": "Galaxy Watch4",
  "watermark": 1754140800000,
  "heartRate": [
    { "t": 1754139000000, "bpm": 62.0 },
    { "t": 1754139300000, "bpm": 71.0 }
  ],
  "daily": [
    {
      "date": "2026-08-02",
      "updatedAt": 1754140800000,
      "steps": 8431,
      "calories": 412.5,
      "distanceMeters": 6234.1
    }
  ]
}
```

`watermark` is the timestamp the client should send as `since` on its next call.
The client persists it only after every sample in the response has been committed
to HealthKit, so a crash mid-write causes re-delivery rather than silent loss.

## The two sample shapes, and why they differ

**`heartRate` is append-only.** Each entry is a discrete reading at an instant.
The phone writes each one to HealthKit once and never revisits it. Deduplication is
purely the `since` watermark.

**`daily` is a running total that gets restated.** Health Services reports steps,
calories and distance as cumulative daily aggregates that climb all day and reset at
midnight. The same `date` will therefore be returned repeatedly with a larger value,
and naively appending each one to HealthKit would multiply your step count several
times over.

So the phone treats `daily` as a **replace**, not an append: for each returned date it
deletes the samples it previously wrote for that day, then writes the new total as a
single sample spanning that day. HealthKit permits an app to delete samples it
authored, so this is idempotent — replaying the same response yields the same result.
This is the single most important correctness detail in the protocol.

## What is deliberately absent

Sleep, stress, blood oxygen, ECG and body composition are not here because Wear OS
does not expose them to third-party apps. They are computed by Samsung's proprietary
algorithms behind the partner-only Privileged Health SDK. No amount of protocol design
recovers them.
