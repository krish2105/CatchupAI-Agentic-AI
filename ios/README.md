# CatchUp AI for iOS

A SwiftUI app (iOS 17+, iPhone and iPad) that runs the live CatchUp AI web app in a native shell. Sign-in, data and
every security control stay on the server. The shell adds:

- native loading progress, an offline screen with retry, and pull to refresh
- swipe back and forward
- the session persists between launches
- links to other sites (GitHub, docs, email) open in Safari, while the app, Supabase sign-in and the bot check stay inside

## Build and run
Requires **Xcode 16+** (from the Mac App Store) and XcodeGen.

```bash
brew install xcodegen
cd ios && xcodegen && open CatchUpAI.xcodeproj
```

Pick an iPhone simulator and press Run. For a device, set your team under Signing & Capabilities.

## Status
- Built with Xcode (`xcodebuild`, iOS Simulator SDK, no errors or warnings) and run on an iPhone 17 Pro simulator on
  2026-11-04: it opens the live site and shows the sign-in screen with the bot check.
- App Store: a web-view shell risks rejection under guideline 4.2 (minimum functionality). To publish, add native
  value first, such as push reminders for study blocks, a home-screen widget for today's plan, or offline viewing of the schedule.
