import Foundation
import HealthKit

/// Writes synced samples into Apple Health.
///
/// Two different write strategies, for the reason set out in PROTOCOL.md:
/// heart rate is appended, daily totals are *replaced*. Getting that distinction
/// wrong is the difference between an accurate step count and one inflated
/// several-fold by re-syncing the same day.
final class HealthKitWriter {

    private let store = HKHealthStore()

    private lazy var dayParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        // The watch formats the date in its own local zone. Parsing in the
        // phone's current zone matches as long as both devices agree, which for
        // a watch and its owner's phone they do.
        formatter.timeZone = .current
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

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

    /// Commits a whole response. Throws before the caller advances its watermark,
    /// so a partial failure results in the batch being re-fetched rather than lost.
    @discardableResult
    func commit(_ response: SamplesResponse) async throws -> Int {
        var written = 0
        written += try await appendHeartRate(response.heartRate)
        written += try await replaceDaily(response.daily)
        return written
    }

    // MARK: - Append

    private func appendHeartRate(_ samples: [HeartRateSample]) async throws -> Int {
        guard !samples.isEmpty else { return 0 }
        let unit = HKUnit.count().unitDivided(by: .minute())

        let objects = samples.map { sample in
            HKQuantitySample(
                type: heartRateType,
                quantity: HKQuantity(unit: unit, doubleValue: sample.bpm),
                start: sample.date,
                end: sample.date
            )
        }
        try await store.save(objects)
        return objects.count
    }

    // MARK: - Replace

    private func replaceDaily(_ totals: [DailyTotals]) async throws -> Int {
        var written = 0
        for day in totals {
            guard let start = dayParser.date(from: day.date),
                  let end = Calendar.current.date(byAdding: .day, value: 1, to: start)
            else { continue }

            written += try await replace(
                type: stepType,
                quantity: HKQuantity(unit: .count(), doubleValue: Double(day.steps)),
                start: start, end: end
            )
            written += try await replace(
                type: energyType,
                quantity: HKQuantity(unit: .kilocalorie(), doubleValue: day.calories),
                start: start, end: end
            )
            written += try await replace(
                type: distanceType,
                quantity: HKQuantity(unit: .meter(), doubleValue: day.distanceMeters),
                start: start, end: end
            )
        }
        return written
    }

    /// Deletes this app's previous samples covering the window, then writes the
    /// restated total as a single sample spanning it.
    ///
    /// HealthKit only permits an app to delete samples it authored, so scoping
    /// the predicate to `HKSource.default()` is both a correctness measure and a
    /// guarantee that data from the user's other devices is never touched.
    private func replace(
        type: HKQuantityType,
        quantity: HKQuantity,
        start: Date,
        end: Date
    ) async throws -> Int {
        let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
            HKQuery.predicateForSamples(withStart: start, end: end, options: [.strictStartDate]),
            HKQuery.predicateForObjects(from: HKSource.default())
        ])

        // Not an error when there is nothing to delete — the first sync of a day
        // has no predecessor.
        _ = try? await store.deleteObjects(of: type, predicate: predicate)

        // A zero total carries no information and would clutter the Health app.
        guard quantity.doubleValue(for: unitFor(type)) > 0 else { return 0 }

        try await store.save(
            HKQuantitySample(type: type, quantity: quantity, start: start, end: end)
        )
        return 1
    }

    private func unitFor(_ type: HKQuantityType) -> HKUnit {
        switch type {
        case stepType: return .count()
        case energyType: return .kilocalorie()
        case distanceType: return .meter()
        default: return .count()
        }
    }
}
