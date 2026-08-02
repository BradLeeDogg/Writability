import Foundation

// MARK: - Wire types (mirror PROTOCOL.md)

struct SamplesResponse: Decodable {
    let protocolVersion: Int
    let device: String
    let cursorInterval: Int64
    let cursorHeartRate: Int64
    let intervals: [IntervalSample]
    let heartRate: [HeartRateSample]

    enum CodingKeys: String, CodingKey {
        case protocolVersion = "protocol"
        case device, cursorInterval, cursorHeartRate, intervals, heartRate
    }

    var isEmpty: Bool { intervals.isEmpty && heartRate.isEmpty }
}

/// An activity delta over a closed time window — "142 steps between 14:05 and
/// 14:20". Append-only: each maps to exactly one HealthKit sample and is never
/// restated, so nothing ever has to be deleted.
struct IntervalSample: Decodable {
    let start: Int64
    let end: Int64
    let field: String
    let value: Double

    var startDate: Date { Date(timeIntervalSince1970: TimeInterval(start) / 1000) }
    var endDate: Date { Date(timeIntervalSince1970: TimeInterval(end) / 1000) }
}

struct HeartRateSample: Decodable {
    let t: Int64
    let bpm: Double

    var date: Date { Date(timeIntervalSince1970: TimeInterval(t) / 1000) }
}

struct PairResponse: Decodable {
    let token: String
    let device: String
}

// MARK: - Client

enum SyncError: Error {
    case unauthorized
    case badPairingCode
    case server(Int)
    case notPaired
}

/// Talks to the watch's HTTP API.
///
/// Delivery position lives on the *watch*, not here: the client fetches whatever
/// is unacknowledged and confirms with `/ack` once HealthKit has accepted it.
/// Reinstalling the app therefore cannot silently skip data.
final class SyncClient {

    private let defaults = UserDefaults.standard
    private let tokenKey = "watchsync.token"

    var token: String? {
        get { defaults.string(forKey: tokenKey) }
        set { defaults.set(newValue, forKey: tokenKey) }
    }

    var isPaired: Bool { token != nil }

    func pair(with code: String, at base: URL) async throws -> String {
        var components = URLComponents(url: base.appendingPathComponent("pair"),
                                       resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "code", value: code.uppercased())]

        let (data, response) = try await URLSession.shared.data(from: components.url!)
        guard let http = response as? HTTPURLResponse else { throw SyncError.server(-1) }
        guard http.statusCode == 200 else {
            throw http.statusCode == 403 ? SyncError.badPairingCode : SyncError.server(http.statusCode)
        }

        let decoded = try JSONDecoder().decode(PairResponse.self, from: data)
        token = decoded.token
        return decoded.device
    }

    func fetchSamples(at base: URL) async throws -> SamplesResponse {
        let data = try await get(base.appendingPathComponent("samples"), query: [])
        return try JSONDecoder().decode(SamplesResponse.self, from: data)
    }

    /// Confirms delivery. Called only after HealthKit has committed everything,
    /// so an interrupted sync repeats rather than skips.
    func acknowledge(_ response: SamplesResponse, at base: URL) async throws {
        _ = try await get(base.appendingPathComponent("ack"), query: [
            URLQueryItem(name: "interval", value: String(response.cursorInterval)),
            URLQueryItem(name: "heart", value: String(response.cursorHeartRate))
        ])
    }

    private func get(_ url: URL, query: [URLQueryItem]) async throws -> Data {
        guard let token else { throw SyncError.notPaired }

        var components = URLComponents(url: url, resolvingAgainstBaseURL: false)!
        if !query.isEmpty { components.queryItems = query }

        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw SyncError.server(-1) }
        guard http.statusCode == 200 else {
            throw http.statusCode == 401 ? SyncError.unauthorized : SyncError.server(http.statusCode)
        }
        return data
    }
}
