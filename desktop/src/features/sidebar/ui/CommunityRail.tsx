import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Bot,
  CheckCheck,
  Link2,
  Plus,
  Settings,
  Settings2,
  Ticket,
  Users,
} from "lucide-react";
import * as React from "react";

import type { LeaveCommunityResult } from "@/features/communities/leaveCommunity";
import type { Community } from "@/features/communities/types";
import { CommunitySwitcher } from "@/features/communities/ui/CommunitySwitcher";
import { useSelfProfileCache } from "@/features/profile/hooks";
import { ProfilePopover } from "@/features/profile/ui/ProfilePopover";
import { EditCommunityDialog } from "@/features/communities/ui/EditCommunityDialog";
import { useCommunityIcons } from "@/features/communities/useCommunityIcons";
import { useMyRelayMembershipLookupQuery } from "@/features/community-members/hooks";
import {
  useCommunityUnread,
  type CommunityUnreadState,
} from "@/features/communities/useCommunityUnread";
import { useAppShell } from "@/app/AppShellContext";
import {
  DEFAULT_HOVER_PROFILE_STATUS_GEOMETRY,
  ProfileAvatarWithStatus,
  scaleProfileAvatarStatusGeometry,
} from "@/features/profile/ui/ProfileAvatarWithStatus";
import type { SettingsSection } from "@/features/settings/ui/SettingsPanels";
import type { PresenceStatus, UserStatus } from "@/shared/api/types";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/shared/ui/context-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { cn } from "@/shared/lib/cn";
import { getInitials } from "@/shared/lib/initials";
import { writeTextToClipboard } from "@/shared/lib/clipboard";

type CommunityRailProps = {
  communities: Community[];
  activeCommunityId: string | null;
  onSwitchCommunity: (id: string) => void;
  onAddCommunity: () => void;
  onUpdateCommunity: (
    id: string,
    updates: Partial<Pick<Community, "name" | "relayUrl" | "token">>,
  ) => void;
  onReorderCommunities: (orderedIds: string[]) => void;
  /** Bottom cluster: jump to the Agents view. */
  onSelectAgents?: () => void;
  /** Bottom cluster: the reader's own face, worn with their presence. */
  selfAvatarUrl?: string | null;
  selfDisplayName?: string | null;
  selfPresenceStatus?: PresenceStatus | null;
  /**
   * Handlers for the profile menu the avatar opens — the same menu the
   * sidebar's footer card shows, so the two faces of one identity cannot
   * offer different actions. Absent, the avatar falls back to opening
   * Settings.
   */
  profileMenu?: RailProfileMenu;
};

type RailProfileMenu = {
  isPresencePending?: boolean;
  onClearUserStatus: () => void;
  onOpenAddCommunity: () => void;
  onRemoveCommunity: (id: string) => Promise<LeaveCommunityResult | undefined>;
  onSendFeedback?: () => void;
  onSetPresenceStatus?: (status: PresenceStatus) => void;
  onSetUserStatus: (text: string, emoji: string) => void;
  selfPubkey?: string | null;
  selfUserStatus?: UserStatus;
};

const MAX_BADGE = 99;

const RAIL_SELF_AVATAR_SIZE = 32;
const RAIL_SELF_AVATAR_GEOMETRY = scaleProfileAvatarStatusGeometry(
  DEFAULT_HOVER_PROFILE_STATUS_GEOMETRY,
  RAIL_SELF_AVATAR_SIZE,
);

/**
 * Presentation decisions for one community button, derived from its observed
 * mention state. Pure so it can be unit-tested without a DOM. The `state` guard
 * ensures we NEVER render any indicator for a relay we could not observe
 * (`unknown`/`loading`/`error`) — only a `ready` observation is trusted.
 *
 * Two-tier indicator system:
 * - `showBadge`: numeric mention count (mentions/thread-replies present).
 * - `showDot`: plain unread dot when there are regular channel unreads but no
 *   mentions. Mutually exclusive with `showBadge` by construction.
 */
