import { expect, it } from "vitest";
import { withFiles } from "../../shared/attachedFiles";
import { withComments } from "../../shared/sentComments";
import { readUserMessage } from "@/lib/userMessage";

it("splits a message into its typed text, images, files and comments", () => {
  const comment = {
    path: "a.ts",
    lines: [{ kind: "add" as const, num: 1, text: "x" }],
    text: "Why?",
  };
  const text = withComments(withFiles("Look", [{ path: "/d/a.pdf" }]), [
    comment,
  ]);
  const image = { type: "image" as const, data: "QQ==", mimeType: "image/png" };
  expect(
    readUserMessage({
      role: "user",
      content: [{ type: "text", text }, image],
      timestamp: 0,
    }),
  ).toEqual({
    text: "Look",
    images: [image],
    files: [{ path: "/d/a.pdf" }],
    comments: [comment],
  });
  expect(
    readUserMessage({ role: "user", content: "plain", timestamp: 0 }),
  ).toEqual({
    text: "plain",
    images: [],
    files: [],
    comments: [],
  });
});
