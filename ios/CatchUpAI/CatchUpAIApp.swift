import SwiftUI

/// CatchUp AI for iPhone and iPad: the live web app in a native shell. Sign-in, data and every security
/// control stay on the server; the shell adds native loading, offline and retry states, pull to refresh,
/// swipe navigation, home-screen quick actions, calendar files opened in iOS Calendar, and opens outside
/// links in Safari.
@main
struct CatchUpAIApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