export function communityRailIndicators(unread: CommunityUnreadState): {
  mentionCount: number;
  showBadge: boolean;
  showDot: boolean;
  pending: boolean;
  badgeLabel: string;
} {
  const observed = unread.state === "ready";
  const mentionCount = observed ? (unread.count ?? 0) : 0;
  const showBadge = mentionCount > 0;
  const showDot = observed && unread.hasUnread && !showBadge;
  return {
    mentionCount,
    showBadge,
    showDot,
    pending: unread.state === "unknown" || unread.state === "loading",
    badgeLabel:
      mentionCount > MAX_BADGE ? `${MAX_BADGE}+` : String(mentionCount),
  };
}

function CommunityButton({
  community,
  isActive,
  unread,
  iconUrl,
  onSwitch,
  menu,
  dragListeners,
  dragAttributes,
  isDragging,
}: {
  community: Community;
  isActive: boolean;
  unread: CommunityUnreadState;
  iconUrl: string | null;
  onSwitch: () => void;
  menu: React.ReactNode;
  dragListeners?: React.HTMLAttributes<HTMLElement>;
  dragAttributes?: React.HTMLAttributes<HTMLElement>;
  isDragging?: boolean;
}) {
  const { mentionCount, showBadge, showDot, badgeLabel } =
    communityRailIndicators(unread);

  const tooltipLabel = showBadge
    ? `${community.name} — ${mentionCount} mention${mentionCount === 1 ? "" : "s"}`
    : showDot
      ? `${community.name} — unread`
      : community.name;

  return (
    <ContextMenu modal={false}>
      <Tooltip>
        <TooltipTrigger asChild>
          <ContextMenuTrigger asChild>
            <button
              aria-current={isActive ? "true" : undefined}
              aria-label={tooltipLabel}
              className={cn(
                "relative flex h-9 w-9 items-center justify-center touch-none outline-hidden focus:outline-none focus-visible:outline-none",
                isDragging && "opacity-30",
              )}
              data-testid={`community-rail-button-${community.id}`}
              onClick={onSwitch}
              type="button"
              {...dragAttributes}
              {...dragListeners}
            >
              {isActive ? (
                <span
                  aria-hidden="true"
                  className="absolute -left-2.5 h-5 w-1 rounded-r-full bg-primary"
                  data-testid={`community-rail-active-${community.id}`}
                />
              ) : null}
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-sidebar-accent/60 text-xs font-semibold text-sidebar-foreground/80 outline-2 outline-offset-2 outline-primary/0 transition-[outline-color]",
                  !isActive && "hover:outline-primary/50",
                )}
              >
                {iconUrl ? (
                  <img
                    alt=""
                    className="h-full w-full object-cover"
                    data-testid={`community-rail-icon-${community.id}`}
                    draggable={false}
                    src={iconUrl}
                  />
                ) : (
                  getInitials(community.name) || <Users className="h-4 w-4" />
                )}
              </span>
              {showBadge ? (
                <span
                  className="absolute -bottom-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-2xs font-semibold text-primary-foreground ring-2 ring-sidebar"
                  data-testid={`community-rail-mentions-${community.id}`}
                >
                  {badgeLabel}
                </span>
              ) : showDot ? (
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 shrink-0 rounded-full bg-primary ring-2 ring-sidebar"
                  data-testid={`community-rail-unread-dot-${community.id}`}
                >
                  <span className="sr-only">unread</span>
                </span>
              ) : null}
            </button>
          </ContextMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {tooltipLabel}
        </TooltipContent>
      </Tooltip>
      <ContextMenuContent data-testid={`community-rail-menu-${community.id}`}>
        {menu}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function CommunityDragOverlay({
  community,
  iconUrl,
}: {
  community: Community;
  iconUrl: string | null;
}) {
  return (
    <div
      className="flex h-9 w-9 cursor-grabbing items-center justify-center overflow-hidden rounded-xl bg-primary text-xs font-semibold text-primary-foreground opacity-90 shadow-lg ring-1 ring-sidebar-border"
      data-buzz-flat
    >
      {iconUrl ? (
        <img
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
          src={iconUrl}
        />
      ) : (
        getInitials(community.name) || <Users className="h-4 w-4" />
      )}
    </div>
  );
}

