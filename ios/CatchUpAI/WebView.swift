import SwiftUI
import UIKit
import WebKit

@MainActor
final class WebViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var progress: Double = 0
    @Published var failure: String?
    weak var webView: WKWebView?

    func reload() {
        failure = nil
        if let webView, webView.url != nil {
            webView.reload()
        } else {
            webView?.load(URLRequest(url: AppConfig.startURL))
        }
    }
}

struct WebView: UIViewRepresentable {
    @ObservedObject var model: WebViewModel

    func makeCoordinator() -> Coordinator { Coordinator(model: model) }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        // Default (persistent) data store keeps the student signed in between launches.
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.applicationNameForUserAgent = AppConfig.userAgentSuffix

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic

        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordinator.pullToRefresh(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refresh

        context.coordinator.observe(webView)
        model.webView = webView
        webView.load(URLRequest(url: AppConfig.startURL))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let model: WebViewModel
        private var observations: [NSKeyValueObservation] = []

        init(model: WebViewModel) { self.model = model }

        func observe(_ webView: WKWebView) {
            observations = [
                webView.observe(\.estimatedProgress, options: [.new]) { [weak self] view, _ in
                    Task { @MainActor in self?.model.progress = view.estimatedProgress }
                },
                webView.observe(\.isLoading, options: [.new]) { [weak self] view, _ in
                    Task { @MainActor in self?.model.isLoading = view.isLoading }
                },
            ]
        }

        @objc func pullToRefresh(_ control: UIRefreshControl) {
            Task { @MainActor in
                model.reload()
                control.endRefreshing()
            }
        }

        /// The app, Supabase auth and the bot check load inside; everything else (GitHub, mail, docs) opens in Safari.
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
                decisionHandler(.cancel)
                return
            }
            if scheme == "mailto" || scheme == "tel" {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            let host = url.host?.lowercased() ?? ""
            let isMainFrame = navigationAction.targetFrame?.isMainFrame ?? true
            if scheme == "https", isMainFrame, !AppConfig.inAppHosts.contains(host) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }
            decisionHandler(.allow)
        }

        /// Links with target="_blank" (e.g. cited source pages) open in the same view.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url {
                if let host = url.host?.lowercased(), AppConfig.inAppHosts.contains(host) {
                    webView.load(URLRequest(url: url))
                } else {
                    UIApplication.shared.open(url)
                }
            }
            return nil
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            Task { @MainActor in model.failure = nil }
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            show(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            show(error)
        }

        private func show(_ error: Error) {
            let nsError = error as NSError
            // A cancelled load (new navigation started) isn't a failure.
            guard nsError.code != NSURLErrorCancelled else { return }
            Task { @MainActor in
                model.failure = nsError.code == NSURLErrorNotConnectedToInternet
                    ? "You're offline. Connect to the internet and try again."
                    : "The page didn't load. Try again in a moment."
            }
        }
    }
}
