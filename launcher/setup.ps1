# `npm run setup` on Windows (through setup.mjs): adds an Ignite shortcut to
# the Start Menu that runs this checkout through launcher\launch.ps1. Safe to rerun.
$ErrorActionPreference = "Stop"
$app = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
  Write-Error "Ignite needs Rust: https://rustup.rs"
}
# Mods need Node's registerHooks, and the sidecar runs TypeScript directly.
# No double quotes in the script: Windows PowerShell strips them from native arguments.
node -e 'const [a, b] = process.versions.node.split(/\./).map(Number);
  process.exit(a > 22 || (a === 22 && b >= 18) ? 0 : 1)'
if ($LASTEXITCODE -ne 0) { Write-Error "Ignite needs Node.js 22.18 or newer." }

$ignite = Join-Path $HOME ".ignite"
New-Item -ItemType Directory -Force (Join-Path $ignite "mods"), (Join-Path $ignite "bin") | Out-Null

# The Start Menu starts apps with the PATH saved for the user, not this
# terminal's; keep the one that found node and cargo.
$launch = Join-Path $ignite "bin\ignite-launch.ps1"
$path = $env:PATH -replace "'", "''"
$script = (Join-Path $PSScriptRoot "launch.ps1") -replace "'", "''"
Set-Content -Encoding UTF8 $launch "`$env:PATH = '$path'`n& '$script'"

$programs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $programs "Ignite.lnk"))
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launch`""
$shortcut.IconLocation = Join-Path $app "src-tauri\icons\icon.ico"
$shortcut.WindowStyle = 7 # minimized, so no console flashes up
$shortcut.Save()

Write-Host "Ignite is in the Start Menu. Opening it now."
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $shortcut.Arguments
