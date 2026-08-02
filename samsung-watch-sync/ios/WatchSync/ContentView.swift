import SwiftUI

@main
struct WatchSyncApp: App {
    var body: some Scene {
        WindowGroup { ContentView() }
    }
}

@MainActor
final class SyncViewModel: ObservableObject {

    @Published var status: String = "Not paired"
    @Published var busy = false
    @Published var pairingCode = ""
    @Published var isPaired = false

    private let discovery = Discovery()
    private let client = SyncClient()
    private let writer = HealthKitWriter()

    init() {
        isPaired = client.isPaired
        if isPaired { status = "Ready" }
    }

    func pair() async {
        busy = true
        defer { busy = false }
        do {
            status = "Looking for watch…"
            let resolved = try await discovery.findWatch()
            status = "Pairing…"
            let device = try await client.pair(with: pairingCode, at: resolved.baseURL)
            isPaired = true
            status = "Paired with \(device)"
        } catch SyncError.badPairingCode {
            status = "Wrong code — check the watch"
        } catch Discovery.DiscoveryError.timedOut {
            status = "Watch not found. Open WatchSync on the watch and check both are on the same Wi-Fi."
        } catch {
            status = "Pairing failed: \(error.localizedDescription)"
        }
    }

    func sync() async {
        busy = true
        defer { busy = false }
        do {
            try await writer.requestAuthorization()

            status = "Looking for watch…"
            let resolved = try await discovery.findWatch()

            status = "Fetching…"
            let response = try await client.fetchSamples(at: resolved.baseURL)

            status = "Writing to Health…"
            let written = try await writer.commit(response)

            // Only now is it safe to acknowledge: everything in this response is
            // in HealthKit, so the watch may retire it.
            try await client.acknowledge(response, at: resolved.baseURL)

            status = written == 0
                ? "Up to date"
                : "Synced \(written) samples from \(response.device)"
        } catch SyncError.unauthorized {
            status = "Token rejected — pair again"
            isPaired = false
        } catch Discovery.DiscoveryError.timedOut {
            status = "Watch not found. Open WatchSync on the watch and check both are on the same Wi-Fi."
        } catch {
            status = "Sync failed: \(error.localizedDescription)"
        }
    }
}

struct ContentView: View {
    @StateObject private var model = SyncViewModel()

    var body: some View {
        VStack(spacing: 24) {
            Text("WatchSync")
                .font(.largeTitle.bold())

            Text(model.status)
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)

            if !model.isPaired {
                TextField("Pairing code", text: $model.pairingCode)
                    .textFieldStyle(.roundedBorder)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .font(.system(.title2, design: .monospaced))
                    .multilineTextAlignment(.center)

                Button("Pair with watch") {
                    Task { await model.pair() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.busy || model.pairingCode.count < 6)
            } else {
                Button("Sync now") {
                    Task { await model.sync() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.busy)
            }

            if model.busy { ProgressView() }

            Spacer()
        }
        .padding(32)
    }
}
