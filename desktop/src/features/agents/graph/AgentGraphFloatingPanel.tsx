import * as React from "react";
import { Maximize2, Minimize2, X } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

import {
  closeAgentGraphPanel,
  toggleAgentGraphPanelMaximized,
  useAgentGraphPanel,
} from "./agentGraphPanelStore";
import { AgentGraphView } from "./AgentGraphView";

const PANEL_WIDTH = 860;
const PANEL_HEIGHT = 620;
const EDGE_MARGIN = 16;

/**
 * The agent graph as a floating window over the app: draggable by its
 * header, maximizable to the full viewport, and closable — so the graph can
 * sit next to a channel and the agent-activity dock instead of replacing
 * them. Windowed mode hides the traffic list (too narrow to share);
 * maximizing brings it back.
 */
export function AgentGraphFloatingPanel() {
  const { isOpen, isMaximized } = useAgentGraphPanel();
  const [position, setPosition] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const onHeaderPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (isMaximized) return;
      if ((event.target as HTMLElement).closest("button")) return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      dragRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [isMaximized],
  );

  React.useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const maxX = window.innerWidth - PANEL_WIDTH - EDGE_MARGIN;
      const maxY = window.innerHeight - PANEL_HEIGHT - EDGE_MARGIN;
      setPosition({
        x: Math.min(
          Math.max(EDGE_MARGIN, event.clientX - drag.offsetX),
          Math.max(EDGE_MARGIN, maxX),
        ),
        y: Math.min(
          Math.max(EDGE_MARGIN, event.clientY - drag.offsetY),
          Math.max(EDGE_MARGIN, maxY),
        ),
      });
    };
    const onUp = (event: PointerEvent) => {
      if (dragRef.current?.pointerId === event.pointerId) {
        dragRef.current = null;
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl",
        isMaximized && "inset-4",
        // Docked default: the right half of the window, full height — the
        // graph sits beside the channel instead of covering it. Dragging the
        // header converts it into a free-floating window.
        !isMaximized &&
          !position &&
          "bottom-4 right-4 top-16 w-[min(46vw,56rem)]",
      )}
      data-testid="agent-graph-floating-panel"
      ref={panelRef}
      style={
        isMaximized || !position
          ? undefined
          : {
              height: PANEL_HEIGHT,
              left: position.x,
              top: position.y,
              width: PANEL_WIDTH,
            }
      }
    >
      <AgentGraphView
        headerTrailing={
          <span className="flex shrink-0 items-center gap-0.5">
            <Button
              aria-label={isMaximized ? "Restore panel" : "Maximize panel"}
              onClick={toggleAgentGraphPanelMaximized}
              size="icon"
              type="button"
              variant="ghost"
            >
              {isMaximized ? <Minimize2 /> : <Maximize2 />}
            </Button>
            <Button
              aria-label="Close agent graph"
              onClick={closeAgentGraphPanel}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X />
            </Button>
          </span>
        }
        onHeaderPointerDown={onHeaderPointerDown}
        variant="panel"
      />
    </div>
  );
}
