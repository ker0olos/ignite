/** UI/UX rules for show_artifact's HTML pages, added to the tool's description. */
export const ARTIFACT_GUIDE = `## UI/UX guide for HTML pages

Design rules for every mockup, design and demo you show.

### How to present designs

- When asked to design or redesign something, show several real options, not one: 6 to 8 alternatives as pages, each with a short name and one line on its idea. Mark the current design when there is one, for comparison. The user often combines parts ("B's header with D's list"), so keep each option's ideas separable. A quick look at one thing needs only one page.
- Each option is a different idea, not the same layout recolored. When the user asks for more, go further and be bolder, not more of the same.
- After a rejection, show concrete options rather than one more guess. Never make a subjective visual call for the user, or undo a pick they made.
- For a UX question (discoverability, conversion, tap targets), note what established guidance (Nielsen Norman, Material, Apple HIG) says beside each option.
- After a pick, iterate on that one; drop the losing options. Mockups are for ideas: once one is agreed, the real thing gets built, not more mockups.
- Check your page before showing it: every state it claims works, and nothing covers anything it shouldn't (a class clash painting a box over an image).
- Draw the states that matter at real size (empty, loading, filled, hover/selected, error), in light and dark (\`prefers-color-scheme\`, or a toggle setting \`data-theme\`). Test small things (icons, badges) at the size they really appear.
- Use realistic content (real names, numbers, paths, long titles), never lorem ipsum or a too-clean demo. Sample images vary (poses, angles, backgrounds) and never look broken.
- Give the board room: large cells, nothing crammed, and the page fits its frame without sideways scrolling.

### Fit the product

- When designing for an existing app, match its design language: its colors, radius, type and components. Write its look as CSS variables and leave daisyUI off (it restyles \`btn\`, \`card\` and more); daisyUI suits new, standalone pages. Don't invent a new aesthetic, and don't borrow a look that isn't the product's (a desktop app is not a terminal, even if the terminal look is pretty).
- Quiet by default: neutral greys, one accent, color only where something needs attention. No random or decorative colors.
- Not dead either: hierarchy through weight, size and contrast; brand logos in their real colors (\`i-simple-icons-*\`); syntax-colored code.
- Draw on established conventions (macOS, VS Code, Spotlight, Linear, Raycast) over novelty.
- Avoid the generic AI-made look (centered hero, gradient blobs, cards of emoji features). Design like a product team would ship it.
- Keep it light: thin lines and borders, nothing oversized (previews, icons, padding around images). A thin border beats a solid colored fill for containers, loading and status boxes included.
- Plain default components read as "basic and ugly". Give them care: real icons, considered spacing, a tinted surface where it helps.
- No stacks of filled grey cards under uppercase, letter-spaced section labels; clean rows, whitespace and avatars instead.
- Image placeholders use the theme's colors in a soft gradient with a small icon, so every state looks like one design family.
- Controls over photos or video get a scrim and a contrasting rounded button; the scrim doesn't darken nearby text.
- Fix overlaps with stacking order, not margin or offset hacks.

### Information design

- Group by what the user thinks in, not by the system's internal state. A downloads list groups by series, and each episode's state ("paused") is a detail on its row, not a section.
- Say the shared part once: a group header carries the common title and image, so rows shrink to what differs ("Episode 11", not the full title again).
- A row reads as a strong name, then muted details joined by " · " ("Episode 11  15% · 206 MB of 1.4 GB · paused"), with a thin progress bar or meta underneath when useful.
- Text-heavy is the most common complaint. Replace paragraphs and texty chips with structure: groups, icons, numbers, previews of the real content.
- Merge redundant pieces: a status and a button saying the same thing become one; two lines repeating each other become one. Never show a label or status that isn't true or adds nothing ("Ready" before it is).
- Show each fact once, in its most meaningful place; the same number three times on a card is noise.
- Name things in full (people's full names, not initials in circles).
- When nothing exists yet, put the create action where the user already looks, with a plain label ("Create your first project").
- The signature feature is prominent but never stands between the user and their main task.
- A user unsure how to start is a design problem: clearer entry points and a guided first step, not a tutorial. Fold multi-step flows into one screen where steps are optional, and let every optional step be skipped.
- Explain limits in one line (a daily cap and when it resets), and make a locked control open that explanation instead of doing nothing.
- Status lives on the item it's about, not its parent, and what waits on the user stays in view so they never scroll to find it.
- Lead with what the user decides on (the actual command, the actual diff), and hide what only experts need (ids, internal paths, counts) behind a click.
- Never truncate meaning away with an ellipsis: wrap to two lines, shorten the label, or show a count. Long lists get a max height and scroll, or a "more" with a count.
- A one-line summary footer or header beats a stats dashboard ("16 on disk · open Downloads").

### Layout and density

- Breathing room: when there's space, pad generously; cramped is a bug. Space between groups, around dividers, inside cards. A cramped list gets more row padding or a new arrangement, never smaller text.
- A short explanation sits beside its button on one line rather than stacked above it.
- Siblings match: rows at the same level share height, padding and alignment; children rows aren't slimmer than parents. Edges align, and borders look the same on all four sides.
- Empty things are small: an empty input is one line and grows with content; no dead space after text inside a box; empty items still keep a sensible min width.
- Collapse bulk by default (long output, unchanged lines, finished items) with a clear way to expand.
- Make the whole row or card the click target, not a small link inside it. Clickable things look clickable, and nothing else does.
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
- Selection is unmistakable: filled with a check, not a faint highlight.
- Add actions are easy to find: a labelled button or a dashed "add" slot beside the items, never a bare tiny "+".
- Upsell and other secondary calls to action use a tonal (tinted) button, not a heavy solid primary one, with a short label ("Go Pro") placed where the user hits the limit.
- Primary actions are clearly sized buttons with text; secondary ones are quiet text buttons or small icon buttons in a corner. Remove duplicate buttons, separators and labels.
- Destructive actions are styled as such and ask for confirmation.
- Dialogs: one tone throughout (no two-tone footer), a close X and Esc, full-width buttons in narrow dialogs.
- Every action has a keyboard path, and its shortcut is shown.

### Icons

- One consistent set (\`i-lucide-*\`), one icon per concept, sized with the text (about 1em to 16px). Prefer an icon to a texty chip where the meaning is clear, but don't put icons on every button.
- Monochrome for UI, real colors only for brand logos. Real icons, never emoji, for controls and categories.

### Touch

- Touch targets at least 44 to 48px.
- Bottom sheets open smoothly and drag down to close, not only by tapping outside.
- A swipe gesture also has a visible button that does the same.
- Swiping to the next item never flashes the previous one's content: hold it, or show a placeholder until the new one is ready.

### States and motion

- Loading: skeletons shaped like the content, replaced only when real content is ready; never a flash of empty state. One loading indicator, not two.
- Feedback on every action at once (the item appears, the button reflects it).
- Focus returns to where the user types once a menu or dialog closes.
- A disabled area stays readable and says why ("Waiting for the upload to finish").
- Errors in plain language with the fix as a button ("Continue", "Retry"), not instructions to type.
- Empty states are minimal: a quiet mark or icon and the next action or shortcut, no filler.
- Motion is quiet and short (150 to 250ms fades and slides); respect \`prefers-reduced-motion\` with a static fallback, but a loading state must still read as alive, never stuck. Fades are visible, not imperceptible. Decorative animation never recolors the content it sits behind. No layout jumps.
- Waiting shows a countdown ("Resets in 2h 14m"), not a vague rule, and thin progress rings.

### Words

- Short labels ("Export", not "Export selected items to file"), plain language, no jargon or internal names. Use the product's own name for each thing, the same everywhere. Friendly and plain beats clever ("Hang tight", not "Warming up the engines").
- No filler ("Take a breather!"): say the fact and stop. Be kind in limit and error states ("Sorry, resets in 2h").
- No em dashes in interface text.
`;
