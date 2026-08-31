import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AgentActivityRail } from "@/features/agents/ui/AgentActivityRail";
import { useIsThreadPanelOverlay } from "@/shared/hooks/use-mobile";
import { useThreadPanelWidth } from "@/shared/hooks/useThreadPanelWidth";
import { useRightDock } from "./rightDockStore";
import { RIGHT_DOCK_VIEWS } from "./rightDockViews";

const DOCK_TRANSITION = { duration: 0.2, ease: "linear" } as const;

/**
 * The standing right column of the app — mounted once beside the content
 * card (see `ContentSurface`), on every screen. Shows agent activity by
 * default; the body comes from `RIGHT_DOCK_VIEWS`, so future content types
 * plug in without new layout work. Hidden on overlay/narrow layouts, where
 * there is no width to spare for a second column.
 */
export function RightDock() {
  const dock = useRightDock();
  const isOverlay = useIsThreadPanelOverlay();
  const panelWidth = useThreadPanelWidth();
  const prefersReducedMotion = useReducedMotion();
  const transition = prefersReducedMotion ? { duration: 0 } : DOCK_TRANSITION;

  if (isOverlay) return null;

  const view = RIGHT_DOCK_VIEWS[dock.viewId];

  return (
    <>
      {/* Closed ≠ gone: the dock folds to the ambient agent rail on every
          screen, exactly as the channel's right edge used to — one avatar per
          active agent, one click back to the full panel. The rail renders
          nothing when the community runs no agents. */}
      {dock.open ? null : <AgentActivityRail />}
      <AnimatePresence initial={false}>
        {dock.open ? (
          <motion.div
            animate={{ width: "auto" }}
            className="flex h-full min-h-0 shrink-0 overflow-hidden"
            data-testid="right-dock"
            exit={{ width: 0, transition }}
            initial={{ width: 0 }}
            key="right-dock"
            transition={transition}
          >
            {/* Same pod grammar as `ContentSurface`: a rounded card floating on
              the sidebar-colored shell, margins matched to its sibling. */}
            <div className="mb-2 mr-2 mt-px flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl bg-background shadow-content-edge">
              <view.Component
                canResetWidth={panelWidth.canReset}
                onResetWidth={panelWidth.onResetWidth}
                onResizeStart={panelWidth.onResizeStart}
                widthPx={panelWidth.widthPx}
              />
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
