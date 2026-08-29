import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { useManagedAgentsQuery } from "@/features/agents/hooks";
import { isManagedAgentActive } from "@/features/agents/lib/managedAgentControlActions";
import {
  formatAgentCount,
  formatTokenCount,
  localDayBoundsUnix,
  parseTokenField,
} from "@/features/sidebar/lib/sidebarNowData";
import { getAgentUsageSeries } from "@/shared/api/tauriArchive";
import type { ConnectionState } from "@/shared/api/relayClientShared";
import { useRelayConnection } from "@/shared/api/useRelayConnection";
import { cn } from "@/shared/lib/cn";
import { useNow } from "@/shared/lib/useNow";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

/** Re-derive the day window (and the daily usage total) once a minute. */
const FOOTER_TICK_MS = 60_000;

type RelayStatus = { dotClass: string; label: string; detail: string };

function describeRelay(state: ConnectionState): RelayStatus {
  switch (state) {
    case "connected":
      return {
        dotClass: "bg-primary",
        label: "Connected",
        detail: "Relay connected — events are streaming in real time.",
      };
    case "connecting":
    case "reconnecting":
      return {
        dotClass: "bg-warning",
        label: "Reconnecting",
        detail: "Reconnecting to the relay. New events may be delayed.",
      };
    case "stalled":
      return {
        dotClass: "bg-warning",
        label: "Stalled",
        detail:
          "The relay connection is open but has gone quiet. New events may be delayed.",
      };
    case "disconnected":
      return {
        dotClass: "bg-destructive",
        label: "Offline",
        detail: "Disconnected from the relay. Nothing is streaming right now.",
      };
    default:
      return {
        dotClass: "bg-sidebar-foreground/30",
        label: "Idle",
        detail: "No relay connection has been opened yet.",
      };
  }
}

function Separator() {
  return (
    <span aria-hidden="true" className="text-sidebar-foreground/25">
      ·
    </span>
  );
}

/**
 * The sidebar's bottom status line: relay health, how many agents are up, and
 * what today has cost in tokens.
 *
 * Reads its own data rather than taking props, because everything on the line
 * is app-wide state that `AppSidebar` would otherwise have to acquire purely to
 * pass through.
 *
 * The usage slot is the one with a real risk of lying. It is sourced from the
 * local NIP-AM archive, which is opt-in and can be partially populated, so
 * three cases are kept distinct: a complete total prints as-is, a total the
 * archive flags `incomplete` prints with a `+` (it is a floor, not a
 * measurement), and no archive at all prints "Usage off" with the reason. The
 * archive also carries an `estimatedCostUsd`, deliberately not shown here — it
 * is an estimate, and a dollar figure in a status bar gets read as an invoice.
 */
export function SidebarStatusFooter({
  className,
}: {
  className?: string;
}): React.ReactElement {
  const relayState = useRelayConnection();
  const relay = describeRelay(relayState);
  const managedAgentsQuery = useManagedAgentsQuery();

  const managedAgents = managedAgentsQuery.data;
  const activeAgentCount = React.useMemo(
    () => (managedAgents ?? []).filter(isManagedAgentActive).length,
    [managedAgents],
  );

  // Ticking here (rather than computing once on mount) is what rolls the window
  // over at local midnight in a sidebar that stays mounted for days.
  const now = useNow(FOOTER_TICK_MS);
  const [dayStart, dayEnd] = React.useMemo(
    () => localDayBoundsUnix(new Date(now)),
    [now],
  );

  const usageQuery = useQuery({
    queryKey: ["sidebar-agent-usage-today", dayStart, dayEnd],
    queryFn: () =>
      getAgentUsageSeries({ bucketBoundaries: [dayStart, dayEnd] }),
    staleTime: FOOTER_TICK_MS,
    // A missing archive is an expected state, not a fault worth retrying into.
    retry: false,
  });

  const usage = usageQuery.data;
  // One bucket was requested, so index 0 is today. Anything else — collection
  // off, the command unavailable, an empty archive — collapses to "no number".
  const todayTokens = usage?.collectionEnabled
    ? usage.buckets[0]?.usage.totalTokens
    : undefined;
  const totalTokens = parseTokenField(todayTokens?.value);
  const tokensIncomplete = todayTokens?.incomplete ?? false;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5 px-2 py-1.5 text-2xs text-sidebar-foreground/60",
        className,
      )}
      data-testid="sidebar-status-footer"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                relay.dotClass,
                relayState !== "connected" && "motion-safe:animate-pulse",
              )}
            />
            <span className="truncate">{relay.label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>{relay.detail}</TooltipContent>
      </Tooltip>

      <Separator />

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="shrink-0 tabular-nums">
            {formatAgentCount(activeAgentCount)}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {`${formatAgentCount(activeAgentCount)} running or deployed`}
        </TooltipContent>
      </Tooltip>

      <Separator />

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-0 truncate tabular-nums">
            {totalTokens === null
              ? "Usage off"
              : `${formatTokenCount(totalTokens)}${tokensIncomplete ? "+" : ""}`}
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {totalTokens === null
            ? "Token usage appears here once agent-metric archiving is enabled in Settings."
            : tokensIncomplete
              ? `At least ${formatTokenCount(totalTokens)} tokens used today. Some turns did not report usage, so the real figure is higher.`
              : `${formatTokenCount(totalTokens)} tokens used today.`}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
