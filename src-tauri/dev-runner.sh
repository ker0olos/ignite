#!/bin/bash
# Stage Manager only shows icons of .app bundles, so `tauri dev` runs the
# debug binary from a minimal bundle. Anything but `run` goes straight to cargo.
set -e
[ "$1" = run ] || exec cargo "$@"
shift

cargo_args=()
while [ $# -gt 0 ] && [ "$1" != -- ]; do cargo_args+=("$1"); shift; done
[ "$1" = -- ] && shift

cargo build "${cargo_args[@]}"

name=$(sed -n 's/^name = "\(.*\)"$/\1/p' Cargo.toml | head -1)
title=$(sed -n 's/^  "productName": "\(.*\)",$/\1/p' tauri.conf.json)
target=${CARGO_TARGET_DIR:-target}/debug
app="$target/$title.app/Contents"
mkdir -p "$app/MacOS" "$app/Resources"
cp -f icons/icon.icns "$app/Resources/icon.icns"
cp -f "$target/$name" "$app/MacOS/$name"
cat > "$app/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>$name</string>
  <key>CFBundleIdentifier</key><string>dev.$name</string>
  <key>CFBundleName</key><string>$title</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
EOF

exec "$app/MacOS/$name" "$@"
