import * as React from "react";
import { FileCode2, Paperclip } from "lucide-react";

import {
  groupChannelCodeArtifactsByFile,
  selectChannelCodeArtifacts,
  selectChannelFileArtifacts,
  type ChannelCodeArtifact,
  type ChannelCodeArtifactGroup,
  type ChannelFileArtifact,
} from "@/features/channels/lib/channelLensData";
import {
  ChannelLensEmpty,
  ChannelLensList,
  ChannelLensSection,
  ChannelLensSoon,
} from "@/features/channels/ui/ChannelLensChrome";
import { formatThreadSummaryLastReplyTime } from "@/features/messages/lib/dateFormatters";
import type { TimelineMessage } from "@/features/messages/types";
import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/badge";
import { UserAvatar } from "@/shared/ui/UserAvatar";

/**
 * The channel read as what came out of it.
 *
 * A channel's output is buried in its transcript by construction — a diff is a
 * message, and messages are ordered by when they were said rather than by what
 * they produced. This tab re-indexes on the artifact: code by the file it
 * touched, attachments by the file itself, so "what did we change in here" is a
 * list instead of a scroll.
 */
export function ChannelArtifactsTab({
  isLoading,
  messages,
  onOpenThread,
}: {
  isLoading: boolean;
  /** The channel's loaded window — the same messages the conversation renders. */
  messages: readonly TimelineMessage[];
  onOpenThread: (message: TimelineMessage) => void;
}) {
  // Memoized together: both selectors walk the full window, and the diff scan
  // inside the first one is the only per-render cost worth avoiding here.
  const { fileGroups, files } = React.useMemo(
    () => ({
      fileGroups: groupChannelCodeArtifactsByFile(
        selectChannelCodeArtifacts(messages),
      ),
      files: selectChannelFileArtifacts(messages),
    }),
    [messages],
  );

  const codeCount = fileGroups.reduce(
    (total, group) => total + group.artifacts.length,
    0,
  );

  return (
    <div
      className="flex min-w-0 flex-col gap-5"
      data-testid="channel-artifacts-tab"
    >
      <ChannelLensSection
        count={codeCount}
        icon={FileCode2}
        testId="channel-artifacts-tab-code"
        title="Code"
      >
        {fileGroups.length > 0 ? (
          <ChannelLensList testId="channel-artifacts-tab-code-list">
            {fileGroups.map((group) => (
              <CodeGroupRow
                group={group}
                key={group.filePath ?? "__untagged__"}
                onOpen={onOpenThread}
              />
            ))}
          </ChannelLensList>
        ) : (
          <ChannelLensEmpty
            message={
              isLoading
                ? "Still loading this channel's history."
                : "No code yet — diffs an agent posts here are collected by the file they touch."
            }
            testId="channel-artifacts-tab-code-empty"
          />
        )}
      </ChannelLensSection>

      <ChannelLensSection
        count={files.length}
        icon={Paperclip}
        testId="channel-artifacts-tab-files"
        title="Files"
      >
        {files.length > 0 ? (
          <ChannelLensList testId="channel-artifacts-tab-files-list">
            {files.map((file) => (
              <FileRow file={file} key={file.id} onOpen={onOpenThread} />
            ))}
          </ChannelLensList>
        ) : (
          <ChannelLensEmpty
            message="No files yet — images and files attached to messages here show up in this list."
            testId="channel-artifacts-tab-files-empty"
          />
        )}
      </ChannelLensSection>

      {/* Two separate gaps, deliberately not merged into one vague note. Links
          are *present* but only as body text, so collecting them means guessing
          which URLs in a sentence were meant as references. Decisions are
          absent outright — no event kind records one — so there is nothing to
          collect at all. */}
      <ChannelLensSoon
        detail="Links live inside message text with nothing marking them as references, and a decision has no event kind at all — so neither can be collected without guessing."
        items={["Linked references", "Decisions"]}
        testId="channel-artifacts-tab-soon"
        title="References and decisions"
      />
    </div>
  );
}

/**
 * One file's worth of diffs.
 *
 * The header carries the newest change and the totals; earlier commits to the
 * same path stay collapsed underneath as one line each. That asymmetry is the
 * point — the current state of a file is what a reader is after, and its
 * history is context they can want but rarely lead with.
 */
