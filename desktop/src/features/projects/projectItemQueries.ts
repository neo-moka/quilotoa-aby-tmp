import { useQuery } from "@tanstack/react-query";

import { useFocusedRefetchInterval } from "@/shared/lib/useDocumentVisible";
import {
  fetchProjectIssues,
  fetchProjectPullRequests,
  type Repository,
} from "./hooks";

export function useProjectIssuesQuery(project: Repository | null | undefined) {
  // Issue comments arrive as relay events with no live push into this
  // feature, so an open task detail only ever showed them again on remount.
  // A focused poll keeps an agent's ticket replies appearing while you watch,
  // without waking a backgrounded window.
  const refetchInterval = useFocusedRefetchInterval(5_000);
  return useQuery({
    enabled: Boolean(project),
    queryKey: ["project", project?.id ?? "none", "issues"],
    queryFn: () => {
      if (!project) throw new Error("No project selected.");
      return fetchProjectIssues(project);
    },
    refetchInterval,
    staleTime: 30_000,
  });
}

export function useProjectPullRequestsQuery(
  project: Repository | null | undefined,
) {
  // Same focused poll as issues: review comments and status changes stream
  // in from other actors while the panel is open.
  const refetchInterval = useFocusedRefetchInterval(5_000);
  return useQuery({
    enabled: Boolean(project),
    queryKey: ["project", project?.id ?? "none", "pull-requests"],
    queryFn: () => {
      if (!project) throw new Error("No project selected.");
      return fetchProjectPullRequests(project);
    },
    refetchInterval,
    staleTime: 30_000,
  });
}
