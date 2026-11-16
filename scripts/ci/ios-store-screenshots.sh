#!/usr/bin/env bash
# Real UI captures from an installed Release app, with no student credentials.
set -euo pipefail
app="$1"
out="$2"
work="$3"
mkdir -p "$out" "$work"
udid=$(xcrun simctl list devices available --json | jq -r '
  [.devices | to_entries[] | select(.key | test("iOS")) | .value[]
    | select(.name | test("^iPhone (1[4-9]|[2-9][0-9]) Pro$"))] | last | .udid')
test -n "$udid" && test "$udid" != null
xcrun simctl boot "$udid" || true
xcrun simctl bootstatus "$udid" -b
xcrun simctl install "$udid" "$app"
xcrun simctl ui "$udid" appearance light
xcrun simctl status_bar "$udid" override --time '9:41' --dataNetwork wifi \
  --wifiMode active --wifiBars 3 --batteryState charged --batteryLevel 100
bundle exec ruby scripts/ci/ios-store-screenshots.rb "$work"
xcodebuild test -project "$work/StoreScreenshots.xcodeproj" -scheme StoreScreenshots \
  -configuration Release -sdk iphonesimulator -destination "platform=iOS Simulator,id=$udid" \
  -parallel-testing-enabled NO -derivedDataPath "$work/build" \
  -resultBundlePath "$out/screenshots.xcresult" CODE_SIGN_IDENTITY=- DEVELOPMENT_TEAM=
xcrun xcresulttool export attachments --path "$out/screenshots.xcresult" --output-path "$out/images"
xcrun simctl shutdown "$udid"
