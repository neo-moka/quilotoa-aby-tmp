import * as React from "react";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/shared/lib/cn";
import { useAgentSessionTranscriptVariant } from "../agentSessionTranscriptContext";

export type ActivityRowLabelParts = {
  verb: string;
  object?: React.ReactNode;
};

export type ActivityRowStats = {
  additions: number;
  deletions: number;
};

export type ActivityRowToneScope = "none" | "tool" | "summary";

type ActivityRowProps = {
  children: React.ReactNode;
  className?: string;
  openToneScope?: Exclude<ActivityRowToneScope, "none">;
  testId?: string;
  title?: string;
};

type ActivityRowContentProps = {
  children: React.ReactNode;
  className?: string;
};

const ACTIVITY_ROW_CONTENT_MARKER = Symbol("ActivityRowContent");

type ActivityRowContentComponent = React.FC<ActivityRowContentProps> & {
  marker: typeof ACTIVITY_ROW_CONTENT_MARKER;
};

export function ActivityRow({
  children,
  className,
  openToneScope = "tool",
  testId,
  title,
}: ActivityRowProps) {
  const childArray = React.Children.toArray(children);
  const summaryChildren = childArray.filter(
    (child) => !isActivityRowContent(child),
  );
  const contentChildren = childArray.filter(isActivityRowContent);

  if (contentChildren.length === 0) {
    return (
      <div
        className={cn("not-prose flex min-h-6 items-center gap-1.5", className)}
        data-testid={testId}
        title={title}
      >
        {children}
      </div>
    );
  }

  return (
    <ExpandableActivityRow
      className={className}
      contentChildren={contentChildren}
      openToneScope={openToneScope}
      summaryChildren={summaryChildren}
      testId={testId}
      title={title}
    />
  );
}

/**
 * The expandable face of {@link ActivityRow}, animated.
 *
 * Still a real `<details>` — fourteen call sites style themselves off
 * `group-open:` variants, which only match `details[open]`. The element is
 * controlled instead of native so closing can play its exit: the `open`
 * attribute stays on until the collapse finishes, otherwise the UA hides the
 * content on the first frame and there is nothing left to animate.
 */
function ExpandableActivityRow({
  className,
  contentChildren,
  openToneScope,
  summaryChildren,
  testId,
  title,
}: {
  className?: string;
  contentChildren: React.ReactElement<
    ActivityRowContentProps,
    ActivityRowContentComponent
  >[];
  openToneScope: Exclude<ActivityRowToneScope, "none">;
  summaryChildren: React.ReactNode[];
  testId?: string;
  title?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [expanded, setExpanded] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  return (
    <details
      className={cn(
        openToneScope === "summary" ? "group/summary" : "group",
        "not-prose w-full",
        className,
      )}
      data-testid={testId}
      // Native toggles (tests setting `.open`, platform find-in-page
      // expansion) fire this without going through the summary handler; sync
      // state so the controlled element never fights an outside opener. The
      // animated-close path never lands here: its click is prevented before
      // the UA toggles.
      onToggle={(event) => {
        const isOpen = event.currentTarget.open;
        if (isOpen && !expanded) {
          setDetailsOpen(true);
          setExpanded(true);
        } else if (!isOpen && expanded) {
          setDetailsOpen(false);
          setExpanded(false);
        }
      }}
      open={detailsOpen}
      title={title}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: summary is natively
          keyboard-operable; the handler only redirects its default toggle. */}
      <summary
        className={cn(
          "group/row flex min-h-6 w-full max-w-full cursor-pointer list-none items-center gap-1.5 text-muted-foreground",
          openToneScope === "summary"
            ? "group-open/summary:text-foreground"
            : "group-open:text-foreground",
        )}
        onClick={(event) => {
          event.preventDefault();
          if (expanded) {
            // Exit runs first; `onExitComplete` drops the `open` attribute.
            setExpanded(false);
          } else {
            setDetailsOpen(true);
            setExpanded(true);
          }
        }}
      >
        {summaryChildren}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform group-hover/row:text-foreground",
            openToneScope === "summary"
              ? "group-open/summary:rotate-180 group-open/summary:text-foreground"
              : "group-open:rotate-180 group-open:text-foreground",
          )}
        />
      </summary>
      {/* Always mounted, never conditionally rendered: a closed `<details>`
          already hides it, and keeping it in the DOM preserves find-in-page
          and the static markup the render tests pin. Only the height plays. */}
      <motion.div
        animate={{
          height: expanded ? "auto" : 0,
          opacity: expanded ? 1 : 0,
        }}
        className="overflow-hidden"
        initial={false}
        onAnimationComplete={() => {
          if (!expanded) setDetailsOpen(false);
        }}
        transition={{
          duration: prefersReducedMotion ? 0 : 0.18,
          ease: "easeOut",
        }}
      >
        {contentChildren.map((child, index) => (
          <div
            className={child.props.className}
            // biome-ignore lint/suspicious/noArrayIndexKey: content regions are static children
            key={index}
          >
            {child.props.children}
          </div>
        ))}
      </motion.div>
    </details>
  );
}

