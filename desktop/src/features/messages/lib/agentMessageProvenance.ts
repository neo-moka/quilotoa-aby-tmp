/**
 * Pure resolvers for the two facts a channel row states about where an agent
 * turn came from: who runs the agent that spoke, and — for an approval request
 * — which workflow is blocked on the reader.
 *
 * Both live outside the components so the decisions are testable without a
 * renderer, and so `MessageRow` (already at the repo's file-size ceiling) pays
 * only for the call site.
 */

export type AgentMessageProvenance = {
  /** Viewer-relative owner label ("you", "baxen"), or null when unverified. */
  ownerLabel: string | null;
  ownerPubkey: string | null;
  /**
   * The agent whose activity this row can open, or null when there is nowhere
   * to go. Null is the whole gate: a surface with no session handler (a thread
   * panel reached outside a channel screen, a unit test) must render no
   * affordance rather than a control that silently does nothing.
   */
  activityPubkey: string | null;
  /** Accessible name for that affordance; also its tooltip. */
  activityLabel: string;
};

/**
 * Decides what an agent-authored row adds to its header.
 *
 * Returns null for every non-agent message, which keeps the "is this an agent"
 * question in one place instead of spreading a truthiness check across the
 * header's segment list.
 */
export function resolveAgentMessageProvenance({
  author,
  canOpenActivity,
  isAgent,
  ownerLabel,
  ownerPubkey,
  pubkey,
}: {
  author: string;
  canOpenActivity: boolean;
  isAgent?: boolean;
  ownerLabel?: string | null;
  ownerPubkey?: string | null;
  pubkey?: string | null;
}): AgentMessageProvenance | null {
  if (!isAgent) {
    return null;
  }

  const trimmedAuthor = author.trim();
  return {
    ownerLabel: ownerLabel ?? null,
    ownerPubkey: ownerPubkey ?? null,
    // Both conditions matter: an agent row can arrive without a resolvable
    // author pubkey (relay-delegated sends), and a surface can lack a handler.
    activityPubkey: canOpenActivity && pubkey ? pubkey : null,
    activityLabel: `View ${trimmedAuthor || "agent"} activity`,
  };
}

export type ChannelApprovalStatus =
  | "pending"
  | "granted"
  | "denied"
  | "expired";

export type ChannelApprovalRequest = {
  /** Who may decide, verbatim from the workflow definition. */
  approverSpec: string | null;
  /** Unix seconds, or null when the request carries no deadline. */
  expiresAt: number | null;
  /** What is waiting — the request text the row shows as its body. */
  request: string;
  status: ChannelApprovalStatus;
  /** Workflow to open; null when the request does not name one. */
  workflowId: string | null;
};

/**
 * House copy for a request that arrived with an empty body. Matches the
 * wording Home already uses for the same kind, so the two surfaces cannot
 * describe the same event differently.
 */
const UNDESCRIBED_REQUEST = "A workflow step is waiting for approval.";

const APPROVAL_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "granted",
  "denied",
  "expired",
]);

function firstTagValue(
  tags: readonly string[][] | undefined,
  name: string,
): string | null {
  const value = tags?.find((tag) => tag[0] === name)?.[1];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Accepts both representations the codebase already uses for a deadline:
 * `WorkflowApproval.expiresAt` is an ISO string, while every Nostr timestamp
 * around it is unix seconds. Guessing wrong in either direction would render a
 * live request as long expired, so we read both rather than pick one.
 */
export function parseApprovalExpiry(raw: string | null): number | null {
  if (!raw) {
    return null;
  }
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    return Number.isFinite(seconds) ? seconds : null;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : Math.floor(parsed / 1_000);
}

/**
 * Reads an approval request off a timeline event.
 *
 * The tag names are the snake_case field names the relay already serialises
 * for a `WorkflowApproval` (`shared/api/workflowTypes.ts`), because kind:46010
 * has no builder anywhere in the repo yet — `buzz-workflow`'s `RequestApproval`
 * step still carries `TODO (WF-08): create approval record in DB, emit
 * kind:46010`. Reading names that already exist is the smallest guess
 * available, and it puts the whole guess in one function to reconcile when
 * WF-08 lands. Every field is optional so a request that names none of them
 * still renders as a card rather than collapsing to blank text.
 */
export function resolveChannelApprovalRequest(
  message: { body?: string; tags?: string[][] },
  nowSeconds: number,
): ChannelApprovalRequest {
  const { tags } = message;
  const expiresAt = parseApprovalExpiry(firstTagValue(tags, "expires_at"));
  const declared = firstTagValue(tags, "status")?.toLowerCase();
  // An unrecognised status reads as pending rather than as its own state: the
  // card's job is to say something is waiting, and inventing a fifth status
  // from an unknown string would say less than the honest default.
  const status: ChannelApprovalStatus = APPROVAL_STATUSES.has(declared ?? "")
    ? (declared as ChannelApprovalStatus)
    : "pending";

  return {
    approverSpec: firstTagValue(tags, "approver_spec"),
    expiresAt,
    request: message.body?.trim() || UNDESCRIBED_REQUEST,
    // Expiry only overrides a request still waiting. A decision already
    // recorded stays granted or denied however long ago the window closed.
    status:
      status === "pending" && expiresAt !== null && expiresAt <= nowSeconds
        ? "expired"
        : status,
    // The workflow id rides the `d` tag, as it does on every other workflow
    // event the SDK builds (`build_workflow_def`, `build_workflow_trigger`).
    workflowId: firstTagValue(tags, "d"),
  };
}
