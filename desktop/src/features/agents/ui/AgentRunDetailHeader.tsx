import * as React from "react";
import { ArrowLeft, Octagon } from "lucide-react";

import { useActiveAgentTurns } from "@/features/agents/activeAgentTurnsStore";
import {
  formatAgentRunStatusLine,
  formatChannelRef,
  formatRunChannelLabel,
  type AgentRunChannel,
} from "@/features/agents/lib/agentRunSummaries";
import {
  formatTokenFigure,
  formatUsageCost,
  selectLatestAgentUsage,
  type AgentUsageSnapshot,
} from "@/features/agents/lib/agentUsageSnapshot";
import { formatElapsed } from "@/features/agents/ui/agentSessionUtils";
import { useObserverEvents } from "@/features/agents/ui/useObserverEvents";
import { useChannelsQuery } from "@/features/channels/hooks";
import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import { cancelManagedAgentTurn } from "@/shared/api/agentControl";
import { cn } from "@/shared/lib/cn";
import { useNow } from "@/shared/lib/useNow";
import { Button } from "@/shared/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { toast } from "@/shared/ui/toast";

/**
 * The vitals for one run, sitting above the transcript.
 *
 * Renders the header only. The transcript below it is `ManagedAgentSessionPanel`,
 * which already owns the observer subscription, the archive paging and the row
 * grammar — this component adds the context that transcript cannot carry: whose
 * run it is, whether it is still going, and the one control that can end it.
 *
 * Bare markup rather than an `AuxiliaryPanel` header, for the same reason as
 * `AgentRunsList`: this mounts inside the activity panel's body, under a header
 * that is already drawn. A second panel surface here would box the run inside a
 * box.
 *
 * **What is real and what is not.** Elapsed time and the channel list come
 * from the live turn store; tokens and cost quote the harness's latest
 * `usage_update` from the same observer stream the transcript renders — so
 * the tile and the transcript's Usage row can never disagree. Progress, the
 * pending-work queue and room rules still have no source anywhere in the app,
 * so they stay muted under one "soon" strip rather than stubbed with a
 * plausible number: a fabricated step count is worse than an absent one,
 * because the reader has no way to tell it is fabricated.
 */