export function ActivityRowLabel({
  className,
  object,
  openToneScope,
  stats,
  title,
  verb,
}: ActivityRowLabelParts & {
  className?: string;
  openToneScope: ActivityRowToneScope;
  stats?: ActivityRowStats | null;
  title?: string;
}) {
  const variant = useAgentSessionTranscriptVariant();
  const isCompactPreview = variant === "compactPreview";

  return (
    <span
      className={cn("inline-flex min-w-0 items-center gap-1.5", className)}
      title={title}
    >
      <span
        className={cn(
          "shrink-0 font-semibold text-muted-foreground/50",
          isCompactPreview ? "text-xs" : "text-sm",
          openToneScope === "none"
            ? null
            : openToneScope === "summary"
              ? "transition-colors group-hover/row:text-foreground group-open/summary:text-foreground"
              : "transition-colors group-hover/row:text-foreground group-open:text-foreground",
        )}
      >
        {verb}
      </span>
      {object ? (
        <span
          className={cn(
            "min-w-0 truncate font-normal text-muted-foreground/60",
            isCompactPreview ? "text-xs" : "text-sm",
            openToneScope === "none"
              ? null
              : openToneScope === "summary"
                ? "transition-colors group-hover/row:text-foreground group-open/summary:text-foreground"
                : "transition-colors group-hover/row:text-foreground group-open:text-foreground",
          )}
        >
          {object}
        </span>
      ) : null}
      {stats ? <ActivityRowStatsView stats={stats} /> : null}
    </span>
  );
}

export const ActivityRowContent = (({ children }: ActivityRowContentProps) => (
  <>{children}</>
)) as ActivityRowContentComponent;
ActivityRowContent.marker = ACTIVITY_ROW_CONTENT_MARKER;

function ActivityRowStatsView({ stats }: { stats: ActivityRowStats }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold leading-5 tabular-nums">
      <span className="text-status-added">+{stats.additions}</span>
      <span className="text-status-deleted">-{stats.deletions}</span>
    </span>
  );
}

function isActivityRowContent(
  child: React.ReactNode,
): child is React.ReactElement<
  ActivityRowContentProps,
  ActivityRowContentComponent
> {
  return (
    React.isValidElement(child) &&
    typeof child.type !== "string" &&
    "marker" in child.type &&
    child.type.marker === ACTIVITY_ROW_CONTENT_MARKER
  );
}

export function splitActivityRowLabel(
  label: string,
): ActivityRowLabelParts | null {
  const match = label.match(
    /^(Added|Archived|Captured|Checked|Compacted|Created|Deleted|Edited|Ran|Read|Removed|Searched|Sent|Unarchived|Updated|Viewed)\s+(.+)$/,
  );
  return match ? { verb: match[1], object: match[2] } : null;
}

export type ActivityRowCountedObject = {
  count: number;
  rest: string;
};

/**
 * Split a summary label object like "16 tool calls" into its leading count
 * and the trailing text (" tool calls"), so the number can animate through
 * AnimatedCount while streaming bursts grow. Returns null when the object
 * does not lead with a count.
 */
export function splitActivityRowCountedObject(
  object: string,
): ActivityRowCountedObject | null {
  const match = object.match(/^(\d+)(\s.+)$/);
  if (!match) return null;
  const count = Number(match[1]);
  if (!Number.isFinite(count)) return null;
  return { count, rest: match[2] };
}
