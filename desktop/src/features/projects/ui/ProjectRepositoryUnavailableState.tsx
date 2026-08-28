import {
  CircleAlert,
  CloudOff,
  GitBranch,
  Loader2,
  LockKeyhole,
  MessageCircle,
  RefreshCw,
} from "lucide-react";

import { useAppNavigation } from "@/app/navigation/useAppNavigation";
import {
  isChannelReferenceOpenable,
  useChannelReference,
} from "@/features/channels/openChannelDirectory";
import {
  type ProjectRepoUnavailableReason,
  projectRepoUnavailablePresentation,
} from "@/features/projects/lib/projectRepoAvailability";
import { Button } from "@/shared/ui/button";
import { UserAvatar } from "@/shared/ui/UserAvatar";
import { ProjectEmptyState } from "./ProjectEmptyState";

const UNAVAILABLE_ICONS = {
  authentication: LockKeyhole,
  missing: CircleAlert,
  access: LockKeyhole,
  unbound: LockKeyhole,
  network: CloudOff,
  ref: GitBranch,
  unknown: CircleAlert,
} satisfies Record<ProjectRepoUnavailableReason, typeof CircleAlert>;

function RepositoryOwnerReference({
  ownerAvatarUrl,
  ownerIsAgent,
  ownerName,
}: {
  ownerAvatarUrl?: string | null;
  ownerIsAgent?: boolean;
  ownerName?: string;
}) {
  if (!ownerName) {
    return <>the repository owner</>;
  }
  return (
    <>
      <span className="inline-flex items-center gap-1 align-middle">
        <span aria-hidden="true">
          <UserAvatar
            accent={ownerIsAgent}
            avatarUrl={ownerAvatarUrl ?? null}
            displayName={ownerName}
            fallbackDelayMs={0}
            size="xs"
            testId="repository-owner-avatar"
          />
        </span>
        <span
          className="font-medium text-foreground"
          data-testid="repository-owner-name"
        >
          {ownerName}
        </span>
      </span>
      , the repository owner,
    </>
  );
}

function AccessRestrictedDescription({
  accessChannelId,
  ownerAvatarUrl,
  ownerIsAgent,
  ownerName,
}: {
  accessChannelId?: string | null;
  ownerAvatarUrl?: string | null;
  ownerIsAgent?: boolean;
  ownerName?: string;
}) {
  const { goChannel } = useAppNavigation();
  const channel = useChannelReference(accessChannelId);
  const isOpenable = isChannelReferenceOpenable(channel);

  if (!isOpenable) {
    return (
      <>
        Repository access is granted through a channel you can’t see. Ask{" "}
        <RepositoryOwnerReference
          ownerAvatarUrl={ownerAvatarUrl}
          ownerIsAgent={ownerIsAgent}
          ownerName={ownerName}
        />{" "}
        for an invite.
      </>
    );
  }

  return (
    <>
      Repository access is granted through{" "}
      <button
        aria-label={`Open repository access channel #${channel.name}`}
        className="font-medium text-foreground underline-offset-2 hover:underline"
        onClick={() => void goChannel(channel.id)}
        type="button"
      >
        #{channel.name}
      </button>
      , and you’re not a member. Join the channel or ask{" "}
      <RepositoryOwnerReference
        ownerAvatarUrl={ownerAvatarUrl}
        ownerIsAgent={ownerIsAgent}
        ownerName={ownerName}
      />{" "}
      for an invite.
    </>
  );
}

export function ProjectRepositoryUnavailableState({
  accessChannelId,
  onAskForAccess,
  onRetry,
  ownerAvatarUrl,
  ownerIsAgent,
  ownerName,
  reason = "unknown",
  retryPending = false,
}: {
  accessChannelId?: string | null;
  onAskForAccess?: () => void;
  onRetry?: () => void;
  ownerAvatarUrl?: string | null;
  ownerIsAgent?: boolean;
  ownerName?: string;
  reason?: ProjectRepoUnavailableReason;
  retryPending?: boolean;
}) {
  const unavailable = projectRepoUnavailablePresentation(reason);
  const UnavailableIcon = UNAVAILABLE_ICONS[reason];

  return (
    <ProjectEmptyState
      actions={
        onRetry || (reason === "access" && onAskForAccess) ? (
          <>
            {onRetry ? (
              <Button
                disabled={retryPending}
                onClick={onRetry}
                size="sm"
                variant="outline"
              >
                {retryPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {retryPending ? "Retrying…" : "Retry"}
              </Button>
            ) : null}
            {reason === "access" && onAskForAccess ? (
              <Button onClick={onAskForAccess} size="sm">
                <MessageCircle className="h-4 w-4" />
                Ask for access
              </Button>
            ) : null}
          </>
        ) : null
      }
      className="min-h-[calc(100dvh-7rem)] justify-center"
      data-testid="project-repository-unavailable"
      descriptionClassName="max-w-lg"
      description={
        reason === "access" ? (
          <AccessRestrictedDescription
            accessChannelId={accessChannelId}
            ownerAvatarUrl={ownerAvatarUrl}
            ownerIsAgent={ownerIsAgent}
            ownerName={ownerName}
          />
        ) : (
          unavailable.description
        )
      }
      icon={UnavailableIcon}
      mediaVariant="icon"
      title={unavailable.title}
    />
  );
}
