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
| | Body composition (BIA) |

The missing column is Samsung's proprietary algorithms, not an oversight in this
code. No transport, protocol or permission recovers them.

Your numbers will also drift slightly from what the watch face shows, because this
app samples the same sensors independently rather than reading Samsung's results.

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

`verify_protocol.py` simulates the store, server and client against the real
logic and checks twelve properties of the sync semantics — cumulative-to-delta
conversion, midnight rollover, idle suppression, idempotent re-sync, crash
recovery, the known duplicate window, and the Shortcut aggregation:

```
$ python3 verify_protocol.py
ok   cumulative -> deltas sum to total      9000.0   expected 9000
ok   midnight reset is not negative         9500.0   expected 9500
ok   crash before write loses nothing             0   expected 0
ok   write/ack gap double-counts (known)    6000.0   expected 6000
...
PASS
```

**Neither app has been compiled.** They were written on Linux without the Android
SDK or Xcode, so expect to fix small things on first build — most likely the
Health Services generics in `HealthCollectorService.kt`, whose exact shape moved
between library versions and is pinned here to `1.0.0-rc02`.

## Layout

```
wear/                      Wear OS app (Kotlin)
  app/src/main/java/com/watchsync/wear/
    HealthCollectorService.kt   Health Services passive listener
    SampleStore.kt              SQLite buffer; totals → interval deltas
    SyncHttpServer.kt           HTTP API, native and Shortcuts shapes
    SyncService.kt              Foreground service, locks, mDNS
    Pairing.kt                  Token and pairing code
    MainActivity.kt             Permissions, pairing code, IP address
ios/WatchSync/             Native iOS app (Swift) — needs a Mac
SHORTCUT.md                Build the phone side without a Mac
PROTOCOL.md                Wire contract
verify_protocol.py         Sync-semantics simulation
```

This directory is self-contained and has no relationship to the rest of this
repository. Moving it to its own repo is a `git mv` away.
