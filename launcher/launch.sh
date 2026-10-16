#!/bin/bash
# What the Ignite app icon runs (made by setup.sh): updates the code, starts
# the app with the user's mods, and falls back if that doesn't come up.
# Everything is inside main, which bash reads whole, so an update that rewrites
# this file can't change it mid-run.

main() {
  set -uo pipefail
  app=$(cd "$(dirname "$0")/.." && pwd)
  state="$HOME/.ignite/launch"
  mods="$HOME/.ignite/mods"
  mkdir -p "$state" "$mods"
  exec >>"$state/log" 2>&1
  echo "--- $(date)"
  cd "$app" || exit 1
  # Otherwise the start would fail and look like a broken update.
  if curl -sf localhost:1420 >/dev/null; then
    notify "Port 1420 is taken, most likely by Ignite in dev mode. Quit it first."
    return
  fi

  update
  start_app "$mods" && return
  local good
  good=$(cat "$state/good" 2>/dev/null)
  if [ -n "$good" ] && [ "$good" != "$(git rev-parse HEAD)" ] &&
    git rev-parse HEAD >"$state/bad" && move_to "$good"; then
    notify "The latest update didn't start with your changes, so Ignite is staying on the previous version."
    start_app "$mods" && return
  fi
  notify "Ignite didn't start with your changes, so they're off for now."
  start_app "" && return
  alert "Ignite couldn’t start. The log is in ~/.ignite/launch/log."
}

notify() {
  if [ "$(uname -s)" = Darwin ]; then
    osascript -e "display notification \"$1\" with title \"Ignite\""
  else
    notify-send Ignite "$1" 2>/dev/null
  fi
}

alert() {
  if [ "$(uname -s)" = Darwin ]; then
    osascript -e "display alert \"$1\""
  else
    notify-send -u critical Ignite "$1" 2>/dev/null
  fi
}

# Moves to the latest upstream code, unless that exact version already failed.
update() {
  git fetch -q origin main || { echo "Not updating: fetch failed"; return 0; }
  local latest
  latest=$(git rev-parse origin/main)
  if [ "$latest" = "$(cat "$state/bad" 2>/dev/null)" ]; then
    echo "Not updating: $latest failed to start before"
    return 0
  fi
  move_to "$latest"
}

# Resets only a checkout with no local edits or commits, so a working clone is left alone.
move_to() {
  local before
  before=$(git rev-parse HEAD)
  if ! git diff --quiet HEAD; then
    echo "Not updating: local changes in $(git diff --name-only HEAD | paste -sd, -)"
    return 1
  fi
  if ! git merge-base --is-ancestor HEAD origin/main; then
    echo "Not updating: HEAD has commits origin/main doesn't"
    return 1
  fi
  git reset -q --hard "$1"
  git diff --quiet "$before" "$1" -- package-lock.json ||
    npm ci --no-audit --no-fund
}

# Polls a condition once a second; gives up early if the given process ends.
wait_for() {
  local seconds=$1 condition=$2 pid=${3:-}
  for _ in $(seq "$seconds"); do
    eval "$condition" && return 0
    [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null && return 1
    sleep 1
  done
  return 1
}

# Runs the app until it quits. Fails if it never reports healthy (lib/health.ts).
start_app() {
  rm -f "$state/healthy"
  [ -e src-tauri/target/debug/ignite ] ||
    notify "Setting up. The first start takes a few minutes."
  # Built before the clock starts: a first build takes minutes.
  (cd src-tauri && cargo build --features no-console) || return 1
  export IGNITE_MODS="$1" IGNITE_HEALTH_FILE="$state/healthy"
  node node_modules/vite/bin/vite.js &
  local vite=$!
  if ! wait_for 30 "curl -sf localhost:1420 >/dev/null" "$vite"; then
    kill "$vite"
    return 1
  fi
  # On macOS through a minimal .app bundle, so Stage Manager shows its icon.
  if [ "$(uname -s)" = Darwin ]; then
    (cd src-tauri && exec ./dev-runner.sh run) &
  else
    (cd src-tauri && exec ./target/debug/ignite) &
  fi
  local pid=$!
  if ! wait_for 60 "[ -f '$state/healthy' ]" "$pid"; then
    kill "$pid" "$vite"
    return 1
  fi
  git rev-parse HEAD >"$state/good"
  wait "$pid"
  kill "$vite"
}

main "$@"
exit
