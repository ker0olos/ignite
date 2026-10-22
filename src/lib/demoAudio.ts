/** The audio clips of the hero conversation, synthesised on first use. */
import type { AudioContent } from "../../shared/agentTypes";

const RATE = 22050;

/** 16-bit mono PCM WAV of `samples` (-1..1) at `rate` Hz, as base64. */
export function wav(samples: Float32Array, rate: number): string {
  const bytes = new Uint8Array(44 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const tag = (at: number, text: string) =>
    [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  tag(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) =>
    view.setInt16(
      44 + i * 2,
      Math.round(Math.max(-1, Math.min(1, s)) * 32767),
      true,
    ),
  );
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

const clip = (samples: Float32Array): AudioContent => ({
  type: "audio",
  mimeType: "audio/wav",
  data: wav(samples, RATE),
});

function synthAmbient() {
  const seconds = 12;
  const out = new Float32Array(seconds * RATE);
  // A major: A3, E4, C#5
  const partials = [220, 329.63, 554.37];
  out.forEach((_, i) => {
    const t = i / RATE;
    const fade = Math.min(1, t / 1.5, (seconds - t) / 1.5);
    const tremolo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.3 * t);
    const pad = partials.reduce(
      (sum, f) => sum + Math.sin(2 * Math.PI * f * t) / partials.length,
      0,
    );
    out[i] = 0.35 * fade * tremolo * pad;
  });
  return out;
}

function synthVoice() {
  const out = new Float32Array(2.5 * RATE);
  const pitches = [200, 240, 190, 260, 220, 180, 210];
  const burst = 0.22;
  pitches.forEach((f, n) => {
    const start = Math.round((0.1 + n * 0.33) * RATE);
    for (let i = 0; i < burst * RATE; i++) {
      const t = i / RATE;
      const envelope = Math.sin((Math.PI * t) / burst) ** 2;
      let tone = 0;
      for (let h = 1; h <= 4; h++)
        tone += Math.sin(2 * Math.PI * f * h * t) / h;
      out[start + i] += 0.3 * envelope * tone;
    }
  });
  return out;
}

let ambientClip: AudioContent | undefined;
let voiceClip: AudioContent | undefined;

/** The 12 second ambient pad, made once on first use. */
export const ambient = () => (ambientClip ??= clip(synthAmbient()));

/** The 2.5 second voiceover, made once on first use. */
export const voice = () => (voiceClip ??= clip(synthVoice()));
