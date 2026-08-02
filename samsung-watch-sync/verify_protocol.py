"""
Simulates the WatchSync protocol (v2) to verify its sync semantics.

Mirrors the real logic:
  watch  -> SampleStore.recordCumulative  (totals -> append-only deltas)
  server -> SyncHttpServer.samplesBody / shortcutBody
  phone  -> commit to HealthKit, then GET /ack

Run: python3 verify_protocol.py
"""

HOUR = 3_600_000


class WatchStore:
    """Mirrors SampleStore: cumulative totals in, interval deltas out."""

    def __init__(self):
        self.intervals = []       # (id, start, end, field, value)
        self.heart_rate = {}      # t -> bpm
        self.progress = {}        # (date, field) -> (last_total, last_time)
        self.acked_interval = 0
        self.acked_hr = 0
        self._next_id = 1

    def record_cumulative(self, date, field, total, at):
        prev_total, prev_time = self.progress.get((date, field), (0.0, 0))
        # Backwards means a day rollover or counter reset.
        delta = total if total < prev_total else total - prev_total
        if delta > 0:
            self.intervals.append((self._next_id, prev_time or at, at, field, delta))
            self._next_id += 1
        self.progress[(date, field)] = (total, at)

    def insert_heart_rate(self, t, bpm):
        self.heart_rate[t] = bpm

    def samples_body(self):
        intervals = [i for i in self.intervals if i[0] > self.acked_interval]
        hr = sorted((t, b) for t, b in self.heart_rate.items() if t > self.acked_hr)
        return {
            "intervals": intervals,
            "heartRate": hr,
            # Cursors come from rows actually returned, not the store maximum.
            "cursorInterval": intervals[-1][0] if intervals else self.acked_interval,
            "cursorHeartRate": hr[-1][0] if hr else self.acked_hr,
        }

    def shortcut_body(self):
        intervals = [i for i in self.intervals if i[0] > self.acked_interval]
        hr = sorted((t, b) for t, b in self.heart_rate.items() if t > self.acked_hr)
        buckets = {}
        for t, bpm in hr:
            buckets.setdefault(t // HOUR, []).append(bpm)
        return {
            "steps": round(sum(i[4] for i in intervals if i[3] == "steps")),
            "heartRate": [
                {"time": h * HOUR + HOUR // 2, "bpm": round(sum(v) / len(v), 1)}
                for h, v in sorted(buckets.items())
            ],
            "cursorInterval": max((i[0] for i in intervals), default=self.acked_interval),
            "cursorHeartRate": hr[-1][0] if hr else self.acked_hr,
        }

    def ack(self, interval_id, hr_t):
        self.acked_interval = interval_id
        self.acked_hr = hr_t
        self.intervals = [i for i in self.intervals if i[0] > interval_id]
        self.heart_rate = {t: b for t, b in self.heart_rate.items() if t > hr_t}


class HealthKit:
    def __init__(self):
        self.samples = []      # (type, start, end, value)

    def append(self, typ, start, end, value):
        self.samples.append((typ, start, end, value))

    def total(self, typ):
        return sum(s[3] for s in self.samples if s[0] == typ)

    def count(self, typ):
        return len([s for s in self.samples if s[0] == typ])


def sync(watch, hk, crash="none"):
    """crash: 'none' | 'before_write' | 'between_write_and_ack'"""
    body = watch.samples_body()
    if crash == "before_write":
        return                                   # nothing written, nothing acked
    for _id, start, end, field, value in body["intervals"]:
        hk.append(field, start, end, value)
    for t, bpm in body["heartRate"]:
        hk.append("hr", t, t, bpm)
    if crash == "between_write_and_ack":
        return                                   # written but not acknowledged
    watch.ack(body["cursorInterval"], body["cursorHeartRate"])


results = []


def check(label, actual, expected):
    ok = actual == expected
    results.append(ok)
    print(f"{'ok  ' if ok else 'FAIL'} {label:<40} {actual!r:>16}   expected {expected!r}")


print("=" * 86)

# 1. Cumulative totals become deltas that sum back to the original total.
w, hk = WatchStore(), HealthKit()
for at, total in [(1 * HOUR, 2000), (2 * HOUR, 5000), (3 * HOUR, 9000)]:
    w.record_cumulative("2026-08-02", "steps", total, at)
    sync(w, hk)
check("cumulative -> deltas sum to total", hk.total("steps"), 9000)
check("one HealthKit sample per delta", hk.count("steps"), 3)

# 2. Midnight rollover must not emit a negative delta.
w, hk = WatchStore(), HealthKit()
w.record_cumulative("2026-08-02", "steps", 9000, 20 * HOUR)
w.record_cumulative("2026-08-03", "steps", 500, 25 * HOUR)
sync(w, hk)
check("midnight reset is not negative", hk.total("steps"), 9500)

# 3. Idle periods emit nothing.
w, hk = WatchStore(), HealthKit()
w.record_cumulative("2026-08-02", "steps", 2000, HOUR)
sync(w, hk)
for at in (2 * HOUR, 3 * HOUR):
    w.record_cumulative("2026-08-02", "steps", 2000, at)
sync(w, hk)
check("unchanged total writes nothing", hk.count("steps"), 1)

# 4. Re-syncing with nothing new is a no-op.
before = (hk.total("steps"), hk.count("steps"))
sync(w, hk)
sync(w, hk)
check("idempotent re-sync", (hk.total("steps"), hk.count("steps")), before)

# 5. Crash before writing: data is retained and redelivered.
w, hk = WatchStore(), HealthKit()
w.record_cumulative("2026-08-02", "steps", 3000, HOUR)
sync(w, hk, crash="before_write")
check("crash before write loses nothing", hk.total("steps"), 0)
sync(w, hk)
check("...and is redelivered intact", hk.total("steps"), 3000)

# 6. The known at-least-once window: written but not acknowledged.
#    Documented in PROTOCOL.md rather than fixed -- closing it needs
#    deduplication that the Shortcuts path cannot perform.
w, hk = WatchStore(), HealthKit()
w.record_cumulative("2026-08-02", "steps", 3000, HOUR)
sync(w, hk, crash="between_write_and_ack")
sync(w, hk)
check("write/ack gap double-counts (known)", hk.total("steps"), 6000)

# 7. Shortcut view aggregates the same data.
w, hk = WatchStore(), HealthKit()
for at, total in [(1 * HOUR, 2000), (2 * HOUR, 5000), (3 * HOUR, 9000)]:
    w.record_cumulative("2026-08-02", "steps", total, at)
for t, bpm in [(HOUR + 60, 60), (HOUR + 120, 70), (2 * HOUR + 60, 80)]:
    w.insert_heart_rate(t, bpm)
body = w.shortcut_body()
check("shortcut steps match delta sum", body["steps"], 9000)
check("heart rate averaged per hour", len(body["heartRate"]), 2)
check("hourly average is correct", body["heartRate"][0]["bpm"], 65.0)

# 8. Acking the shortcut cursor clears the buffer.
w.ack(body["cursorInterval"], body["cursorHeartRate"])
check("ack drains the buffer", w.shortcut_body()["steps"], 0)

print("=" * 86)
print("PASS" if all(results) else "FAIL")
raise SystemExit(0 if all(results) else 1)