function SortableCommunityButton({
  community,
  activeCommunityId,
  iconsByCommunity,
  unreadByCommunity,
  canInvite,
  onInvite,
  onSwitchCommunity,
  onMarkAllRead,
  onSetEditingCommunity,
}: {
  community: Community;
  activeCommunityId: string | null;
  iconsByCommunity: Record<string, string | null | undefined>;
  unreadByCommunity: Record<string, CommunityUnreadState>;
  canInvite: boolean;
  onInvite: () => void;
  onSwitchCommunity: (id: string) => void;
  onMarkAllRead: (community: Community) => void;
  onSetEditingCommunity: (community: Community) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: community.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CommunityButton
        community={community}
        dragAttributes={attributes}
        dragListeners={listeners}
        iconUrl={iconsByCommunity[community.id] ?? null}
        isActive={community.id === activeCommunityId}
        isDragging={isDragging}
        menu={
          <>
            <ContextMenuItem onClick={() => onMarkAllRead(community)}>
              <CheckCheck className="h-4 w-4" />
              Mark all as read
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                void writeTextToClipboard(community.relayUrl);
              }}
            >
              <Link2 className="h-4 w-4" />
              Copy community URL
            </ContextMenuItem>
            {canInvite ? (
              <ContextMenuItem onClick={onInvite}>
                <Ticket className="h-4 w-4" />
                Invite to community
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem onClick={() => onSetEditingCommunity(community)}>
              <Settings2 className="h-4 w-4" />
              Community settings
            </ContextMenuItem>
          </>
        }
        onSwitch={() => onSwitchCommunity(community.id)}
        unread={
          unreadByCommunity[community.id] ?? {
            hasUnread: false,
            state: "unknown",
          }
        }
      />
    </div>
  );
}

/**
 * Discord/Slack-style vertical rail of communities on the far left of the app.
 * Shows a mention-count badge for inactive communities (observed via
 * `useCommunityUnread`) and switches relays on click. Right-click opens a
 * per-community menu for read state, community URL, invites, and settings.
 *
 * Hidden entirely with a single community — a rail of one adds no value.
 */
