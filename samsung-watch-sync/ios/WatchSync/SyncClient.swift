import Foundation

// MARK: - Wire types (mirror PROTOCOL.md)

struct SamplesResponse: Decodable {
    let protocolVersion: Int
    let device: String
    let watermark: Int64
    let heartRate: [HeartRateSample]
    let daily: [DailyTotals]

    enum CodingKeys: String, CodingKey {
        case protocolVersion = "protocol"
        case device, watermark, heartRate, daily
    }
}

struct HeartRateSample: Decodable {
    let t: Int64
    let bpm: Double

    var date: Date { Date(timeIntervalSince1970: TimeInterval(t) / 1000) }
}

struct DailyTotals: Decodable {
    let date: String
    let updatedAt: Int64
    let steps: Int
    let calories: Double
    let distanceMeters: Double
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

/// Talks to the watch's HTTP API. Stateless apart from the stored token and
/// watermark, both of which live in `UserDefaults` — losing them costs a full
/// re-sync, not data.
final class SyncClient {

    private let defaults = UserDefaults.standard
    private let tokenKey = "watchsync.token"
    private let watermarkKey = "watchsync.watermark"

    var token: String? {
        get { defaults.string(forKey: tokenKey) }
        set { defaults.set(newValue, forKey: tokenKey) }
    }

    /// Last timestamp successfully committed to HealthKit. Only advanced after
    /// the write completes, so an interrupted sync repeats rather than skips.
    var watermark: Int64 {
        get { Int64(defaults.integer(forKey: watermarkKey)) }
        set { defaults.set(Int(newValue), forKey: watermarkKey) }
    }

    var isPaired: Bool { token != nil }

    /// Exchanges the 6-character code shown on the watch for the full token.
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
        guard let token else { throw SyncError.notPaired }

        var components = URLComponents(url: base.appendingPathComponent("samples"),
                                       resolvingAgainstBaseURL: false)!
        components.queryItems = [URLQueryItem(name: "since", value: String(watermark))]

        var request = URLRequest(url: components.url!)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 15

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw SyncError.server(-1) }
        guard http.statusCode == 200 else {
            throw http.statusCode == 401 ? SyncError.unauthorized : SyncError.server(http.statusCode)
        }
        return try JSONDecoder().decode(SamplesResponse.self, from: data)
    }
}
