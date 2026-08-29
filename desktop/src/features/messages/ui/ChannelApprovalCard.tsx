import { ShieldCheck } from "lucide-react";

import { useAppNavigation } from "@/app/navigation/useAppNavigation";
import {
  type ChannelApprovalStatus,
  resolveChannelApprovalRequest,
} from "@/features/messages/lib/agentMessageProvenance";
import type { TimelineMessage } from "@/features/messages/types";
import { Badge, type BadgeProps } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

/**
 * Status wording and colour, keyed by state. Module-level so the timeline is
 * not rebuilding a lookup object per rendered card.
 *
 * "Waiting" rather than "Pending": pending describes the record, waiting
 * describes what the reader is being asked to notice.
 */
const STATUS_PRESENTATION: Record<
  ChannelApprovalStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  pending: { label: "Waiting", variant: "warning" },
  granted: { label: "Granted", variant: "success" },
  denied: { label: "Denied", variant: "destructive" },
  expired: { label: "Expired", variant: "secondary" },
};

const expiryFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/**
 * A workflow approval request rendered as a card instead of a line of text.
 *
 * The row states what is waiting, who may decide, and by when — the four facts
 * a reader needs to know whether this one is theirs. It deliberately renders
 * no Approve or Deny button: granting requires the raw approval token, and the
 * relay only ever stores that token's hash. What Desktop can read is
 * `WorkflowApproval.approvalRef`, documented in `shared/api/workflowTypes.ts`
 * as "opaque, non-actionable" — so a pair of buttons here would be decoration
 * over a call that cannot be made. The card points at the workflow and names
 * the command that can decide instead.
 *
 * Sized for the message column, which is ~640px and often much less: the
 * header wraps, the request text breaks, and the metadata stacks rather than
 * pushing the card wider than its lane.
 */
export function ChannelApprovalCard({ message }: { message: TimelineMessage }) {
  const { goWorkflow } = useAppNavigation();
  // Evaluated at render like the workflows-page card does, not on a timer: a
  // deadline that lapses while the row sits on screen resolves on the row's
  // next render, and nothing depends on the exact second it flips.
  const approval = resolveChannelApprovalRequest(
    message,
    Math.floor(Date.now() / 1_000),
  );
  const status = STATUS_PRESENTATION[approval.status];
  const expired = approval.status === "expired";
  const { workflowId } = approval;

  return (
    <div
      className="mt-1 max-w-full rounded-lg border border-border/60 bg-muted/30 p-3"
      data-testid="channel-approval-card"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <ShieldCheck
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <h4 className="min-w-0 text-sm font-semibold">Approval requested</h4>
        <Badge variant={status.variant}>{status.label}</Badge>
      </div>

      <p className="mt-2 break-words text-message">{approval.request}</p>

      {approval.approverSpec || approval.expiresAt !== null ? (
        <dl className="mt-2 flex flex-col gap-y-0.5 text-xs text-muted-foreground">
          {approval.approverSpec ? (
            <div className="flex min-w-0 flex-wrap gap-x-1.5">
              <dt>Approver</dt>
              <dd className="min-w-0 break-words font-medium text-foreground/85">
                {approval.approverSpec}
              </dd>
            </div>
          ) : null}
          {approval.expiresAt !== null ? (
            <div className="flex min-w-0 flex-wrap gap-x-1.5">
              <dt>{expired ? "Expired" : "Expires"}</dt>
              <dd className="min-w-0 break-words font-medium text-foreground/85">
                {expiryFormatter.format(new Date(approval.expiresAt * 1_000))}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
        {workflowId ? (
          <Button
            data-testid="channel-approval-card-open-workflow"
            onClick={() => goWorkflow(workflowId)}
            size="xs"
            variant="outline"
          >
            Open workflow
          </Button>
        ) : null}
        {approval.status === "pending" ? (
          <p className="min-w-0 text-xs text-muted-foreground">
            Deciding isn&rsquo;t available in Desktop yet — run{" "}
            <code className="break-all">buzz workflows approve</code> with the
            token from the request.
          </p>
        ) : null}
      </div>
    </div>
  );
}
