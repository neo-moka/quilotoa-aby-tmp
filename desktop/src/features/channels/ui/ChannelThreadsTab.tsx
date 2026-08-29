import * as React from "react";
import { Bot, ListTree, MessageSquare } from "lucide-react";

import {
  buildMessageExcerpt,
  countThreadAgentParticipants,
  selectChannelThreadRows,
  type ChannelThreadRow,
} from "@/features/channels/lib/channelLensData";
import {
  ChannelLensEmpty,
  ChannelLensList,
  ChannelLensSection,
  ChannelLensSoon,
} from "@/features/channels/ui/ChannelLensChrome";
import { formatThreadSummaryLastReplyTime } from "@/features/messages/lib/dateFormatters";
import type {
  MainTimelineEntry,
  TimelineThreadSummaryParticipant,
} from "@/features/messages/lib/threadPanel";
import type { TimelineMessage } from "@/features/messages/types";
import { UserAvatar } from "@/shared/ui/UserAvatar";

const MAX_STACKED_PARTICIPANTS = 3;

/**
 * The channel read as a list of open questions instead of a stream.
 *
 * A thread is where a conversation stopped being linear, which is exactly the
 * thing a scrollback loses: by the time a reply lands the root has scrolled
 * past and the question looks answered. Sorting on last activity rather than on
 * when the thread started is what makes this a to-do list — the thread someone
 * touched five minutes ago is the one still live, however old its root is.
 */
export function ChannelThreadsTab({
  agentPubkeys,
  entries,
  isLoading,
  onOpenThread,
}: {
  /** Lowercased pubkeys of the channel's agents, for the per-thread marker. */
  agentPubkeys?: ReadonlySet<string>;
  entries: readonly MainTimelineEntry[];
  isLoading: boolean;
  onOpenThread: (message: TimelineMessage) => void;
}) {
  const rows = React.useMemo(() => selectChannelThreadRows(entries), [entries]);

  return (
    <div
      className="flex min-w-0 flex-col gap-5"
      data-testid="channel-threads-tab"
    >
      <ChannelLensSection
        count={rows.length}
        icon={ListTree}
        testId="channel-threads-tab-open"
        title="Open threads"
      >
        {rows.length > 0 ? (
          <ChannelLensList testId="channel-threads-tab-list">
            {rows.map((row) => (
              <ThreadRow
                agentPubkeys={agentPubkeys}
                key={row.id}
                onOpen={onOpenThread}
                row={row}
              />
            ))}
          </ChannelLensList>
        ) : (
          <ChannelLensEmpty
            message={
              isLoading
                ? "Still loading this channel's history."
                : "No threads yet — reply to a message and it becomes a thread you can pick back up from here."
            }
            testId="channel-threads-tab-empty"
          />
        )}
      </ChannelLensSection>

      {/* The design splits this list into open and resolved. Nothing in the
          relay marks a thread as settled — there is no such event kind and no
          field on the summary — so the split is named and deferred rather than
          faked with a heuristic like "no replies lately", which would quietly
          archive the threads people are still thinking about. */}
      <ChannelLensSoon
        detail="Marking a thread resolved needs an event kind the relay does not have yet, so nothing in the app knows which threads are settled."
        items={["Resolved threads", "Decision recorded on a thread"]}
        testId="channel-threads-tab-resolved-soon"
        title="Resolved"
      />
    </div>
  );
}

function ThreadRow({
  agentPubkeys,
  onOpen,
  row,
}: {
  agentPubkeys?: ReadonlySet<string>;
  onOpen: (message: TimelineMessage) => void;
  row: ChannelThreadRow;
}) {
  const excerpt = buildMessageExcerpt(row.message.body);
  const replyLabel =
    row.replyCount === 1 ? "1 reply" : `${row.replyCount} replies`;
  const agentCount = agentPubkeys
    ? countThreadAgentParticipants(row, agentPubkeys)
    : 0;

  return (
    <button
      className="flex w-full min-w-0 items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      data-testid="channel-threads-tab-row"
      onClick={() => {
        onOpen(row.message);
      }}
      type="button"
    >
      <UserAvatar
        avatarUrl={row.message.avatarUrl ?? null}
        displayName={row.message.author}
        size="sm"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="min-w-0 truncate text-sm text-foreground">
          {excerpt || "Message with no text"}
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
          <span className="truncate font-medium">{row.message.author}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <MessageSquare aria-hidden="true" className="h-3 w-3" />
            {replyLabel}
          </span>
          {agentCount > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span
                className="inline-flex items-center gap-1 tabular-nums"
                data-testid="channel-threads-tab-agent-count"
                title="Agents among the participants shown — the thread may involve more."
              >
                <Bot aria-hidden="true" className="h-3 w-3" />
                {agentCount === 1 ? "1 agent" : `${agentCount} agents`}
              </span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{formatThreadSummaryLastReplyTime(row.lastActivityAt)}</span>
        </div>
      </div>

      <ParticipantStack participants={row.participants} />
    </button>
  );
}

/**
 * Who is in the thread, at a glance.
 *
 * Overlapped rather than listed because the question this answers is "is this
 * mine to read", and that is settled by recognising a face faster than by
 * reading three names.
 */
function ParticipantStack({
  participants,
}: {
  participants: readonly TimelineThreadSummaryParticipant[];
}) {
  if (participants.length === 0) return null;

  const visible = participants.slice(0, MAX_STACKED_PARTICIPANTS);
  const hidden = participants.length - visible.length;

  return (
    <div
      className="flex shrink-0 items-center pt-0.5"
      data-testid="channel-threads-tab-participants"
    >
      {visible.map((participant, index) => (
        <span
          className={index > 0 ? "-ml-1.5" : undefined}
          key={participant.id}
          title={participant.author}
        >
          <UserAvatar
            avatarUrl={participant.avatarUrl}
            className="ring-1 ring-background"
            displayName={participant.author}
            size="xs"
          />
        </span>
      ))}
      {hidden > 0 ? (
        <span className="ml-1 text-2xs tabular-nums text-muted-foreground">
          +{hidden}
        </span>
      ) : null}
    </div>
  );
}
