import { useReducedMotion } from "motion/react";
import * as React from "react";

import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import { cn } from "@/shared/lib/cn";
import { Spinner } from "@/shared/ui/spinner";

import { project, spherePositions } from "./agentGraph3d";
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
  const [rotation, setRotation] = React.useState({ yaw: 0, pitch: -0.28 });
  const dragRef = React.useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
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
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
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
          <marker
            id="agent-graph-arrow-3d"
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
          const from = projectedByPubkey.get(edge.from);
          const to = projectedByPubkey.get(edge.to);
          if (!from || !to) return null;
          const deltaX = to.x - from.x;
          const deltaY = to.y - from.y;
          const distance = Math.hypot(deltaX, deltaY) || 1;
          const unitX = deltaX / distance;
          const unitY = deltaY / distance;
          const startX = from.x + unitX * (NODE_RADIUS * from.scale + 4);
          const startY = from.y + unitY * (NODE_RADIUS * from.scale + 4);
          const endX = to.x - unitX * (NODE_RADIUS * to.scale + 10);
          const endY = to.y - unitY * (NODE_RADIUS * to.scale + 10);
          const path = `M ${startX} ${startY} L ${endX} ${endY}`;
          const depth = (from.scale + to.scale) / 2;
          const isRecent = nowSeconds - edge.lastAt <= RECENT_WINDOW_SECONDS;
          const active = isEdgeActive(edge);
          const baseOpacity = active ? 0.55 + (depth - 0.7) * 0.9 : 0.15;
          return (
            <g key={`${edge.from}→${edge.to}`}>
              <path
                className={cn(
                  isRecent ? "text-primary" : "text-muted-foreground/80",
                )}
                d={path}
                fill="none"
                markerEnd="url(#agent-graph-arrow-3d)"
                opacity={Math.max(0.12, Math.min(1, baseOpacity))}
                stroke="currentColor"
                strokeDasharray={edge.replyCount === 0 ? "5 4" : undefined}
                strokeWidth={
                  (1 + Math.min(3, Math.log2(edge.count + 1))) * depth
                }
              />
              {active ? (
                <path
                  className={cn(
                    "text-primary",
                    isRecent ? "buzz-graph-flow" : "buzz-graph-flow-slow",
                  )}
                  d={path}
                  fill="none"
                  opacity={(isRecent ? 0.95 : 0.45) * Math.min(1, depth)}
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
