# untitledharness

A native macOS app for working with AI coding agents.

## Requirements

- macOS
- [Node.js](https://nodejs.org) 22 or newer
- [Rust](https://rustup.rs)
- Xcode Command Line Tools: `xcode-select --install`

## Run it

```sh
git clone https://github.com/lead-led/unnamed-harness.git
cd unnamed-harness
npm install
npm run tauri dev
```

The first launch compiles the Rust side and takes a few minutes. After that it
starts quickly.

## Build the app

```sh
npm run tauri build
```

The `.app` and `.dmg` end up in `src-tauri/target/release/bundle/`.
