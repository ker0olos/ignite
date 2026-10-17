// Imported first by setup and uninstall, before any TypeScript loads: older
// Nodes can't run it (nor mods' registerHooks).
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 22 || (major === 22 && minor < 18)) {
  console.error(
    `Ignite needs Node.js 22.18 or newer (this is ${process.versions.node}).`,
  );
  process.exit(1);
}
