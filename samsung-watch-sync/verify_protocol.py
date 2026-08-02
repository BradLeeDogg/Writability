"""
Simulates the WatchSync protocol to verify the sync semantics.

Mirrors the real logic:
  watch  -> SampleStore.updateDaily / insertHeartRate / watermark
  server -> SyncHttpServer.samplesBody (watermark read BEFORE samples)
  phone  -> HealthKitWriter.commit (append HR, replace daily) then advance watermark
"""

DAY = "2026-08-02"
DAY_START, DAY_END = 1000, 2000  # stand-ins for the day's ms bounds


class WatchStore:
    def __init__(self):
        self.heart_rate = {}   # t -> bpm   (PRIMARY KEY t => dedup)
        self.daily = {}        # date -> (updated_at, steps)

    def insert_heart_rate(self, t, bpm):
        self.heart_rate[t] = bpm            # CONFLICT_REPLACE

    def update_daily(self, date, updated_at, steps):
        self.daily[date] = (updated_at, steps)   # upsert, restated total

    def heart_rate_since(self, since):
        return sorted((t, b) for t, b in self.heart_rate.items() if t > since)

    def daily_since(self, since):
        return [(d, u, s) for d, (u, s) in self.daily.items() if u > since]

    def watermark(self):
        hr = max(self.heart_rate.keys(), default=0)
        dy = max((u for u, _ in self.daily.values()), default=0)
        return max(hr, dy)

    def samples_body(self, since):
        wm = self.watermark()                 # read first, deliberately
        return {
            "watermark": wm,
            "heartRate": self.heart_rate_since(since),
            "daily": self.daily_since(since),
        }


class HealthKit:
    """Only models what matters: samples are attributed to a source, and this
    app may delete only its own."""

    def __init__(self):
        self.samples = []   # (type, start, end, value, source)

    def save(self, typ, start, end, value, source="watchsync"):
        self.samples.append((typ, start, end, value, source))

    def delete_own(self, typ, start, end):
        before = len(self.samples)
        self.samples = [
            s for s in self.samples
            if not (s[0] == typ and s[1] >= start and s[2] <= end and s[4] == "watchsync")
        ]
        return before - len(self.samples)

    def total(self, typ):
        return sum(s[3] for s in self.samples if s[0] == typ)

    def count(self, typ):
        return len([s for s in self.samples if s[0] == typ])


class Phone:
    def __init__(self, hk, naive=False):
        self.hk = hk
        self.watermark = 0
        self.naive = naive   # control: append daily instead of replacing

    def sync(self, watch, crash_before_watermark=False):
        resp = watch.samples_body(self.watermark)

        for t, bpm in resp["heartRate"]:
            self.hk.save("hr", t, t, bpm)

        for date, updated_at, steps in resp["daily"]:
            if not self.naive:
                self.hk.delete_own("steps", DAY_START, DAY_END)
            self.hk.save("steps", DAY_START, DAY_END, steps)

        if crash_before_watermark:
            return            # watermark not advanced -> batch re-delivered
        self.watermark = resp["watermark"]


def scenario(naive=False, crash_on=None):
    watch, hk = WatchStore(), HealthKit()
    phone = Phone(hk, naive=naive)

    # A day's worth of restated cumulative totals, with the phone syncing between.
    for i, (ts, steps) in enumerate([(1100, 2000), (1200, 5000), (1300, 9000)]):
        watch.update_daily(DAY, ts, steps)
        watch.insert_heart_rate(ts, 60 + i)
        phone.sync(watch, crash_before_watermark=(crash_on == i))
        if crash_on == i:
            phone.sync(watch)   # retry after the crash

    return hk, phone


print("=" * 62)
hk, phone = scenario()
print(f"replace strategy   steps={hk.total('steps'):>5}  samples={hk.count('steps')}  (expect 9000, 1)")
ok1 = hk.total("steps") == 9000 and hk.count("steps") == 1

hk_n, _ = scenario(naive=True)
print(f"naive append       steps={hk_n.total('steps'):>5}  samples={hk_n.count('steps')}  (the bug avoided)")
ok2 = hk_n.total("steps") == 16000

hk_c, _ = scenario(crash_on=1)
print(f"crash mid-commit   steps={hk_c.total('steps'):>5}  samples={hk_c.count('steps')}  (expect 9000, 1)")
ok3 = hk_c.total("steps") == 9000 and hk_c.count("steps") == 1

hr_ok = hk.count("hr") == 3
print(f"heart rate         samples={hk.count('hr')}  (expect 3, no duplicates)")

# Re-syncing with no new data must be a no-op.
watch, hk2 = WatchStore(), HealthKit()
p = Phone(hk2)
watch.update_daily(DAY, 1100, 2000)
p.sync(watch)
before = (hk2.total("steps"), hk2.count("steps"))
p.sync(watch)
p.sync(watch)
after = (hk2.total("steps"), hk2.count("steps"))
print(f"idempotent re-sync {before} -> {after}  (expect unchanged)")
ok4 = before == after

print("=" * 62)
print("PASS" if all([ok1, ok2, ok3, hr_ok, ok4]) else "FAIL")
