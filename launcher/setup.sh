#!/bin/bash
# `npm run setup`: adds an Ignition app to ~/Applications that runs this
# checkout through launcher/launch.sh. Safe to rerun.
set -euo pipefail
app=$(cd "$(dirname "$0")/.." && pwd)
bundle="$HOME/Applications/Ignition.app"

command -v cargo >/dev/null ||
  { echo "Ignition needs Rust: https://rustup.rs" >&2; exit 1; }
# Mods need Node's registerHooks, and the sidecar runs TypeScript directly.
node -e 'const [a, b] = process.versions.node.split(".").map(Number);
  process.exit(a > 22 || (a === 22 && b >= 18) ? 0 : 1)' ||
  { echo "Ignition needs Node.js 22.18 or newer." >&2; exit 1; }

mkdir -p "$HOME/.ignition/mods" "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
cp "$app/src-tauri/icons/icon.icns" "$bundle/Contents/Resources/icon.icns"

# Apps opened from Finder get a bare PATH; keep the one that found node and cargo.
cat >"$bundle/Contents/MacOS/launch" <<EOF
#!/bin/bash
export PATH="$PATH"
exec /bin/bash "$app/launcher/launch.sh"
EOF
chmod +x "$bundle/Contents/MacOS/launch"

# LSUIElement: no Dock icon for the launcher; the app it starts has its own.
cat >"$bundle/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIdentifier</key><string>com.ignition.launcher</string>
  <key>CFBundleName</key><string>Ignition</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
EOF

echo "Ignition is in ~/Applications. Opening it now."
open "$bundle"
