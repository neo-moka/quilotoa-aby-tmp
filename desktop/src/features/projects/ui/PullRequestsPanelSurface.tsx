import type * as React from "react";

import { BuzzLoadingState } from "@/shared/ui/BuzzLoadingState";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateHeader,
} from "@/shared/ui/empty-state";

/** Which center pane `PullRequestsPanel` should show. A retained selected
 * review wins over an empty list so refetching does not flash "No reviews yet." */
export function pullRequestsPanelKind({
  isLoading,
  pullRequests,
  selectedPullRequest,
}: {
  isLoading: boolean;
  pullRequests: { length: number };
  selectedPullRequest: unknown;
}): "loading" | "detail" | "empty" | "list" {
  if (isLoading && !selectedPullRequest) return "loading";
  if (selectedPullRequest) return "detail";
  if (pullRequests.length === 0) return "empty";
  return "list";
}

/** Loading / empty / detail / list switch used by `PullRequestsPanel`. */
export function PullRequestsPanelSurface({
  detail,
  error,
  isLoading,
  list,
  pullRequests,
  selectedPullRequest,
}: {
  detail: React.ReactNode;
  error: unknown;
  isLoading: boolean;
  list: React.ReactNode;
  pullRequests: { length: number };
  selectedPullRequest: unknown;
}) {
  const kind = pullRequestsPanelKind({
    isLoading,
    pullRequests,
    selectedPullRequest,
  });
  if (kind === "loading") {
    return <BuzzLoadingState label="Loading reviews" />;
  }
  if (kind === "detail") {
    return detail;
  }
  if (kind === "empty") {
    return (
      // Description only, no `EmptyStateTitle`. Pro's title is an `<h3>`, and
      // `project-pr-review.spec.ts:184` takes an unscoped page-wide
      // `getByRole("heading", { level: 3 }).first()` — a heading invented here
      // could hand it the wrong element. This state never had one anyway.
      <EmptyState data-testid="project-pull-requests-empty">
        <EmptyStateHeader>
          <EmptyStateDescription>
            {error
              ? "Could not load reviews for this repository."
              : "No reviews yet."}
          </EmptyStateDescription>
        </EmptyStateHeader>
      </EmptyState>
    );
  }
  return list;
}
