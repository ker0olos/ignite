/** The page the demo's dark mode conversation embeds with show_html: Tempo's timer in either theme. */
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
