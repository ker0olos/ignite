# ignition

A native macOS app for working with AI coding agents.

## Requirements

- macOS
- [Node.js](https://nodejs.org) 22 or newer
- [Rust](https://rustup.rs)
- Xcode Command Line Tools: `xcode-select --install`

## Run it

```sh
git clone https://github.com/ker0olos/ignition.git
cd ignition
npm install
npm run tauri dev
```

The first launch compiles the Rust side and takes a few minutes. After that it
starts quickly.

For now the app is meant to be run this way, in dev mode, rather than built
and installed.
