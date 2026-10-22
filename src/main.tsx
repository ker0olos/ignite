import "./lib/remoteFirst";
import { followLiveMods } from "./lib/liveReload";
import { prestartPiHost } from "./lib/piHost";
import { fitToScreenAndShow, isWindows } from "./lib/window";

// Dev and installed builds share an origin, so the demo's storage ends with its window.
if (__DEMO_FOLDER__) {
  Object.defineProperty(window, "localStorage", { value: sessionStorage });
}
// The sidecar is the slowest part of a start, so it starts first; imported
// statically, it doesn't wait behind the app's modules for its own chunk.
if (!__DEMO_FOLDER__) prestartPiHost();
// Shown before the app's modules load, so the window opens at once.
fitToScreenAndShow();
followLiveMods();
if (isWindows()) {
  document.documentElement.classList.add("windows");
}

// WebKit's own menu only offers Reload and Inspect Element; text fields keep theirs for paste.
document.addEventListener("contextmenu", (e) => {
  const target = e.target as Element;
  if (!target.closest?.("input, textarea, [contenteditable]")) {
    e.preventDefault();
  }
});

const [React, ReactDOM, { default: App }] = await Promise.all([
  import("react"),
  import("react-dom/client"),
  import("./App"),
  import("./index.css"),
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
