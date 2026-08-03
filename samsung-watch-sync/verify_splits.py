"""
Verifies the split-derivation algorithm in Splits.kt and the TCX structure
produced by TcxWriter.kt.

Ports the Kotlin logic exactly, then checks the properties that matter for a
run: splits sum to the distance actually covered, boundary crossings are
interpolated rather than snapped to the nearest sample, pace reflects real
effort, and pauses do not corrupt the arithmetic.

Run: python3 verify_splits.py
"""

import xml.etree.ElementTree as ET
from collections import namedtuple

Point = namedtuple("Point", "t distance bpm")   # t in ms, distance cumulative m
KM = 1000.0

results = []


def check(label, actual, expected, tolerance=0.0):
    ok = abs(actual - expected) <= tolerance if isinstance(expected, float) else actual == expected
    results.append(ok)
    shown = f"{actual:.2f}" if isinstance(actual, float) else str(actual)
    want = f"{expected:.2f}" if isinstance(expected, float) else str(expected)
    print(f"{'ok  ' if ok else 'FAIL'} {label:<46} {shown:>10}   expected {want}")


# --- Ported from Splits.kt -------------------------------------------------

def interpolate_time(before, after, target):
    span = after.distance - before.distance
    if span <= 0:                       # a pause gives no basis to interpolate
        return after.t
    fraction = (target - before.distance) / span
    return before.t + round(fraction * (after.t - before.t))


def build(index, points, start_t, end_t, distance, partial=False):
    hrs = [p.bpm for p in points if start_t <= p.t <= end_t and p.bpm is not None]
    duration = max(end_t - start_t, 0)
    return {
        "index": index,
        "start": start_t,
        "end": end_t,
        "distance": distance,
        "duration_ms": duration,
        "avg_bpm": sum(hrs) / len(hrs) if hrs else None,
        "partial": partial,
        "pace_s_per_km": (duration / 1000.0) / (distance / 1000.0) if distance > 0 else 0.0,
    }


def compute(points, split_meters, origin_ms=None):
    if len(points) < 2 or split_meters <= 0:
        return []
    total = points[-1].distance
    if total <= 0:
        return []

    splits = []
    # The first sample can land seconds into the run and already some distance
    # along, while GPS settles. Timing the opening split from that sample drops
    # everything before it. Ignored if later than the first sample, so a bad
    # clock cannot stretch the split instead.
    split_start_time = (origin_ms if origin_ms is not None and origin_ms <= points[0].t
                        else points[0].t)
    split_start_distance = 0.0
    boundary = split_meters
    cursor = 1

    while boundary <= total:
        while cursor < len(points) and points[cursor].distance < boundary:
            cursor += 1
        if cursor >= len(points):
            break
        crossing = interpolate_time(points[cursor - 1], points[cursor], boundary)
        splits.append(build(len(splits) + 1, points, split_start_time,
                            crossing, boundary - split_start_distance))
        split_start_time = crossing
        split_start_distance = boundary
        boundary += split_meters

    remainder = total - split_start_distance
    if remainder > 1.0:
        splits.append(build(len(splits) + 1, points, split_start_time,
                            points[-1].t, remainder, partial=True))
    return splits


def steady_run(pace_s_per_km, distance_m, sample_s=10, bpm=150, start=0):
    """Trackpoints at a constant pace."""
    speed = 1000.0 / pace_s_per_km                      # m/s
    points, t, d = [], start, 0.0
    while d < distance_m:
        points.append(Point(t, min(d, distance_m), bpm))
        t += sample_s * 1000
        d += speed * sample_s
    points.append(Point(start + round(distance_m / speed * 1000), distance_m, bpm))
    return points


print("=" * 92)

# 1. Constant 5:00/km over 3 km -> three 300-second splits.
pts = steady_run(300.0, 3000.0)
s = compute(pts, KM)
check("3 km at 5:00/km yields 3 splits", len(s), 3)
check("split 1 pace (s/km)", s[0]["pace_s_per_km"], 300.0, tolerance=1.0)
check("split 3 pace (s/km)", s[2]["pace_s_per_km"], 300.0, tolerance=1.0)
check("split distances sum to total", sum(x["distance"] for x in s), 3000.0, tolerance=0.5)
check("split durations sum to elapsed",
      sum(x["duration_ms"] for x in s) / 1000.0, 900.0, tolerance=1.0)

# 2. Interpolation: boundary falls between two samples that are far apart.
#    Sampling every 60 s at 5:00/km puts samples 200 m apart, so the 1000 m
#    boundary lands squarely between them. Snapping instead of interpolating
#    would put the split at 1200 m and report a 6:00 pace.
coarse = steady_run(300.0, 2000.0, sample_s=60)
s = compute(coarse, KM)
check("coarse sampling still gives 5:00/km", s[0]["pace_s_per_km"], 300.0, tolerance=2.0)

# 3. Variable pace: 4:00 first km, 6:00 second km.
fast = steady_run(240.0, 1000.0)
slow_start = fast[-1].t
slow = [Point(p.t + slow_start, p.distance + 1000.0, p.bpm)
        for p in steady_run(360.0, 1000.0)]
s = compute(fast + slow[1:], KM)
check("negative split detected: km 1", s[0]["pace_s_per_km"], 240.0, tolerance=2.0)
check("negative split detected: km 2", s[1]["pace_s_per_km"], 360.0, tolerance=3.0)

# 4. Partial final split is reported, not discarded.
pts = steady_run(300.0, 5400.0)
s = compute(pts, KM)
check("5.4 km yields 6 splits", len(s), 6)
check("final split is partial", s[-1]["partial"], True)
check("final split distance", s[-1]["distance"], 400.0, tolerance=5.0)

