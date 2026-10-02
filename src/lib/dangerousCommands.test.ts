import { describe, expect, it } from "vitest";
import { COMMAND_CASES } from "@/test/dangerousCommandCases";
import { DANGEROUS_COMMANDS, dangerousCommand } from "./dangerousCommands";

const dangerous = (command: string) => dangerousCommand(command);

describe("dangerousCommand", () => {
  for (const [group, { stop, pass }] of Object.entries(COMMAND_CASES)) {
    describe(group, () => {
      it.each(stop)("stops %s", (command) => {
        expect(dangerous(command)).not.toBeNull();
      });
      it.each(pass)("lets %s run", (command) => {
        expect(dangerous(command)).toBeNull();
      });
    });
  }

  it("sees through quoting tricks", () => {
    expect(dangerous("r''m -rf /")).not.toBeNull();
    expect(dangerous('"rm" -rf ~')).not.toBeNull();
    expect(dangerous("\\rm -rf /")).not.toBeNull();
    expect(dangerous("su''do ls")).not.toBeNull();
  });

  it("checks every line of a script", () => {
    expect(dangerous("npm test\nrm -rf ~")).not.toBeNull();
  });

  it("explains why it stopped", () => {
    expect(dangerous("git push --force")).toBe(
      "Rewrites or deletes history on the remote",
    );
    expect(dangerous("sudo rm -rf /")).toBe(
      "Recursively deletes a broad path (/, ~, the folder, a system folder)",
    );
  });

  it("gives every rule a reason", () => {
    for (const { reason } of DANGEROUS_COMMANDS) expect(reason).toBeTruthy();
  });
});
