import Foundation
import Network

/// Finds the watch on the local network via Bonjour and resolves it to an
/// address `URLSession` can talk to.
///
/// `NWBrowser` hands back an opaque service endpoint rather than a host and
/// port, so resolution takes a deliberate detour: open an `NWConnection` to the
/// endpoint, wait for it to become ready, and read the resolved remote address
/// off its current path. That is the supported way to turn a Bonjour result
/// into something addressable.
final class Discovery {

    struct Resolved {
        let host: String
        let port: UInt16

        var baseURL: URL {
            // IPv6 literals must be bracketed in a URL.
            let literal = host.contains(":") ? "[\(host)]" : host
            return URL(string: "http://\(literal):\(port)")!
        }
    }

    enum DiscoveryError: Error {
        case timedOut
        case failed(String)
    }

    private var browser: NWBrowser?
    private var connection: NWConnection?

    /// Browses for the watch and resolves the first result.
    func findWatch(timeout: TimeInterval = 8) async throws -> Resolved {
        let endpoint = try await browse(timeout: timeout)
        return try await resolve(endpoint: endpoint, timeout: timeout)
    }

    private func browse(timeout: TimeInterval) async throws -> NWEndpoint {
        try await withCheckedThrowingContinuation { continuation in
            var settled = false
            let browser = NWBrowser(
                for: .bonjour(type: "_watchsync._tcp", domain: nil),
                using: .tcp
            )
            self.browser = browser

            browser.browseResultsChangedHandler = { results, _ in
                guard !settled, let first = results.first else { return }
                settled = true
                browser.cancel()
                continuation.resume(returning: first.endpoint)
            }

            browser.stateUpdateHandler = { state in
                guard !settled, case .failed(let error) = state else { return }
                settled = true
                browser.cancel()
                continuation.resume(throwing: DiscoveryError.failed(error.localizedDescription))
            }

            browser.start(queue: .main)

            DispatchQueue.main.asyncAfter(deadline: .now() + timeout) {
                guard !settled else { return }
                settled = true
                browser.cancel()
                continuation.resume(throwing: DiscoveryError.timedOut)
            }
        }
    }

    private func resolve(endpoint: NWEndpoint, timeout: TimeInterval) async throws -> Resolved {
        try await withCheckedThrowingContinuation { continuation in
            var settled = false
            let connection = NWConnection(to: endpoint, using: .tcp)
            self.connection = connection

            connection.stateUpdateHandler = { state in
                guard !settled else { return }
                switch state {
                case .ready:
                    guard case .hostPort(let host, let port) = connection.currentPath?.remoteEndpoint else {
                        settled = true
                        connection.cancel()
                        continuation.resume(throwing: DiscoveryError.failed("no remote endpoint"))
                        return
                    }
                    settled = true
                    connection.cancel()
                    // Strip the interface suffix Network appends to link-local
                    // addresses (e.g. "fe80::1%en0") — URLSession rejects it.
                    let literal = "\(host)".components(separatedBy: "%").first ?? "\(host)"
                    continuation.resume(
                        returning: Resolved(host: literal, port: port.rawValue)
                    )
                case .failed(let error):
                    settled = true
                    connection.cancel()
                    continuation.resume(throwing: DiscoveryError.failed(error.localizedDescription))
                default:
                    break
                }
            }

            connection.start(queue: .main)

            DispatchQueue.main.asyncAfter(deadline: .now() + timeout) {
                guard !settled else { return }
                settled = true
                connection.cancel()
                continuation.resume(throwing: DiscoveryError.timedOut)
            }
        }
    }
}
