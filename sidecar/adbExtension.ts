/**
 * adb and adb_screenshot: Android devices over adb, run outside the sandbox
 * (it can't reach adb's server on localhost:5037). Auto asks only for host
 * paths outside the folder (approvalPolicy.ts).
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { ADB_TOOL, adbNeverExits } from "../shared/adb.ts";
import { IMAGE_TOOL } from "../shared/agentTypes.ts";
import { APP_NAME } from "../src/lib/app.ts";
import { resultText, run } from "./gitRun.ts";

/** adb on PATH, else in the Android SDK (the app may start without the user's shell PATH). */
export function adbProgram(
  env: NodeJS.ProcessEnv = process.env,
  exists: (path: string) => boolean = existsSync,
  windows = process.platform === "win32",
): string {
  const adb = windows ? "adb.exe" : "adb";
  const sdks = [
    env.ANDROID_HOME,
    env.ANDROID_SDK_ROOT,
    join(homedir(), "Library/Android/sdk"),
    join(homedir(), "Android/Sdk"),
  ];
  const onPath = (env.PATH ?? "")
    .split(windows ? ";" : delimiter)
    .map((d) => join(d, adb));
  const inSdk = sdks.flatMap((s) =>
    s ? [join(s, "platform-tools", adb)] : [],
  );
  return [...onPath, ...inSdk].find(exists) ?? adb;
}

const Serial = Type.Optional(
  Type.String({
    description:
      "Device serial from `adb devices`, when more than one is attached.",
  }),
);

const serialArgs = (serial?: string) => (serial ? ["-s", serial] : []);

// Long enough for a large install; anything that streams was refused already.
const TIMEOUT_MS = 2 * 60_000;

function screencap(serial?: string, signal?: AbortSignal): Promise<Buffer> {
  const args = [...serialArgs(serial), "exec-out", "screencap", "-p"];
  return new Promise((resolve, reject) =>
    execFile(
      adbProgram(),
      args,
      {
        encoding: "buffer",
        maxBuffer: 64 * 1024 * 1024,
        timeout: 30_000,
        signal,
      },
      (error, stdout, stderr) =>
        error
          ? reject(new Error(stderr.toString() || error.message))
          : resolve(stdout),
    ),
  );
}

export default function adbTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: ADB_TOOL,
    label: "adb",
    description:
      "Run adb with these arguments (no shell on this side): devices, install, logcat -d, shell …, " +
      "shell input tap/text/keyevent, shell am start, pull, push.",
    promptSnippet: "adb / adb_screenshot: drive Android devices and emulators",
    promptGuidelines: [
      "Use the adb tool, not bash, for adb: bash's sandbox can't reach the adb server.",
      "Never run commands that don't exit (logcat without -d, shell without a command).",
      "Ask before wiping data, uninstalling apps you didn't install, or rebooting a device.",
    ],
    parameters: Type.Object({
      args: Type.Array(Type.String(), {
        description: 'e.g. ["shell", "pm", "list", "packages"]',
      }),
      serial: Serial,
    }),
    async execute(_id, { args, serial }, signal, _onUpdate, ctx) {
      const never = adbNeverExits(args);
      if (never) throw new Error(never);
      const result = await run(adbProgram(), [...serialArgs(serial), ...args], {
        cwd: ctx.cwd,
        signal,
        timeout: TIMEOUT_MS,
      });
      const text = resultText(result);
      if (result.code !== 0) throw new Error(text);
      return { content: [{ type: "text", text }], details: undefined };
    },
  });

  pi.registerTool({
    name: "adb_screenshot",
    label: "adb screenshot",
    description: `Take a screenshot of an Android device's screen. It's also saved to a file, to show the user with ${IMAGE_TOOL}.`,
    parameters: Type.Object({ serial: Serial }),
    async execute(id, { serial }, signal) {
      const png = await screencap(serial, signal);
      const file = join(tmpdir(), `${APP_NAME}-adb-${id}.png`);
      await writeFile(file, png);
      return {
        content: [
          { type: "text", text: `Saved to ${file}` },
          {
            type: "image",
            data: png.toString("base64"),
            mimeType: "image/png",
          },
        ],
        details: undefined,
      };
    },
  });
}
