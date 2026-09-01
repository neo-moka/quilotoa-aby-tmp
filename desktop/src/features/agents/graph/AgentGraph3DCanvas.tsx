import { useReducedMotion } from "motion/react";
import * as React from "react";

import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import { cn } from "@/shared/lib/cn";
import { Spinner } from "@/shared/ui/spinner";

import { project, spherePositions } from "./agentGraph3d";
import { curvedEdgeGeometry } from "./agentGraphEdgeGeometry";
import type { AgentGraphEdge, AgentGraphNode } from "./agentGraphModel";

const STAGE_SIZE = 640;
const CENTER = STAGE_SIZE / 2;
const SPHERE_RADIUS = 232;
const FOCAL = 720;
const NODE_RADIUS = 24;
const MAX_PITCH = 1.1;
/** Radians per frame while idle — a slow presentational spin. */
const AUTO_SPIN = 0.0028;
const INERTIA_DECAY = 0.94;
const RECENT_WINDOW_SECONDS = 10 * 60;

type ProjectedNode = { x: number; y: number; scale: number };

function edgeGeometry3d(
  from: ProjectedNode,
  to: ProjectedNode,
  edge: AgentGraphEdge,
) {
  const depth = (from.scale + to.scale) / 2;
  return curvedEdgeGeometry({
    fromX: from.x,
    fromY: from.y,
    toX: to.x,
    toY: to.y,
    startTrim: NODE_RADIUS * from.scale + 4,
    endTrim: NODE_RADIUS * to.scale + 4,
    bow: 14 * depth,
    arrowSize: (6 + Math.min(3, Math.log2(edge.count + 1))) * depth,
  });
}

/**
 * Orbit-mode rendering of the agent graph: nodes on a sphere, dragged with
 * the hand to spin (with inertia), auto-rotating gently while idle. Depth
 * feeds every cue — node scale, stacking order, and edge opacity — so the
 * rotation reads as a volume, not a shuffle. Recent edges carry the same
 * flowing-packet overlay as the 2D stage.
 */
