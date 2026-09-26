#!/bin/zsh
# Captures raw app screens for the App Store art through the debug harness
# (`-STScreen <name>`, see PaperCoach/App/DebugScreenHarness.swift).
#
#   capture.sh <simulator udid> <iphone|ipad> <screen> [screen ...]
#
# The simulator must be booted with a Debug build of PaperCoach installed. Each
# screen is launched fresh, given a few seconds to settle, and saved as
# captures/<device>/<screen>.png. The status bar is set to Apple's 9:41 first.
set -euo pipefail

udid=$1 device=$2; shift 2
bundle=com.softroni.papercoach
out=${0:A:h}/captures/$device
mkdir -p $out

xcrun simctl status_bar $udid override --time "9:41" --dataNetwork wifi --wifiMode active \
  --wifiBars 3 --cellularMode active --cellularBars 4 --operatorName "" \
  --batteryState discharging --batteryLevel 100

for screen in "$@"; do
  xcrun simctl terminate $udid $bundle 2>/dev/null || true
  xcrun simctl launch $udid $bundle -STScreen $screen >/dev/null
  sleep ${SETTLE:-4}
  xcrun simctl io $udid screenshot --type=png $out/$screen.png >/dev/null 2>&1
  if [[ $device == ipad ]]; then
    # iPadOS 26 runs the app as a screen-sized window and draws its resize handle,
    # a grey arc, in the bottom-right corner. It is system chrome, not the app, so
    # it is covered with the background beside it (the white tab bar or panel).
    bg=$(magick $out/$screen.png -format '%[pixel:p{1990,2720}]' info:)
    magick $out/$screen.png -fill "$bg" -draw 'rectangle 1996,2684 2063,2751' $out/$screen.png
  fi
  echo "$device/$screen.png"
done
xcrun simctl terminate $udid $bundle 2>/dev/null || true
