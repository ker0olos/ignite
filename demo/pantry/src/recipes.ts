import { db } from "./db.ts";

export type Recipe = {
  id: number;
  title: string;
  ingredients: string[];
  steps: string;
};

type Row = Omit<Recipe, "ingredients"> & { ingredients: string };

const toRecipe = (row: Row): Recipe => ({
  ...row,
  ingredients: JSON.parse(row.ingredients),
});

/** Recipes whose ingredients are all in `have`; every recipe when it's empty. */
export function cookable(have: string[]): Recipe[] {
  const rows = db.prepare("SELECT * FROM recipes").all() as Row[];
  return rows
    .map(toRecipe)
    .filter((r) =>
      r.ingredients.every((i) => !have.length || have.includes(i)),
    );
}

export function save(recipe: Omit<Recipe, "id">): Recipe {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO recipes (title, ingredients, steps) VALUES (?, ?, ?)")
    .run(recipe.title, JSON.stringify(recipe.ingredients), recipe.steps);
  return { id: Number(lastInsertRowid), ...recipe };
}
