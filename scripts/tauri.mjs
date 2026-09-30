#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_PORT = 1420;
const CLI = fileURLToPath(
  new URL("../node_modules/@tauri-apps/cli/tauri.js", import.meta.url),
);

const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("-"));

if (command === "dev") {
  const port = await findFreePort(DEFAULT_PORT);
  const hmrPort = process.env.TAURI_DEV_HOST
    ? await findFreePort(port + 1, new Set([port]))
    : undefined;
  const config = { build: { devUrl: `http://localhost:${port}` } };
  const env = {
    ...process.env,
    IGNITE_DEV_PORT: String(port),
    ...(hmrPort ? { IGNITE_DEV_HMR_PORT: String(hmrPort) } : {}),
  };
  if (port !== DEFAULT_PORT) {
    console.log(`Port ${DEFAULT_PORT} is busy; starting Tauri on ${port}.`);
  }
  run(withConfig(args, JSON.stringify(config)), env);
} else {
  run(args, process.env);
}

function withConfig(runArgs, config) {
  const separator = runArgs.indexOf("--");
  if (separator === -1) {
    return [...runArgs, "--config", config];
  }
  return [
    ...runArgs.slice(0, separator),
    "--config",
    config,
    ...runArgs.slice(separator),
  ];
}

function run(runArgs, env) {
  const child = spawn(process.execPath, [CLI, ...runArgs], {
    env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code ?? 1);
    }
  });
  child.on("error", (error) => {
    console.error(error.message);
    process.exit(1);
  });
}

async function findFreePort(start, reserved = new Set()) {
  for (let port = start; port < start + 100; port += 1) {
    if (!reserved.has(port) && (await isPortFree(port))) {
      return port;
    }
  }
  throw new Error(`No free port found from ${start} to ${start + 99}.`);
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
  });
}
