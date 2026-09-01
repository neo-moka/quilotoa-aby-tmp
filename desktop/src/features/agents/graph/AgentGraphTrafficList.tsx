import * as React from "react";

import { useChannelsQuery } from "@/features/channels/hooks";
import { cn } from "@/shared/lib/cn";

import type { AgentGraphEdge } from "./agentGraphModel";
import { useAgentGraphData } from "./useAgentGraphData";

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

/**
 * The recent-traffic list on its own: the Agent activity dock's default body
 * while the graph is hidden. Shares the graph's data (same query keys, so no
 * extra fetching when both mount).
 */
export function AgentTrafficPane({ className }: { className?: string }) {
  const { model } = useAgentGraphData();
  const channelsQuery = useChannelsQuery();
  const nowSeconds = Math.floor(Date.now() / 1_000);

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

  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto p-4", className)}>
      <h2 className="pb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        Recent traffic
      </h2>
      {model.edges.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No messages between agents yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {model.edges.map((edge) => (
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
    </div>
  );
}
