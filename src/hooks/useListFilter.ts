import { useState } from "react";

/** A Settings list's own search and picked filter chip (null is All). */
export function useListFilter() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  return { query, setQuery, filter, setFilter };
}
