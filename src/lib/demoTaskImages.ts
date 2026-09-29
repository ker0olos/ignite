/** The demo tasks' reference images: small SVG mockups and sketches. */
import type { TaskImage } from "../../shared/tasks";

const svg = (name: string, body: string): TaskImage => ({
  type: "image",
  mimeType: "image/svg+xml",
  name,
  data: btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 224" font-family="system-ui, sans-serif">${body}</svg>`,
  ),
});

/** Tempo in dark, as the dark mode task was asked for. */
export const DARK_MOCKUP = svg(
  "dark-mockup.png",
  `<rect width="320" height="224" fill="#0f1115"/>
<rect width="84" height="224" fill="#171a21"/>
<rect x="14" y="18" width="52" height="8" rx="4" fill="#3a4050"/>
<rect x="14" y="40" width="56" height="6" rx="3" fill="#2a2f3a"/>
<rect x="14" y="54" width="44" height="6" rx="3" fill="#2a2f3a"/>
<rect x="14" y="68" width="50" height="6" rx="3" fill="#7c9cff"/>
<circle cx="200" cy="96" r="52" fill="none" stroke="#232834" stroke-width="10"/>
<circle cx="200" cy="96" r="52" fill="none" stroke="#7c9cff" stroke-width="10" stroke-dasharray="230 400" stroke-linecap="round" transform="rotate(-90 200 96)"/>
<text x="200" y="104" text-anchor="middle" font-size="24" font-weight="600" fill="#e8ebf2">18:40</text>
<rect x="150" y="170" width="100" height="26" rx="13" fill="#7c9cff"/>
<text x="200" y="187" text-anchor="middle" font-size="11" font-weight="600" fill="#0f1115">Pause</text>`,
);

/** The same screen in light, for comparison. */
export const LIGHT_MOCKUP = svg(
  "light-today.png",
  `<rect width="320" height="224" fill="#fafaf7"/>
<rect width="84" height="224" fill="#f0efe9"/>
<rect x="14" y="18" width="52" height="8" rx="4" fill="#cfccc2"/>
<rect x="14" y="40" width="56" height="6" rx="3" fill="#dedbd2"/>
<rect x="14" y="54" width="44" height="6" rx="3" fill="#dedbd2"/>
<rect x="14" y="68" width="50" height="6" rx="3" fill="#e2733b"/>
<circle cx="200" cy="96" r="52" fill="none" stroke="#ebe8e0" stroke-width="10"/>
<circle cx="200" cy="96" r="52" fill="none" stroke="#e2733b" stroke-width="10" stroke-dasharray="230 400" stroke-linecap="round" transform="rotate(-90 200 96)"/>
<text x="200" y="104" text-anchor="middle" font-size="24" font-weight="600" fill="#2b2a27">18:40</text>
<rect x="150" y="170" width="100" height="26" rx="13" fill="#2b2a27"/>
<text x="200" y="187" text-anchor="middle" font-size="11" font-weight="600" fill="#fafaf7">Pause</text>`,
);

/** The timer back at the start after a reload, marked up. */
export const RELOAD_BUG = svg(
  "after-reload.png",
  `<rect width="320" height="224" fill="#fafaf7"/>
<rect x="0" y="0" width="320" height="26" fill="#ecebe5"/>
<circle cx="14" cy="13" r="4" fill="#e0605a"/><circle cx="28" cy="13" r="4" fill="#e3b341"/><circle cx="42" cy="13" r="4" fill="#5fb85f"/>
<rect x="70" y="8" width="180" height="10" rx="5" fill="#fff"/>
<text x="160" y="112" text-anchor="middle" font-size="40" font-weight="600" fill="#2b2a27">25:00</text>
<text x="160" y="136" text-anchor="middle" font-size="11" fill="#8a877e">Focus</text>
<ellipse cx="160" cy="100" rx="78" ry="38" fill="none" stroke="#e0453a" stroke-width="3" stroke-dasharray="7 5"/>
<text x="248" y="176" text-anchor="middle" font-size="12" font-weight="700" fill="#e0453a">was 11:32!</text>
<path d="M236 164 L206 132" stroke="#e0453a" stroke-width="2.5" fill="none"/>`,
);

/** A pencil sketch of the weekly chart. */
export const CHART_SKETCH = svg(
  "weekly-sketch.png",
  `<rect width="320" height="224" fill="#fffdf6"/>
<g stroke="#3b3a36" stroke-width="2" fill="none" stroke-linecap="round">
<path d="M40 184 L292 186"/><path d="M42 40 L40 186"/>
<path d="M62 184 L62 120 L88 121 L88 184"/>
<path d="M100 184 L101 92 L126 91 L126 184"/>
<path d="M138 184 L138 140 L163 139 L164 184"/>
<path d="M176 184 L177 70 L202 71 L202 184"/>
<path d="M214 184 L214 104 L239 105 L240 184"/>
<path d="M252 184 L252 150 L276 149 L277 184"/>
</g>
<g font-size="11" fill="#6d6a60" text-anchor="middle">
<text x="75" y="202">M</text><text x="113" y="202">T</text><text x="151" y="202">W</text>
<text x="189" y="202">T</text><text x="227" y="202">F</text><text x="264" y="202">S</text>
</g>
<text x="176" y="30" font-size="14" font-weight="600" fill="#3b3a36" font-style="italic">minutes practised / day</text>
<path d="M176 60 C190 52 196 52 206 60" stroke="#e2733b" stroke-width="2" fill="none"/>
<text x="214" y="58" font-size="11" fill="#e2733b">best day</text>`,
);
