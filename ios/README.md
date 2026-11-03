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

Pick an iPhone simulator and press Run.

**On your own iPhone:** sign in to Xcode with your Apple ID (Xcode → Settings → Accounts), turn on Developer Mode on the
phone (Settings → Privacy & Security → Developer Mode, then restart), connect and unlock it, then run
`TEAM=<your team id> ios/install-on-iphone.sh`. A free Apple ID works; the app then needs re-installing every 7 days.

## Status
- Built with Xcode (`xcodebuild`, iOS Simulator SDK, no errors or warnings) and run on an iPhone 17 Pro simulator on
  2026-11-04: it opens the live site and shows the sign-in screen with the bot check.
- App Store: a web-view shell risks rejection under guideline 4.2 (minimum functionality). To publish, add native
  value first, such as push reminders for study blocks, a home-screen widget for today's plan, or offline viewing of the schedule.
