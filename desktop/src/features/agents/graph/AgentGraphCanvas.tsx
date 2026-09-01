import * as React from "react";

import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import { cn } from "@/shared/lib/cn";
import { Spinner } from "@/shared/ui/spinner";

import { curvedEdgeGeometry } from "./agentGraphEdgeGeometry";
import type { AgentGraphEdge, AgentGraphNode } from "./agentGraphModel";

/**
 * Fixed-size circular stage: an SVG underlay draws the directed edges and an
 * HTML overlay places the avatar nodes at the same pixel coordinates, so the
 * two layers can never drift apart under scaling.
 */
const STAGE_SIZE = 640;
const CENTER = STAGE_SIZE / 2;
const RING_RADIUS = 236;
const NODE_RADIUS = 24;
/** Perpendicular bow so A→B and B→A trace mirrored curves, never overlap. */
const CURVE_OFFSET = 26;
/** Edges newer than this render in the accent color. */
const RECENT_WINDOW_SECONDS = 10 * 60;

type NodePosition = { x: number; y: number };

function nodePositions(nodes: AgentGraphNode[]): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const count = Math.max(nodes.length, 1);
  nodes.forEach((node, index) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / count;
    positions.set(node.pubkey, {
      x: CENTER + RING_RADIUS * Math.cos(angle),
      y: CENTER + RING_RADIUS * Math.sin(angle),
    });
  });
  return positions;
}

function edgeGeometry(
  from: NodePosition,
  to: NodePosition,
  edge: AgentGraphEdge,
) {
  return curvedEdgeGeometry({
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    startTrim: NODE_RADIUS + 4,
    endTrim: NODE_RADIUS + 4,
    bow: CURVE_OFFSET,
    arrowSize: 7 + Math.min(3, Math.log2(edge.count + 1)),
  });
}

function edgeWidth(count: number): number {
  return 1.5 + Math.min(4, Math.log2(count + 1));
}

