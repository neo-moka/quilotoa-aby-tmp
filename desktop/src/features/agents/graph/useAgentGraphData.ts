import * as React from "react";
import { useQuery } from "@tanstack/react-query";

import { useActiveAgentTurnsByChannel } from "@/features/agents/activeAgentTurnsStore";
import {
  useManagedAgentsQuery,
  useRelayAgentsQuery,
} from "@/features/agents/hooks";
import { isManagedAgentActive } from "@/features/agents/lib/managedAgentControlActions";
import { useRelayMembersQuery } from "@/features/community-members/hooks";
import { useUsersBatchQuery } from "@/features/profile/hooks";
import { relayClient } from "@/shared/api/relayClient";
import { useIdentityQuery } from "@/shared/api/hooks";
import {
  KIND_STREAM_MESSAGE,
  KIND_STREAM_MESSAGE_V2,
} from "@/shared/constants/kinds";
import { normalizePubkey } from "@/shared/lib/pubkey";

import {
  type AgentGraphModel,
  type AgentGraphRosterEntry,
  buildAgentGraphModel,
} from "./agentGraphModel";

/**
 * Relay NIP-11 `max_authors` is 20; the graph queries node-authored traffic in
 * one filter, so the roster slice is capped to stay inside it.
 */
const MAX_AUTHORS = 20;
const FETCH_LIMIT = 500;
const REFRESH_INTERVAL_MS = 15_000;

export type AgentGraphData = {
  model: AgentGraphModel;
  workingPubkeys: ReadonlySet<string>;
  isLoading: boolean;
};

/**
 * Roster + recent node-authored channel messages → communication graph.
 *
 * Only node-authored events can create edges (every edge starts at a p-tag on
 * a node's message), so a single authors-scoped query is sufficient — no
 * second `#p` sweep needed.
 */
export function useAgentGraphData(): AgentGraphData {
  const managedAgentsQuery = useManagedAgentsQuery();
  const relayAgentsQuery = useRelayAgentsQuery();
  const identityQuery = useIdentityQuery();
  const activeChannelTurns = useActiveAgentTurnsByChannel();

  const roster = React.useMemo<AgentGraphRosterEntry[]>(() => {
    const managed = (managedAgentsQuery.data ?? []).filter(
      isManagedAgentActive,
    );
    const managedPubkeys = new Set(
      managed.map((agent) => normalizePubkey(agent.pubkey)),
    );
    const relayOnly = (relayAgentsQuery.data ?? []).filter(
      (agent) => !managedPubkeys.has(normalizePubkey(agent.pubkey)),
    );
    return [...managed, ...relayOnly].map((agent) => ({
      pubkey: agent.pubkey,
      name: agent.name,
      avatarUrl: agent.avatarUrl ?? null,
    }));
  }, [managedAgentsQuery.data, relayAgentsQuery.data]);

  // Humans in the flow: every relay member who is not an agent joins the
  // roster as an optional node — the model renders them only when they
  // actually exchange messages with someone on the graph.
  const relayMembersQuery = useRelayMembersQuery();
  const humanPubkeys = React.useMemo(() => {
    const agentPubkeys = new Set(
      roster.map((entry) => normalizePubkey(entry.pubkey)),
    );
    const viewerPubkey = identityQuery.data?.pubkey
      ? normalizePubkey(identityQuery.data.pubkey)
      : null;
    return (relayMembersQuery.data ?? [])
      .map((member) => normalizePubkey(member.pubkey))
      .filter((pubkey) => !agentPubkeys.has(pubkey) && pubkey !== viewerPubkey);
  }, [identityQuery.data?.pubkey, relayMembersQuery.data, roster]);

  const profilesQuery = useUsersBatchQuery(
    identityQuery.data?.pubkey
      ? [...humanPubkeys, identityQuery.data.pubkey]
      : humanPubkeys,
  );
  const profiles = profilesQuery.data?.profiles;

  const humans = React.useMemo<AgentGraphRosterEntry[]>(
    () =>
      humanPubkeys.map((pubkey) => {
        const profile = profiles?.[pubkey];
        return {
          pubkey,
          name: profile?.displayName || `${pubkey.slice(0, 8)}…`,
          avatarUrl: profile?.avatarUrl ?? null,
          optional: true,
        };
      }),
    [humanPubkeys, profiles],
  );

  const viewer = React.useMemo<AgentGraphRosterEntry | null>(() => {
    const identity = identityQuery.data;
    if (!identity?.pubkey) return null;
    return {
      pubkey: identity.pubkey,
      name: identity.displayName || "You",
      avatarUrl:
        profiles?.[normalizePubkey(identity.pubkey)]?.avatarUrl ?? null,
    };
  }, [identityQuery.data, profiles]);

  const authorPubkeys = React.useMemo(() => {
    const pubkeys = roster.map((entry) => normalizePubkey(entry.pubkey));
    if (viewer) pubkeys.push(normalizePubkey(viewer.pubkey));
    for (const pubkey of humanPubkeys) pubkeys.push(pubkey);
    return [...new Set(pubkeys)].slice(0, MAX_AUTHORS);
  }, [humanPubkeys, roster, viewer]);

  const eventsQuery = useQuery({
    queryKey: ["agent-graph-messages", authorPubkeys],
    enabled: authorPubkeys.length > 0,
    refetchInterval: REFRESH_INTERVAL_MS,
    queryFn: () =>
      relayClient.fetchEvents({
        kinds: [KIND_STREAM_MESSAGE, KIND_STREAM_MESSAGE_V2],
        authors: authorPubkeys,
        limit: FETCH_LIMIT,
      }),
  });

  const model = React.useMemo(
    () =>
      buildAgentGraphModel({
        roster: [...roster, ...humans],
        viewer,
        events: eventsQuery.data ?? [],
      }),
    [eventsQuery.data, humans, roster, viewer],
  );

  const workingPubkeys = React.useMemo(() => {
    const working = new Set<string>();
    for (const channel of activeChannelTurns) {
      for (const pubkey of channel.agentPubkeys) {
        working.add(normalizePubkey(pubkey));
      }
    }
    return working;
  }, [activeChannelTurns]);

  return {
    model,
    workingPubkeys,
    isLoading:
      (managedAgentsQuery.isPending && relayAgentsQuery.isPending) ||
      (authorPubkeys.length > 0 && eventsQuery.isPending),
  };
}
