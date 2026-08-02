# Building the iPhone side with Apple Shortcuts

This replaces the iOS app entirely. **No Mac, no Xcode, no developer account.**
Everything below is done on the iPhone itself.

The trade-off versus the native app: no automatic discovery (you type the watch's
IP once), heart rate arrives as hourly averages rather than individual readings,
and you build the shortcut by hand instead of installing a binary.

## Before you start

Open **WatchSync** on the watch. It shows two things:

```
Pairing code
  A3F91C
192.168.1.57:8787
```

Note both. If the address says *Wi-Fi not connected*, the watch is not on your
network and nothing below will work.

## Step 1 — Get the token

The pairing code is only the first 6 characters. The shortcut needs the full
token, and you can fetch it in Safari.

With the WatchSync screen still open on the watch, visit this in Safari on the
iPhone, substituting your address and code:

```
http://192.168.1.57:8787/pair?code=A3F91C
```

Safari will show something like:

```json
{"token":"9f2c4a1b8e7d3f60a5c2b9e814d7f3a2","device":"SM-R870"}
```

Copy the token value. If you get `pairing window closed`, the watch screen has
timed out — wake it and retry. If Safari cannot connect at all, check both
devices are on the same Wi-Fi and that your router does not have client isolation
(AP isolation) enabled.

## Step 2 — Build the shortcut

Open **Shortcuts** → **+** → name it `Sync Watch`.

### Fetch the data

1. Add **Get Contents of URL**.
   - URL: `http://192.168.1.57:8787/shortcut`
   - Expand **Show More** → Method `GET`
   - **Headers** → add `Authorization` = `Bearer 9f2c4a1b8e7d3f60a5c2b9e814d7f3a2`
     (the word `Bearer`, a space, then your token)
2. Add **Set Variable** → name `Data`, value: the *Contents of URL* output.

The first time you run this, iOS will ask permission to find devices on your
local network. Allow it — the shortcut cannot work otherwise, and the prompt only
appears once.

### Log the activity totals

The sample type in **Log Health Sample** cannot be set from a variable, so each
metric needs its own action. Three near-identical blocks:

**Steps**

3. **Get Dictionary Value** → key `steps` → from `Data`
4. **Get Dictionary Value** → key `windowStart` → from `Data`
5. **Get Dictionary Value** → key `windowEnd` → from `Data`
6. **Log Health Sample**
   - Type: `Steps`
   - Value: the output of step 3
   - Start / End dates: outputs of steps 4 and 5

**Active energy** — repeat with key `calories`, type `Active Energy`, unit
kilocalories.

**Distance** — repeat with key `distanceMeters`, type `Walking + Running
Distance`, unit meters.

### Log heart rate

7. **Get Dictionary Value** → key `heartRate` → from `Data`
8. **Repeat with Each** over that list
   - **Get Dictionary Value** → key `bpm` → from *Repeat Item*
   - **Get Dictionary Value** → key `time` → from *Repeat Item*
   - **Log Health Sample** → Type `Heart Rate`, value the bpm, start and end both
     the time
9. **End Repeat**

### Acknowledge

This is what tells the watch it can discard the data. Skip it and every sync
re-sends everything from the beginning.

10. **Get Dictionary Value** → key `cursorInterval` → from `Data`
11. **Get Dictionary Value** → key `cursorHeartRate` → from `Data`
12. **Get Contents of URL**
    - URL: `http://192.168.1.57:8787/ack?interval=[cursorInterval]&heart=[cursorHeartRate]`
      — build this with the **Text** action, inserting the two variables inline,
      then pass that text as the URL
    - Same `Authorization` header as before

Order matters: acknowledge only *after* the logging actions. See the duplicate
window note in [PROTOCOL.md](PROTOCOL.md).

## Step 3 — Run it

Wear the watch for a while first, or there will be nothing to sync. Tap the
shortcut. Grant the Health permissions when prompted, then check the Health app —
steps, heart rate, active energy and distance should appear under
*Browse → Activity*, sourced from Shortcuts.

Running it twice in a row should add nothing the second time. If it does, the
acknowledge step is not working.

## Exporting a run

Runs are separate from the all-day sync above, and they do not go into Apple
Health as splits — the `Log Workout` action accepts only date, duration, calories
and distance, with no laps and no route. That is a hard limit of Shortcuts.

So runs export as a **TCX file**, which carries the splits, the route and
per-lap heart rate. Upload it to Strava and you get pace, splits and a map
properly rendered; Strava can then push the workout into Apple Health for you if
you enable that in its settings.

### Shortcut: `Export Run`

1. **Get Contents of URL** → `http://192.168.1.57:8787/runs`, with the same
   `Authorization` header
2. **Get Dictionary Value** → key `runs`
3. **Choose from List** → pick the run you want
4. **Get Dictionary Value** → key `id` → from the chosen item
5. **Text** → `http://192.168.1.57:8787/runs/[id].tcx`
   (insert the `id` variable inline; add `?split=mi` for mile splits)
6. **Get Contents of URL** → use that text as the URL, same `Authorization` header
7. **Save File** → choose a folder in iCloud Drive or On My iPhone

Then open **strava.com/upload** in Safari, choose the file, and upload. The web
uploader works on iOS; the Strava app itself does not import files.

### Seeing splits without leaving the phone

If you just want to read the split table, add a shortcut that fetches
`http://192.168.1.57:8787/runs/[id]` and shows the `splits` list with
**Quick Look**. Each entry already contains a formatted `pace`, so nothing needs
computing.

### Logging the run into Health as well

Optional, and lossy by design: after downloading the TCX, add **Log Workout**
with type `Running`, and fill duration, distance and calories from the run
detail. Health will show the run and an average pace, but no splits and no map.
Alternatively let Strava write it to Health after upload, which gives the same
result with one less step.

## Step 4 — Automate it (optional)

**Shortcuts → Automation → + → Time of Day.** Pick a time when the watch is
usually charging and awake, add *Run Shortcut → Sync Watch*, and turn off **Ask
Before Running**.

Once a day while the watch is on its charger is the sweet spot. Wear OS powers
down the Wi-Fi radio aggressively on battery, so an automation at 3am with the
watch on your wrist will often find nothing.

## When it does not work

**"Could not connect to server"** — the watch is asleep, off Wi-Fi, or its IP
changed. Open WatchSync on the watch and re-check the address. Set a DHCP
reservation on your router to stop it moving.

**Runs but logs nothing** — check `hasData` by visiting the `/shortcut` URL in
Safari. If it is `false`, the watch genuinely has nothing buffered: either it was
just acknowledged, or the app is not collecting. Confirm the persistent WatchSync
notification is present on the watch.

**401 unauthorized** — the header is malformed. It must be exactly
`Bearer <token>` with a single space, in the `Authorization` header.

**Numbers look doubled** — the acknowledge step is missing, misordered, or its
URL is wrong. Verify by loading the `/shortcut` URL twice in Safari: the second
load should show the same values, and only change after a successful `/ack`.
