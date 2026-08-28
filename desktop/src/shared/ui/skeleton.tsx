import * as React from "react";

import { cn } from "@/shared/lib/cn";

/**
 * Deliberately not HeroUI's `Skeleton`. Its `pulse` and `shimmer` variants
 * animate unconditionally and forever, with no way to stop them once the real
 * content arrives. `skeleton.css` stops this one on reveal
 * (`.t-skel.is-revealed … { animation: none }`) and under
 * `prefers-reduced-motion`. That difference is not cosmetic: a never-settling
 * animation hangs `waitForAnimations`, which every screenshot spec awaits, so
 * adopting HeroUI's would stall captures rather than fail them.
 *
 * `SkeletonReveal` has no HeroUI counterpart at all — HeroUI's skeleton is a
 * single styled `div`, with none of the crossfade choreography below.
 */

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  pulsing?: boolean;
};

function Skeleton({ className, pulsing = true, ...props }: SkeletonProps) {
  return (
    <div
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
