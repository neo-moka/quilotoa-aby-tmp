import { ChatListView } from "@heroui-pro/react/chat-list-view";

import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import type { ManagedAgent } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { HERO_MUTED_SCOPE } from "@/shared/ui/heroMutedScope";

export type AgentActivityCandidate = Pick<
  ManagedAgent,
  "pubkey" | "name" | "status"
> & {
  avatarUrl?: string | null;
};

const AGENT_STATUS_LABELS: Record<ManagedAgent["status"], string> = {
  deployed: "Deployed",
  not_deployed: "Not deployed",
  running: "Running",
  stopped: "Stopped",
};

/**
 * Picks which agent the activity panel is watching.
 *
 * Built on Pro's `ChatListView`, which is a thread-row list for sidebars and
 * conversation pickers rather than the virtualised timeline its name suggests
 * — which is exactly this. It wraps React Aria's `GridList`, so selection is
 * the collection's (`selectedKeys`), not the row's, and keyboard navigation
 * comes with it.
 *
 * Two Pro defaults are corrected here rather than in a wrapper, because both
 * land on specific leaves:
 *
 * - **`--muted`.** `__icon`, `__preview` and `__meta` read it as a text colour,
 *   and this app spends that token on a surface (see `heroMutedScope`). The
 *   scope goes on those three leaves and nowhere higher: the rows carry app
 *   markup — avatars, status badges — and a scope on the root would repaint
 *   anything inside them that uses `bg-muted`.
 * - **A hardcoded 11px text size** on `.chat-list-view__meta`, which would
 *   freeze that text against Cmd +/- zoom. `check:px-text` cannot catch it —
 *   it only scans `desktop/src`, and this lives in the Pro dist. `text-2xs` is
 *   the app's zoom-safe token for the same size, so `Meta` is overridden with
 *   it.
 */
export function AgentActivitySelector({
  agents,
  onSelect,
  selectedPubkey,
  workingPubkeys,
}: {
  agents: readonly AgentActivityCandidate[];
  onSelect: (pubkey: string) => void;
  selectedPubkey: string | null;
  /** Agents with a turn in flight right now, shown with a "Live" marker. */
  workingPubkeys: ReadonlySet<string>;
}) {
  return (
    <ChatListView
      aria-label="Active agents"
      data-testid="agent-activity-selector"
      density="compact"
      disallowEmptySelection
      onSelectionChange={(keys) => {
        // RAC hands back a Set for multiple selection and "all" for select-all;
        // single selection always yields at most one key.
        if (keys === "all") return;
        const [first] = [...keys];
        if (first != null) onSelect(String(first));
      }}
      selectedKeys={selectedPubkey ? [selectedPubkey] : []}
      selectionMode="single"
    >
      {agents.map((agent) => (
        <ChatListView.Item
          data-testid={`agent-activity-option-${agent.pubkey}`}
          id={agent.pubkey}
          key={agent.pubkey}
          textValue={agent.name}
        >
          <ChatListView.Icon className={HERO_MUTED_SCOPE}>
            <ProfileAvatar
              avatarUrl={agent.avatarUrl ?? null}
              className="h-6 w-6 text-2xs"
              label={agent.name}
            />
          </ChatListView.Icon>
          <ChatListView.ItemContent className={HERO_MUTED_SCOPE}>
            <ChatListView.Title>{agent.name}</ChatListView.Title>
            <ChatListView.Preview className={HERO_MUTED_SCOPE}>
              {AGENT_STATUS_LABELS[agent.status]}
            </ChatListView.Preview>
          </ChatListView.ItemContent>
          {workingPubkeys.has(agent.pubkey) ? (
            <ChatListView.Meta
              className={cn(HERO_MUTED_SCOPE, "text-2xs text-primary")}
            >
              Live
            </ChatListView.Meta>
          ) : null}
        </ChatListView.Item>
      ))}
    </ChatListView>
  );
}
