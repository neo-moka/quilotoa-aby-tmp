import { useMutation } from "@tanstack/react-query";

import { relayClient } from "@/shared/api/relayClient";
import { signRelayEvent } from "@/shared/api/tauri";
import {
  KIND_GIT_STATUS_CLOSED,
  KIND_GIT_STATUS_DRAFT,
  KIND_GIT_STATUS_MERGED,
  KIND_GIT_STATUS_OPEN,
} from "@/shared/constants/kinds";
import type { ProjectIssue, Repository as Project } from "./hooks";
import { useProjectIssueWriteInvalidation } from "./issueAssignments";

/**
 * The NIP-34 status targets a task can be moved to from the desktop.
 *
 * Same vocabulary as `buzz issues status --status …`: `open` reopens (readers
 * fall back to the issue's label-derived state), `resolved` reads as Done,
 * `draft` reads as Triage. The intermediate states (In Progress, In Review)
 * are label heuristics on the issue root, not status events — they cannot be
 * set here because kind:1621 roots are immutable.
 */
export type ProjectIssueStatusTarget = "open" | "resolved" | "closed" | "draft";

const STATUS_TARGET_KIND: Record<ProjectIssueStatusTarget, number> = {
  open: KIND_GIT_STATUS_OPEN,
  resolved: KIND_GIT_STATUS_MERGED,
  closed: KIND_GIT_STATUS_CLOSED,
  draft: KIND_GIT_STATUS_DRAFT,
};

/**
 * Publishes a status event for a task, mirroring the CLI's
 * `build_git_status` tag shape: the issue as the `e` root, the repo `a`
 * address (readers fetch statuses by it), and the repo owner as the notified
 * `p` — trusted readers only honour statuses signed by the issue author or
 * the repo owner, so callers gate on that before offering the control.
 */
export async function publishProjectIssueStatus(
  project: Project,
  issue: ProjectIssue,
  target: ProjectIssueStatusTarget,
) {
  const event = await signRelayEvent({
    kind: STATUS_TARGET_KIND[target],
    content: "",
    tags: [
      ["e", issue.id, "", "root"],
      ["a", project.repoAddress],
      ["p", project.owner],
    ],
  });
  await relayClient.publishEvent(
    event,
    "Timed out updating task status.",
    "Failed to update task status.",
  );
  return event.id;
}

export function useProjectIssueStatusMutation(
  project: Project | null | undefined,
) {
  const invalidate = useProjectIssueWriteInvalidation(project);
  return useMutation({
    mutationFn: ({
      issue,
      target,
    }: {
      issue: ProjectIssue;
      target: ProjectIssueStatusTarget;
    }) => {
      if (!project) throw new Error("No project selected.");
      return publishProjectIssueStatus(project, issue, target);
    },
    onSuccess: invalidate,
  });
}
