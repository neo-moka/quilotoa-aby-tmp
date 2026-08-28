import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/shared/lib/cn";
import { useTranscriptAnimationEnabled } from "./transcriptAnimationPreference";

const MARKS = ["first", "second", "third"] as const;
const STAGGER_SECONDS = 0.25;
const CYCLE_SECONDS = 1.8;

/**
 * "This agent is working" at the foot of the transcript.
 *
 * Three dots rather than three copies of the wordmark. It used to render the
 * logo three times at 20px and a quarter opacity, which is not a legible
 * signal at any fidelity — and `AbyMark` draws its letters as SVG `<text>`
 * rather than traced outlines, so at that size the three marks collapsed into
 * grey squares that read as missing glyphs. A progress cue wants a shape
 * designed for its size, not a brand asset shrunk past legibility.
 *
 * The wordmark is still right for the larger empty state ("Waiting for ACP
 * activity"), which is why this is a change here and not in `FuzzyLogo`.
 */
export function TurnLivenessIndicator({ className }: { className?: string }) {
  const animationsEnabled = useTranscriptAnimationEnabled();
  const shouldReduceMotion = useReducedMotion();
  const showStaggeredRow = animationsEnabled && !shouldReduceMotion;

  return (
    <div
      aria-label="Agent turn in progress"
      className={cn(
        "flex items-center gap-1.5 text-muted-foreground",
        !showStaggeredRow && "opacity-60",
        className,
      )}
      data-testid="turn-liveness-indicator"
      role="status"
    >
      {MARKS.map((mark, index) =>
        showStaggeredRow ? (
          <motion.span
            animate={{ opacity: [0.25, 1, 1, 0.25], y: [1, -1, -1, 1] }}
            className="h-1.5 w-1.5 rounded-full bg-current"
            key={mark}
            transition={{
              delay: index * STAGGER_SECONDS,
              duration: CYCLE_SECONDS,
              ease: "easeInOut",
              repeat: Number.POSITIVE_INFINITY,
              times: [0, 0.3, 0.7, 1],
            }}
          />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" key={mark} />
        ),
      )}
    </div>
  );
}