export function AgentGraphCanvas({
  nodes,
  edges,
  nowSeconds,
  selectedPubkey,
  workingPubkeys,
  pulsingPubkeys,
  onSelectNode,
}: {
  nodes: AgentGraphNode[];
  edges: AgentGraphEdge[];
  nowSeconds: number;
  selectedPubkey: string | null;
  workingPubkeys: ReadonlySet<string>;
  pulsingPubkeys: ReadonlySet<string>;
  onSelectNode: (pubkey: string | null) => void;
}) {
  const positions = React.useMemo(() => nodePositions(nodes), [nodes]);
  // Gradient/filter ids must be unique per mounted canvas: the floating
  // panel and the /agents/graph page can render simultaneously.
  const uid = React.useId();

  const isEdgeActive = (edge: AgentGraphEdge) =>
    selectedPubkey === null ||
    edge.from === selectedPubkey ||
    edge.to === selectedPubkey;

  return (
    <div
      className="relative mx-auto shrink-0"
      data-testid="agent-graph-canvas"
      style={{ height: STAGE_SIZE, width: STAGE_SIZE }}
    >
      <svg
        aria-hidden
        className="absolute inset-0"
        height={STAGE_SIZE}
        role="presentation"
        viewBox={`0 0 ${STAGE_SIZE} ${STAGE_SIZE}`}
        width={STAGE_SIZE}
      >
        <defs>
          <filter
            height="160%"
            id={`${uid}-glow`}
            width="160%"
            x="-30%"
            y="-30%"
          >
            <feGaussianBlur stdDeviation="4" />
          </filter>
          {edges.map((edge, index) => {
            const from = positions.get(edge.from);
            const to = positions.get(edge.to);
            if (!from || !to) return null;
            const isRecent = nowSeconds - edge.lastAt <= RECENT_WINDOW_SECONDS;
            const geometry = edgeGeometry(from, to, edge);
            const color = isRecent
              ? "var(--primary)"
              : "var(--muted-foreground)";
            return (
              // Direction reads from the stroke itself: faint at the sender,
              // saturated at the receiver, matching the arrowhead's hue.
              <linearGradient
                gradientUnits="userSpaceOnUse"
                id={`${uid}-edge-${index}`}
                key={`${edge.from}→${edge.to}`}
                x1={geometry.startX}
                x2={geometry.endX}
                y1={geometry.startY}
                y2={geometry.endY}
              >
                <stop offset="0" stopColor={color} stopOpacity="0.25" />
                <stop offset="1" stopColor={color} stopOpacity="0.95" />
              </linearGradient>
            );
          })}
        </defs>
        {edges.map((edge, index) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const isRecent = nowSeconds - edge.lastAt <= RECENT_WINDOW_SECONDS;
          const active = isEdgeActive(edge);
          const geometry = edgeGeometry(from, to, edge);
          const width = edgeWidth(edge.count);
          return (
            <g key={`${edge.from}→${edge.to}`} opacity={active ? 1 : 0.2}>
              {isRecent && active ? (
                // Soft halo under hot edges — communication in progress glows.
                <path
                  d={geometry.d}
                  fill="none"
                  filter={`url(#${uid}-glow)`}
                  opacity={0.35}
                  stroke="var(--primary)"
                  strokeLinecap="round"
                  strokeWidth={width + 4}
                />
              ) : null}
              <path
                d={geometry.d}
                fill="none"
                stroke={`url(#${uid}-edge-${index})`}
                strokeDasharray={edge.replyCount === 0 ? "6 5" : undefined}
                strokeLinecap="round"
                strokeWidth={width}
              />
              <polygon
                fill={isRecent ? "var(--primary)" : "var(--muted-foreground)"}
                opacity={0.95}
                points={geometry.arrowPoints}
              />
              {active ? (
                // Flowing "packets" sliding toward the arrowhead: fast and
                // bright while the edge is hot, a quiet ambient drift after —
                // the exchange always reads as alive, never frozen.
                <path
                  className={cn(
                    "fill-none text-primary",
                    isRecent ? "buzz-graph-flow" : "buzz-graph-flow-slow",
                  )}
                  d={geometry.d}
                  opacity={isRecent ? 0.95 : 0.45}
                  stroke="currentColor"
                  strokeDasharray="3 19"
                  strokeLinecap="round"
                  strokeWidth={isRecent ? 2.5 : 2}
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      {nodes.map((node) => {
        const position = positions.get(node.pubkey);
        if (!position) return null;
        const isSelected = selectedPubkey === node.pubkey;
        const isDimmed = selectedPubkey !== null && !isSelected;
        const isWorking = workingPubkeys.has(node.pubkey);
        return (
          <button
            className={cn(
              "absolute flex w-24 -translate-x-1/2 flex-col items-center gap-1 rounded-lg p-1 text-center transition-opacity",
              "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              isDimmed && "opacity-40",
            )}
            data-testid="agent-graph-node"
            key={node.pubkey}
            onClick={() => onSelectNode(isSelected ? null : node.pubkey)}
            style={{ left: position.x, top: position.y - NODE_RADIUS - 4 }}
            type="button"
          >
            <span className="relative inline-flex">
              {pulsingPubkeys.has(node.pubkey) ? (
                <span
                  aria-hidden
                  className="buzz-graph-pulse absolute -inset-1 rounded-full border-2 border-primary"
                />
              ) : null}
              {isWorking ? (
                <Spinner
                  aria-hidden
                  className="absolute border-2 text-primary"
                  size={NODE_RADIUS * 2 + 12}
                  style={{ left: -6, top: -6 }}
                />
              ) : null}
              <ProfileAvatar
                avatarUrl={node.avatarUrl}
                className={cn(
                  "h-12 w-12",
                  isSelected &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background",
                )}
                label={node.name}
              />
            </span>
            <span
              className={cn(
                "max-w-full truncate text-xs font-medium",
                isSelected ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {node.name}
              {node.isViewer ? " (you)" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
