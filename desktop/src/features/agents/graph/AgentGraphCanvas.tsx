import * as React from "react";

import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import { cn } from "@/shared/lib/cn";
import { Spinner } from "@/shared/ui/spinner";

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

function edgePath(from: NodePosition, to: NodePosition): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.hypot(dx, dy) || 1;
  const ux = dx / distance;
  const uy = dy / distance;
  // Trim both ends to the node circles; leave room for the arrowhead.
  const startX = from.x + ux * (NODE_RADIUS + 4);
  const startY = from.y + uy * (NODE_RADIUS + 4);
  const endX = to.x - ux * (NODE_RADIUS + 10);
  const endY = to.y - uy * (NODE_RADIUS + 10);
  const midX = (startX + endX) / 2 - uy * CURVE_OFFSET;
  const midY = (startY + endY) / 2 + ux * CURVE_OFFSET;
  return `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;
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
  onSelectNode,
}: {
  nodes: AgentGraphNode[];
  edges: AgentGraphEdge[];
  nowSeconds: number;
  selectedPubkey: string | null;
  workingPubkeys: ReadonlySet<string>;
  onSelectNode: (pubkey: string | null) => void;
}) {
  const positions = React.useMemo(() => nodePositions(nodes), [nodes]);

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
          <marker
            id="agent-graph-arrow"
            markerHeight="7"
            markerWidth="7"
            orient="auto-start-reverse"
            refX="6"
            refY="3.5"
          >
            <path d="M 0 0 L 7 3.5 L 0 7 z" fill="currentColor" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          const isRecent = nowSeconds - edge.lastAt <= RECENT_WINDOW_SECONDS;
          const active = isEdgeActive(edge);
          return (
            <path
              className={cn(
                "fill-none transition-opacity",
                isRecent ? "text-primary" : "text-muted-foreground/50",
                active ? "opacity-100" : "opacity-15",
              )}
              d={edgePath(from, to)}
              key={`${edge.from}→${edge.to}`}
              markerEnd="url(#agent-graph-arrow)"
              stroke="currentColor"
              strokeDasharray={edge.replyCount === 0 ? "5 4" : undefined}
              strokeWidth={edgeWidth(edge.count)}
            />
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
