# WatchSync

Copies health data from a Galaxy Watch4 to an iPhone over local Wi-Fi, writing it
into Apple Health. No cloud service, no account, and no Android phone in the loop.

```
Galaxy Watch4                          iPhone
┌──────────────────────────┐           ┌────────────────────────────┐
│ Health Services (passive)│           │ Apple Shortcuts            │
│          ↓               │  Wi-Fi    │   Get Contents of URL      │
│ SampleStore  (deltas)    │ ────────► │   Log Health Sample        │
│          ↓               │   LAN     │   → Apple Health           │
│ SyncHttpServer  :8787    │           │   GET /ack                 │
└──────────────────────────┘           └────────────────────────────┘
```

The watch collects continuously and buffers locally. The phone pulls when you run
the shortcut, writes to Health, then acknowledges so the watch can discard what it
sent.

## Two ways to build the phone side

**[Apple Shortcuts](SHORTCUT.md) — no Mac required.** Built entirely on the
iPhone: fetch JSON, log health samples, acknowledge. Can be automated on a
schedule. This is the recommended path unless you own a Mac.

**A native iOS app** (`ios/WatchSync/`) — Swift, with Bonjour discovery and
per-reading heart rate instead of hourly averages. Requires a Mac with Xcode and
an Apple Developer account. Included because it is the better client if you ever
have the toolchain; it is *not* buildable on Windows or Linux.

Both speak the same [protocol](PROTOCOL.md).

## Read this before you build anything

**This does not sync Samsung Health.** It cannot. Samsung Health's database is
sandboxed from third-party apps, and the SDKs that would open it (Samsung Health
Data SDK, Privileged Health SDK) are gated behind a partner programme that is not
currently accepting applications.

What this app does instead is collect *its own* data from the watch's sensors via
Google's Health Services API, which is open to any app. That means:

| Available | Not available |
| --- | --- |
| Heart rate | Sleep and sleep stages |
| Steps | Stress |
| Active energy | Blood oxygen (SpO2) |
| Distance | ECG |
| GPS route, pace, splits | Body composition (BIA) |

The missing column is Samsung's proprietary algorithms, not an oversight in this
code. No transport, protocol or permission recovers them.

Your numbers will also drift slightly from what the watch face shows, because this
app samples the same sensors independently rather than reading Samsung's results.

## Runs

Two modes, and they are genuinely different — not one feature with a flag.

**All-day collection** uses `PassiveMonitoringClient`: cheap, batched, sensor
only, never turns on GPS, and has no concept of a workout.

**Runs** use `ExerciseClient`, which pins the sensors and the GPS receiver on for
the duration. That is what makes pace and a route possible, and also why a run is
started and stopped deliberately from the **Run** app on the watch rather than
left running.

Splits are derived from trackpoints by interpolating each distance boundary
between the two samples that straddle it, so a kilometre split is accurate even
though the boundary almost never lands exactly on a sample. Kilometres by
default; add `?split=mi` for miles. Changing the split distance re-slices an
existing run — nothing needs re-recording.

Runs export as **TCX**, which carries laps, route and per-lap heart rate. Upload
to Strava for pace, splits and a map; Strava can then push the workout into Apple
Health. Splits cannot go into Apple Health directly — Shortcuts' `Log Workout`
takes only date, duration, calories and distance.

Two constraints worth knowing before your first run:

- **Only one exercise session may be active device-wide.** Starting a run here
  while Samsung Health is tracking a workout will fail. That is a platform rule,
  not something this app can arbitrate.
- **GPS is expensive.** An hour of recording with GPS costs far more battery than
  a day of passive collection. Without a fix the run still records — distance
  comes from step estimation and pace still works — but there is no map.

Auto-pause is deliberately off. It silently stops the clock at traffic lights,
which makes recorded splits disagree with a stopwatch.

## Requirements

- Galaxy Watch4 (or later Wear OS Galaxy Watch), **already set up**. The watch
  cannot complete first-time setup without an Android phone — but if yours is
  already running, you do not need one again.
- A Windows or Linux computer, for Android Studio and ADB.
- Both devices on the same Wi-Fi, with client isolation (AP isolation) off. Most
  home routers are fine; guest and public networks usually are not.
- For the optional native iOS app only: a Mac with Xcode and an Apple Developer
  account.

## Building and installing the watch app

```bash
cd wear
./gradlew :app:assembleDebug          # gradlew.bat on Windows
```

The wrapper is committed, so this pulls its own Gradle (8.9) and needs only a JDK
(17–21) on the machine. Everything else — the Android SDK, the platform and build
tools — comes from Android Studio, which is where `local.properties` or
`ANDROID_HOME` gets pointed at your SDK. Opening `wear/` in Android Studio and
letting it sync is the least fiddly route.

On the watch, enable developer access — no phone needed:

1. Settings → About watch → Software → tap **Software version** seven times
2. Settings → Developer options → enable **ADB debugging** and **Wireless debugging**
3. Tap Wireless debugging to see the IP and port

Then from your computer, with the Android platform tools installed:

```bash
adb connect <watch-ip>:<port>
adb install app/build/outputs/apk/debug/app-debug.apk
```

Launch WatchSync on the watch and grant sensor permissions. It shows a pairing
code and the watch's address, and starts collecting immediately.

