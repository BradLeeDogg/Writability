import Foundation
import HealthKit

/// Writes synced samples into Apple Health.
///
/// Every sample is an append. The watch has already converted cumulative daily
/// totals into non-overlapping interval deltas, so nothing here is ever restated
/// and no sample ever needs deleting — which is also what makes the Apple
/// Shortcuts path possible, since Shortcuts cannot delete health samples.
final class HealthKitWriter {

    private let store = HKHealthStore()

    private var heartRateType: HKQuantityType { .quantityType(forIdentifier: .heartRate)! }
    private var stepType: HKQuantityType { .quantityType(forIdentifier: .stepCount)! }
    private var energyType: HKQuantityType { .quantityType(forIdentifier: .activeEnergyBurned)! }
    private var distanceType: HKQuantityType { .quantityType(forIdentifier: .distanceWalkingRunning)! }

    private var writeTypes: Set<HKSampleType> {
        [heartRateType, stepType, energyType, distanceType]
    }

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    func requestAuthorization() async throws {
        guard isAvailable else { return }
        try await store.requestAuthorization(toShare: writeTypes, read: [])
    }

    /// Commits a whole response as one batch. Throws before the caller
    /// acknowledges, so a partial failure results in re-delivery, not loss.
    @discardableResult
    func commit(_ response: SamplesResponse) async throws -> Int {
        var objects: [HKQuantitySample] = []

        let beatsPerMinute = HKUnit.count().unitDivided(by: .minute())
        objects += response.heartRate.map { sample in
            HKQuantitySample(
                type: heartRateType,
                quantity: HKQuantity(unit: beatsPerMinute, doubleValue: sample.bpm),
                start: sample.date,
                end: sample.date
            )
        }

        objects += response.intervals.compactMap { interval -> HKQuantitySample? in
            guard interval.value > 0, let spec = spec(for: interval.field) else { return nil }
            return HKQuantitySample(
                type: spec.type,
                quantity: HKQuantity(unit: spec.unit, doubleValue: interval.value),
                start: interval.startDate,
                // A zero-length window is rejected by HealthKit for cumulative
                // types; collapse it to an instant the framework will accept.
                end: max(interval.endDate, interval.startDate)
            )
        }

        guard !objects.isEmpty else { return 0 }
        try await store.save(objects)
        return objects.count
    }

    private func spec(for field: String) -> (type: HKQuantityType, unit: HKUnit)? {
        switch field {
        case "steps": return (stepType, .count())
        case "calories": return (energyType, .kilocalorie())
        case "distance": return (distanceType, .meter())
        default: return nil
        }
    }
}
