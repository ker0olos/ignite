import type { Item } from "@/components/settings/sections";

/** The one row a list shows when its search and filter leave nothing. */
export const noMatchItem = (section: Item["section"], text: string): Item => ({
  section,
  title: text,
  titleView: <p className="text-[13px] text-muted-foreground">{text}</p>,
});
