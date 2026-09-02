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
const MIN_WIDTH = 480;
const MIN_HEIGHT = 380;

type PanelPoint = { x: number; y: number };
type PanelSize = { width: number; height: number };

/**
 * The agent graph as an app-level floating window: draggable by its header,
 * resizable from the bottom-left grip, maximizable to the full viewport, and
 * closable — so the graph can sit next to a channel and the agent-activity
 * dock instead of replacing them. Opens docked to the window's right half;
 * dragging converts it into a free-floating window.
 */
export function AgentGraphFloatingPanel() {
  const { isOpen, isMaximized } = useAgentGraphPanel();
  const [position, setPosition] = React.useState<PanelPoint | null>(null);
  const [size, setSize] = React.useState<PanelSize | null>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const resizeRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
    startLeft: number;
    anchored: "right" | "free";
  } | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const onHeaderPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (isMaximized) return;
      if ((event.target as HTMLElement).closest("button")) return;
      const panel = panelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      // Leaving the dock: freeze the current rect as the explicit size so the
      // window keeps its shape while it moves.
      setSize({ width: rect.width, height: rect.height });
      dragRef.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [isMaximized],
  );

  const onResizePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const panel = panelRef.current;
      if (!panel) return;
      event.preventDefault();
      const rect = panel.getBoundingClientRect();
      resizeRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startWidth: rect.width,
        startHeight: rect.height,
        startLeft: rect.left,
        anchored: position ? "free" : "right",
      };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    },
    [position],
  );

  React.useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const resize = resizeRef.current;
      if (resize && resize.pointerId === event.pointerId) {
        const deltaX = event.clientX - resize.startX;
        const deltaY = event.clientY - resize.startY;
        // The grip sits on the bottom-left corner: pulling left widens,
        // pulling down lengthens. A right-docked panel grows leftward from
        // its anchored edge; a free window shifts its left edge instead.
        const width = Math.min(
          Math.max(MIN_WIDTH, resize.startWidth - deltaX),
          window.innerWidth - EDGE_MARGIN * 2,
        );
        const height = Math.min(
          Math.max(MIN_HEIGHT, resize.startHeight + deltaY),
          window.innerHeight - EDGE_MARGIN * 2,
        );
        setSize({ width, height });
        if (resize.anchored === "free") {
          setPosition((current) =>
            current
              ? {
                  x: resize.startLeft + (resize.startWidth - width),
                  y: current.y,
                }
              : current,
          );
        }
        return;
      }

      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const panel = panelRef.current;
      const width = panel?.getBoundingClientRect().width ?? PANEL_WIDTH;
      const height = panel?.getBoundingClientRect().height ?? PANEL_HEIGHT;
      const maxX = window.innerWidth - width - EDGE_MARGIN;
      const maxY = window.innerHeight - height - EDGE_MARGIN;
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
      if (resizeRef.current?.pointerId === event.pointerId) {
        resizeRef.current = null;
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

  const style = isMaximized
    ? undefined
    : position
      ? {
          height: size?.height ?? PANEL_HEIGHT,
          left: position.x,
          top: position.y,
          width: size?.width ?? PANEL_WIDTH,
        }
      : size
        ? {
            height: size.height,
            right: EDGE_MARGIN,
            top: 64,
            width: size.width,
          }
        : undefined;

  return (
    <div
      className={cn(
        // Inline elevation on purpose: a ring hairline the dark theme can
        // actually see plus heavy arbitrary drops — no config token, so dev
        // servers never serve a stale build without it.
        "fixed z-50 flex flex-col overflow-hidden rounded-xl bg-popover ring-1 ring-border",
        "shadow-[0_32px_96px_-16px_rgba(0,0,0,0.8),0_12px_32px_-8px_rgba(0,0,0,0.5)]",
        isMaximized && "inset-4",
        // Docked default: the right half of the window, full height — the
        // graph sits beside the channel instead of covering it.
        !isMaximized &&
          !position &&
          !size &&
          "bottom-4 right-4 top-16 w-[min(46vw,56rem)]",
      )}
      data-testid="agent-graph-floating-panel"
      ref={panelRef}
      style={style}
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
        // The floating window is the graph, whole: recent traffic already
        // lives in the Agent activity dock, so a rail here repeated it.
        hideRail
        onHeaderPointerDown={onHeaderPointerDown}
        variant="panel"
      />
      {isMaximized ? null : (
        <button
          aria-label="Resize agent graph panel"
          className="absolute bottom-0 left-0 z-10 h-5 w-5 cursor-nesw-resize touch-none rounded-tr-md text-muted-foreground/50 hover:text-muted-foreground"
          data-testid="agent-graph-panel-resize"
          onPointerDown={onResizePointerDown}
          type="button"
        >
          <svg
            aria-hidden
            className="h-full w-full p-1"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.5"
            viewBox="0 0 12 12"
          >
            <path d="M 1 5 L 5 11 M 1 9 L 2.2 11" transform="scale(1,1)" />
            <path d="M 1 4 L 8 11" />
          </svg>
        </button>
      )}
    </div>
  );
}
