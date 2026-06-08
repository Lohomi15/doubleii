#!/usr/bin/env bash
# doubleii — Safari Web Extension builder
#
# Usage: chmod +x safari/build.sh && ./safari/build.sh
#
# Requires: Xcode 14+ (full Xcode.app, not just Command Line Tools)
# Min target: macOS 14 (Sonoma) / Safari 17 — first version with full MV3 service workers
#
# What this does:
#   1. Checks for Xcode.app
#   2. Runs safari-web-extension-converter on the repo root
#   3. Generates the Xcode project at safari/DoubleiiSafari/
#   4. Prints next steps and smoke-test checklist

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SAFARI_DIR="$REPO_ROOT/safari"
OUTPUT_DIR="$SAFARI_DIR/DoubleiiSafari"

echo ""
echo "doubleii — Safari Web Extension builder"
echo "========================================"
echo ""

# ── 1. Check for Xcode.app ────────────────────────────────────────────────────
if [ ! -d "/Applications/Xcode.app" ]; then
  echo "ERROR: Xcode.app not found at /Applications/Xcode.app"
  echo ""
  echo "  Install Xcode (free) from the Mac App Store:"
  echo "  https://apps.apple.com/app/xcode/id497799835"
  echo ""
  echo "  After installing, run:"
  echo "    sudo xcode-select -s /Applications/Xcode.app"
  echo "  Then run this script again."
  exit 1
fi

# ── 2. Switch to Xcode toolchain ──────────────────────────────────────────────
XCODE_DEV="/Applications/Xcode.app/Contents/Developer"
CURRENT_DEV="$(xcode-select -p 2>/dev/null || true)"
if [ "$CURRENT_DEV" != "$XCODE_DEV" ]; then
  echo "Switching to Xcode toolchain (requires sudo)..."
  sudo xcode-select -s "$XCODE_DEV"
fi

# ── 3. Check converter is available ──────────────────────────────────────────
if ! xcrun --find safari-web-extension-converter &>/dev/null; then
  echo "ERROR: safari-web-extension-converter not found."
  echo "Make sure Xcode is fully installed (open Xcode.app once to accept the licence)."
  exit 1
fi

# ── 4. Remove previous output ─────────────────────────────────────────────────
if [ -d "$OUTPUT_DIR" ]; then
  echo "Removing previous build at $OUTPUT_DIR..."
  rm -rf "$OUTPUT_DIR"
fi

echo "Source:  $REPO_ROOT"
echo "Output:  $OUTPUT_DIR"
echo ""
echo "Running safari-web-extension-converter..."
echo ""

# ── 5. Convert ────────────────────────────────────────────────────────────────
xcrun safari-web-extension-converter \
  "$REPO_ROOT" \
  --project-location "$SAFARI_DIR" \
  --app-name "doubleii" \
  --bundle-identifier "io.doubleii.extension" \
  --swift \
  --macos-only \
  --no-open \
  --force

echo ""
echo "Done! Xcode project created at:"
echo "  $OUTPUT_DIR"
echo ""
echo "── Next steps ───────────────────────────────────────────────────────────"
echo ""
echo "  1. Open the Xcode project:"
echo "       open \"$OUTPUT_DIR/doubleii.xcodeproj\""
echo ""
echo "  2. Select scheme: doubleii (macOS)"
echo "  3. Build and Run (⌘R)  — the thin host app launches"
echo "  4. In Safari: Settings → Extensions → enable doubleii"
echo "  5. If needed: Safari menu → Develop → Allow Unsigned Extensions"
echo "     (re-enable after every Safari restart during development)"
echo ""
echo "── Smoke test checklist ─────────────────────────────────────────────────"
echo ""
echo "  □ Navigate to any article"
echo "  □ Select 2+ words — Explain button appears near selection"
echo "  □ Click Explain — shimmer loader appears"
echo "  □ Explanation text renders in bubble (no shimmer leftover)"
echo "  □ Token count and cost footer visible"
echo "  □ Press ⌥B (Option+B) with text selected — explain triggers"
echo "  □ Right-click selected text → Explain with doubleii in context menu"
echo "  □ Drag the bubble by its header — repositions correctly"
echo "  □ Click X — bubble closes"
echo "  □ Open doubleii popup → Settings → API key saves correctly"
echo "  □ History page: previous explanations appear"
echo "  □ Usage card in Settings shows token totals"
echo ""
