/** The hero loop conversation: a short video generated from the hero image. */
import {
  VIDEO_TOOL,
  type AgentMessage,
  type VideoContent,
} from "../../shared/agentTypes";
import clip from "../assets/demo/hero-loop.mp4?inline";
import { assistant, call, result, T } from "./demoTranscript";

const HERO_LOOP: VideoContent = {
  type: "video",
  mimeType: "video/mp4",
  data: clip.slice(clip.indexOf(",") + 1),
};

const generate = call("v1", "bash", {
  command:
    "doppler run -- python veo.py --first-frame /tmp/hero-v2.png --seconds 4 --out /tmp/hero-loop.mp4",
});
const showLoop = call("v2", VIDEO_TOOL, {
  path: "/tmp/hero-loop.mp4",
  model: "veo-3.1-fast",
  prompt:
    "Seamless 4 second loop. Locked camera, very slow drift of thin clouds left to right, gentle shimmer on the water, sun steady. Keep the flat illustration style of the first frame. No audio.",
  size: "640×360",
  from: "/tmp/hero-v2.png",
});

const text = (t: string) => ({ type: "text" as const, text: t });

/** The hero loop conversation, oldest first. */
export const VIDEO_MESSAGES: AgentMessage[] = [
  {
    role: "user",
    content:
      "Turn the hero image into a 4 second loop for the landing page background. Slow drift, no sound.",
    timestamp: T,
  },
  assistant([
    text("Starting a Veo job with the hero as the first frame."),
    generate,
  ]),
  result(
    generate,
    "operation operations/7f3a91c2 started\npolling every 5s\ndone after 38s\nSaved /tmp/hero-loop.mp4",
  ),
  assistant([showLoop]),
  result(showLoop, "Shown to the user.", { video: HERO_LOOP }),
  assistant([text("Here's the loop. Want it slower, or longer?")], true),
];
