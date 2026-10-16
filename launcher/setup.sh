#!/bin/bash
# `npm run setup` on macOS and Linux (through setup.mjs): adds an Ignite
# launcher that runs this checkout through launcher/launch.sh, an app in
# ~/Applications on macOS or an app menu entry on Linux. Safe to rerun.
set -euo pipefail
app=$(cd "$(dirname "$0")/.." && pwd)

command -v cargo >/dev/null ||
  { echo "Ignite needs Rust: https://rustup.rs" >&2; exit 1; }
# Mods need Node's registerHooks, and the sidecar runs TypeScript directly.
node -e 'const [a, b] = process.versions.node.split(".").map(Number);
  process.exit(a > 22 || (a === 22 && b >= 18) ? 0 : 1)' ||
  { echo "Ignite needs Node.js 22.18 or newer." >&2; exit 1; }
mkdir -p "$HOME/.ignite/mods"

# Apps opened from Finder or a menu get a bare PATH; keep the one that found
# node and cargo.
write_launch() {
  cat >"$1" <<EOF
#!/bin/bash
export PATH="$PATH"
exec /bin/bash "$app/launcher/launch.sh"
EOF
  chmod +x "$1"
}

setup_mac() {
  local bundle="$HOME/Applications/Ignite.app"
  mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
  cp "$app/src-tauri/icons/icon.icns" "$bundle/Contents/Resources/icon.icns"
  write_launch "$bundle/Contents/MacOS/launch"
  # LSUIElement: no Dock icon for the launcher; the app it starts has its own.
  cat >"$bundle/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIdentifier</key><string>com.ignite.launcher</string>
  <key>CFBundleName</key><string>Ignite</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSUIElement</key><true/>
  <key>NSAppSleepDisabled</key><true/>
</dict>
</plist>
EOF
  echo "Ignite is in ~/Applications. Opening it now."
  open "$bundle"
}

setup_linux() {
  local launch="$HOME/.ignite/bin/ignite-launch"
  local menu="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  mkdir -p "$(dirname "$launch")" "$menu"
  write_launch "$launch"
  cat >"$menu/ignite.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Ignite
Comment=Run AI coding agents on your projects
Exec="$launch"
Icon=$app/src-tauri/icons/icon.png
Terminal=false
Categories=Development;
StartupWMClass=ignite
EOF
  command -v update-desktop-database >/dev/null &&
    update-desktop-database -q "$menu" || true
  echo "Ignite is in your app menu. Opening it now."
  nohup "$launch" >/dev/null 2>&1 &
}

case "$(uname -s)" in
  Darwin) setup_mac ;;
  Linux) setup_linux ;;
  *) echo "Run npm run setup (on Windows it uses setup.ps1)." >&2; exit 1 ;;
esac
