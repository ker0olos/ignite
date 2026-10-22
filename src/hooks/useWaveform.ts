import { useEffect, useState } from "react";
import type { AudioContent } from "../../shared/agentTypes";
import { peaks } from "@/lib/media";
import { base64Bytes } from "@/lib/audio";

export const WAVEFORM_BARS = 80;

/** The audio's waveform bars (0..1), decoded once per clip; null while decoding or when it can't be. */
export function useWaveform(audio: AudioContent): number[] | null {
  const [done, setDone] = useState<{ data: string; bars: number[] } | null>(
    null,
  );
  useEffect(() => {
    if (typeof OfflineAudioContext === "undefined") return;
    let live = true;
    new OfflineAudioContext(1, 1, 44100)
      .decodeAudioData(base64Bytes(audio.data).buffer as ArrayBuffer)
      .then((buffer) => {
        if (live) {
          setDone({
            data: audio.data,
            bars: peaks(buffer.getChannelData(0), WAVEFORM_BARS),
          });
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [audio.data]);
  return done?.data === audio.data ? done.bars : null;
}
