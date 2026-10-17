// `npm run uninstall`: removes the launcher and what Ignite keeps only to run
// (sidecar/appUninstall.ts), asking first; your conversations, settings and
// tasks stay unless `npm run uninstall -- --all`. The clone itself stays too.
import { homedir } from "node:os";
import { dirname } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import "./nodeCheck.mjs";

const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--all");
if (unknown.length) {
  console.error(
    `Unknown option ${unknown.join(" ")}. Uninstall takes --all, which removes your conversations and settings too.`,
  );
  process.exit(1);
}
const all = args.includes("--all");

const { APP_NAME, APP_TITLE } = await import("../src/lib/app.ts");
const { keptItems, uninstall, uninstallTargets } =
  await import("../sidecar/appUninstall.ts");
const clone = dirname(dirname(fileURLToPath(import.meta.url)));
const home = homedir();
const place = { clone, home, platform: process.platform, env: process.env };

const targets = uninstallTargets(place, all);
if (!targets.length) {
  console.log(`${APP_TITLE} isn't set up here; nothing to remove.`);
  process.exit(0);
}
console.log(`Quit ${APP_TITLE} first. This removes:`);
for (const target of targets) console.log(`  ${target}`);
const kept = all ? [] : keptItems(home);
if (kept.length)
  console.log(
    `and keeps your ${kept.join(", ")} in ~/.${APP_NAME} (npm run uninstall -- --all removes them too).`,
  );
const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question("Remove them? [y/N] ");
rl.close();
if (/^y/i.test(answer.trim())) {
  await uninstall(place, all);
  console.log(`Removed. This clone (${clone}) stays; delete it to finish.`);
}
