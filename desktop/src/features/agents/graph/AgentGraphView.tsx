import * as React from "react";
import {
  ArrowLeft,
  GitFork,
  Maximize2,
  Minimize2,
  Orbit,
  Radio,
  Scan,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { openAgentActivityPanel } from "@/features/agents/agentActivityPanelStore";
import { showAgentRunsList } from "@/features/agents/agentRunPanelStore";
import {
  setDockGraphFullscreen,
  useAgentGraphPanel,
} from "./agentGraphPanelStore";
import { useChannelsQuery } from "@/features/channels/hooks";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";

import { type AgentGraphFlight, edgesForNode } from "./agentGraphModel";
import { AgentGraphFilterPopover } from "./AgentGraphFilterPopover";
import { EdgeDetail } from "./AgentGraphTrafficList";
import { AgentGraph3DCanvas } from "./AgentGraph3DCanvas";
import { AgentGraphCanvas } from "./AgentGraphCanvas";
import { useAgentGraphData } from "./useAgentGraphData";

const MIN_ZOOM = 0.3;
/** Stage size plus breathing room, used to fit the embedded variant. */
const STAGE_FIT_BASE = 700;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 1.25;
/** The 3D orbit mode is a per-user flag; it survives restarts. Default ON. */
const ORBIT_MODE_STORAGE_KEY = "buzz.agentGraph.orbit";
/** Pubkeys the user chose to hide from the graph; persists per user. */
const HIDDEN_NODES_STORAGE_KEY = "buzz.agentGraph.hiddenNodes";

function readHiddenNodes(): ReadonlySet<string> {
  try {
    const raw = window.localStorage.getItem(HIDDEN_NODES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}
/** How long a delivery pulse rings on the recipient after a new message. */
const PULSE_DURATION_MS = 4_000;
/** Balloon lifetime: the CSS flight (2.6s) plus a little settling room. */
const FLIGHT_DURATION_MS = 3_200;

function readOrbitFlag(): boolean {
  try {
    return window.localStorage.getItem(ORBIT_MODE_STORAGE_KEY) !== "0";
  } catch {
    return true;
  }
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
  headerTrailing,
  onHeaderPointerDown,
  detailPane,
  hideRail = false,
}: {
  /**
   * `embedded` drops the header and auto-fits the stage to its container —
   * the shape the Active runs dock view mounts above the roster.
   */
  variant?: "page" | "panel" | "embedded";
  headerTrailing?: React.ReactNode;
  onHeaderPointerDown?: (event: React.PointerEvent<HTMLElement>) => void;
  /**
   * When set, the side rail shows this instead of the traffic list — the
   * dock uses it to put the clicked agent's transcript beside the graph.
   */
  detailPane?: React.ReactNode;
  /** Fullscreen dock mode: the graph owns the panel, no rail at all. */
  hideRail?: boolean;
}) {
  const { model: fullModel, workingPubkeys, isLoading } = useAgentGraphData();
  const { dockGraph } = useAgentGraphPanel();

  // Participant filter: hidden nodes drop from the stage together with every
  // edge touching them; the full roster stays available to the popover so
  // hiding is always reversible.
  const [hiddenPubkeys, setHiddenPubkeys] = React.useState(readHiddenNodes);
  const toggleNodeVisible = React.useCallback(
    (pubkey: string, visible: boolean) => {
      setHiddenPubkeys((current) => {
        const next = new Set(current);
        if (visible) next.delete(pubkey);
        else next.add(pubkey);
        try {
          window.localStorage.setItem(
            HIDDEN_NODES_STORAGE_KEY,
            JSON.stringify([...next]),
          );
        } catch {
          // Best-effort persistence.
        }
        return next;
      });
    },
    [],
  );
  const model = React.useMemo(() => {
    if (hiddenPubkeys.size === 0) return fullModel;
    const nodes = fullModel.nodes.filter(
      (node) => !hiddenPubkeys.has(node.pubkey),
    );
    const visible = new Set(nodes.map((node) => node.pubkey));
    return {
      ...fullModel,
      nodes,
      edges: fullModel.edges.filter(
        (edge) => visible.has(edge.from) && visible.has(edge.to),
      ),
    };
  }, [fullModel, hiddenPubkeys]);
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

  // Embedded in the dock, the 640px stage must fit whatever box it got — and
  // refit when the dock is resized or the layout flips between stacked and
  // side-by-side. Manual zooming still works between resizes.
  React.useLayoutEffect(() => {
    if (variant !== "embedded") return;
    const wrapper = stageWrapperRef.current;
    if (!wrapper) return;
    const refit = () => {
      const fit =
        Math.min(wrapper.clientWidth, wrapper.clientHeight) / STAGE_FIT_BASE;
      setZoom(Math.max(MIN_ZOOM, Math.min(1, fit)));
    };
    refit();
    const observer = new ResizeObserver(refit);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [variant]);

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
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    // A click on empty background (no meaningful drag) clears the selection —
    // without this the node filter latches until the same node is re-clicked.
    const moved = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );
    if (moved < 5) {
      selectNode(null);
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
      } else if (pubkey === null && variant === "embedded") {
        // Clearing the selection in the dock also returns its rail from the
        // agent detail back to the traffic list.
        showAgentRunsList();
      }
    },
    [variant, viewerPubkey],
  );

  // Escape clears the selection from anywhere in the view.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") selectNode(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectNode]);

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
  const [flights, setFlights] = React.useState<readonly AgentGraphFlight[]>([]);
  const edgeLastAtRef = React.useRef<Map<string, number> | null>(null);
  const seenBroadcastsRef = React.useRef<Set<string> | null>(null);
  React.useEffect(() => {
    const previous = edgeLastAtRef.current;
    const next = new Map<string, number>();
    const arrivals = new Set<string>();
    const departures: AgentGraphFlight[] = [];
    for (const edge of model.edges) {
      const key = `${edge.from}→${edge.to}`;
      next.set(key, edge.lastAt);
      const before = previous?.get(key);
      if (previous && (before === undefined || edge.lastAt > before)) {
        arrivals.add(edge.to);
        const snippet = edge.recent[0]?.snippet;
        if (snippet) {
          departures.push({
            key: `${key}:${edge.lastAt}`,
            from: edge.from,
            to: edge.to,
            snippet,
          });
        }
      }
    }
    // Target-less "to the room" messages (e.g. the viewer's plain channel
    // message) fan out as balloons toward that channel's other speakers.
    // Balloons only: recipients are a guess, so no edge, no pulse.
    const previousBroadcasts = seenBroadcastsRef.current;
    const seenBroadcasts = new Set(previousBroadcasts ?? []);
    const visiblePubkeys = new Set(model.nodes.map((node) => node.pubkey));
    for (const broadcast of model.broadcasts) {
      if (seenBroadcasts.has(broadcast.id)) continue;
      seenBroadcasts.add(broadcast.id);
      if (!previousBroadcasts) continue;
      if (!visiblePubkeys.has(broadcast.from)) continue;
      const recipients = [
        ...(model.speakersByChannel.get(broadcast.channelId) ?? []),
      ]
        .filter(
          (pubkey) => pubkey !== broadcast.from && visiblePubkeys.has(pubkey),
        )
        .slice(0, 3);
      for (const to of recipients) {
        departures.push({
          key: `${broadcast.id}:${to}`,
          from: broadcast.from,
          to,
          snippet: broadcast.snippet,
        });
      }
    }
    seenBroadcastsRef.current = seenBroadcasts;
    edgeLastAtRef.current = next;
    if (arrivals.size === 0) return;
    setPulsingPubkeys((current) => new Set([...current, ...arrivals]));
    if (departures.length > 0) {
      // A refresh can bring a burst; cap the balloons so the stage stays
      // readable and the newest exchanges win.
      setFlights((current) => [...current, ...departures].slice(-6));
      window.setTimeout(() => {
        setFlights((current) =>
          current.filter(
            (flight) => !departures.some((d) => d.key === flight.key),
          ),
        );
      }, FLIGHT_DURATION_MS);
    }
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
    // The view root is the size container: the body row below both flips
    // its own direction and resizes its children against this ancestor — an
    // element cannot query itself as its container.
    <div
      className={cn(
        "flex h-full min-h-0 flex-col [container-type:inline-size]",
        // The floating panel supplies its own elevated surface (bg-popover);
        // painting bg-background here would flatten it back to the app bg.
        variant === "page" ? "bg-background" : "bg-transparent",
      )}
    >
      {variant === "embedded" ? null : (
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
              <Spinner
                aria-hidden
                className="border-2 text-primary"
                size={14}
              />
              {workingPubkeys.size} working
            </span>
          ) : null}
          {headerTrailing}
        </header>
      )}

      <div
        className={cn(
          "flex min-h-0 flex-1",
          // Embedded stacks in a narrow dock and goes side-by-side (stage +
          // traffic rail) once the container is wide enough.
          variant === "embedded" &&
            "flex-col [@container(min-width:44rem)]:flex-row",
        )}
      >
        <div
          className={cn(
            variant === "embedded"
              ? cn(
                  "relative h-72 w-full shrink-0 overflow-hidden border-b border-border/60",
                  "[@container(min-width:44rem)]:h-auto [@container(min-width:44rem)]:min-h-0 [@container(min-width:44rem)]:min-w-0 [@container(min-width:44rem)]:flex-1 [@container(min-width:44rem)]:border-b-0",
                )
              : "relative min-w-0 flex-1 overflow-hidden",
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
                    flights={flights}
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
                    flights={flights}
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
            <AgentGraphFilterPopover
              hiddenPubkeys={hiddenPubkeys}
              nodes={fullModel.nodes}
              onToggle={toggleNodeVisible}
            />
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
            {variant === "embedded" ? (
              <Button
                aria-label={
                  dockGraph === "fullscreen"
                    ? "Exit graph fullscreen"
                    : "Graph fullscreen"
                }
                onClick={() =>
                  setDockGraphFullscreen(dockGraph !== "fullscreen")
                }
                size="icon"
                title={
                  dockGraph === "fullscreen" ? "Exit fullscreen" : "Fullscreen"
                }
                type="button"
                variant="ghost"
              >
                {dockGraph === "fullscreen" ? <Minimize2 /> : <Maximize2 />}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Embedded (the dock's front door): the traffic list stacks under
            the stage — the graph says who is talking, the list says about
            what. Wide layouts keep it as a side rail by container width. */}
        {hideRail ? null : (
          <aside
            className={cn(
              variant === "embedded"
                ? cn(
                    "flex min-h-0 flex-1 flex-col overflow-y-auto",
                    detailPane ? "p-0" : "p-3",
                    "[@container(min-width:44rem)]:w-80 [@container(min-width:44rem)]:flex-none [@container(min-width:44rem)]:border-l [@container(min-width:44rem)]:border-border",
                    !detailPane && "[@container(min-width:44rem)]:p-4",
                  )
                : "hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-border p-4 [@container(min-width:44rem)]:flex",
            )}
          >
            {detailPane ?? (
              <>
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
              </>
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
