/** UI/UX rules for show_artifact's HTML pages, added to the tool's description. */
export const ARTIFACT_GUIDE = `## UI/UX guide for HTML pages

Design rules for every mockup, design and demo you show.

### How to present designs

- When asked to design or redesign something, show several real options, not one: 4 to 8 alternatives as pages, each with a short name and one line on its idea. Mark the current design when there is one, for comparison. The user often combines parts ("B's header with D's list"), so keep each option's ideas separable. A quick look at one thing needs only one page.
- After a pick, iterate on that one; drop the losing options.
- Draw the states that matter at real size (empty, loading, filled, hover/selected, error), in light and dark (\`prefers-color-scheme\`, or a toggle setting \`data-theme\`). Test small things (icons, badges) at the size they really appear.
- Use realistic content (real names, numbers, paths, long titles), never lorem ipsum or a too-clean demo.
- Give the board room: large cells, nothing crammed, and the page fits its frame without sideways scrolling.

### Fit the product

- When designing for an existing app, match its design language: its colors, radius, type and components. Write its look as CSS variables and leave daisyUI off (it restyles \`btn\`, \`card\` and more); daisyUI suits new, standalone pages. Don't invent a new aesthetic, and don't borrow a look that isn't the product's (a desktop app is not a terminal, even if the terminal look is pretty).
- Quiet by default: neutral greys, one accent, color only where something needs attention. No random or decorative colors.
- Not dead either: hierarchy through weight, size and contrast; brand logos in their real colors (\`i-simple-icons-*\`); syntax-colored code.
- Draw on established conventions (macOS, VS Code, Spotlight, Linear, Raycast) over novelty.

### Information design

- Group by what the user thinks in, not by the system's internal state. A downloads list groups by series, and each episode's state ("paused") is a detail on its row, not a section.
- Say the shared part once: a group header carries the common title and image, so rows shrink to what differs ("Episode 11", not the full title again).
- A row reads as a strong name, then muted details joined by " · " ("Episode 11  15% · 206 MB of 1.4 GB · paused"), with a thin progress bar or meta underneath when useful.
- Text-heavy is the most common complaint. Replace paragraphs and texty chips with structure: groups, icons, numbers, previews of the real content.
- Merge redundant pieces: a status and a button saying the same thing become one; two lines repeating each other become one.
- Lead with what the user decides on (the actual command, the actual diff), and hide what only experts need (ids, internal paths, counts) behind a click.
- Never truncate meaning away with an ellipsis: wrap to two lines, shorten the label, or show a count. Long lists get a max height and scroll, or a "more" with a count.
- A one-line summary footer or header beats a stats dashboard ("16 on disk · open Downloads").

### Layout and density

- Breathing room: when there's space, pad generously; cramped is a bug. Space between groups, around dividers, inside cards.
- Siblings match: rows at the same level share height, padding and alignment; children rows aren't slimmer than parents. Edges align, and borders look the same on all four sides.
- Empty things are small: an empty input is one line and grows with content; no dead space after text inside a box; empty items still keep a sensible min width.
- Collapse bulk by default (long output, unchanged lines, finished items) with a clear way to expand.
- Make the whole row or card the click target, not a small link inside it.
- Works narrow too: no fixed widths that overflow a phone, no 50/50 splits in portrait, nothing that collides when it wraps.

### Type

- Interface text around 13px (macOS), body text 14px or more with a readable measure (~60ch) and ~1.6 line height. Not smaller; small text must not look bold.
- System UI font for apps (\`system-ui, -apple-system\`); a mono like Menlo for code. A Google Font only when the design calls for one.
- Paths are short: relative to the folder, or \`~/\`.
- Keyboard shortcuts render as small bordered key caps (\`⌘K\`), not plain text.

### Color and theme

- Define colors as CSS variables (or daisyUI theme tokens) with light and dark values; never one-off hex values sprinkled through the markup.
- Status colors mean one thing each: green done/ok, amber working or needs attention, red destructive or error. Nothing gets a status color it hasn't earned (an open item isn't green).
- Hover, selected and focused look different from each other.
- Overlays (dialogs, palettes) sit on a dimmed, blurred backdrop.

### Controls

- Menus and pickers look like real menus: a styled popover, never a raw native \`<select>\`.
- Show the few likely options first, the rest under "More".
- Primary actions are clearly sized buttons with text; secondary ones are quiet text buttons or small icon buttons in a corner. Remove duplicate buttons, separators and labels.
- Destructive actions are styled as such and ask for confirmation.
- Dialogs: one tone throughout (no two-tone footer), a close X and Esc, full-width buttons in narrow dialogs.
- Every action has a keyboard path, and its shortcut is shown.

### Icons

- One consistent set (\`i-lucide-*\`), one icon per concept, sized with the text (about 1em to 16px). Prefer an icon to a texty chip where the meaning is clear, but don't put icons on every button.
- Monochrome for UI, real colors only for brand logos.

### States and motion

- Loading: skeletons shaped like the content, replaced only when real content is ready; never a flash of empty state. One loading indicator, not two.
- Feedback on every action at once (the item appears, the button reflects it).
- A disabled area stays readable and says why ("Waiting for the upload to finish").
- Errors in plain language with the fix as a button ("Continue", "Retry"), not instructions to type.
- Empty states are minimal: a quiet mark or icon and the next action or shortcut, no filler.
- Motion is quiet and short (150 to 250ms fades and slides); respect \`prefers-reduced-motion\` with a static fallback. No layout jumps.

### Words

- Short labels ("Export", not "Export selected items to file"), plain language, no jargon or internal names. Use the product's own name for each thing, the same everywhere.
`;
