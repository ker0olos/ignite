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

/** The Settings picker's appearance row, each choice shown in its theme. */
export const PICKER_PREVIEW = `<!doctype html>
<html>
<head>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif;
         background: #fbfaf7; color: #1f1d1a; }
  .panel { width: 340px; padding: 20px; border-radius: 16px; background: #f1eee8; }
  .label { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #7a756c; margin-bottom: 12px; }
  .row { display: flex; gap: 10px; }
  .opt { flex: 1; cursor: pointer; text-align: center; font-size: 13px; }
  .swatch { height: 64px; border-radius: 10px; border: 2px solid transparent; margin-bottom: 6px; overflow: hidden; display: flex; }
  .opt.on .swatch { border-color: #e0643b; }
  .light { background: #fbfaf7; } .dark { background: #161514; }
  .half { flex: 1; }
</style>
</head>
<body>
  <div class="panel">
    <div class="label">Appearance</div>
    <div class="row">
      <div class="opt on"><div class="swatch"><div class="half light"></div><div class="half dark"></div></div>System</div>
      <div class="opt"><div class="swatch light"></div>Light</div>
      <div class="opt"><div class="swatch dark"></div>Dark</div>
    </div>
  </div>
<script>
  document.querySelectorAll(".opt").forEach((o) => o.onclick = () =>
    document.querySelectorAll(".opt").forEach((p) => p.classList.toggle("on", p === o)));
</script>
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
