/// <reference types="vite/client" />

/** Absolute path of sidecar/main.ts, set by vite.config.ts. */
declare const __PI_HOST_PATH__: string;
/** Absolute path of demo/tempo in demo mode (`npm run demo`), else null. */
declare const __DEMO_FOLDER__: string | null;
/** Where to report a healthy start when run by launcher/launch.sh, else null. */
declare const __HEALTH_FILE__: string | null;
