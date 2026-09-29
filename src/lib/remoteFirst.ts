import { installRemote } from "./remote";

// Imported first by main.tsx, so the stand-in for Tauri is there before any module reads it.
installRemote();
