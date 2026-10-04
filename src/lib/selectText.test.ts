import { afterEach, expect, it } from "vitest";
import { selectAllOf } from "./selectText";

afterEach(() => {
  window.getSelection()?.removeAllRanges();
  document.body.innerHTML = "";
});

it("selects all of the element's text", () => {
  document.body.innerHTML = "<p>Run <code>npm run check</code> now</p>";
  selectAllOf(document.querySelector("code")!);
  expect(window.getSelection()?.toString()).toBe("npm run check");
});

it("keeps a selection the user dragged", () => {
  document.body.innerHTML = "<p>Run <code>npm run check</code> now</p>";
  const text = document.querySelector("code")!.firstChild!;
  window.getSelection()!.setBaseAndExtent(text, 0, text, 3);
  selectAllOf(document.querySelector("code")!);
  expect(window.getSelection()?.toString()).toBe("npm");
});