# 5. A pause (time advances, distance does not) must not divide by zero
#    or produce a negative duration.
paused = [Point(0, 0.0, 140), Point(60_000, 500.0, 140),
          Point(300_000, 500.0, 90),            # standing still for 4 minutes
          Point(360_000, 1000.0, 150)]
s = compute(paused, KM)
check("pause does not break split count", len(s), 1)
check("pause is included in elapsed time", s[0]["duration_ms"] / 1000.0, 360.0, tolerance=1.0)

# 6. A run shorter than one split still reports something.
short = steady_run(300.0, 600.0)
s = compute(short, KM)
check("sub-kilometre run yields one partial", len(s), 1)
check("...marked partial", s[0]["partial"], True)

# 7. Mile splits.
pts = steady_run(300.0, 3218.688)          # exactly 2 miles
s = compute(pts, 1609.344)
check("2 miles yields 2 mile-splits", len(s), 2)

# 8. Heart rate is averaged within the split, not across the run.
pts = ([Point(p.t, p.distance, 140) for p in steady_run(300.0, 1000.0)]
       + [Point(p.t + 300_000, p.distance + 1000.0, 170)
          for p in steady_run(300.0, 1000.0)][1:])
s = compute(pts, KM)
check("split 1 average bpm", s[0]["avg_bpm"], 140.0, tolerance=1.0)
check("split 2 average bpm", s[1]["avg_bpm"], 170.0, tolerance=1.0)


# 9. GPS acquisition delay. Health Services delivers nothing until the fix
#    lands, so the first sample can arrive several seconds in and already some
#    metres along. Timing the opening split from that sample drops the missing
#    seconds and reports a first kilometre that is too fast — and disagrees with
#    the phone app, which times splits from the TCX <Id> instead.
#
#    Here: the run starts at t=0, the first sample lands at t=8 s and 12 m, and
#    the remaining 988 m is run at 5:00/km (296.4 s). The true first kilometre
#    therefore took 8 + 296.4 = 304.4 s.
delayed = [Point(8_000 + p.t, 12.0 + p.distance, 150)
           for p in steady_run(300.0, 988.0, sample_s=1)]
delayed.append(Point(delayed[-1].t + 1000, 1400.0, 150))   # keep running past 1 km

no_origin = compute(delayed, KM)
check("without an origin the first km is short", no_origin[0]["pace_s_per_km"], 296.4,
      tolerance=1.5)

with_origin = compute(delayed, KM, origin_ms=0)
check("origin restores the opening split", with_origin[0]["pace_s_per_km"], 304.4,
      tolerance=1.5)
check("later splits are untouched by the origin",
      len(with_origin), len(no_origin))

# An origin after the first sample is nonsense and must be ignored rather than
# used to inflate the split.
late = compute(delayed, KM, origin_ms=50_000)
check("an origin later than the first sample is ignored",
      late[0]["pace_s_per_km"], no_origin[0]["pace_s_per_km"], tolerance=0.01)

# A run whose first sample really is at zero must be unaffected either way.
clean = steady_run(300.0, 2000.0)
check("a clean start is identical with and without an origin",
      compute(clean, KM, origin_ms=0)[0]["pace_s_per_km"],
      compute(clean, KM)[0]["pace_s_per_km"], tolerance=0.01)


# --- TCX structure ---------------------------------------------------------

NS = "{http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2}"


def write_tcx(splits, points):
    """Mirrors TcxWriter.kt closely enough to check the document shape."""
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/'
           'TrainingCenterDatabase/v2">',
           '  <Activities>', '    <Activity Sport="Running">',
           '      <Id>2026-08-02T09:00:00Z</Id>']
    for i, sp in enumerate(splits):
        # Half-open [start, end) except the last lap, so no point is emitted twice.
        last = i == len(splits) - 1
        lap_pts = [p for p in points
                   if p.t >= sp["start"] and (p.t <= sp["end"] if last else p.t < sp["end"])]
        out.append(f'      <Lap StartTime="2026-08-02T09:00:00Z">')
        out.append(f'        <TotalTimeSeconds>{sp["duration_ms"] / 1000.0}</TotalTimeSeconds>')
        out.append(f'        <DistanceMeters>{sp["distance"]:.2f}</DistanceMeters>')
        out.append('        <Intensity>Active</Intensity>')
        out.append('        <TriggerMethod>Distance</TriggerMethod>')
        out.append('        <Track>')
        for p in lap_pts:
            out.append('          <Trackpoint>')
            out.append(f'            <DistanceMeters>{p.distance:.2f}</DistanceMeters>')
            out.append('          </Trackpoint>')
        out.append('        </Track>')
        out.append('      </Lap>')
    out += ['    </Activity>', '  </Activities>', '</TrainingCenterDatabase>']
    return "\n".join(out)


pts = steady_run(300.0, 3000.0)
splits = compute(pts, KM)
doc = write_tcx(splits, pts)

try:
    root = ET.fromstring(doc)
    parsed = True
except ET.ParseError:
    parsed = False

check("TCX parses as XML", parsed, True)
laps = root.findall(f".//{NS}Lap") if parsed else []
check("TCX lap count matches splits", len(laps), len(splits))
check("every lap carries a distance",
      all(l.find(f"{NS}DistanceMeters") is not None for l in laps), True)
check("every lap carries a track",
      all(l.find(f"{NS}Track") is not None for l in laps), True)
check("every trackpoint appears exactly once",
      len(root.findall(f".//{NS}Trackpoint")), len(pts))

print("=" * 92)
print("PASS" if all(results) else "FAIL")
raise SystemExit(0 if all(results) else 1)
