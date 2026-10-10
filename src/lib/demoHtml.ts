/** The pages the demo's dark mode conversation shows with show_artifact: Tempo's timer in either theme. */
export const THEME_PREVIEW = `<!doctype html>
<html data-theme="light">
<head>
<style>
  :root { --bg: #fbfaf7; --text: #1f1d1a; --muted: #7a756c; --accent: #e0643b; --card: #f1eee8; }
  :root[data-theme="dark"] { --bg: #161514; --text: #f2efe9; --muted: #9c968c; --accent: #f07a52; --card: #22201e; }
  * { box-sizing: border-box; }
  body { margin: 0; height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif;
         background: var(--bg); color: var(--text); transition: background .3s, color .3s; }
  .card { width: 260px; padding: 24px; border-radius: 16px; background: var(--card); text-align: center; transition: background .3s; }
  .label { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
  .time { font-size: 56px; font-weight: 600; font-variant-numeric: tabular-nums; margin: 8px 0 16px; }
  .accent { color: var(--accent); }
  .row { display: flex; gap: 8px; justify-content: center; }
  button { font: inherit; font-size: 13px; padding: 6px 14px; border-radius: 999px; cursor: pointer;
           border: 1px solid var(--muted); background: transparent; color: var(--text); }
  button.on { background: var(--accent); border-color: var(--accent); color: var(--bg); }
</style>
</head>
<body>
  <div class="card">
    <div class="label">Focus</div>
    <div class="time"><span id="m">25</span><span class="accent">:</span><span id="s">00</span></div>
    <div class="row">
      <button data-t="light" class="on">Light</button>
      <button data-t="dark">Dark</button>
      <button id="go">Start</button>
    </div>
  </div>
<script>
  const root = document.documentElement;
  document.querySelectorAll("[data-t]").forEach((b) => b.onclick = () => {
    root.dataset.theme = b.dataset.t;
    document.querySelectorAll("[data-t]").forEach((o) => o.classList.toggle("on", o === b));
  });
  let left = 25 * 60, timer;
  const show = () => {
    m.textContent = String(Math.floor(left / 60)).padStart(2, "0");
    s.textContent = String(left % 60).padStart(2, "0");
  };
  go.onclick = () => {
    if (timer) { clearInterval(timer); timer = null; go.textContent = "Start"; return; }
    timer = setInterval(() => { left = Math.max(0, left - 1); show(); }, 1000);
    go.textContent = "Pause";
  };
</script>
</body>
</html>`;

/** Tempo's Settings with the new Appearance choice, in daisyUI components (no CSS of its own). */
export const PICKER_PREVIEW = `<!doctype html>
<html data-theme="light">
<body class="bg-base-200 min-h-screen grid place-items-center">
  <div class="card bg-base-100 w-96 shadow-sm">
    <div class="card-body gap-4">
      <h2 class="card-title"><span class="i-lucide-settings"></span> Settings</h2>
      <fieldset class="fieldset">
        <legend class="fieldset-legend">Appearance</legend>
        <div class="join w-full">
          <input class="join-item btn btn-sm flex-1" type="radio" name="theme" aria-label="System" checked>
          <input class="join-item btn btn-sm flex-1" type="radio" name="theme" aria-label="Light">
          <input class="join-item btn btn-sm flex-1" type="radio" name="theme" aria-label="Dark">
        </div>
        <p class="label">System follows your Mac's appearance.</p>
      </fieldset>
      <label class="label justify-between text-base-content">
        <span class="flex items-center gap-2"><span class="i-lucide-volume-2"></span> Tick sound</span> <input type="checkbox" class="toggle toggle-primary" checked>
      </label>
      <label class="label justify-between text-base-content">
        <span class="flex items-center gap-2"><span class="i-lucide-coffee"></span> Long breaks</span> <span class="badge badge-soft badge-primary">every 4</span>
      </label>
    </div>
  </div>
</body>
</html>`;

/** The palette both themes use, as a markdown page. */
export const PALETTE_NOTES = `## Palette

| Token | Light | Dark |
| --- | --- | --- |
| \`--bg\` | \`#fbfaf7\` | \`#161514\` |
| \`--text\` | \`#1f1d1a\` | \`#f2efe9\` |
| \`--muted\` | \`#7a756c\` | \`#9c968c\` |
| \`--accent\` | \`#e0643b\` | \`#f07a52\` |
| \`--card\` | \`#f1eee8\` | \`#22201e\` |

The dark accent is a step lighter so the timer's colon keeps its contrast. **System** is the default and follows the OS live.`;
