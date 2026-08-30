import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/shared/lib/cn";

/**
 * Window-outline glyph for panel toggles: a rounded frame with a drawer bar
 * that thickens when its panel is open. `edge` picks which side of the frame
 * the drawer lives on, matching the panel the trigger controls.
 */
export function DrawerPanelIcon({
  className,
  edge = "left",
  open,
}: {
  className?: string;
  /** Which edge of the window frame the drawer bar sits against. */
  edge?: "left" | "right";
  /** Whether the controlled panel is open (thick bar) or closed (thin bar). */
  open: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const width = open ? 5 : 2;

  return (
    <svg
      aria-hidden="true"
      className={cn("h-4 w-auto shrink-0", className)}
      fill="none"
      height="22"
      viewBox="0 0 24 22"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        height="20"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
        width="22"
        x="1"
        y="1"
      />
      <motion.rect
        animate={{
          rx: open ? 2.5 : 1,
          width,
          // The bar hugs its edge: left-anchored bars keep x fixed while the
          // width grows rightward; right-anchored bars move x so the right
          // edge stays pinned against the frame's inner margin.
          x: edge === "left" ? 4 : 20 - width,
        }}
        fill="currentColor"
        height="14"
        initial={false}
        transition={{
          duration: prefersReducedMotion ? 0 : 0.2,
          ease: "linear",
        }}
        y="4"
      />
    </svg>
  );
}
