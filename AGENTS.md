# AGENTS.md

Guidance for contributors and AI coding agents working in this repo.
Tauri 2 + React 19 + TypeScript + Tailwind v4 + shadcn/ui. Early prototype:
the UI shell works (folders, file tree, settings, multi-window); the agent is
not wired up yet.

## Structure

```
src/                     React frontend (almost all logic lives here)
  main.tsx               Entry: sizes and shows the window, renders <App>
  App.tsx                Composes hooks, picks Welcome vs Workspace
  index.css              Tailwind + shadcn theme tokens (light/dark)
  components/
    ui/                  shadcn/ui components (CLI-generated)
    Welcome.tsx          Screen when no folder is open
    Sidebar.tsx          Title-bar strip + file tree
    Workspace.tsx        Header and task composer for the open folder
    FileTree.tsx         Lazy directory tree with file-type icons
    SettingsDialog.tsx   Settings modal
  hooks/
    useFolders.ts        Recent folders + this window's open folder
    useTheme.ts          Persisted theme, applied as the `dark` class
    useFolderDrop.ts     Drag-and-drop folders onto the window
  lib/
    store.ts             Persisted state (tauri-plugin-store) + cross-window sync
    menu.ts              macOS menu bar
    window.ts            Window sizing and New Window
    paths.ts             basename / dirname / ~ shortening
    utils.ts             `cn` class-name helper (shadcn)
src-tauri/               Rust shell: registers plugins, nothing else
  tauri.conf.json        App and main-window config
  capabilities/          Permissions the frontend may use
.github/workflows/ci.yml Runs `npm run build` + `npm run check` on macOS
```

State lives in `state.json` (app data folder). Recent folders and the theme
are shared by all windows; each window keeps its own open folder.

## Commands

- Dev app: `npm run tauri dev` (frontend hot-reloads; `src-tauri/` changes relaunch)
- Verify before finishing any change: `npm run check` (tsc, ESLint, clippy, Prettier, rustfmt)
- Auto-format: `npm run format`
- Add a UI primitive: `npx shadcn@latest add <name>`
- Add a Tauri plugin: `npm run tauri add <plugin>` (wires npm, Cargo, `lib.rs` and a default permission)

## Conventions

- **Logic goes in TypeScript.** Prefer an official Tauri plugin's JS API over a
  custom Rust command. `src-tauri/src/lib.rs` should stay plugin registration only.
- **Permissions are explicit.** Any new Tauri API call needs its permission in
  `src-tauri/capabilities/default.json`; missing ones fail silently at runtime.
- **Layout of `src/`:** screens and pieces in `components/`, stateful logic in
  `hooks/`, non-React helpers in `lib/`. Do not hand-edit `components/ui/`
  beyond small fixes; it is shadcn-generated.
- **Styling:** Tailwind v4 with shadcn tokens (`bg-background`, `text-muted-foreground`,
  `bg-sidebar`, …). No hard-coded colors. Interface text is 13px (`text-[13px]`)
  to match macOS.
- **Comments:** sparse; only for non-obvious constraints. Deliberate shortcuts
  are marked `ponytail:` with their limit and upgrade path.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org)
  (`feat(scope): …`, `fix(scope): …`). CI must pass.

## macOS gotchas (learned the hard way)

- `window.setTitle()` resets `trafficLightPosition`, and there is no runtime API
  to re-apply it. Do not change window titles.
- `maximize()` and the `maximized` config zoom over Stage Manager's strip.
  Window size is set in `lib/window.ts` from the monitor work area instead.
- The store plugin's `onKeyChange`/`onChange` filter by a per-webview resource
  id and miss changes from other windows. Use `onStoreChange` in `lib/store.ts`.
- The menu bar is global. Only the focused window may call `setAppMenu`,
  otherwise menu actions run in the wrong window.
- Setting a custom app menu drops the default Edit menu; keep the Edit items or
  copy/paste stops working.
- New windows are created in `lib/window.ts`, which mirrors the main window's
  options in `tauri.conf.json`. Keep the two in sync.
