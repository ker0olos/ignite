# What the Ignite shortcut runs on Windows (made by setup.ps1), like launch.sh:
# updates the code, starts the app with the user's mods, and falls back if that
# doesn't come up. PowerShell reads the whole file first, so an update that
# rewrites it can't change it mid-run.
$app = Split-Path -Parent $PSScriptRoot
$state = Join-Path $HOME ".ignite\launch"
$mods = Join-Path $HOME ".ignite\mods"
New-Item -ItemType Directory -Force $state, $mods | Out-Null
$log = Join-Path $state "log"
Set-Location $app
Add-Type -AssemblyName System.Windows.Forms

function Log($text) { Add-Content $log $text }

function Notify($text) {
  $n = New-Object System.Windows.Forms.NotifyIcon
  $n.Icon = [System.Drawing.SystemIcons]::Information
  $n.Visible = $true
  $n.ShowBalloonTip(8000, "Ignite", $text, "Info")
  Register-ObjectEvent $n BalloonTipClosed -Action { $Sender.Dispose() } | Out-Null
}

function Run($exe) {
  & $exe @args *>> $log
  return $LASTEXITCODE -eq 0
}

function Serving {
  try {
    Invoke-WebRequest http://localhost:1420 -UseBasicParsing -TimeoutSec 2 | Out-Null
    return $true
  } catch { return $false }
}

# Resets only a checkout with no local edits or commits, so a working clone is left alone.
function MoveTo($commit) {
  $before = git rev-parse HEAD
  if (-not (Run git diff --quiet HEAD)) {
    Log "Not updating: local changes in $((git diff --name-only HEAD) -join ', ')"
    return $false
  }
  if (-not (Run git merge-base --is-ancestor HEAD origin/main)) {
    Log "Not updating: HEAD has commits origin/main doesn't"
    return $false
  }
  Run git reset -q --hard $commit | Out-Null
  # Quoted: PowerShell would take a bare -- for itself.
  if (-not (Run git diff --quiet $before $commit '--' package-lock.json)) {
    Run npm.cmd ci --no-audit --no-fund | Out-Null
  }
  return $true
}

# Moves to the latest upstream code, unless that exact version already failed.
function Update {
  if (-not (Run git fetch -q origin main)) { Log "Not updating: fetch failed"; return }
  $latest = git rev-parse origin/main
  if ($latest -eq (Get-Content (Join-Path $state "bad") -ErrorAction SilentlyContinue)) {
    Log "Not updating: $latest failed to start before"
    return
  }
  MoveTo $latest | Out-Null
}

# Polls a condition once a second; gives up early if the given process ends.
function WaitFor($seconds, $condition, $process) {
  for ($i = 0; $i -lt $seconds; $i++) {
    if (& $condition) { return $true }
    if ($process.HasExited) { return $false }
    Start-Sleep 1
  }
  return $false
}

# Runs the app until it quits. Fails if it never reports healthy (lib/health.ts).
function StartApp($withMods) {
  $healthy = Join-Path $state "healthy"
  Remove-Item $healthy -ErrorAction SilentlyContinue
  $exe = Join-Path $app "src-tauri\target\debug\ignite.exe"
  if (-not (Test-Path $exe)) { Notify "Setting up. The first start takes a few minutes." }
  # Built before the clock starts: a first build takes minutes.
  Push-Location src-tauri
  $built = Run cargo build --features no-console
  Pop-Location
  if (-not $built) { return $false }
  $env:IGNITE_MODS = $withMods
  $env:IGNITE_HEALTH_FILE = $healthy
  $vite = Start-Process node "node_modules\vite\bin\vite.js" -PassThru -WindowStyle Hidden
  if (-not (WaitFor 30 { Serving } $vite)) {
    Stop-Process $vite -ErrorAction SilentlyContinue
    return $false
  }
  $ignite = Start-Process $exe -WorkingDirectory (Join-Path $app "src-tauri") -PassThru
  if (-not (WaitFor 60 { Test-Path $healthy } $ignite)) {
    Stop-Process $ignite, $vite -ErrorAction SilentlyContinue
    return $false
  }
  git rev-parse HEAD | Set-Content (Join-Path $state "good")
  $ignite.WaitForExit()
  Stop-Process $vite -ErrorAction SilentlyContinue
  return $true
}

Log "--- $(Get-Date)"
# Otherwise the start would fail and look like a broken update.
if (Serving) {
  Notify "Port 1420 is taken, most likely by Ignite in dev mode. Quit it first."
  Start-Sleep 8 # the notification closes with this script
  exit
}
Update
if (StartApp $mods) { exit }
$good = Get-Content (Join-Path $state "good") -ErrorAction SilentlyContinue
if ($good -and $good -ne (git rev-parse HEAD)) {
  git rev-parse HEAD | Set-Content (Join-Path $state "bad")
  if (MoveTo $good) {
    Notify "The latest update didn't start with your changes, so Ignite is staying on the previous version."
    if (StartApp $mods) { exit }
  }
}
Notify "Ignite didn't start with your changes, so they're off for now."
if (StartApp "") { exit }
[System.Windows.Forms.MessageBox]::Show("Ignite couldn't start. The log is in ~\.ignite\launch\log.", "Ignite") | Out-Null
