/** Selects all of `element`'s text, unless the click ended a drag that selected some of it. */
export function selectAllOf(element: Element) {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed) return;
  selection.selectAllChildren(element);
}
