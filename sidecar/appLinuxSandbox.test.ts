// @vitest-environment node
import { join } from "node:path";
import { expect, it } from "vitest";
import { installCommand, missingPackages } from "./appLinuxSandbox.ts";

const PATH = ["/usr/local/bin", "/usr/bin"].join(":");
const has =
  (...files: string[]) =>
  (path: string) =>
    files.includes(path);

it("names the packages of the tools missing from PATH", () => {
  expect(missingPackages(PATH, has())).toEqual(["bubblewrap", "socat"]);
  expect(missingPackages(PATH, has("/usr/bin/bwrap"))).toEqual(["socat"]);
  const both = has("/usr/bin/bwrap", "/usr/local/bin/socat");
  expect(missingPackages(PATH, both)).toEqual([]);
});

it("installs with the first package manager found, through sudo", () => {
  const exists = has("/usr/bin/sudo", "/usr/bin/dnf", "/usr/bin/zypper");
  expect(
    installCommand(["socat"], { path: PATH, root: false, exists }),
  ).toEqual(["sudo", "dnf", "install", "-y", "socat"]);
  const apt = has("/usr/bin/sudo", "/usr/bin/apt-get");
  expect(
    installCommand(["bubblewrap", "socat"], {
      path: PATH,
      root: false,
      exists: apt,
    }),
  ).toEqual(["sudo", "apt-get", "install", "-y", "bubblewrap", "socat"]);
});

it("skips sudo for root, and gives up without sudo or a known package manager", () => {
  const pacman = has(join("/usr/bin", "pacman"));
  expect(
    installCommand(["socat"], { path: PATH, root: true, exists: pacman }),
  ).toEqual(["pacman", "-S", "--needed", "--noconfirm", "socat"]);
  expect(
    installCommand(["socat"], { path: PATH, root: false, exists: pacman }),
  ).toBeNull();
  const nothing = has("/usr/bin/sudo", "/usr/bin/emerge");
  expect(
    installCommand(["socat"], { path: PATH, root: false, exists: nothing }),
  ).toBeNull();
});
