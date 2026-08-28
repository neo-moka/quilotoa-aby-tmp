import * as React from "react";

import { getPresenceLabel } from "@/features/presence/lib/presence";
import { PresenceDot } from "@/features/presence/ui/PresenceBadge";
import { useSelfProfileCache } from "@/features/profile/hooks";
import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import {
  MaskedAvatarBadgeFrame,
  STATUS_DOT_MASK_CURVE,
} from "@/features/profile/ui/MaskedAvatarBadgeFrame";
import { ProfilePopover } from "@/features/profile/ui/ProfilePopover";
import { StatusEmoji } from "@/features/user-status/ui/StatusEmoji";
import type { LeaveCommunityResult } from "@/features/communities/leaveCommunity";
import type { Community } from "@/features/communities/types";
import { CommunitySwitcher } from "@/features/communities/ui/CommunitySwitcher";
import { useMyRelayMembershipLookupQuery } from "@/features/community-members/hooks";
import type { SettingsSection } from "@/features/settings/ui/SettingsPanels";
import type { PresenceStatus, Profile, UserStatus } from "@/shared/api/types";
import { cn } from "@/shared/lib/cn";
import { Identicon } from "@/shared/ui/Identicon";
import { ItemCard } from "@/shared/ui/item-card";

/**
 * Built on Pro's `ItemCard` for the row itself — root, `Content`, `Title`,
 * `Description` — which is exactly this card's shape: leading figure, stacked
 * title and secondary line, trailing space.
 *
 * **`ItemCard.Icon` is deliberately not used for the avatar.** Its rule set is a
 * fixed `size-9` box with `background-color: var(--default)`, its own radius,
 * and a descendant `svg { width: 1rem; height: 1rem }`
 * (`dist/css/components/item-card.css`). The avatar here is a 32px
 * `MaskedAvatarBadgeFrame` whose `cutout` coordinates are expressed in that 32px
 * space, it must stay transparent so the mask reads, and the identicon below is
 * an `svg` that the descendant rule would clamp to 16px. Using the slot would
 * mean overriding size, background, radius and descendant sizing — every
 * declaration it has — so the avatar keeps its own button.
 *
 * The secondary line uses `ItemCard.Description`, whose `--muted` re-point the
 * `shared/ui/item-card` surface already carries. That scope is not redundant
 * with `data-buzz-sidebar-secondary`: theme.css is unlayered so it wins under
 * the Buzz theme, but its rule is gated on `:root[data-buzz-sidebar]`, and
 * without the scope the line renders in the surface colour under every other
 * theme.
 *
 * The `variant="transparent"` is load-bearing: `default` paints
 * `var(--surface)` plus a shadow, and this card is transparent until hover.
 */

type SidebarProfileCardProps = {
  activeCommunity: Community | null;
  isPresencePending?: boolean;
  onOpenAddCommunity: () => void;
  onOpenSettings: (section?: SettingsSection) => void;
  onRemoveCommunity: (id: string) => Promise<LeaveCommunityResult | undefined>;
  onSendFeedback?: () => void;
  onSetPresenceStatus?: (status: PresenceStatus) => void;
  onSetUserStatus: (text: string, emoji: string) => void;
  onClearUserStatus: () => void;
  onSwitchCommunity: (id: string) => void;
  onUpdateCommunity: (
    id: string,
    updates: Partial<Pick<Community, "name" | "relayUrl" | "token">>,
  ) => void;
  profile?: Profile;
  resolvedDisplayName: string;
  selfPresenceStatus: PresenceStatus;
  selfUserStatus?: UserStatus;
  communities: Community[];
};

const SECONDARY_LINE_CLASS =
  "flex min-w-0 items-center gap-1 text-xs leading-snug text-sidebar-foreground/70";

