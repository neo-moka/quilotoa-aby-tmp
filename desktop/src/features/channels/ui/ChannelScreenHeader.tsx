import { LogIn, Radio, SquareTerminal } from "lucide-react";
import type * as React from "react";

import { ChatHeader } from "@/features/chat/ui/ChatHeader";
import type { EphemeralChannelDisplay } from "@/features/channels/lib/ephemeralChannel";
import type { ActiveDmHeaderParticipant } from "@/features/channels/useActiveChannelHeader";
import { getChannelDescription } from "@/features/channels/lib/channelDescription";
import { getDmParticipantPreview } from "@/features/channels/lib/dmParticipantDisplay";
import { ChannelHeaderStatusBadge } from "@/features/channels/ui/ChannelHeaderStatusBadge";
import { ChannelMembersBar } from "@/features/channels/ui/ChannelMembersBar";
import {
  DEFAULT_HOVER_PROFILE_STATUS_GEOMETRY,
  ProfileAvatarWithStatus,
  scaleProfileAvatarStatusGeometry,
} from "@/features/profile/ui/ProfileAvatarWithStatus";
import { UserProfilePopover } from "@/features/profile/ui/UserProfilePopover";
import { Button } from "@/shared/ui/button";
import type { Channel, PresenceStatus } from "@/shared/api/types";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { useActiveAgentTurnsByChannel } from "@/features/agents/activeAgentTurnsStore";
import {
  toggleAgentActivityPanel,
  useAgentActivityPanel,
} from "@/features/agents/agentActivityPanelStore";
import {
  toggleTerminalPanel,
  useTerminalPanel,
} from "@/features/terminal/terminalPanelStore";

const DM_HEADER_AVATAR_SIZE = 32;
const DM_HEADER_AVATAR_STATUS_GEOMETRY = scaleProfileAvatarStatusGeometry(
  DEFAULT_HOVER_PROFILE_STATUS_GEOMETRY,
  DM_HEADER_AVATAR_SIZE,
);

type ChannelScreenHeaderProps = {
  activeChannel: Channel | null;
  activeChannelEphemeralDisplay: EphemeralChannelDisplay | null;
  activeChannelTitle: string;
  actionsVariant?: "inline" | "compact";
  activeDmAvatarUrl: string | null;
  activeDmHeaderParticipants: ActiveDmHeaderParticipant[];
  activeDmPresenceStatus: PresenceStatus | null;
  chromeWrapperRef?: React.Ref<HTMLDivElement>;
  currentPubkey?: string;
  isAddBotOpen?: boolean;
  isJoining?: boolean;
  showHeaderContent?: boolean;
  transparentChrome?: boolean;
  onAddBotOpenChange?: (open: boolean) => void;
  onJoinChannel?: () => Promise<void>;
  onManageChannel: () => void;
  onToggleMembers: () => void;
};