function CodeGroupRow({
  group,
  onOpen,
}: {
  group: ChannelCodeArtifactGroup;
  onOpen: (message: TimelineMessage) => void;
}) {
  const [latest, ...earlier] = group.artifacts;
  if (!latest) return null;

  const added = group.artifacts.reduce(
    (total, artifact) => total + artifact.added,
    0,
  );
  const removed = group.artifacts.reduce(
    (total, artifact) => total + artifact.removed,
    0,
  );

  return (
    <div className="min-w-0" data-testid="channel-artifacts-tab-code-row">
      <button
        className="flex w-full min-w-0 items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
        onClick={() => {
          onOpen(latest.message);
        }}
        type="button"
      >
        <UserAvatar
          avatarUrl={latest.message.avatarUrl ?? null}
          displayName={latest.message.author}
          size="sm"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="min-w-0 truncate font-mono text-sm text-foreground">
            {group.filePath ?? "Untitled diff"}
          </span>
          {latest.description ? (
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {latest.description}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted-foreground">
            <span className="truncate font-medium">
              {latest.message.author}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatThreadSummaryLastReplyTime(latest.createdAt)}</span>
            {group.artifacts.length > 1 ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">
                  {group.artifacts.length} changes
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pt-0.5">
          <DiffCounts added={added} removed={removed} />
          {latest.commitSha ? (
            <Badge className="font-mono" variant="outline">
              {latest.commitSha}
            </Badge>
          ) : null}
        </div>
      </button>

      {earlier.length > 0 ? (
        <ul className="border-t border-border/40 bg-muted/20 px-3 py-1.5">
          {earlier.map((artifact) => (
            <EarlierChangeRow
              artifact={artifact}
              key={artifact.id}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function EarlierChangeRow({
  artifact,
  onOpen,
}: {
  artifact: ChannelCodeArtifact;
  onOpen: (message: TimelineMessage) => void;
}) {
  return (
    <li className="min-w-0">
      <button
        className="flex w-full min-w-0 items-center gap-2 rounded px-1 py-1 text-left text-2xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        data-testid="channel-artifacts-tab-code-history-row"
        onClick={() => {
          onOpen(artifact.message);
        }}
        type="button"
      >
        <span className="truncate">
          {artifact.description ?? artifact.message.author}
        </span>
        <span className="ml-auto shrink-0 tabular-nums">
          {formatThreadSummaryLastReplyTime(artifact.createdAt)}
        </span>
        {artifact.commitSha ? (
          <span className="shrink-0 font-mono">{artifact.commitSha}</span>
        ) : null}
      </button>
    </li>
  );
}

/** Added/removed lines, silent when a diff carries neither. */
function DiffCounts({ added, removed }: { added: number; removed: number }) {
  if (added === 0 && removed === 0) return null;

  return (
    <span
      className="shrink-0 whitespace-nowrap text-2xs tabular-nums"
      data-testid="channel-artifacts-tab-diff-counts"
    >
      {added > 0 ? (
        <span className="text-emerald-600 dark:text-emerald-400">+{added}</span>
      ) : null}
      {added > 0 && removed > 0 ? " " : null}
      {removed > 0 ? (
        <span className="text-rose-600 dark:text-rose-400">−{removed}</span>
      ) : null}
    </span>
  );
}

function FileRow({
  file,
  onOpen,
}: {
  file: ChannelFileArtifact;
  onOpen: (message: TimelineMessage) => void;
}) {
  return (
    <button
      className="flex w-full min-w-0 items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50"
      data-testid="channel-artifacts-tab-files-row"
      onClick={() => {
        onOpen(file.message);
      }}
      type="button"
    >
      <Paperclip
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="min-w-0 truncate text-sm text-foreground">
          {file.label}
        </span>
        <div className="flex min-w-0 items-center gap-2 text-2xs text-muted-foreground">
          <span className="truncate">{file.message.author}</span>
          <span aria-hidden="true">·</span>
          <span>{formatThreadSummaryLastReplyTime(file.createdAt)}</span>
        </div>
      </div>

      <span
        className={cn(
          "shrink-0 truncate text-2xs text-muted-foreground/70",
          !file.mimeType && "hidden",
        )}
      >
        {file.mimeType}
      </span>
    </button>
  );
}