export function SidebarProfileCard({
  activeCommunity,
  isPresencePending,
  onOpenAddCommunity,
  onOpenSettings,
  onSendFeedback,
  onRemoveCommunity,
  onSetPresenceStatus,
  onSetUserStatus,
  onClearUserStatus,
  onSwitchCommunity,
  onUpdateCommunity,
  profile,
  resolvedDisplayName,
  selfPresenceStatus,
  selfUserStatus,
  communities,
}: SidebarProfileCardProps) {
  const selfProfileCache = useSelfProfileCache();
  const myMembershipQuery = useMyRelayMembershipLookupQuery();
  const activeRole = myMembershipQuery.data?.membership?.role;
  const canInvite = activeRole === "owner" || activeRole === "admin";
  const [profilePopoverOpen, setProfilePopoverOpen] = React.useState(false);
  const profileCardRef = React.useRef<HTMLDivElement | null>(null);
  const toggleProfilePopover = React.useCallback(
    () => setProfilePopoverOpen((prev) => !prev),
    [],
  );
  const handleCardClick = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        !profileCardRef.current?.contains(target)
      ) {
        return;
      }
      toggleProfilePopover();
    },
    [toggleProfilePopover],
  );

  const avatarDataUrl = selfProfileCache?.avatarDataUrl ?? null;
  const avatarUrl = profile?.avatarUrl ?? null;

  // `resolvedDisplayName` is already resolved upstream and falls back to the
  // truncated npub the Rust identity command synthesises
  // (`commands/identity.rs:truncated_display_name`). So an empty profile name
  // means the label on screen is a key, not a name — and a key must not be
  // dressed as one.
  const hasProfileName = Boolean(profile?.displayName?.trim());
  const identiconSeed = profile?.pubkey ?? null;
  const showIdenticon =
    !hasProfileName && !avatarUrl && !avatarDataUrl && Boolean(identiconSeed);

  const hasStatus = Boolean(selfUserStatus?.text || selfUserStatus?.emoji);
  const communityLabel = activeCommunity?.name ?? "No community";
  const readonlyCommunityLabel = (
    <ItemCard.Description
      className={cn(SECONDARY_LINE_CLASS, "mt-0 w-full")}
      data-buzz-sidebar-secondary
    >
      <span className="truncate">{communityLabel}</span>
    </ItemCard.Description>
  );

  return (
    // The click handler here only fills the pointer gaps between the child
    // buttons; every action is reachable from the keyboard through those
    // buttons. The `biome-ignore` this used to carry is gone on purpose: the
    // a11y rules fire on intrinsic elements, and `ItemCard` is a component, so
    // the suppression became dead and biome flags unused ones. Note the flip
    // side — the linter no longer watches this row, so the keyboard path is now
    // maintained by hand.
    <ItemCard
      className="group/profile-card cursor-pointer gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-sidebar-border/35"
      data-testid="sidebar-profile-card"
      onClick={handleCardClick}
      ref={profileCardRef}
      variant="transparent"
    >
      <button
        aria-label={`Open profile menu for ${resolvedDisplayName}`}
        className="relative shrink-0 rounded-xl outline-hidden focus:outline-none focus-visible:outline-none"
        data-testid="sidebar-profile-avatar-button"
        onClick={(event) => {
          event.stopPropagation();
          toggleProfilePopover();
        }}
        type="button"
      >
        <MaskedAvatarBadgeFrame
          badge={
            <span
              aria-label={getPresenceLabel(selfPresenceStatus)}
              className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
              data-testid="self-presence-badge"
              role="img"
            >
              <PresenceDot className="h-2 w-2" status={selfPresenceStatus} />
            </span>
          }
          badgeBox={{ bottom: -2, height: 14, right: -2, width: 14 }}
          className="h-8 w-8"
          curve={STATUS_DOT_MASK_CURVE}
          cutout={{ cx: 28, cy: 28, r: 7.5 }}
          size={32}
        >
          {showIdenticon && identiconSeed ? (
            <Identicon
              className="h-full w-full overflow-hidden rounded-full bg-primary/10"
              size={32}
              testId="sidebar-profile-avatar"
              value={identiconSeed}
            />
          ) : (
            // `label` stays the resolved name so the image keeps a real `alt`.
            // Without a profile name this branch is only reached when a picture
            // exists, so `ProfileAvatar`'s initials are unreachable except in
            // the narrow case of that picture failing to load.
            <ProfileAvatar
              avatarDataUrl={avatarDataUrl}
              avatarUrl={avatarUrl}
              className="h-full w-full text-xs"
              iconClassName="h-4 w-4"
              label={resolvedDisplayName}
              testId="sidebar-profile-avatar"
            />
          )}
        </MaskedAvatarBadgeFrame>
      </button>

      <ItemCard.Content>
        <ProfilePopover
          open={profilePopoverOpen}
          onOpenChange={setProfilePopoverOpen}
          avatarDataUrl={avatarDataUrl}
          avatarUrl={avatarUrl}
          currentStatus={selfPresenceStatus}
          displayName={resolvedDisplayName}
          // The popover is a second rendering of this same identity. Both read
          // it from these two values so the card cannot show an identicon while
          // the menu that opens from it shows invented initials.
          hasProfileName={hasProfileName}
          identiconSeed={identiconSeed}
          isStatusPending={isPresencePending}
          onClearUserStatus={onClearUserStatus}
          onOpenSettings={onOpenSettings}
          onSendFeedback={onSendFeedback}
          onSetStatus={onSetPresenceStatus ?? (() => {})}
          onSetUserStatus={onSetUserStatus}
          triggerContainerRef={profileCardRef}
          userStatusEmoji={selfUserStatus?.emoji}
          userStatusText={selfUserStatus?.text}
          communitySwitcherSlot={
            <CommunitySwitcher
              activeCommunity={activeCommunity}
              canInvite={canInvite}
              onAddCommunity={() => {
                setProfilePopoverOpen(false);
                onOpenAddCommunity();
              }}
              onInvite={() => {
                setProfilePopoverOpen(false);
                onOpenSettings("community-members");
              }}
              onRemoveCommunity={onRemoveCommunity}
              onSwitchCommunity={onSwitchCommunity}
              onUpdateCommunity={onUpdateCommunity}
              variant="profile-menu"
              communities={communities}
            />
          }
        >
          <button
            onClick={(event) => {
              event.stopPropagation();
              toggleProfilePopover();
            }}
            className="block w-full min-w-0 rounded-sm text-left text-sidebar-foreground outline-hidden focus:outline-none focus-visible:outline-none"
            data-testid="open-settings"
            type="button"
          >
            <ItemCard.Title
              className={cn(
                "block w-full leading-tight text-current",
                // A key gets key treatment: monospace, regular weight. Bold on a
                // truncated npub reads as somebody's name.
                hasProfileName ? "font-semibold" : "font-mono font-normal",
              )}
              data-testid="sidebar-profile-name"
            >
              {resolvedDisplayName}
            </ItemCard.Title>
          </button>
        </ProfilePopover>

        {hasStatus ? (
          <div className="relative mt-0.5">
            <button
              aria-label={`Open profile menu for ${resolvedDisplayName}`}
              className={cn(
                "w-full truncate rounded-sm text-left outline-hidden transition-opacity duration-150 focus:outline-none focus-visible:outline-none group-hover/profile-card:opacity-0",
                SECONDARY_LINE_CLASS,
                profilePopoverOpen && "opacity-100",
              )}
              data-buzz-sidebar-secondary
              data-testid="sidebar-profile-user-status"
              onClick={(event) => {
                event.stopPropagation();
                toggleProfilePopover();
              }}
              type="button"
            >
              {selfUserStatus?.emoji ? (
                <StatusEmoji
                  className="mr-1 w-4 shrink-0 text-xs"
                  value={selfUserStatus.emoji}
                />
              ) : null}
              <span className="truncate">{selfUserStatus?.text}</span>
            </button>
            <div
              className={cn(
                "pointer-events-none absolute inset-0 flex min-w-0 items-center opacity-0 transition-opacity duration-150 group-hover/profile-card:opacity-100",
                profilePopoverOpen && "opacity-0",
              )}
            >
              {readonlyCommunityLabel}
            </div>
          </div>
        ) : (
          <div className="relative mt-0.5">{readonlyCommunityLabel}</div>
        )}
      </ItemCard.Content>
    </ItemCard>
  );
}
