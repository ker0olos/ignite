/**
 * Reloads the page when the launcher starts serving the frontend from Vite
 * (a mod changed), so mods hot-reload as in dev (launcher/serve.mjs).
 */
export function followLiveMods(enabled = __LIVE_RELOAD__) {
  if (!enabled) return;
  new EventSource("/__ignite/live").onmessage = () => location.reload();
}
