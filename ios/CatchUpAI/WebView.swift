import QuickLook
import SwiftUI
import UIKit
import WebKit

@MainActor
final class WebViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var progress: Double = 0
    @Published var failure: String?
    weak var webView: WKWebView?

    /// Loads an app URL (from a quick action), or keeps it until the web view exists.
    func open(_ url: URL) {
        failure = nil
        if let webView { webView.load(URLRequest(url: url)) } else { pendingURL = url }
    }

    var pendingURL: URL?

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
        // A cold launch from a quick action opens that page instead of the dashboard.
        webView.load(URLRequest(url: model.pendingURL ?? QuickActionRouter.shared.pendingURL ?? AppConfig.startURL))
        model.pendingURL = nil
        QuickActionRouter.shared.pendingURL = nil
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, QLPreviewControllerDataSource {
        private let model: WebViewModel
        private var observations: [NSKeyValueObservation] = []
        /// The last downloaded file (e.g. the .ics plan export), shown in Quick Look.
        private var previewURL: URL?

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
            // A "download" link (the .ics export) becomes a download we hand to Quick Look.
            if navigationAction.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
            // Calendar subscription links open the iOS Calendar app, which subscribes to the private feed.
            if scheme == "mailto" || scheme == "tel" || scheme == "webcal" {
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

        /// Responses the web view can't show (calendar files, attachments) become downloads.
        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse) async -> WKNavigationResponsePolicy {
            let mime = navigationResponse.response.mimeType?.lowercased() ?? ""
            let disposition = (navigationResponse.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition")?.lowercased() ?? ""
            if mime == "text/calendar" || disposition.hasPrefix("attachment") || !navigationResponse.canShowMIMEType {
                return .download
            }
            return .allow
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
        }

        // MARK: Downloads → Quick Look (a calendar file shows its events with "Add All" to Calendar)

        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String) async -> URL? {
            let name = suggestedFilename.isEmpty ? "catchup-ai-plan.ics" : suggestedFilename
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            try? FileManager.default.removeItem(at: url)
            previewURL = url
            return url
        }

        func downloadDidFinish(_ download: WKDownload) {
            Task { @MainActor in self.presentPreview() }
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            Task { @MainActor in
                self.presentAlert(title: "Download failed", message: "The file couldn't be downloaded. Check your connection and try again.")
            }
        }

        @MainActor private func presentPreview() {
            guard previewURL != nil, let top = Self.topViewController() else { return }
            let preview = QLPreviewController()
            preview.dataSource = self
            top.present(preview, animated: true)
        }

        @MainActor private func presentAlert(title: String, message: String) {
            guard let top = Self.topViewController() else { return }
            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            top.present(alert, animated: true)
        }

        @MainActor private static func topViewController() -> UIViewController? {
            let scene = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first { $0.activationState == .foregroundActive }
            var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
            while let presented = top?.presentedViewController { top = presented }
            return top
        }

        func numberOfPreviewItems(in controller: QLPreviewController) -> Int { previewURL == nil ? 0 : 1 }

        func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
            (previewURL ?? URL(fileURLWithPath: "/dev/null")) as NSURL
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