export function ChannelScreenHeader({
  activeChannel,
  activeChannelEphemeralDisplay,
  activeChannelTitle,
  actionsVariant = "inline",
  activeDmAvatarUrl,
  activeDmHeaderParticipants,
  activeDmPresenceStatus,
  chromeWrapperRef,
  currentPubkey,
  isAddBotOpen,
  isJoining = false,
  onAddBotOpenChange,
  showHeaderContent = true,
  transparentChrome = false,
  onJoinChannel,
  onManageChannel,
  onToggleMembers,
}: ChannelScreenHeaderProps) {
  const isGroupDm =
    activeChannel?.channelType === "dm" &&
    activeDmHeaderParticipants.length > 1;
  const activeDmParticipant = activeDmHeaderParticipants[0] ?? null;
  const showJoinButton =
    activeChannel !== null &&
    !activeChannel.isMember &&
    activeChannel.visibility === "open" &&
    !activeChannel.archivedAt &&
    onJoinChannel;

  const terminalPanel = useTerminalPanel();
  const activeChannelTurns = useActiveAgentTurnsByChannel();
  const terminalButton = activeChannel ? (
    <Button
      aria-label={
        terminalPanel.mode === "closed" ? "Open ABY Term" : "Hide ABY Term"
      }
      onClick={toggleTerminalPanel}
      size="icon"
      title="ABY Term (⌘J)"
      type="button"
      variant={terminalPanel.mode === "closed" ? "outline" : "secondary"}
    >
      <SquareTerminal />
    </Button>
  ) : null;

  // Opening from a channel header preselects an agent working *here* — the
  // gesture reads as "show me what's happening in this channel". The panel's
  // own picker still reaches every agent, so this is a starting point, not a
  // scope: `openAgentActivityPanel` keeps the previous choice when this channel
  // has nobody working, rather than clearing it.
  const activityPanel = useAgentActivityPanel();
  const channelWorkingPubkey = activeChannel
    ? (activeChannelTurns.find(
        (channel) => channel.channelId === activeChannel.id,
      )?.agentPubkeys[0] ?? null)
    : null;
  const activityButton = activeChannel ? (
    <Button
      aria-label={
        activityPanel.isOpen ? "Hide agent activity" : "Show agent activity"
      }
      aria-pressed={activityPanel.isOpen}
      className="relative"
      data-testid="channel-header-agent-activity"
      onClick={() => toggleAgentActivityPanel(channelWorkingPubkey)}
      size="icon"
      title="Agent activity"
      type="button"
      variant={activityPanel.isOpen ? "secondary" : "outline"}
    >
      <Radio />
      {channelWorkingPubkey ? (
        <span
          aria-hidden="true"
          className="absolute right-1 bottom-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
          data-testid="channel-header-agent-activity-live"
        />
      ) : null}
    </Button>
  ) : null;
  const channelActions = activeChannel ? (
    showJoinButton ? (
      <Button
        disabled={isJoining}
        onClick={() => void onJoinChannel()}
        size="sm"
        variant="default"
      >
        <LogIn className="mr-1.5 h-4 w-4" />
        {isJoining ? "Joining…" : "Join"}
      </Button>
    ) : (
      <ChannelMembersBar
        channel={activeChannel}
        currentPubkey={currentPubkey}
        isAddBotOpen={isAddBotOpen}
        onAddBotOpenChange={onAddBotOpenChange}
        onManageChannel={onManageChannel}
        onToggleMembers={onToggleMembers}
        variant={actionsVariant}
      />
    )
  ) : null;
  const actions = activeChannel ? (
    <div className="flex items-center gap-1">
      {terminalButton}
      {activityButton}
      {channelActions}
    </div>
  ) : null;

  if (!showHeaderContent) {
    return null;
  }

  return (
    <ChatHeader
      belowSystemChrome
      chromeWrapperRef={chromeWrapperRef}
      actions={actions}
      channelType={activeChannel?.channelType}
      description={getChannelDescription(activeChannel)}
      leadingContent={
        activeChannel?.channelType === "dm" ? (
          isGroupDm ? (
            <DmHeaderParticipantStack
              participants={activeDmHeaderParticipants}
            />
          ) : activeDmParticipant ? (
            <UserProfilePopover
              pubkey={activeDmParticipant.pubkey}
              triggerAriaLabel={`Open profile for ${activeChannelTitle}`}
              triggerElement="span"
            >
              <ProfileAvatarWithStatus
                avatarClassName="text-xs"
                avatarUrl={activeDmAvatarUrl}
                className="mr-1.5 h-8 w-8"
                geometry={DM_HEADER_AVATAR_STATUS_GEOMETRY}
                iconClassName="h-4 w-4"
                label={activeChannelTitle}
                size={DM_HEADER_AVATAR_SIZE}
                status={activeDmPresenceStatus ?? "offline"}
                statusTestId="chat-presence-badge"
                testId="chat-header-dm-avatar"
              />
            </UserProfilePopover>
          ) : (
            <ProfileAvatarWithStatus
              avatarClassName="text-xs"
              avatarUrl={activeDmAvatarUrl}
              className="mr-1.5 h-8 w-8"
              geometry={DM_HEADER_AVATAR_STATUS_GEOMETRY}
              iconClassName="h-4 w-4"
              label={activeChannelTitle}
              size={DM_HEADER_AVATAR_SIZE}
              status={activeDmPresenceStatus ?? "offline"}
              statusTestId="chat-presence-badge"
              testId="chat-header-dm-avatar"
            />
          )
        ) : undefined
      }
      statusBadge={
        <ChannelHeaderStatusBadge
          ephemeralDisplay={activeChannelEphemeralDisplay}
        />
      }
      title={activeChannelTitle}
      transparentChrome={transparentChrome}
      visibility={activeChannel?.visibility}
    />
  );
}

function DmHeaderParticipantStack({
  participants,
}: {
  participants: ActiveDmHeaderParticipant[];
}) {
  const { hiddenCount, visibleParticipants } =
    getDmParticipantPreview(participants);
  const stackItemCount = visibleParticipants.length + (hiddenCount > 0 ? 1 : 0);

  return (
    <div
      className="mr-1.5 flex shrink-0 items-center"
      data-testid="chat-header-dm-avatar-stack"
    >
      {visibleParticipants.map((participant, index) => (
        <UserProfilePopover
          key={participant.pubkey}
          pubkey={participant.pubkey}
          triggerAriaLabel={`Open profile for ${participant.displayName}`}
          triggerElement="span"
        >
          <span
            className={index > 0 ? "-ml-2" : ""}
            data-testid="chat-header-dm-avatar-stack-participant"
            style={{
              zIndex: index + 1,
              ...(index < stackItemCount - 1 && {
                mask: "radial-gradient(circle 18px at calc(100% + 4px) 50%, transparent 99%, #fff 100%)",
                WebkitMask:
                  "radial-gradient(circle 18px at calc(100% + 4px) 50%, transparent 99%, #fff 100%)",
              }),
            }}
          >
            <UserAvatar
              avatarUrl={participant.avatarUrl}
              className="h-8 w-8 text-xs"
              displayName={participant.displayName}
              size="sm"
            />
          </span>
        </UserProfilePopover>
      ))}
      {hiddenCount > 0 ? (
        <div
          className={visibleParticipants.length > 0 ? "-ml-2" : ""}
          data-testid="chat-header-dm-avatar-stack-more"
          style={{ zIndex: stackItemCount }}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary font-semibold text-secondary-foreground shadow-xs">
            <span className="text-2xs leading-none">+{hiddenCount}</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}