export function AgentGraph3DCanvas({
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
  const shouldReduceMotion = useReducedMotion();
  // Gradient/filter ids must be unique per mounted canvas: the floating
  // panel and the /agents/graph page can render simultaneously.
  const uid = React.useId();
  const [rotation, setRotation] = React.useState({ yaw: 0, pitch: -0.28 });
  const dragRef = React.useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    velocityYaw: number;
  } | null>(null);

  // One animation frame loop drives idle auto-spin and post-drag inertia.
  React.useEffect(() => {
    let frame = 0;
    let velocityYaw = 0;
    const step = () => {
      const drag = dragRef.current;
      if (drag) {
        velocityYaw = drag.velocityYaw;
      } else {
        velocityYaw *= INERTIA_DECAY;
        const idleSpin = shouldReduceMotion ? 0 : AUTO_SPIN;
        const delta = Math.abs(velocityYaw) > 0.0005 ? velocityYaw : idleSpin;
        if (delta !== 0) {
          setRotation((current) => ({
            yaw: current.yaw + delta,
            pitch: current.pitch,
          }));
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [shouldReduceMotion]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    event.stopPropagation();
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      velocityYaw: 0,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const deltaX = event.clientX - drag.lastX;
    const deltaY = event.clientY - drag.lastY;
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    drag.velocityYaw = deltaX * 0.005;
    setRotation((current) => ({
      yaw: current.yaw + deltaX * 0.005,
      pitch: Math.max(
        -MAX_PITCH,
        Math.min(MAX_PITCH, current.pitch + deltaY * 0.004),
      ),
    }));
  };
  const onPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    // A background click (no meaningful orbit drag) clears the selection,
    // matching the 2D stage.
    const moved = Math.hypot(
      event.clientX - drag.startX,
      event.clientY - drag.startY,
    );
    if (moved < 5) {
      onSelectNode(null);
    }
  };

  const basePositions = React.useMemo(
    () => spherePositions(nodes.length, SPHERE_RADIUS),
    [nodes.length],
  );

  const projectedByPubkey = React.useMemo(() => {
    const byPubkey = new Map<
      string,
      ReturnType<typeof project> & { node: AgentGraphNode }
    >();
    nodes.forEach((node, index) => {
      const base = basePositions[index];
      if (!base) return;
      byPubkey.set(node.pubkey, {
        ...project(base, rotation.yaw, rotation.pitch, CENTER, FOCAL),
        node,
      });
    });
    return byPubkey;
  }, [basePositions, nodes, rotation.pitch, rotation.yaw]);

  const isEdgeActive = (edge: AgentGraphEdge) =>
    selectedPubkey === null ||
    edge.from === selectedPubkey ||
    edge.to === selectedPubkey;

  return (
    <div
      className="relative touch-none select-none"
      data-testid="agent-graph-canvas-3d"
      onPointerCancel={onPointerEnd}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
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
            id={`${uid}-glow3d`}
            width="160%"
            x="-30%"
            y="-30%"
          >
            <feGaussianBlur stdDeviation="4" />
          </filter>
          {edges.map((edge, index) => {
            const from = projectedByPubkey.get(edge.from);
            const to = projectedByPubkey.get(edge.to);
            if (!from || !to) return null;
            const isRecent = nowSeconds - edge.lastAt <= RECENT_WINDOW_SECONDS;
            const geometry = edgeGeometry3d(from, to, edge);
            const color = isRecent
              ? "var(--primary)"
              : "var(--muted-foreground)";
            return (
              <linearGradient
                gradientUnits="userSpaceOnUse"
                id={`${uid}-edge3d-${index}`}
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
          const from = projectedByPubkey.get(edge.from);
          const to = projectedByPubkey.get(edge.to);
          if (!from || !to) return null;
          const depth = (from.scale + to.scale) / 2;
          const isRecent = nowSeconds - edge.lastAt <= RECENT_WINDOW_SECONDS;
          const active = isEdgeActive(edge);
          const geometry = edgeGeometry3d(from, to, edge);
          const width = (1 + Math.min(3, Math.log2(edge.count + 1))) * depth;
          const groupOpacity = active
            ? Math.max(0.35, Math.min(1, 0.65 + (depth - 0.8)))
            : 0.15;
          return (
            <g key={`${edge.from}→${edge.to}`} opacity={groupOpacity}>
              {isRecent && active ? (
                <path
                  d={geometry.d}
                  fill="none"
                  filter={`url(#${uid}-glow3d)`}
                  opacity={0.35}
                  stroke="var(--primary)"
                  strokeLinecap="round"
                  strokeWidth={width + 4}
                />
              ) : null}
              <path
                d={geometry.d}
                fill="none"
                stroke={`url(#${uid}-edge3d-${index})`}
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
                <path
                  className={cn(
                    "text-primary",
                    isRecent ? "buzz-graph-flow" : "buzz-graph-flow-slow",
                  )}
                  d={geometry.d}
                  fill="none"
                  opacity={isRecent ? 0.95 : 0.45}
                  stroke="currentColor"
                  strokeDasharray="3 19"
                  strokeLinecap="round"
                  strokeWidth={(isRecent ? 2.5 : 2) * depth}
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      {[...projectedByPubkey.values()]
        .sort((left, right) => right.z - left.z)
        .map(({ node, x, y, scale, z }) => {
          const isSelected = selectedPubkey === node.pubkey;
          const isDimmed = selectedPubkey !== null && !isSelected;
          const isWorking = workingPubkeys.has(node.pubkey);
          return (
            <button
              className={cn(
                "absolute flex w-24 flex-col items-center gap-1 rounded-lg p-1 text-center",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                isDimmed && "opacity-40",
              )}
              data-testid="agent-graph-node"
              key={node.pubkey}
              onClick={() => onSelectNode(isSelected ? null : node.pubkey)}
              style={{
                left: x,
                top: y,
                transform: `translate(-50%, -50%) scale(${scale})`,
                zIndex: Math.round(1000 - z),
              }}
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
                    className="absolute -inset-1.5 h-auto w-auto border-2 border-primary/25 border-t-primary"
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
