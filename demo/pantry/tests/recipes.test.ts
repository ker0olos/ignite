import { expect, it } from "vitest";
import { cookable, save } from "../src/recipes.ts";

it("lists only recipes you have everything for", () => {
  save({
    title: "Pancakes",
    ingredients: ["eggs", "flour"],
    steps: "Mix, fry.",
  });
  const titles = cookable(["eggs"]).map((r) => r.title);
  expect(titles).not.toContain("Pancakes");
});
