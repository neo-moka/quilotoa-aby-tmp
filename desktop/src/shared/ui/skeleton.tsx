import * as React from "react";
import { SkeletonRoot as HeroSkeletonRoot } from "@heroui/react/skeleton";

import { cn } from "@/shared/lib/cn";

/**
 * `Skeleton` sits on HeroUI's `SkeletonRoot`; `SkeletonReveal` below does not,
 * because HeroUI has nothing of the sort.
 *
 * HeroUI's `.skeleton` base lands in `layer(components)` (see
 * `shared/styles/globals/heroui.css`), so the Tailwind utilities here win on
 * radius and fill, and `skeleton.css` — imported unlayered, which outranks
 * every layer — keeps owning the animation. What the base contributes is the
 * three declarations this wrapper never had: `pointer-events-none`,
 * `position: relative` and `overflow: hidden`. None of the 202 call sites pass
 * children, so the latter two are inert today.
 *
 * The animation is the part that had to be neutralised rather than adopted.
 * `animationType="none"` cancels HeroUI's default `shimmer`; the pulse stays on
 * `is-pulsing` because `.skeleton--pulse` is a bare `animate-pulse`, which has
 * no `prefers-reduced-motion` opt-out, while `skeleton.css` stops this one both
 * under reduced motion and on reveal (`.t-skel.is-revealed … { animation: none
 * }`). Adopting HeroUI's pulse would trade a 1s ease-in-out for a 2s
 * cubic-bezier and drop that opt-out.
 *
 * Two claims recorded when this wrapper was first kept do not survive contact
 * with the installed code, and are corrected here so they are not re-derived:
 * `skeletonVariants` does expose `animationType: none`
 * (`@heroui/styles/dist/components/skeleton/skeleton.styles.js`), and
 * `waitForAnimations` cannot hang on a looping animation — it races the settle
 * against a 1s ceiling (`tests/helpers/animations.ts`), and this component's
 * own pulse is already `infinite`.
 */

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  pulsing?: boolean;
};

function Skeleton({ className, pulsing = true, ...props }: SkeletonProps) {
  return (
    <HeroSkeletonRoot
      animationType="none"
      aria-hidden="true"
      className={cn(
        "t-skel-bar rounded-md bg-primary/10",
        pulsing && "is-pulsing",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The crossfade choreography, kept in full. HeroUI's skeleton is a single
 * styled `div` with no counterpart to it, so there is nothing to sit on.
 *
 * It currently has no call site in `desktop/src` — the live consumer is the
 * Flutter port (`mobile/lib/shared/widgets/skeleton_reveal.dart`), which this
 * is the reference for. So it was never the thing blocking `Skeleton` above
 * from moving to HeroUI, whatever the two components share in `skeleton.css`.
 */
type SkeletonRevealProps = React.HTMLAttributes<HTMLDivElement> & {
  contentClassName?: string;
  layout?: "absolute" | "flow";
  loading: boolean;
  skeleton: React.ReactNode;
  skeletonClassName?: string;
};

function SkeletonReveal({
  children,
  className,
  contentClassName,
  layout = "flow",
  loading,
  skeleton,
  skeletonClassName,
  ...props
}: SkeletonRevealProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const previousLoadingRef = React.useRef(loading);
  const [isResetting, setIsResetting] = React.useState(false);

  React.useLayoutEffect(() => {
    const wasLoading = previousLoadingRef.current;
    previousLoadingRef.current = loading;

    if (!loading || wasLoading) return;

    setIsResetting(true);
    rootRef.current?.getBoundingClientRect();

    const reset = () => setIsResetting(false);
    const frameId = globalThis.requestAnimationFrame
      ? globalThis.requestAnimationFrame(reset)
      : globalThis.setTimeout(reset, 0);

    return () => {
      if (typeof frameId === "number") {
        if (globalThis.cancelAnimationFrame) {
          globalThis.cancelAnimationFrame(frameId);
        } else {
          globalThis.clearTimeout(frameId);
        }
      }
    };
  }, [loading]);

  return (
    <div
      className={cn(
        "t-skel",
        !loading && "is-revealed",
        isResetting && "is-resetting",
        className,
      )}
      data-layout={layout}
      data-state={loading ? "loading" : "loaded"}
      ref={rootRef}
      {...props}
    >
      <div
        aria-hidden="true"
        className={cn("t-skel-skeleton is-pulsing", skeletonClassName)}
      >
        {skeleton}
      </div>
      <div
        aria-hidden={loading}
        className={cn("t-skel-content", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}

export { Skeleton, SkeletonReveal };
