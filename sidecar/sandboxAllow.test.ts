// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  allowAlways,
  allowedFile,
  allowRuleFor,
  commandToAllow,
  loadAllowed,
  NOTHING_ALLOWED,
  runsOnly,
} from "./sandboxAllow.ts";

let home: string;
beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), "sandbox-allow-"));
});
afterEach(() => rm(home, { recursive: true, force: true }));

describe("loadAllowed", () => {
  it("is empty without a file, or with a bad one", async () => {
    expect(await loadAllowed(allowedFile(home))).toEqual(NOTHING_ALLOWED);
    await writeFile(join(home, "bad.json"), "not json");
    expect(await loadAllowed(join(home, "bad.json"))).toEqual(NOTHING_ALLOWED);
  });

  it("keeps only lists of strings", async () => {
    const file = join(home, "sandbox.json");
    await writeFile(file, JSON.stringify({ hosts: ["a.com", 3], read: "x" }));
    expect(await loadAllowed(file)).toEqual({
      ...NOTHING_ALLOWED,
      hosts: ["a.com"],
    });
  });
});

describe("allowAlways", () => {
  it("adds a rule once, creating the file", async () => {
    const file = allowedFile(home);
    const rule = { kind: "hosts", target: "example.com" } as const;
    await allowAlways(rule, file);
    await allowAlways(rule, file);
    await allowAlways({ kind: "sockets", target: "/x.sock" }, file);
    expect(JSON.parse(await readFile(file, "utf8"))).toEqual({
      ...NOTHING_ALLOWED,
      hosts: ["example.com"],
      sockets: ["/x.sock"],
    });
  });
});

describe("allowAlways at once", () => {
  it("keeps both of two answers given together", async () => {
    const file = allowedFile(home);
    await Promise.all([
      allowAlways({ kind: "hosts", target: "a.com" }, file),
      allowAlways({ kind: "hosts", target: "b.com" }, file),
    ]);
    expect((await loadAllowed(file)).hosts).toEqual(["a.com", "b.com"]);
  });

  it("still saves after one save failed", async () => {
    await writeFile(join(home, "blocker"), "a file, not a folder");
    const bad = join(home, "blocker", "sandbox.json");
    await expect(
      allowAlways({ kind: "hosts", target: "a.com" }, bad),
    ).rejects.toThrow();
    await allowAlways({ kind: "hosts", target: "b.com" }, allowedFile(home));
    expect((await loadAllowed(allowedFile(home))).hosts).toEqual(["b.com"]);
  });
});

describe("allowRuleFor", () => {
  it.each([
    [
      "network-outbound /Users/me/.docker/run/docker.sock",
      "sockets",
      "/Users/me/.docker/run/docker.sock",
    ],
    [
      "network-outbound example.com:443 (host is not on the allow list)",
      "hosts",
      "example.com",
    ],
    ["network-outbound example.com", "hosts", "example.com"],
    [
      "file-read-data /Users/me/My Files/a.txt",
      "read",
      "/Users/me/My Files/a.txt",
    ],
    ["file-write-create /Users/me/x", "write", "/Users/me/x"],
    [
      "http-request POST https://api.example.com/v1/x (Permission denied: …)",
      "hosts",
      "api.example.com",
    ],
  ])("%s", (summary, kind, target) => {
    expect(allowRuleFor(summary)).toEqual({ kind, target });
  });

  it("is null for anything else", () => {
    expect(allowRuleFor("mach-lookup com.apple.x")).toBeNull();
    expect(allowRuleFor("gibberish")).toBeNull();
  });
});

const run = (words: string[]) => ({ words, redirects: [] });

describe("runsOnly", () => {
  const line = [
    [run(["cd", "x"])],
    [run(["doppler", "run", "--", "npm", "test"]), run(["tail"])],
  ];

  it("is true when every pipeline starts with the command or is a cd", () => {
    expect(runsOnly(line, ["doppler run"])).toBe(true);
    expect(runsOnly(line, ["doppler"])).toBe(true);
  });

  it("is false when anything else starts, or the command doesn't", () => {
    const chained = [
      [run(["doppler", "run"])],
      [run(["curl", "evil.example"])],
    ];
    expect(runsOnly(chained, ["doppler run"])).toBe(false);
    expect(runsOnly([[run(["doppler", "secrets"])]], ["doppler run"])).toBe(
      false,
    );
    expect(runsOnly([[run(["cd", "x"])]], ["doppler run"])).toBe(false);
    const piped = [
      [run(["doppler", "run"])],
      [run(["cd", "x"]), run(["curl"])],
    ];
    expect(runsOnly(piped, ["doppler run"])).toBe(false);
    expect(runsOnly([[run(["./doppler", "run"])]], ["doppler run"])).toBe(
      false,
    );
  });
});

describe("commandToAllow", () => {
  it("is the one program and subcommand starting every pipeline", () => {
    const line = [
      [run(["cd", "x"])],
      [run(["doppler", "run", "--", "sh"]), run(["tail"])],
      [run(["doppler", "run", "--", "env"])],
    ];
    expect(commandToAllow(line)).toBe("doppler run");
  });

  it("is the program alone when no subcommand follows it", () => {
    expect(commandToAllow([[run(["doppler", "--version"])]])).toBe("doppler");
  });

  it("is the blocked program's command among others", () => {
    const line = [
      [run(["grep", "x"])],
      [run(["doppler", "secrets", "get"])],
      [run(["lsof"]), run(["head"])],
    ];
    expect(commandToAllow(line, "doppler")).toBe("doppler secrets");
    expect(commandToAllow(line, "security")).toBeNull();
    const two = [[run(["doppler", "run"])], [run(["doppler", "secrets"])]];
    expect(commandToAllow(two, "doppler")).toBeNull();
  });

  it("is null for several commands, none, or one run by path or assignment", () => {
    const two = [[run(["doppler", "run"])], [run(["doppler", "secrets"])]];
    expect(commandToAllow(two)).toBeNull();
    expect(commandToAllow([[run(["cd", "x"])]])).toBeNull();
    expect(commandToAllow([[run(["./doppler", "run"])]])).toBeNull();
    expect(commandToAllow([[run(["PATH=.", "doppler"])]])).toBeNull();
  });
});
