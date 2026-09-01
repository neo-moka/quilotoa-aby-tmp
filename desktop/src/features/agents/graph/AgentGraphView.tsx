import * as React from "react";
import { ArrowLeft, GitFork, Radio } from "lucide-react";

import { useChannelsQuery } from "@/features/channels/hooks";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/spinner";

import { type AgentGraphEdge, edgesForNode } from "./agentGraphModel";
import { AgentGraphCanvas } from "./AgentGraphCanvas";
import { useAgentGraphData } from "./useAgentGraphData";

function formatAgo(atSeconds: number, nowSeconds: number): string {
  const delta = Math.max(0, nowSeconds - atSeconds);
  if (delta < 60) return "now";
  if (delta < 3_600) return `${Math.floor(delta / 60)}m`;
  if (delta < 86_400) return `${Math.floor(delta / 3_600)}h`;
  return `${Math.floor(delta / 86_400)}d`;
}

/**
 * Full-screen communication graph between agents (and the viewer): who is
 * passing messages to whom, mentions vs. thread replies (dependencies), and
 * which agents are mid-turn right now. Opened from the channel header's
 * "Agent activity" button.
 */
export function AgentGraphView() {
  const { model, workingPubkeys, isLoading } = useAgentGraphData();
  const channelsQuery = useChannelsQuery();
  const [selectedPubkey, setSelectedPubkey] = React.useState<string | null>(
    null,
  );
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

  const detailEdges = React.useMemo(
    () =>
      selectedPubkey === null
        ? model.edges
        : edgesForNode(model, selectedPubkey),
    [model, selectedPubkey],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5">
        <Button
          aria-label="Back"
          onClick={() => window.history.back()}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ArrowLeft />
        </Button>
        <GitFork aria-hidden className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">Agent graph</h1>
          <p className="truncate text-xs text-muted-foreground">
            Message passing between agents — solid edges carry thread replies
            (dependencies), dashed edges are mentions.
          </p>
        </div>
        {workingPubkeys.size > 0 ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Spinner aria-hidden className="border-2 text-primary" size={14} />
            {workingPubkeys.size} working
          </span>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto p-6">
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
            <AgentGraphCanvas
              edges={model.edges}
              nodes={model.nodes}
              nowSeconds={nowSeconds}
              onSelectNode={setSelectedPubkey}
              selectedPubkey={selectedPubkey}
              workingPubkeys={workingPubkeys}
            />
          )}
        </div>

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
