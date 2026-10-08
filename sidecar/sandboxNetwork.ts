/**
 * The sandbox's network policy for hosts off its allow list: names that
 * resolve only to public addresses, and only reads (GET, HEAD, OPTIONS).
 */
import type { FilterRequestCallback } from "@anthropic-ai/sandbox-runtime";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { networkInterfaces } from "node:os";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Whether `host` matches one of `patterns` ("github.com", "*.github.com"). */
export function hostListed(host: string, patterns: string[]): boolean {
  const name = host.replace(/\.$/, "");
  return patterns.some((p) =>
    p.startsWith("*.") ? name.endsWith(p.slice(1)) : name === p,
  );
}

const LOCAL = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
] as const)
  LOCAL.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [
  ["::", 127],
  ["fc00::", 7],
  ["fe80::", 10],
] as const)
  LOCAL.addSubnet(net, bits, "ipv6");

/** Whether `address` is this machine's or its network's (loopback, private, link-local). */
function isLocal(address: string): boolean {
  const ip = address.replace(/^::ffff:(?=\d+\.)/i, "");
  const own = Object.values(networkInterfaces()).flat();
  return (
    LOCAL.check(ip, isIP(ip) === 6 ? "ipv6" : "ipv4") ||
    own.some((i) => i?.address === ip)
  );
}

/**
 * Whether an off-list host passes the proxy's host check: a name that
 * resolves only to public addresses, never an IP literal. The runtime lets
 * `localhost` and literals through, which would reach local services like
 * Chrome's debugging port or the remote access server.
 * ponytail: resolved here and again when the proxy dials (DNS rebinding);
 * pass the checked address to the dial if the runtime ever takes one.
 */
export async function hostReachable({ host }: { host: string }) {
  try {
    const name = (
      isIP(host) ? host : new URL(`http://${host}`).hostname
    ).replace(/^\[|\]$/g, "");
    if (isIP(name) || /(^|\.)localhost\.?$/i.test(name)) return false;
    const addresses = await lookup(name, { all: true });
    return !addresses.some((a) => isLocal(a.address));
  } catch {
    return false;
  }
}

/**
 * Lets reads (GET, HEAD, OPTIONS) reach any host and anything reach the
 * `listed()` ones. A WebSocket opens with a GET but sends freely, so it isn't
 * a read. The 403's reason says "permission denied" so the run asks the user.
 */
export function readsOnly(listed: () => string[]): FilterRequestCallback {
  return async (request) => {
    const read = READS.has(request.method) && !request.headers.has("upgrade");
    if (read || hostListed(new URL(request.url).hostname, listed()))
      return { action: "allow" };
    // The runtime's deny path throws uncaught (crashing the sidecar) when the
    // body is still arriving, so it's read to the end first.
    // ponytail: a denied upload is buffered whole; fine for API calls.
    await request.body?.pipeTo(new WritableStream()).catch(() => {});
    return {
      action: "deny",
      reason:
        "Permission denied: only reads (GET, HEAD, OPTIONS) reach hosts off the sandbox's allow list",
    };
  };
}
