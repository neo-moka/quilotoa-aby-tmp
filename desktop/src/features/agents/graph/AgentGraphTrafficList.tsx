import { cn } from "@/shared/lib/cn";

import type { AgentGraphEdge } from "./agentGraphModel";

export function formatAgo(atSeconds: number, nowSeconds: number): string {
  const delta = Math.max(0, nowSeconds - atSeconds);
  if (delta < 60) return "now";
  if (delta < 3_600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86_400) return `${Math.floor(delta / 3_600)}h`;
  return `${Math.floor(delta / 86_400)}d`;
}

export function EdgeDetail({
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