export function AgentRunDetailHeader({
  agentAvatarUrl = null,
  agentName,
  agentPubkey,
  onBack,
}: {
  /**
   * Optional, and defaulted, so the required three-prop contract still works:
   * omitted, the avatar falls back to initials. Passed, the run wears the same
   * face the reader clicked in the runs list — without it, moving between the
   * two views swaps a picture for a monogram and reads as a different agent.
   */
  agentAvatarUrl?: string | null;
  agentName: string;
  agentPubkey: string;
  /**
   * Always present, because the runs list is always behind this view — it is
   * the panel's front door even for a community with one agent, where a single
   * row saying what that agent is doing beats a one-option picker. So the arrow
   * never points at a view that does not exist, and no caller has to reason
   * about whether it should.
   */
  onBack: () => void;
}): React.ReactElement {
  const activeTurns = useActiveAgentTurns(agentPubkey);
  const channelsQuery = useChannelsQuery();
  // The same observer stream the transcript below renders — quoting it here
  // means the Tokens tile can never disagree with the transcript's Usage row.
  const observer = useObserverEvents(true, agentPubkey);
  const usage = React.useMemo(
    () => selectLatestAgentUsage(observer.events),
    [observer.events],
  );

  // Map once per channel-list change; a per-turn `find` would rescan the
  // list on every 1s elapsed tick this header re-renders under.
  const channelById = React.useMemo(
    () =>
      new Map(
        (channelsQuery.data ?? []).map((channel) => [channel.id, channel]),
      ),
    [channelsQuery.data],
  );
  const channels = React.useMemo<AgentRunChannel[]>(
    () =>
      activeTurns.map((turn) => {
        const record = channelById.get(turn.channelId);
        return {
          anchorAt: turn.anchorAt,
          channelId: turn.channelId,
          channelName: record?.name ?? null,
          isDm: record?.channelType === "dm",
        };
      }),
    [activeTurns, channelById],
  );

  const startedAt =
    channels.length > 0 ? Math.min(...channels.map((c) => c.anchorAt)) : null;

  return (
    // `z-[35]`: the channel's shared header backdrop paints a blur at `z-30`
    // across the whole pane row, and this header's top can fall inside that
    // band — without a higher layer it renders ghosted underneath it. Kept
    // below the panel's own header layer (z-40).
    <div
      className="relative z-[35] shrink-0 border-b border-border/60 px-3 py-2.5"
      data-testid="agent-run-detail-header"
    >
      <div className="flex min-w-0 items-center gap-2">
        <Button
          aria-label="Back to runs"
          data-testid="agent-run-detail-back"
          onClick={onBack}
          size="icon-xs"
          variant="ghost"
        >
          <ArrowLeft />
        </Button>
        <ProfileAvatar
          avatarUrl={agentAvatarUrl}
          className="h-7 w-7 shrink-0"
          label={agentName}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {agentName}
          </p>
          {startedAt !== null ? (
            <RunStatusLine channels={channels} />
          ) : (
            <p
              className="truncate text-xs text-muted-foreground"
              data-testid="agent-run-detail-status"
            >
              Idle
            </p>
          )}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        {startedAt !== null ? (
          <ElapsedTile anchorAt={startedAt} />
        ) : (
          <VitalTile label="Elapsed" value="—" />
        )}
        <VitalTile
          label="Channels"
          value={
            channels.length === 0
              ? "—"
              : (formatRunChannelLabel(channels) ?? String(channels.length))
          }
        />
        {usage ? (
          <TokensTile usage={usage} />
        ) : (
          <VitalTile
            label="Tokens"
            title="No usage report from this agent yet — the tile fills in when its harness sends one."
            value="—"
          />
        )}
        {usage?.costAmount !== null && usage?.costAmount !== undefined ? (
          <VitalTile
            label="Cost"
            title={`Latest cost reported by the harness${usage.costCurrency ? ` (${usage.costCurrency})` : ""}.`}
            value={formatUsageCost(usage.costAmount)}
            valueClassName="tabular-nums"
          />
        ) : (
          <VitalTile
            label="Cost"
            title="This agent's harness has not reported a cost."
            value="—"
          />
        )}
      </div>

      {/* One strip for the whole class of missing vitals rather than a tile
          per absence: a grid half-full of SOON reads as broken software, where
          a single note reads as a roadmap — the same call the Work tab made. */}
      <SoonStrip
        detail="Step position, ETA, a pending-work queue, and per-channel rules and memory all need signals the harness does not report yet."
        label="Progress, queue & room memory"
      />

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StopRunButton
          agentName={agentName}
          agentPubkey={agentPubkey}
          channels={channels}
        />
        <SoonChip
          detail="A run can be stopped, but not held and resumed — the harness has no pause."
          label="Pause"
        />
        <SoonChip
          detail="Mid-run redirection is not wired: today you stop the run and say it again."
          label="Steer"
        />
      </div>
    </div>
  );
}

/**
 * The ticking half of the header, split out so only this line re-renders each
 * second and an idle run mounts no timer at all.
 */
function RunStatusLine({ channels }: { channels: readonly AgentRunChannel[] }) {
  const now = useNow(1000);
  const startedAt = Math.min(...channels.map((channel) => channel.anchorAt));

  return (
    <p
      className="truncate text-xs text-muted-foreground"
      data-testid="agent-run-detail-status"
    >
      {formatAgentRunStatusLine({
        channels,
        elapsedLabel: formatElapsed(now - startedAt),
      })}
    </p>
  );
}

function ElapsedTile({ anchorAt }: { anchorAt: number }) {
  const now = useNow(1000);

  return (
    <VitalTile
      label="Elapsed"
      value={formatElapsed(now - anchorAt)}
      valueClassName="tabular-nums"
    />
  );
}

function VitalTile({
  label,
  title,
  value,
  valueClassName,
}: {
  label: string;
  /** Hover explanation; defaults to the value itself for truncation relief. */
  title?: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div
      className="min-w-0 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5"
      data-testid="agent-run-detail-tile"
      title={title}
    >
      <p className="truncate text-2xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "truncate text-sm font-medium text-foreground",
          valueClassName,
        )}
        title={title ?? value}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Context-window fill from the harness's latest `usage_update` — the design's
 * budget tile, backed by the one usage figure the stream actually reports.
 * Quoted as "latest report", never summed: context fill can shrink on
 * compaction, so an accumulator would drift from what the agent experiences.
 */