Next: **[SHORTCUT.md](SHORTCUT.md)**.

## Reliability, honestly

**Sync is manual or scheduled, never continuous.** You run the shortcut, or a
time-of-day automation runs it. That is a deliberate limit, not a missing feature.

**The watch is not always reachable.** Wear OS aggressively powers down the Wi-Fi
radio when the screen is off and the watch is on battery. `SyncService` holds a
`WIFI_MODE_FULL_HIGH_PERF` lock and a multicast lock and runs in the foreground,
which helps but does not win outright. In practice the watch answers most reliably
while charging or with the screen on. Syncing once a day while it sits on the
charger works well; expecting a response at 3am on battery does not.

**Collection continues regardless.** Data accumulates on the watch whether or not
the phone can reach it, so an unreachable watch delays a sync rather than losing
anything. Rows are deleted only once acknowledged.

**Delivery is at-least-once.** A crash in the gap between writing to Health and
acknowledging will duplicate that batch. The window is milliseconds and the
alternative — acknowledging first — would trade visible duplicates for silent
loss. See PROTOCOL.md for why this is not fixable on the Shortcuts path.

**Battery.** Passive monitoring rather than an active exercise session, which is
the difference between a modest background cost and flattening the watch by
lunchtime. Expect a noticeable but tolerable reduction.

## Verified vs. not

Two simulations port the real logic and assert its properties.

`verify_protocol.py` covers the sync semantics — cumulative-to-delta conversion,
midnight rollover, idle suppression, idempotent re-sync, crash recovery, the known
duplicate window, and the Shortcut aggregation.

`verify_splits.py` covers run analysis — split derivation at constant and varying
pace, boundary interpolation under coarse sampling, partial final splits, pauses,
mile splits, per-split heart rate, GPS acquisition delay, and the structure of the
generated TCX:

```
$ python3 verify_splits.py
ok   coarse sampling still gives 5:00/km                300.00   expected 300.00
ok   negative split detected: km 1                      240.00   expected 240.00
ok   5.4 km yields 6 splits                                  6   expected 6
ok   pause is included in elapsed time                  360.00   expected 360.00
ok   every trackpoint appears exactly once                  91   expected 91
PASS
```

The interpolation test is the one that earns its keep: sampling every 60 seconds
puts trackpoints 200 m apart, so snapping a kilometre boundary to the nearest
sample instead of interpolating would place it at 1200 m and report 6:00/km for a
5:00/km effort. The last check caught a real bug — trackpoints on a lap boundary
were being emitted in two laps, which would have inflated distance for importers.

The GPS-delay test caught another. Health Services delivers nothing until the fix
lands, so the first sample can arrive several seconds in and already some metres
along. `Splits.compute` timed the opening split from that first sample, silently
dropping the seconds before it: a first kilometre that really took 304 s was
reported as 296. It now takes the run's own start as the origin, which is what
the TCX `<Id>` already carried.

### The TCX contract, checked end to end

`Splits.kt` and `TcxWriter.kt` have no Android imports, so they compile and run on
a plain JVM. Doing that against synthetic runs — clean, GPS-delayed, and one
ending mid-kilometre — and feeding the resulting TCX into the phone app's own
importer confirms the two agree: 5:00 splits read back as 5:00, and the delayed
run reads 5:04 on both sides once the origin fix is in. Before the fix the watch
said 4:56 and the phone said 5:04 for the same run.

One difference remains by design: the watch emits a trailing partial split (5.4 km
gives six laps, the last 400 m) while the phone app reports only whole kilometres
(five). Neither is wrong; the tail simply does not appear in the phone's split
list.

**Neither app has been compiled as an APK.** The Kotlin above runs on the JVM, but
the Android build needs `dl.google.com`, which serves both the SDK packages and —
via Gradle's `google()` repository — the Android Gradle Plugin itself. Expect to
fix small things on first build, most likely the Health Services generics in
`HealthCollectorService.kt`, whose exact shape moved between library versions and
is pinned here to `1.0.0-rc02`.

## Layout

```
wear/                      Wear OS app (Kotlin)
  app/src/main/java/com/watchsync/wear/
    HealthCollectorService.kt   Health Services passive listener (all-day)
    RunRecorder.kt              ExerciseClient session (runs, GPS, pace)
    RunStore.kt                 Runs and trackpoints
    Splits.kt                   Distance splits by boundary interpolation
    TcxWriter.kt                Garmin TCX with laps
    SampleStore.kt              SQLite buffer; totals → interval deltas
    SyncHttpServer.kt           HTTP API, native and Shortcuts shapes
    SyncService.kt              Foreground service, locks, mDNS
    Pairing.kt                  Token and pairing code
    MainActivity.kt             Permissions, pairing code, IP address
    RunActivity.kt              Start/stop a run, live pace
ios/WatchSync/             Native iOS app (Swift) — needs a Mac
SHORTCUT.md                Build the phone side without a Mac
PROTOCOL.md                Wire contract
verify_protocol.py         Sync-semantics simulation
verify_splits.py           Split derivation and TCX structure
```

This directory is self-contained and has no relationship to the rest of this
repository. Moving it to its own repo is a `git mv` away.
