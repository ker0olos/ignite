import { Pause, Play } from "lucide-react";
import type { AudioContent } from "../../../shared/agentTypes";
import { Button } from "@/components/ui/button";
import { useAudioPlayer } from "@/hooks/useAudioPlayer";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { WAVEFORM_BARS, useWaveform } from "@/hooks/useWaveform";
import { clock } from "@/lib/audio";
import { cn } from "@/lib/utils";

const FLAT = Array.from({ length: WAVEFORM_BARS }, () => 0);

/** A clip with a play button, its waveform (click or arrow keys to seek) and the time. */
export function AudioPlayer({ audio }: { audio: AudioContent }) {
  const { ref, playing, time, duration, toggle, seek } = useAudioPlayer();
  const bars = useWaveform(audio) ?? FLAT;
  const url = useMediaUrl(audio);
  const done = duration ? time / duration : 0;
  const step = (event: React.KeyboardEvent) => {
    const delta = { ArrowLeft: -0.05, ArrowRight: 0.05 }[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    seek(done + delta);
  };
  return (
    <div className="flex items-center gap-3 border-b p-3">
      <audio
        ref={ref}
        src={url === "missing" ? undefined : url}
        preload="metadata"
      />
      <Button
        size="icon"
        variant="outline"
        className="rounded-full"
        aria-label={playing ? "Pause" : "Play"}
        onClick={toggle}
      >
        {playing ? <Pause /> : <Play />}
      </Button>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(time)}
        onKeyDown={step}
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          seek((event.clientX - box.left) / box.width);
        }}
        className="flex h-10 flex-1 cursor-pointer items-center gap-px"
      >
        {bars.map((peak, i) => (
          <span
            key={i}
            style={{ height: `max(2px, ${peak * 100}%)` }}
            className={cn(
              "flex-1 rounded-full",
              i / bars.length < done
                ? "bg-foreground"
                : "bg-muted-foreground/40",
            )}
          />
        ))}
      </div>
      <span className="font-mono text-[12px] text-muted-foreground tabular-nums">
        {clock(time)} / {clock(duration)}
      </span>
    </div>
  );
}