export function CommunityRail({
  communities,
  activeCommunityId,
  onSwitchCommunity,
  onAddCommunity,
  onUpdateCommunity,
  onReorderCommunities,
  onSelectAgents,
  selfAvatarUrl = null,
  selfDisplayName = null,
  selfPresenceStatus = null,
  profileMenu,
}: CommunityRailProps) {
  const { unreadByCommunity, markCommunityRead } = useCommunityUnread(
    communities,
    activeCommunityId,
  );
  const iconsByCommunity = useCommunityIcons(communities);
  const { markAllChannelsRead, onOpenSettings } = useAppShell();
  const myMembershipQuery = useMyRelayMembershipLookupQuery();
  const activeRole = myMembershipQuery.data?.membership?.role;
  const canInviteToActiveCommunity =
    onOpenSettings !== null &&
    (activeRole === "owner" || activeRole === "admin");
  const [editingCommunity, setEditingCommunity] =
    React.useState<Community | null>(null);
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // The rail no longer hides for a single community: with the brand mark and
  // the agents / settings / self cluster living here, it is the app's outer
  // frame, not a community switcher that only earns its width at two.
  const communityIds = communities.map((c) => c.id);
  const draggingCommunity = draggingId
    ? (communities.find((c) => c.id === draggingId) ?? null)
    : null;

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = communityIds.indexOf(active.id as string);
    const newIdx = communityIds.indexOf(over.id as string);
    if (oldIdx !== -1 && newIdx !== -1) {
      onReorderCommunities(arrayMove(communityIds, oldIdx, newIdx));
    }
  };

  const handleMarkAllRead = (community: Community) => {
    if (community.id === activeCommunityId) {
      markAllChannelsRead();
      return;
    }
    markCommunityRead(community.id).catch((error) => {
      console.warn(
        `[CommunityRail] mark all read failed community=${community.id}:`,
        error,
      );
    });
  };

  return (
    <nav
      aria-label="Communities"
      className="relative z-20 flex w-14 shrink-0 flex-col items-center gap-2.5 overflow-y-auto bg-sidebar px-2.5 pb-5 pt-[calc(var(--buzz-top-chrome-height,40px)+7px)] after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border/60"
      data-testid="community-rail"
    >
      {/* Brand mark, then a hairline — the design's rail leads with the app
          so the tiles below read as places inside it. Deliberately inert:
          every navigation the mark could do already has a labelled button. */}
      <div
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground"
        data-testid="community-rail-brand"
      >
        a
      </div>
      <div aria-hidden="true" className="h-px w-5 shrink-0 bg-sidebar-border" />
      <DndContext
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SortableContext
          items={communityIds}
          strategy={verticalListSortingStrategy}
        >
          {communities.map((community) => (
            <SortableCommunityButton
              key={community.id}
              activeCommunityId={activeCommunityId}
              canInvite={
                community.id === activeCommunityId && canInviteToActiveCommunity
              }
              community={community}
              iconsByCommunity={iconsByCommunity}
              unreadByCommunity={unreadByCommunity}
              onInvite={() => onOpenSettings?.("community-members")}
              onMarkAllRead={handleMarkAllRead}
              onSetEditingCommunity={setEditingCommunity}
              onSwitchCommunity={onSwitchCommunity}
            />
          ))}
        </SortableContext>
        <DragOverlay>
          {draggingCommunity ? (
            <CommunityDragOverlay
              community={draggingCommunity}
              iconUrl={iconsByCommunity[draggingCommunity.id] ?? null}
            />
          ) : null}
        </DragOverlay>
      </DndContext>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            aria-label="Add community"
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-sidebar-accent/60 text-sidebar-foreground/70 outline-hidden transition-all hover:rounded-xl hover:bg-primary/80 hover:text-primary-foreground focus:outline-none focus-visible:outline-none"
            data-testid="community-rail-add"
            onClick={onAddCommunity}
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          Add community
        </TooltipContent>
      </Tooltip>

      {/* The bottom cluster pins app-level identity where the design puts it:
          agents, settings, and the reader's own presence. */}
      <div aria-hidden="true" className="min-h-2 flex-1" />
      {onSelectAgents ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Agents"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/60 outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              data-testid="community-rail-agents"
              onClick={onSelectAgents}
              type="button"
            >
              <Bot className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Agents
          </TooltipContent>
        </Tooltip>
      ) : null}
      {onOpenSettings ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              aria-label="Settings"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sidebar-foreground/60 outline-hidden transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              data-testid="community-rail-settings"
              onClick={() => onOpenSettings("profile")}
              type="button"
            >
              <Settings className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            Settings
          </TooltipContent>
        </Tooltip>
      ) : null}
      {selfDisplayName || selfAvatarUrl ? (
        <RailSelfButton
          activeCommunity={
            communities.find((c) => c.id === activeCommunityId) ?? null
          }
          canInvite={canInviteToActiveCommunity}
          communities={communities}
          onOpenSettings={onOpenSettings}
          onRemoveCommunityFromMenu={profileMenu?.onRemoveCommunity}
          onSwitchCommunity={onSwitchCommunity}
          onUpdateCommunity={onUpdateCommunity}
          profileMenu={profileMenu}
          selfAvatarUrl={selfAvatarUrl}
          selfDisplayName={selfDisplayName}
          selfPresenceStatus={selfPresenceStatus}
        />
      ) : null}
      <EditCommunityDialog
        onOpenChange={(open) => {
          if (!open) setEditingCommunity(null);
        }}
        onSave={onUpdateCommunity}
        open={editingCommunity !== null}
        community={editingCommunity}
        showIconEditor={editingCommunity?.id === activeCommunityId}
      />
    </nav>
  );
}

/**
 * The rail's self avatar. With `profileMenu` wired it opens the same
 * `ProfilePopover` as the sidebar's footer card — status, community actions,
 * feedback, settings — so the rail is a full stand-in for the card rather
 * than a picture of it. Without the handlers it degrades to opening Settings.
 */
