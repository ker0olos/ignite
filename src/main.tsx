import "./lib/remoteFirst";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { fitToScreenAndShow, isWindows } from "./lib/window";
import "./index.css";

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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
