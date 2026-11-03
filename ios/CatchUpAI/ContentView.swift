import SwiftUI

struct ContentView: View {
    @StateObject private var model = WebViewModel()

    var body: some View {
        ZStack(alignment: .top) {
            WebView(model: model)
                .ignoresSafeArea(edges: .bottom)
                .opacity(model.failure == nil ? 1 : 0)

            if model.isLoading && model.progress < 1 {
                ProgressView(value: model.progress)
                    .progressViewStyle(.linear)
                    .tint(Color.accentColor)
                    .accessibilityLabel("Loading")
            }

            if let failure = model.failure {
                OfflineView(message: failure) { model.reload() }
            }
        }
        .background(Color(.systemBackground))
    }
}

/// Shown when a page can't load (no connection, server unavailable). Nothing is lost: data lives on the server.
struct OfflineView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
                .accessibilityHidden(true)
            Text("Can't reach CatchUp AI")
                .font(.title2.bold())
            Text(message)
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Text("Your plans and notes are safe on the server.")
                .font(.footnote)
                .foregroundStyle(.secondary)
            Button(action: retry) {
                Label("Try again", systemImage: "arrow.clockwise")
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
