#!/usr/bin/env node
import { spawn } from "node:child_process";
import net from "node:net";
import process from "node:process";

const DEFAULT_PORT = 1420;
const VITE = "vite";

const port = process.env.IGNITE_DEV_PORT
  ? Number(process.env.IGNITE_DEV_PORT)
  : await findFreePort(DEFAULT_PORT);

if (!process.env.IGNITE_DEV_PORT && port !== DEFAULT_PORT) {
  console.log(`Port ${DEFAULT_PORT} is busy; starting Vite on ${port}.`);
}

const child = spawn(VITE, ["--port", String(port), ...process.argv.slice(2)], {
  shell: true,
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

async function findFreePort(start, reserved = new Set()) {
  for (let port = start; port < start + 100; port += 1) {
    if (!reserved.has(port) && (await isPortFree(port))) {
      return port;
    }
  }
  throw new Error(`No free port found from ${start} to ${start + 99}.`);
}

async function isPortFree(port) {
  const checks = await Promise.all([
    canConnect(port, "127.0.0.1"),
    canConnect(port, "::1"),
  ]);
  return !checks.some(Boolean);
}

function canConnect(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    socket.setTimeout(500);
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => {
      socket.destroy();
      resolve(false);
    });
  });
}
