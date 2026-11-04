import SwiftUI
import UIKit

/// Carries a home-screen quick action (or a cold launch from one) to the web view.
@MainActor
final class QuickActionRouter: ObservableObject {
    static let shared = QuickActionRouter()
    @Published var pendingURL: URL?

    func handle(_ item: UIApplicationShortcutItem) -> Bool {
        guard let url = AppConfig.url(forQuickAction: item.type) else { return false }
        pendingURL = url
        return true
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession, options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        // A launch from a quick action arrives here before any scene exists.
        if let item = options.shortcutItem {
            Task { @MainActor in _ = QuickActionRouter.shared.handle(item) }
        }
        let configuration = UISceneConfiguration(name: nil, sessionRole: connectingSceneSession.role)
        configuration.delegateClass = SceneDelegate.self
        return configuration
    }
}

final class SceneDelegate: NSObject, UIWindowSceneDelegate {
    /// Quick action while the app is already running.
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        Task { @MainActor in completionHandler(QuickActionRouter.shared.handle(shortcutItem)) }
    }
}
