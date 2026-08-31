import * as React from "react";

import { useActiveAgentTurnsBridge } from "@/features/agents/activeAgentTurnsStore";
import {
  useManagedAgentsQuery,
  useRelayAgentsQuery,
} from "@/features/agents/hooks";
import { useManagedAgentObserverBridge } from "@/features/agents/observerRelayStore";
import type { ManagedAgent } from "@/shared/api/types";
import { normalizePubkey } from "@/shared/lib/pubkey";

type IngestionAgent = Pick<ManagedAgent, "pubkey" | "status">;

/**
 * Combine locally managed agents with every agent registered on the relay
 * into one ingestion list.
 *
 * Managed agents keep their real status; relay agents that are not managed
 * locally are treated as `deployed`. Ownership does not gate inclusion:
 * public observer frames (kind 24201) can arrive for any relay agent, so all
 * of them must be in the trusted ingestion set, while encrypted frames (kind
 * 24200) for agents we do not own are `#p`-addressed to their owner and never
 * reach our subscription in the first place — registering their agents is
 * harmless for the private path.
 */
export function combineObserverIngestionAgents(
  managedAgents: readonly IngestionAgent[],
  relayAgentPubkeys: readonly string[],
): IngestionAgent[] {
  const managed = managedAgents.map((agent) => ({
    pubkey: agent.pubkey,
    status: agent.status,
  }));
  const managedSet = new Set(
    managed.map((agent) => normalizePubkey(agent.pubkey)),
  );
  const relay: IngestionAgent[] = [];
  for (const pubkey of relayAgentPubkeys) {
    if (managedSet.has(normalizePubkey(pubkey))) {
      continue;
    }
    relay.push({ pubkey, status: "deployed" as const });
  }
  return [...managed, ...relay];
}

/**
 * App-level community-global observer ingestion.
 *
 * Mounted once in AppShell so observer frames — encrypted owner-scoped ones
 * (kind 24200) and public community-visible ones (kind 24201) — are received,
 * decoded, and folded into the derived active-turns store regardless of which
 * screen or panel happens to be open. Individual surfaces read from the
 * stores; none of them need to mount their own bridge for ingestion to work.
 *
 * This is the product invariant: activity from every registered agent in the
 * community is ingested app-wide — owned agents through their encrypted
 * stream, everyone else's through the public stream when their harness opts
 * in with `BUZZ_ACP_OBSERVER_PUBLIC=true`.
 */
export function useAgentObserverIngestion() {
  const managedAgentsQuery = useManagedAgentsQuery();
  const managedAgents = managedAgentsQuery.data;

  const relayAgentsQuery = useRelayAgentsQuery();
  const relayAgentPubkeys = React.useMemo(
    () => (relayAgentsQuery.data ?? []).map((agent) => agent.pubkey),
    [relayAgentsQuery.data],
  );

  const ingestionAgents = React.useMemo(
    () =>
      combineObserverIngestionAgents(managedAgents ?? [], relayAgentPubkeys),
    [managedAgents, relayAgentPubkeys],
  );

  useManagedAgentObserverBridge(ingestionAgents);
  useActiveAgentTurnsBridge(ingestionAgents);
}
