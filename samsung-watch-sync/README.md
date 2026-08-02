# WatchSync

Copies health data from a Galaxy Watch4 to an iPhone over local Wi-Fi, writing it
into Apple Health. No cloud service, no account, no Android phone in the loop
during normal operation.

Two apps and a small HTTP contract:

```
Galaxy Watch4                          iPhone
┌──────────────────────────┐           ┌────────────────────────────┐
│ Health Services (passive)│           │ NWBrowser  finds _watchsync│
│          ↓               │           │          ↓                 │
│ SampleStore (SQLite)     │  Wi-Fi    │ SyncClient  GET /samples   │
│          ↓               │ ────────► │          ↓                 │
│ SyncHttpServer  :8787    │   LAN     │ HealthKitWriter → Health   │
│ advertised via mDNS      │           │                            │
└──────────────────────────┘           └────────────────────────────┘
```

The watch collects continuously and buffers locally. The phone pulls when you open
it and press Sync. See [PROTOCOL.md](PROTOCOL.md) for the wire format.

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
| | Body composition (BIA) |

The missing column is Samsung's proprietary algorithms, not an oversight in this
code. No transport, protocol or permission recovers them.

Your numbers will also drift slightly from what the watch face shows, because this
app samples the same sensors independently rather than reading Samsung's results.

## Requirements

- Galaxy Watch4 (or later Wear OS Galaxy Watch), already set up
- **An Android phone, once** — the Watch4 cannot complete first-time setup without
  one, and you need it to enable developer mode. Not needed afterwards.
- A Mac with Xcode, and an Apple Developer account. A free account works but
  re-signing is required every 7 days; a paid account ($99/yr) lasts a year.
- Android Studio, for the watch app.
- Both devices on the same Wi-Fi network, with client isolation off (most home
  routers; many guest and public networks block device-to-device traffic).

## Building the watch app

```bash
cd wear
./gradlew :app:assembleDebug
```

Enable wireless debugging on the watch: Settings → About watch → Software → tap
Software version 7 times, then Settings → Developer options → ADB debugging and
Wireless debugging. Note the IP and port shown, then:

```bash
adb connect <watch-ip>:<port>
adb install app/build/outputs/apk/debug/app-debug.apk
```

Launch WatchSync on the watch and grant sensor permissions. It shows a 6-character
pairing code and starts collecting.

## Building the iPhone app

Create a new iOS App project in Xcode named `WatchSync`, add the `ios/WatchSync/*.swift`
files, and merge the keys from `ios/WatchSync/Info.plist` into the target's Info.plist.
Then enable the **HealthKit** capability under Signing & Capabilities.

Three settings are easy to miss, and each fails in a way that looks like something
else:

- `NSLocalNetworkUsageDescription` and `NSBonjourServices` — without them Bonjour
  browsing returns nothing and the watch just appears to be absent.
- `NSAllowsLocalNetworking` — without it App Transport Security blocks the plain
  HTTP request.
- The HealthKit capability — without it authorization fails at runtime rather than
  at build time.

Run on your iPhone, enter the code from the watch, press Pair, then Sync.

## Reliability, honestly

**Sync is manual and opportunistic.** Open the app, press Sync. That is a deliberate
choice: iOS background execution is too constrained to promise unattended syncing,
and pretending otherwise would produce an app that silently stops working.

**The watch is not always reachable.** Wear OS aggressively powers down the Wi-Fi
radio when the screen is off and the watch is on battery. `SyncService` holds a
`WIFI_MODE_FULL_HIGH_PERF` lock and a multicast lock to fight this, and runs in the
foreground so the process survives, but it does not win outright. In practice the
watch is most reliably reachable while charging or while the screen is on. Syncing
once a day while the watch sits on its charger works well; expecting it to answer
at 3am on battery does not.

**Collection continues regardless.** Data accumulates in SQLite on the watch whether
or not the phone can reach it, so an unreachable watch delays a sync rather than
losing anything. Heart rate rows are pruned once collected; daily rows are kept.

**Battery.** Passive monitoring rather than an active exercise session, which is the
difference between a modest background cost and flattening the watch by lunchtime.
Expect a noticeable but tolerable reduction.

## Verified vs. not

The sync semantics — cumulative daily totals, watermark advance, crash recovery —
are simulated and verified in `verify_protocol.py`, run against a faithful model of
the store, server and HealthKit writer. That test demonstrates the specific bug the
design exists to avoid: appending restated daily totals rather than replacing them
reports 16,000 steps for a 9,000-step day.

Neither app has been compiled. They were written on Linux, without the Android SDK
or Xcode, so expect to fix small things on first build — most likely the Health
Services generics in `HealthCollectorService`, whose exact shape moved between
library versions and is pinned here to `1.0.0-rc02`.

## Layout

```
wear/                      Wear OS app (Kotlin)
  app/src/main/java/com/watchsync/wear/
    HealthCollectorService.kt   Health Services passive listener
    SampleStore.kt              SQLite buffer
    SyncHttpServer.kt           HTTP API (Android-independent logic)
    SyncService.kt              Foreground service, locks, mDNS
    Pairing.kt                  Token and pairing code
    MainActivity.kt             Permissions and pairing screen
ios/WatchSync/             iOS app (Swift)
    Discovery.swift             Bonjour browse and resolve
    SyncClient.swift            Pair and fetch
    HealthKitWriter.swift       Append heart rate, replace daily totals
    ContentView.swift           UI
PROTOCOL.md                Wire contract
```

This directory is self-contained and has no relationship to the rest of this
repository. Moving it to its own repo is a `git mv` away.
