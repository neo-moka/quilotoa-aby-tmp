import * as React from "react";
import {
  ArrowLeft,
  GitFork,
  Orbit,
  Radio,
  Scan,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { openAgentActivityPanel } from "@/features/agents/agentActivityPanelStore";
import { useChannelsQuery } from "@/features/channels/hooks";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";

import { type AgentGraphEdge, edgesForNode } from "./agentGraphModel";
import { AgentGraph3DCanvas } from "./AgentGraph3DCanvas";
import { AgentGraphCanvas } from "./AgentGraphCanvas";
import { useAgentGraphData } from "./useAgentGraphData";

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.25;
/** The 3D orbit mode is a per-user flag; it survives restarts. Default ON. */
const ORBIT_MODE_STORAGE_KEY = "buzz.agentGraph.orbit";
/** How long a delivery pulse rings on the recipient after a new message. */
const PULSE_DURATION_MS = 4_000;

function readOrbitFlag(): boolean {
  try {
    return window.localStorage.getItem(ORBIT_MODE_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
}

function formatAgo(atSeconds: number, nowSeconds: number): string {
  const delta = Math.max(0, nowSeconds - atSeconds);
  if (delta < 60) return "now";
  if (delta < 3_600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86_400) return `${Math.floor(delta / 3_600)}h`;
  return `${Math.floor(delta / 86_400)}d`;
}

/**
 * Communication graph between agents (and the viewer): who is passing
 * messages to whom, mentions vs. thread replies (dependencies), and which
 * agents are mid-turn right now. The stage pans by dragging and zooms with
 * the wheel or the toolbar; selecting an agent also opens its activity
 * transcript in the right dock.
 *
 * Rendered both as the `/agents/graph` page and inside the floating panel
 * (`AgentGraphFloatingPanel`), which supplies window chrome via
 * `headerTrailing`/`onHeaderPointerDown`.
 */
export function AgentGraphView({
  variant = "page",
  showDetails = true,
  headerTrailing,
  onHeaderPointerDown,
}: {
  variant?: "page" | "panel";
  showDetails?: boolean;
  headerTrailing?: React.ReactNode;
  onHeaderPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
}) {
  const { model, workingPubkeys, isLoading } = useAgentGraphData();
  const channelsQuery = useChannelsQuery();
  const [selectedPubkey, setSelectedPubkey] = React.useState<string | null>(
    null,
  );
  const nowSeconds = Math.floor(Date.now() / 1_000);

  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isOrbit, setIsOrbit] = React.useState(readOrbitFlag);
  const toggleOrbit = React.useCallback(() => {
    setIsOrbit((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(ORBIT_MODE_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Preference persistence is best-effort.
      }
      return next;
    });
  }, []);
  const stageWrapperRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const applyZoom = React.useCallback((factor: number) => {
    setZoom((current) =>
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current * factor)),
    );
  }, []);

  const resetView = React.useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Wheel zoom needs a non-passive listener: React's synthetic onWheel cannot
  // preventDefault, and without it the page scrolls instead of zooming.
  React.useEffect(() => {
    const wrapper = stageWrapperRef.current;
    if (!wrapper) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      applyZoom(event.deltaY < 0 ? 1.1 : 1 / 1.1);
    };
    wrapper.addEventListener("wheel", onWheel, { passive: false });
    return () => wrapper.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  const onStagePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    // Nodes are buttons: dragging starts only on the background.
    if ((event.target as HTMLElement).closest("button")) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: pan.x,
      panY: pan.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onStagePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.panX + (event.clientX - drag.startX),
      y: drag.panY + (event.clientY - drag.startY),
    });
  };
  const onStagePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const channelNameById = React.useMemo(() => {
    const byId = new Map<string, string>();
    for (const channel of channelsQuery.data ?? []) {
      byId.set(channel.id, channel.name);
    }
    return byId;
  }, [channelsQuery.data]);

  const nameByPubkey = React.useMemo(() => {
    const byPubkey = new Map<string, string>();
    for (const node of model.nodes) {
      byPubkey.set(node.pubkey, node.name);
    }
    return byPubkey;
  }, [model.nodes]);

  const viewerPubkey = React.useMemo(
    () => model.nodes.find((node) => node.isViewer)?.pubkey ?? null,
    [model.nodes],
  );

  const selectNode = React.useCallback(
    (pubkey: string | null) => {
      setSelectedPubkey(pubkey);
      // Selecting an agent answers "what is it doing?" — surface its live
      // transcript alongside the graph. The viewer has no agent transcript.
      if (pubkey && pubkey !== viewerPubkey) {
        openAgentActivityPanel(pubkey);
      }
    },
    [viewerPubkey],
  );

  const detailEdges = React.useMemo(
    () =>
      selectedPubkey === null
        ? model.edges
        : edgesForNode(model, selectedPubkey),
    [model, selectedPubkey],
  );

  // Delivery pulses: when a refresh advances an edge's lastAt, its recipient
  // just got a message — ring their node for a few seconds. The first model
  // (no baseline) never pulses, so opening the graph doesn't light up
  // everything at once.
  const [pulsingPubkeys, setPulsingPubkeys] = React.useState<
    ReadonlySet<string>
  >(new Set());
  const edgeLastAtRef = React.useRef<Map<string, number> | null>(null);
  React.useEffect(() => {
    const previous = edgeLastAtRef.current;
    const next = new Map<string, number>();
    const arrivals = new Set<string>();
    for (const edge of model.edges) {
      const key = `${edge.from}→${edge.to}`;
      next.set(key, edge.lastAt);
      const before = previous?.get(key);
      if (previous && (before === undefined || edge.lastAt > before)) {
        arrivals.add(edge.to);
      }
    }
    edgeLastAtRef.current = next;
    if (arrivals.size === 0) return;
    setPulsingPubkeys((current) => new Set([...current, ...arrivals]));
    // Deliberately not cancelled on re-run: each timer clears only its own
    // arrivals, so overlapping refreshes cannot strand a pulse forever.
    window.setTimeout(() => {
      setPulsingPubkeys((current) => {
        const remaining = new Set(current);
        for (const pubkey of arrivals) remaining.delete(pubkey);
        return remaining;
      });
    }, PULSE_DURATION_MS);
  }, [model.edges]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header
        className={cn(
          "flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5",
          onHeaderPointerDown && "cursor-grab select-none",
        )}
        onPointerDown={onHeaderPointerDown}
      >
        {variant === "page" ? (
          <Button
            aria-label="Back"
            onClick={() => window.history.back()}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ArrowLeft />
          </Button>
        ) : null}
        <GitFork
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">Agent graph</h1>
          <p className="truncate text-xs text-muted-foreground">
            Solid edges carry thread replies (dependencies), dashed edges are
            mentions.
          </p>
        </div>
        {workingPubkeys.size > 0 ? (
          <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner aria-hidden className="border-2 text-primary" size={14} />
            {workingPubkeys.size} working
          </span>
        ) : null}
        {headerTrailing}
      </header>

      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "relative min-w-0 flex-1 overflow-hidden",
            dragRef.current ? "cursor-grabbing" : "cursor-grab",
          )}
          data-testid="agent-graph-stage"
          onPointerCancel={onStagePointerEnd}
          onPointerDown={onStagePointerDown}
          onPointerMove={onStagePointerMove}
          onPointerUp={onStagePointerEnd}
          ref={stageWrapperRef}
        >
          {isLoading && model.nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Spinner
                aria-label="Loading agent graph"
                className="h-7 w-7 text-muted-foreground"
              />
            </div>
          ) : model.nodes.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <Radio className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">No agents yet</p>
              <p className="text-sm text-muted-foreground">
                Deploy an agent to see its communication here.
              </p>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                {isOrbit ? (
                  <AgentGraph3DCanvas
                    edges={model.edges}
                    nodes={model.nodes}
                    nowSeconds={nowSeconds}
                    onSelectNode={selectNode}
                    pulsingPubkeys={pulsingPubkeys}
                    selectedPubkey={selectedPubkey}
                    workingPubkeys={workingPubkeys}
                  />
                ) : (
                  <AgentGraphCanvas
                    edges={model.edges}
                    nodes={model.nodes}
                    nowSeconds={nowSeconds}
                    onSelectNode={selectNode}
                    pulsingPubkeys={pulsingPubkeys}
                    selectedPubkey={selectedPubkey}
                    workingPubkeys={workingPubkeys}
                  />
                )}
              </div>
            </div>
          )}

          <div className="absolute bottom-3 right-3 flex flex-col gap-1 rounded-lg border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur">
            <Button
              aria-label={isOrbit ? "Switch to 2D view" : "Switch to 3D orbit"}
              aria-pressed={isOrbit}
              onClick={toggleOrbit}
              size="icon"
              title={isOrbit ? "2D view" : "3D orbit — drag to spin"}
              type="button"
              variant={isOrbit ? "secondary" : "ghost"}
            >
              <Orbit />
            </Button>
            <Button
              aria-label="Zoom in"
              onClick={() => applyZoom(ZOOM_STEP)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ZoomIn />
            </Button>
            <Button
              aria-label="Zoom out"
              onClick={() => applyZoom(1 / ZOOM_STEP)}
              size="icon"
              type="button"
              variant="ghost"
            >
              <ZoomOut />
            </Button>
            <Button
              aria-label="Reset view"
              onClick={resetView}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Scan />
            </Button>
          </div>
        </div>

        {showDetails ? (
          <aside className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border p-4 lg:flex">
            <h2 className="pb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
              {selectedPubkey
                ? `Traffic — ${nameByPubkey.get(selectedPubkey) ?? "agent"}`
                : "Recent traffic"}
            </h2>
            {detailEdges.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No messages between agents yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {detailEdges.map((edge) => (
                  <EdgeDetail
                    channelNameById={channelNameById}
                    edge={edge}
                    key={`${edge.from}→${edge.to}`}
                    nameByPubkey={nameByPubkey}
                    nowSeconds={nowSeconds}
                  />
                ))}
              </ul>
            )}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function EdgeDetail({
  channelNameById,
  edge,
  nameByPubkey,
  nowSeconds,
}: {
  channelNameById: Map<string, string>;
  edge: AgentGraphEdge;
  nameByPubkey: Map<string, string>;
  nowSeconds: number;
}) {
  const latest = edge.recent[0];
  const channelName = latest?.channelId
    ? channelNameById.get(latest.channelId)
    : undefined;
  return (
    <li
      className="rounded-lg border border-border/60 p-2.5"
      data-testid="agent-graph-edge-detail"
    >
      <p className="flex items-baseline gap-1 text-sm">
        <span className="font-medium">
          {nameByPubkey.get(edge.from) ?? "?"}
        </span>
        <span aria-hidden className="text-muted-foreground">
          →
        </span>
        <span className="font-medium">{nameByPubkey.get(edge.to) ?? "?"}</span>
        <span className="ml-auto text-2xs tabular-nums text-muted-foreground">
          {formatAgo(edge.lastAt, nowSeconds)}
        </span>
      </p>
      <p className="pt-0.5 text-2xs text-muted-foreground">
        {edge.count} {edge.count === 1 ? "message" : "messages"}
        {edge.replyCount > 0 ? ` · ${edge.replyCount} in-thread` : ""}
        {channelName ? ` · #${channelName}` : ""}
      </p>
      {latest ? (
        <p
          className={cn(
            "pt-1 text-xs text-foreground/90",
            "line-clamp-2 break-words",
          )}
        >
          {latest.snippet}
        </p>
      ) : null}
    </li>
  );
}
