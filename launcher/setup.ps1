# `npm run setup` on Windows (through setup.mjs, once it has built the app):
# adds an Ignite shortcut to the Start Menu that runs launcher\launch.mjs. Safe to rerun.
$ErrorActionPreference = "Stop"
$app = Split-Path -Parent $PSScriptRoot

$ignite = Join-Path $HOME ".ignite"
New-Item -ItemType Directory -Force (Join-Path $ignite "bin") | Out-Null

# The Start Menu starts apps with the PATH saved for the user, not this
# terminal's; keep the one that found node and cargo.
$launch = Join-Path $ignite "bin\ignite-launch.ps1"
$path = $env:PATH -replace "'", "''"
$script = (Join-Path $PSScriptRoot "launch.mjs") -replace "'", "''"
Set-Content -Encoding UTF8 $launch "`$env:PATH = '$path'`n& node '$script'"

$programs = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
$shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $programs "Ignite.lnk"))
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launch`""
$shortcut.IconLocation = Join-Path $app "src-tauri\icons\icon.ico"
$shortcut.WindowStyle = 7 # minimized, so no console flashes up
$shortcut.Save()

Write-Host "Ignite is in the Start Menu. Opening it now."
Start-Process powershell.exe -WindowStyle Hidden -ArgumentList $shortcut.Arguments
