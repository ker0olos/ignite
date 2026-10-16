// Prevents additional console window on Windows in release, DO NOT REMOVE!!
// `no-console`: the launcher's debug build, which has no terminal to log to.
#![cfg_attr(
    any(not(debug_assertions), feature = "no-console"),
    windows_subsystem = "windows"
)]

fn main() {
    app_lib::run()
}