function TokensTile({ usage }: { usage: AgentUsageSnapshot }) {
  const percent = Math.min(100, Math.max(0, (usage.used / usage.size) * 100));

  return (
    <div
      className="min-w-0 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5"
      data-testid="agent-run-detail-tokens"
      title={`${usage.used.toLocaleString()} of ${usage.size.toLocaleString()} context tokens used, per the harness's latest usage report.`}
    >
      <p className="truncate text-2xs uppercase tracking-wide text-muted-foreground">
        Tokens
      </p>
      <p className="truncate text-sm font-medium tabular-nums text-foreground">
        {formatTokenFigure(usage.used)}
        <span className="font-normal text-muted-foreground">
          {" "}
          / {formatTokenFigure(usage.size)}
        </span>
      </p>
      <div
        aria-hidden="true"
        className="mt-1 h-0.5 overflow-hidden rounded-full bg-border/60"
      >
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Vitals the product has not built yet, one line for the whole class.
 *
 * Muted and non-interactive on purpose — the same reasoning the channel status
 * strip settled on: a disabled-looking strip reads as "not yet", where a
 * live-looking one holding a placeholder reads as broken data. The look is
 * copied rather than the component imported; that one belongs to
 * `features/channels`, and features do not reach across each other.
 */
function SoonStrip({ detail, label }: { detail: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="mt-1.5 flex cursor-default items-center justify-between gap-2 rounded-md border border-dashed border-border/60 px-2 py-1.5"
          data-testid="agent-run-detail-tile-soon"
        >
          <span className="truncate text-2xs uppercase tracking-wide text-muted-foreground/70">
            {label}
          </span>
          <SoonBadge />
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{detail}</TooltipContent>
    </Tooltip>
  );
}

function SoonChip({ detail, label }: { detail: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className="flex shrink-0 cursor-default items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground/70"
          data-testid="agent-run-detail-action-soon"
        >
          {label}
          <SoonBadge />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{detail}</TooltipContent>
    </Tooltip>
  );
}

function SoonBadge() {
  return (
    <span className="rounded bg-muted px-1 text-badge uppercase leading-4 tracking-wide text-muted-foreground">
      soon
    </span>
  );
}

/**
 * Stop the run — the one live-run control that genuinely exists.
 *
 * It is under-determined rather than merely awkward, and the settings menu
 * already settled how to handle that: the control frame is `{ type:
 * "cancel_turn", channelId }`, so cancelling is per *turn in a channel*, while
 * an agent can hold turns in several channels at once. So:
 *
 * - one live turn — enabled, and the label names the channel it will stop, so
 *   the target is stated rather than implied;
 * - several — disabled, pointing at the channel panel, which knows which turn
 *   the reader means because the reader is standing in it;
 * - none — disabled, there being nothing to stop.
 *
 * The disabled cases keep a tooltip via a wrapping span: a disabled button
 * swallows pointer events, so the explanation would never appear on the control
 * that needs it most.
 */
function StopRunButton({
  agentName,
  agentPubkey,
  channels,
}: {
  agentName: string;
  agentPubkey: string;
  channels: readonly AgentRunChannel[];
}) {
  const [stopping, setStopping] = React.useState(false);
  const soleChannel = channels.length === 1 ? channels[0] : null;

  async function handleStop(channelId: string) {
    setStopping(true);
    try {
      await cancelManagedAgentTurn(agentPubkey, channelId);
      toast.success(
        `Stop signal sent to ${agentName}. It may take a moment to respond.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to stop ${agentName}'s current turn.`,
      );
    } finally {
      setStopping(false);
    }
  }

  if (!soleChannel) {
    const detail =
      channels.length === 0
        ? "Nothing is running to stop."
        : `${agentName} is working in ${channels.length} channels. Stop it from the channel you mean.`;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex"
            data-testid="agent-run-detail-stop-blocked"
          >
            <Button disabled size="xs" variant="outline">
              <Octagon />
              Stop run
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-64">{detail}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      data-testid="agent-run-detail-stop"
      disabled={stopping}
      onClick={() => handleStop(soleChannel.channelId)}
      size="xs"
      variant="outline"
    >
      <Octagon />
      {(() => {
        const ref = formatChannelRef(soleChannel);
        if (!ref) return "Stop run";
        return soleChannel.isDm ? "Stop run in this DM" : `Stop run in ${ref}`;
      })()}
    </Button>
  );
}
