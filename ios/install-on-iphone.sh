#!/usr/bin/env bash
# Builds CatchUp AI and installs it on a connected iPhone.
# Needs: Xcode signed in to your Apple ID (Xcode → Settings → Accounts), Developer Mode on the iPhone
# (Settings → Privacy & Security → Developer Mode), and the phone unlocked and trusted by this Mac.
#   TEAM=<your team id> ios/install-on-iphone.sh
set -euo pipefail
cd "$(dirname "$0")"
: "${TEAM:?Set TEAM to your Apple team id (Xcode → Settings → Accounts → your team)}"
BUNDLE="${BUNDLE:-com.$(whoami | tr -cd 'a-z0-9').catchupai}"
DEVICE="$(xcrun devicectl list devices 2>/dev/null | awk '/physical/ && /connected/ {for (i=1;i<=NF;i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) print $i}' | head -1)"
[ -n "$DEVICE" ] || { echo "No connected, unlocked iPhone found."; exit 1; }
xcodegen generate >/dev/null
xcodebuild -project CatchUpAI.xcodeproj -scheme CatchUpAI -destination "id=$DEVICE" -derivedDataPath build \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE" -quiet build
xcrun devicectl device install app --device "$DEVICE" build/Build/Products/Debug-iphoneos/CatchUpAI.app
xcrun devicectl device process launch --device "$DEVICE" "$BUNDLE" || echo "Installed. If it won't open: iPhone Settings → General → VPN & Device Management → trust your developer profile."
