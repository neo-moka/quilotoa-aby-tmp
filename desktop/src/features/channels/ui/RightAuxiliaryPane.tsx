import type * as React from "react";
import { motion, useReducedMotion } from "motion/react";

import { AUXILIARY_PANEL_MIN_WIDTH_PX } from "@/shared/layout/AuxiliaryPanel";
import { cn } from "@/shared/lib/cn";

type RightAuxiliaryPaneProps = {
  /**
   * Animate open/close like the left sidebar (200ms linear width reveal with
   * a content fade). Only meaningful under an `AnimatePresence` — the exit leg
   * needs it to hold the unmount. Consumers that keep the pane permanently
   * mounted (projects, home) leave this off so nothing moves on screen load.
   */
  animated?: boolean;
  canResetWidth: boolean;
  children: React.ReactNode;
  constrainToAvailableSpace?: boolean;
  detached?: boolean;
  onResetWidth: () => void;
  onResizeStart: (event: React.PointerEvent<HTMLButtonElement>) => void;
  testId?: string;
  widthPx: number;
};

const PANE_TRANSITION = { duration: 0.2, ease: "linear" } as const;

export function RightAuxiliaryPane({
  animated = false,
  canResetWidth,
  children,
  constrainToAvailableSpace = true,
  detached = false,
  onResetWidth,
  onResizeStart,
  testId,
  widthPx,
}: RightAuxiliaryPaneProps) {
  const prefersReducedMotion = useReducedMotion();
  const animate = animated && !prefersReducedMotion;
  const transition = animate ? PANE_TRANSITION : { duration: 0 };
  const maxWidth = constrainToAvailableSpace
    ? `calc(100% - ${AUXILIARY_PANEL_MIN_WIDTH_PX}px)`
    : undefined;

  const pane = (
    <aside
      className={cn(
        // `bg-sidebar`, not `bg-background`: this pane is chrome, and the app
        // already separates chrome from content with `--sidebar` — the left
        // sidebar uses it. Painting the right pane in the content surface left
        // a 1px rule as the only thing dividing it from the conversation, which
        // is why it read as part of the chat rather than beside it.
        "group/right-pane relative flex h-full shrink-0 flex-col overflow-hidden bg-sidebar",
        detached
          ? "bg-transparent"
          : "before:pointer-events-none before:absolute before:bottom-0 before:left-0 before:top-0 before:z-50 before:w-px before:bg-border/80 before:content-['']",
      )}
      data-testid={testId}
      style={{
        // In the animated path the wrapper below owns the clamp: its `100%`
        // resolves against the pane row, while the aside's own would resolve
        // against the content-sized wrapper and squeeze itself.
        maxWidth: animated ? undefined : maxWidth,
        width: widthPx,
      }}
    >
      <button
        aria-label="Resize panel"
        className="peer/right-pane-resize group/right-pane-resize absolute inset-y-0 left-0 z-50 w-3 -translate-x-1/2 cursor-col-resize"
        data-testid="right-auxiliary-pane-resize-handle"
        onDoubleClick={canResetWidth ? onResetWidth : undefined}
        onPointerDown={onResizeStart}
        title={
          canResetWidth
            ? "Drag to resize. Double-click to reset width."
            : "Drag to resize."
        }
        type="button"
      >
        <span className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-transparent group-hover/right-pane-resize:bg-border/80 group-focus-visible/right-pane-resize:bg-border/80" />
      </button>
      <motion.div
        animate={animate ? { opacity: 1, x: 0 } : undefined}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        exit={animate ? { opacity: 0, x: 24, transition } : undefined}
        initial={animate ? { opacity: 0, x: 24 } : false}
        transition={transition}
      >
        {children}
      </motion.div>
    </aside>
  );

  if (!animated) return pane;

  // Same mechanism as `RightDock`: an overflow-hidden wrapper animating
  // 0 ↔ auto reveals the fixed-width pane. The pane's live width (resize
  // drags) flows through instantly because the wrapper rests at `auto`.
  return (
    <motion.div
      animate={{ width: "auto" }}
      className="flex h-full min-h-0 shrink-0 overflow-hidden"
      exit={{ width: 0, transition }}
      initial={{ width: 0 }}
      style={{ maxWidth }}
      transition={transition}
    >
      {pane}
    </motion.div>
  );
}
