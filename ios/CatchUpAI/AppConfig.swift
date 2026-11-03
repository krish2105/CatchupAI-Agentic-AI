import Foundation

enum AppConfig {
    /// The deployed app. Change for a staging build.
    static let baseURL = URL(string: "https://catchupai-chi.vercel.app")!
    static let startURL = baseURL.appendingPathComponent("dashboard")
    /// Hosts that may load inside the app: the app itself, Supabase auth and the Turnstile bot check.
    static let inAppHosts: Set<String> = ["catchupai-chi.vercel.app", "keczcmggohfmgyjsdevk.supabase.co", "challenges.cloudflare.com"]
    static let userAgentSuffix = "CatchUpAI-iOS/1.0"
}