function RailSelfButton({
  activeCommunity,
  canInvite,
  communities,
  onOpenSettings,
  onRemoveCommunityFromMenu,
  onSwitchCommunity,
  onUpdateCommunity,
  profileMenu,
  selfAvatarUrl,
  selfDisplayName,
  selfPresenceStatus,
}: {
  activeCommunity: Community | null;
  canInvite: boolean;
  communities: Community[];
  onOpenSettings: ((section: SettingsSection) => void) | null;
  onRemoveCommunityFromMenu?: (
    id: string,
  ) => Promise<LeaveCommunityResult | undefined>;
  onSwitchCommunity: (id: string) => void;
  onUpdateCommunity: (
    id: string,
    updates: Partial<Pick<Community, "name" | "relayUrl" | "token">>,
  ) => void;
  profileMenu?: RailProfileMenu;
  selfAvatarUrl: string | null;
  selfDisplayName: string | null;
  selfPresenceStatus: PresenceStatus | null;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement | null>(null);
  const selfProfileCache = useSelfProfileCache();
  const displayName = selfDisplayName ?? "Current identity";

  const trigger = (
    // `open-settings` / `sidebar-profile-avatar-button` / `self-presence-badge`
    // are inherited from the footer profile card this button replaced — a
    // sizeable spec surface addresses the profile menu through them, and the
    // ids name the affordance, not the old placement.
    <button
      aria-label={`Open profile menu for ${displayName}`}
      className="shrink-0 rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      data-testid="open-settings"
      onClick={() => {
        if (profileMenu) {
          setMenuOpen((prev) => !prev);
          return;
        }
        onOpenSettings?.("profile");
      }}
      type="button"
    >
      <ProfileAvatarWithStatus
        avatarClassName="text-xs"
        avatarUrl={selfAvatarUrl}
        geometry={RAIL_SELF_AVATAR_GEOMETRY}
        iconClassName="h-4 w-4"
        label={displayName}
        size={RAIL_SELF_AVATAR_SIZE}
        status={selfPresenceStatus ?? "offline"}
        statusTestId="self-presence-badge"
        testId="sidebar-profile-avatar-button"
      />
    </button>
  );

  if (!profileMenu) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {displayName}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div data-testid="sidebar-profile-card" ref={triggerRef}>
      <ProfilePopover
        avatarDataUrl={selfProfileCache?.avatarDataUrl ?? null}
        avatarUrl={selfAvatarUrl}
        currentStatus={selfPresenceStatus ?? "offline"}
        displayName={displayName}
        hasProfileName={Boolean(selfDisplayName?.trim())}
        identiconSeed={profileMenu.selfPubkey ?? null}
        isStatusPending={profileMenu.isPresencePending}
        onClearUserStatus={profileMenu.onClearUserStatus}
        onOpenChange={setMenuOpen}
        onOpenSettings={(section) => onOpenSettings?.(section ?? "profile")}
        onSendFeedback={profileMenu.onSendFeedback}
        onSetStatus={profileMenu.onSetPresenceStatus ?? (() => {})}
        onSetUserStatus={profileMenu.onSetUserStatus}
        open={menuOpen}
        triggerContainerRef={triggerRef}
        userStatusEmoji={profileMenu.selfUserStatus?.emoji}
        userStatusText={profileMenu.selfUserStatus?.text}
        communitySwitcherSlot={
          <CommunitySwitcher
            activeCommunity={activeCommunity}
            canInvite={canInvite}
            onAddCommunity={() => {
              setMenuOpen(false);
              profileMenu.onOpenAddCommunity();
            }}
            onInvite={() => {
              setMenuOpen(false);
              onOpenSettings?.("community-members");
            }}
            onRemoveCommunity={
              onRemoveCommunityFromMenu ?? (() => Promise.resolve(undefined))
            }
            onSwitchCommunity={onSwitchCommunity}
            onUpdateCommunity={onUpdateCommunity}
            variant="profile-menu"
            communities={communities}
          />
        }
      >
        {trigger}
      </ProfilePopover>
    </div>
  );
}
