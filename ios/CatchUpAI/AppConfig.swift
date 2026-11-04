import Foundation

enum AppConfig {
    /// The deployed app. Change for a staging build.
    static let baseURL = URL(string: "https://catchupai-chi.vercel.app")!
    static let startURL = baseURL.appendingPathComponent("dashboard")
    /// Hosts that may load inside the app: the app itself, Supabase auth and the Turnstile bot check.
    static let inAppHosts: Set<String> = ["catchupai-chi.vercel.app", "keczcmggohfmgyjsdevk.supabase.co", "challenges.cloudflare.com"]
    static let userAgentSuffix = "CatchUpAI-iOS/1.1"

    /// Home-screen quick actions (press and hold the app icon). Types match UIApplicationShortcutItems in Info.plist.
    static let quickActions: [String: String] = [
        "ai.catchup.schedule": "/planner?view=month",
        "ai.catchup.copilot": "/assistant",
        "ai.catchup.focus": "/focus",
        "ai.catchup.progress": "/insights#tracker",
    ]

    static func url(forQuickAction type: String) -> URL? {
        guard let path = quickActions[type] else { return nil }
        return URL(string: path, relativeTo: baseURL)?.absoluteURL
    }
}
