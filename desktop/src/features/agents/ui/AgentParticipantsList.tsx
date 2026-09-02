import * as React from "react";

import { useIsArchivedPredicate } from "@/features/identity-archive/hooks";
import { usePresenceQuery } from "@/features/presence/hooks";
import { PresenceDot } from "@/features/presence/ui/PresenceBadge";
import {
  useFlattenedUserSearchResults,
  useInfiniteUserSearchQuery,
  useUserSearchFetchMoreOnScroll,
} from "@/features/profile/hooks";
import type { UserProfileLookup } from "@/features/profile/lib/identity";
import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import { useIdentityQuery } from "@/shared/api/hooks";
import type { PresenceStatus } from "@/shared/api/types";
import { useProfilePanel } from "@/shared/context/ProfilePanelContext";
import { truncatePubkey } from "@/shared/lib/pubkey";
import { Spinner } from "@/shared/ui/spinner";

import type { AgentActivityCandidate } from "./AgentActivitySelector";

type ParticipantRow = {
  pubkey: string;
  name: string;
  avatarUrl: string | null;
  isViewer: boolean;
};

/**
 * The activity panel's front door: everyone in the community, agents first.
 *
 * This replaced the recent-traffic list. Traffic answered "who talked to
 * whom", which the graph now owns outright; the roster answers the question
 * the dock is actually opened for — who is here, who is working right now,
 * and how do I get to their transcript. Agents row-click into their
 * transcript; humans open their profile.
 */
export function AgentParticipantsList({
  agents,
  onSelectAgent,
  profiles,
  workingPubkeys,
}: {
  agents: readonly AgentActivityCandidate[];
  onSelectAgent: (pubkey: string) => void;
  profiles?: UserProfileLookup;
  workingPubkeys: ReadonlySet<string>;
}): React.ReactElement {
  const identityQuery = useIdentityQuery();
  const viewerPubkey = identityQuery.data?.pubkey ?? null;
  const isArchived = useIsArchivedPredicate();
  const { openProfilePanel } = useProfilePanel();

  // Empty query = the full community directory, paged. The panel is
  // channel-agnostic, so the roster is too — channel membership would silently
  // hide whoever hasn't joined the channel you happen to be reading.
  const directoryQuery = useInfiniteUserSearchQuery("", {
    allowEmpty: true,
    limit: 50,
  });
  const directoryResults = useFlattenedUserSearchResults(directoryQuery.data);
  const handleScroll = useUserSearchFetchMoreOnScroll(directoryQuery);

  const agentRows = React.useMemo<ParticipantRow[]>(() => {
    const rows = agents
      .filter((agent) => !isArchived(agent.pubkey))
      .map((agent) => ({
        pubkey: agent.pubkey,
        name: agent.name,
        avatarUrl: agent.avatarUrl ?? null,
        isViewer: false,
      }));
    rows.sort((a, b) => {
      const aWorking = workingPubkeys.has(a.pubkey) ? 0 : 1;
      const bWorking = workingPubkeys.has(b.pubkey) ? 0 : 1;
      if (aWorking !== bWorking) return aWorking - bWorking;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [agents, isArchived, workingPubkeys]);

  const humanRows = React.useMemo<ParticipantRow[]>(() => {
    const agentPubkeys = new Set(agents.map((agent) => agent.pubkey));
    const rows: ParticipantRow[] = [];
    const seen = new Set<string>();
    for (const user of directoryResults) {
      if (user.isAgent || agentPubkeys.has(user.pubkey)) continue;
      if (isArchived(user.pubkey) || seen.has(user.pubkey)) continue;
      seen.add(user.pubkey);
      rows.push({
        pubkey: user.pubkey,
        name: user.displayName ?? truncatePubkey(user.pubkey),
        avatarUrl: user.avatarUrl,
        isViewer: user.pubkey === viewerPubkey,
      });
    }
    // The directory can lag a fresh identity; the viewer belongs on their own
    // roster regardless, so seed them from local identity when missing.
    if (viewerPubkey && !seen.has(viewerPubkey)) {
      const profile = profiles?.[viewerPubkey];
      rows.push({
        pubkey: viewerPubkey,
        name:
          profile?.displayName ??
          identityQuery.data?.displayName ??
          truncatePubkey(viewerPubkey),
        avatarUrl: profile?.avatarUrl ?? null,
        isViewer: true,
      });
    }
    rows.sort((a, b) => {
      if (a.isViewer !== b.isViewer) return a.isViewer ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return rows;
  }, [
    agents,
    directoryResults,
    identityQuery.data?.displayName,
    isArchived,
    profiles,
    viewerPubkey,
  ]);

  const presenceQuery = usePresenceQuery(
    React.useMemo(
      () => [...agentRows, ...humanRows].map((row) => row.pubkey),
      [agentRows, humanRows],
    ),
  );
  const presence = presenceQuery.data;

  const renderRow = (row: ParticipantRow, isAgent: boolean) => {
    const status: PresenceStatus = presence?.[row.pubkey] ?? "offline";
    const working = isAgent && workingPubkeys.has(row.pubkey);
    const onClick = isAgent
      ? () => onSelectAgent(row.pubkey)
      : openProfilePanel
        ? () => openProfilePanel(row.pubkey)
        : undefined;
    return (
      <li key={row.pubkey}>
        <button
          className="flex w-full items-center gap-2.5 rounded-md px-3 py-1.5 text-left hover:bg-muted/60 disabled:cursor-default disabled:hover:bg-transparent"
          data-testid={`participant-row-${row.pubkey}`}
          disabled={onClick === undefined}
          onClick={onClick}
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
          <span className="min-w-0 flex-1 truncate text-sm">
            {row.name}
            {row.isViewer ? (
              <span className="text-muted-foreground"> (you)</span>
            ) : null}
          </span>
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
      onScroll={handleScroll}
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
          {agentRows.map((row) => renderRow(row, true))}
        </ul>
      )}
      <h2 className="px-3 pb-1 pt-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
        People
      </h2>
      {humanRows.length === 0 ? (
        <p className="px-3 text-sm text-muted-foreground">Nobody here yet.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {humanRows.map((row) => renderRow(row, false))}
        </ul>
      )}
    </div>
  );
}
