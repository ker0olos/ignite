/** The hero image conversation: an image generated with fal, marked up, then edited. */
import {
  IMAGE_TOOL,
  type AgentMessage,
  type ImageContent,
} from "../../shared/agentTypes";
import { assistant, call, result, T } from "./demoTranscript";

const svg = (body: string): ImageContent => ({
  type: "image",
  mimeType: "image/svg+xml",
  data: btoa(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360">${body}</svg>`,
  ),
});

const scene = (sky: string, sun: string, lake: string, ripples: string) =>
  `<rect width="640" height="360" fill="${sky}"/>${sun}<path d="M0 230 L90 150 L170 210 L260 120 L360 215 L450 160 L540 220 L640 170 L640 360 L0 360Z" fill="#6f8fa3"/><path d="M0 262 L120 190 L230 250 L330 180 L450 255 L560 200 L640 240 L640 360 L0 360Z" fill="#4c6b7f"/><rect y="270" width="640" height="90" fill="${lake}"/><path d="M60 300 H220 M300 318 H460 M420 296 H560" stroke="${ripples}" stroke-width="3" stroke-linecap="round"/><path d="M0 340 Q160 322 320 340 T640 336 L640 360 L0 360Z" fill="#355063"/>`;

const DAWN = scene(
  "#a9c6d6",
  '<circle cx="470" cy="150" r="34" fill="#f3e6c4"/>',
  "#86a9bc",
  "#a9c6d6",
);
const HERO_DAWN = svg(DAWN);
const HERO_SUNSET = svg(
  scene(
    "#e7a07a",
    '<circle cx="470" cy="190" r="40" fill="#ffd38a"/>',
    "#9a9aa6",
    "#f0b892",
  ),
);
const MARKED_DAWN = svg(
  `${DAWN}<ellipse cx="330" cy="80" rx="290" ry="62" fill="none" stroke="#ef4444" stroke-width="7"/>`,
);

const generate = call("m1", "bash", {
  command:
    'doppler run -p tempo -c dev -- curl -s https://fal.run/fal-ai/flux-pro/v1.1 -H "Authorization: Key $FAL_KEY" -d @req.json -o /tmp/hero-v1.png',
});
const showV1 = call("m2", IMAGE_TOOL, {
  path: "/tmp/hero-v1.png",
  model: "fal-ai/flux-pro/v1.1",
  prompt:
    "Wide flat illustration of a calm alpine lake at dawn, layered blue mountains, pale sun low over the ridge, soft paper texture, muted palette, no text.",
  avoid: "text, watermark, people, harsh contrast",
  size: "1536×864",
});
const edit = call("m3", "bash", {
  command:
    "doppler run -- node edit.mjs --model gemini-3-pro-image --in /tmp/hero-v1.png --mask /tmp/mask.png --out /tmp/hero-v2.png",
});
const showV2 = call("m4", IMAGE_TOOL, {
  path: "/tmp/hero-v2.png",
  model: "gemini-3-pro-image",
  prompt:
    "Inside the mask, repaint the sky as a warm sunset: peach to amber, the sun lower and golden. Keep the mountains, lake and flat illustration style unchanged.",
  size: "1536×864",
  editOf: "/tmp/hero-v1.png",
});

const text = (t: string) => ({ type: "text" as const, text: t });

/** The hero image conversation, oldest first. */
export const MEDIA_MESSAGES: AgentMessage[] = [
  {
    role: "user",
    content:
      "Make a hero image for the landing page: a calm lake with mountains at dawn, flat illustration, wide. Use fal with flux.",
    timestamp: T,
  },
  assistant([
    text(
      "Generating with FLUX 1.1 Pro on fal. The key comes from your Doppler config, so it never lands in the conversation.",
    ),
    generate,
  ]),
  result(
    generate,
    '{"request_id":"9c1e4f7a","seed":4211,"timings":{"inference":5.8},"images":[{"width":1536,"height":864}]}\nSaved /tmp/hero-v1.png',
  ),
  assistant([showV1]),
  result(showV1, "Shown to the user.", { image: HERO_DAWN }),
  assistant(
    [
      text(
        "Here it is. Mark it up or tell me what to change, and I'll edit this one rather than start over.",
      ),
    ],
    true,
  ),
  {
    role: "user",
    content: [
      MARKED_DAWN,
      text(
        "@image1 make the circled sky a warm sunset. Keep the mountains and lake as they are.",
      ),
    ],
    timestamp: T,
  },
  assistant([
    text(
      "Editing v1 with Nano Banana Pro. Your circle becomes the mask, so only the sky changes; same seed to keep the rest close.",
    ),
    edit,
  ]),
  result(edit, "mask: 1 region, 18% of the image\nSaved /tmp/hero-v2.png"),
  assistant([showV2]),
  result(showV2, "Shown to the user.", { image: HERO_SUNSET }),
  assistant(
    [text("Done: only the sky changed. Drag the line to compare.")],
    true,
  ),
];
