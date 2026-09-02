import * as React from "react";

import { useIsArchivedPredicate } from "@/features/identity-archive/hooks";
import { usePresenceQuery } from "@/features/presence/hooks";
import { PresenceDot } from "@/features/presence/ui/PresenceBadge";
import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import type { PresenceStatus } from "@/shared/api/types";
import { Spinner } from "@/shared/ui/spinner";

import type { AgentActivityCandidate } from "./AgentActivitySelector";

type ParticipantRow = {
  pubkey: string;
  name: string;
  avatarUrl: string | null;
};

/**
 * The activity panel's front door: the community's agents, working first.
 *
 * Agents only, on purpose: this dock exists to answer "which agents are here,
 * which are working, and how do I get to their transcript". Humans have their
 * own surfaces (channel members, profiles, DMs) — listing the whole community
 * directory here just buried the agents under people the panel can't act on.
 */
export function AgentParticipantsList({
  agents,
  onSelectAgent,
  workingPubkeys,
}: {
  agents: readonly AgentActivityCandidate[];
  onSelectAgent: (pubkey: string) => void;
  workingPubkeys: ReadonlySet<string>;
}): React.ReactElement {
  const isArchived = useIsArchivedPredicate();

  const agentRows = React.useMemo<ParticipantRow[]>(() => {
    const rows = agents
      .filter((agent) => !isArchived(agent.pubkey))
      .map((agent) => ({
        pubkey: agent.pubkey,
        name: agent.name,
        avatarUrl: agent.avatarUrl ?? null,
      }));
    rows.sort((a, b) => {
      const aWorking = workingPubkeys.has(a.pubkey) ? 0 : 1;
      const bWorking = workingPubkeys.has(b.pubkey) ? 0 : 1;
      if (aWorking !== bWorking) return aWorking - bWorking;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [agents, isArchived, workingPubkeys]);

  const presenceQuery = usePresenceQuery(
    React.useMemo(() => agentRows.map((row) => row.pubkey), [agentRows]),
  );
  const presence = presenceQuery.data;

  const renderRow = (row: ParticipantRow) => {
    const status: PresenceStatus = presence?.[row.pubkey] ?? "offline";
    const working = workingPubkeys.has(row.pubkey);
    return (
      <li key={row.pubkey}>
        <button
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left hover:bg-muted/60"
          data-testid={`participant-row-${row.pubkey}`}
          onClick={() => onSelectAgent(row.pubkey)}
          type="button"
        >
          <span className="relative shrink-0">
            <ProfileAvatar
              avatarUrl={row.avatarUrl}
              className="h-7 w-7"
              label={row.name}
            />
            <PresenceDot
              className="absolute -bottom-0.5 -right-0.5 h-2 w-2 ring-2 ring-background"
              status={status}
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{row.name}</span>
          {working ? (
            <Spinner
              aria-label={`${row.name} is working`}
              className="text-primary"
              size={14}
            />
          ) : null}
        </button>
      </li>
    );
  };

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto px-1 py-2"
      data-testid="agent-participants-list"
    >
      <h2 className="px-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        Agents
      </h2>
      {agentRows.length === 0 ? (
        <p className="px-3 pb-2 text-sm text-muted-foreground">
          No agents yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5 pb-2">
          {agentRows.map((row) => renderRow(row))}
        </ul>
      )}
    </div>
  );
}
