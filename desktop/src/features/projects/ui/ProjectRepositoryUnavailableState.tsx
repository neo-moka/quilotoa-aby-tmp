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
import {
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/shared/ui/empty-state";
import { UserAvatar } from "@/shared/ui/UserAvatar";

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
    <EmptyState
      className="min-h-[calc(100dvh-7rem)] justify-center px-8"
      data-testid="project-repository-unavailable"
    >
      {/* `gap-1` + the media's `mb-3` reproduce the hand-rolled 1rem drop below
          the icon well and 0.25rem above the description; Pro's own header gap
          is a uniform 0.5rem. `bg-secondary` rather than `bg-muted` because the
          root re-points `--muted` to the foreground grey — the two tokens carry
          identical values in both themes, so this is a rename, not a restyle. */}
      <EmptyStateHeader className="gap-1">
        <EmptyStateMedia className="mb-3 h-12 w-12 rounded-xl border border-border/60 bg-secondary/40 text-muted-foreground">
          <UnavailableIcon className="h-6 w-6" />
        </EmptyStateMedia>
        <EmptyStateTitle>{unavailable.title}</EmptyStateTitle>
        <EmptyStateDescription className="max-w-lg">
          {reason === "access" ? (
            <AccessRestrictedDescription
              accessChannelId={accessChannelId}
              ownerAvatarUrl={ownerAvatarUrl}
              ownerIsAgent={ownerIsAgent}
              ownerName={ownerName}
            />
          ) : (
            unavailable.description
          )}
        </EmptyStateDescription>
      </EmptyStateHeader>
      <EmptyStateContent>
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
      </EmptyStateContent>
    </EmptyState>
  );
}
