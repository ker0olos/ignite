import "./lib/remoteFirst";
import { fitToScreenAndShow, isWindows } from "./lib/window";

// Shown before the app's modules load, so the window opens at once.
fitToScreenAndShow();
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
