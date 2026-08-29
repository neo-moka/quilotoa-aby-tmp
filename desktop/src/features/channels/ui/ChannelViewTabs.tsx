import { Clock, FolderOpen, ListTree, MessageSquare } from "lucide-react";

import {
  CHANNEL_VIEW_TABS,
  type ChannelViewTab,
  setChannelViewTab,
} from "@/features/channels/channelViewTabStore";
import { cn } from "@/shared/lib/cn";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";

/**
 * Counts shown beside each tab. `null` means "not counted", which renders no
 * badge at all — deliberately different from `0`, which renders nothing either
 * but for the opposite reason. Keeping them distinct lets a tab whose data is
 * still loading stay quiet instead of flashing a zero.
 */
export type ChannelViewTabCounts = {
  artifacts: number | null;
  threads: number | null;
  /** Runs in this channel that are waiting on the reader specifically. */
  workNeedsYou: number | null;
};

const TAB_META = {
  all: {
    icon: MessageSquare,
    label: "All",
    title: "The whole conversation, humans and agents",
  },
  work: {
    icon: Clock,
    label: "Work",
    title: "Agent runs in this channel",
  },
  threads: {
    icon: ListTree,
    label: "Threads",
    title: "Open questions and decisions",
  },
  artifacts: {
    icon: FolderOpen,
    label: "Artifacts",
    title: "What the work produced",
  },
} as const satisfies Record<
  ChannelViewTab,
  { icon: typeof Clock; label: string; title: string }
>;

/**
 * The four lenses on a channel.
 *
 * Ordered by how often they are wanted, not by importance: the conversation is
 * the default and everything else is a detour from it. `Work` sits second
 * because it is the only one that can be *waiting on you* — its badge is the
 * warning colour for exactly that reason, while the other counts are neutral
 * inventory.
 */
export function ChannelViewTabs({
  activeTab,
  channelId,
  counts,
}: {
  activeTab: ChannelViewTab;
  channelId: string;
  counts: ChannelViewTabCounts;
}) {
  return (
    <Tabs
      onValueChange={(value) =>
        setChannelViewTab(channelId, value as ChannelViewTab)
      }
      value={activeTab}
    >
      {/* Sized to be aimed at, not squeezed in. These four are the primary way
          to move around a channel, so they get the same weight as the body
          text below them rather than the smaller register the app uses for
          chrome that is read once and ignored. */}
      <TabsList
        aria-label="Channel views"
        className="h-9 w-full justify-start gap-1 bg-transparent p-0"
        data-testid="channel-view-tabs"
      >
        {CHANNEL_VIEW_TABS.map((tab) => {
          const meta = TAB_META[tab];
          const Icon = meta.icon;
          const badge = badgeFor(tab, counts);

          return (
            <TabsTrigger
              className="h-8 gap-1.5 rounded-lg px-3 text-sm font-medium data-[state=active]:bg-muted"
              data-testid={`channel-view-tab-${tab}`}
              key={tab}
              title={meta.title}
              value={tab}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              {meta.label}
              {badge ? (
                <span
                  className={cn(
                    "ml-0.5 inline-flex h-4 min-w-4 shrink-0 items-center justify-center rounded px-1 text-badge leading-none tabular-nums",
                    badge.tone === "attention"
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground",
                  )}
                  data-testid={`channel-view-tab-${tab}-count`}
                >
                  {badge.value}
                </span>
              ) : null}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

function badgeFor(
  tab: ChannelViewTab,
  counts: ChannelViewTabCounts,
): { tone: "attention" | "neutral"; value: number } | null {
  const raw =
    tab === "work"
      ? counts.workNeedsYou
      : tab === "threads"
        ? counts.threads
        : tab === "artifacts"
          ? counts.artifacts
          : null;
  if (raw === null || raw <= 0) return null;
  return { tone: tab === "work" ? "attention" : "neutral", value: raw };
}
