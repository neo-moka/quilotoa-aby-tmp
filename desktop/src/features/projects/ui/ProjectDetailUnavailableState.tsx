import { ArrowLeft, FolderGit2 } from "lucide-react";

import type { Project } from "@/features/projects/hooks";
import { Button } from "@/shared/ui/button";
import {
  EmptyState,
  EmptyStateContent,
  EmptyStateDescription,
  EmptyStateHeader,
  EmptyStateMedia,
} from "@/shared/ui/empty-state";
import { UnavailableProjectRepositories } from "./UnavailableProjectRepositories";

type ProjectDetailUnavailableStateProps =
  | {
      kind: "load-error";
      onBack: () => void;
      onRetry: () => void;
    }
  | {
      kind: "not-found";
      onBack: () => void;
    }
  | {
      kind: "repositories-unavailable";
      project: Project;
    };

/**
 * Only the `not-found` branch is on `EmptyState`. The other two keep their
 * hand-rolled markup because their headline is a `<p>`, and Pro's
 * `EmptyStateTitle` is an `<h3>` with no escape hatch — its props are
 * `ComponentPropsWithRef<"h3">`, so the tag cannot be swapped through it.
 *
 * Promoting them would add two headings to the accessibility tree.
 * `project-pr-review.spec.ts:184` takes an unscoped, page-wide
 * `getByRole("heading", { level: 3 })` and asserts on `.first()`, and
 * `repositories-unavailable` renders the *project name* as its headline —
 * exactly the string a name-scoped heading query would go looking for
 * elsewhere. Playwright cannot be run here to prove the blast radius either
 * way, so the two stay as they are; unifying a padding is not worth spending
 * an unverifiable assertion on.
 *
 * If `EmptyStateTitle` ever takes a semantic-level prop, these are the first
 * two call sites to revisit.
 */
export function ProjectDetailUnavailableState(
  props: ProjectDetailUnavailableStateProps,
) {
  if (props.kind === "load-error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <FolderGit2 className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-red-400">Failed to load project</p>
        <div className="flex items-center gap-2">
          <Button onClick={props.onRetry} size="sm" variant="outline">
            Retry
          </Button>
          <Button onClick={props.onBack} size="sm" variant="ghost">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  if (props.kind === "not-found") {
    return (
      <EmptyState className="flex-1 justify-center">
        <EmptyStateHeader>
          <EmptyStateMedia className="text-muted-foreground/40 [&_svg]:size-10">
            <FolderGit2 />
          </EmptyStateMedia>
          <EmptyStateDescription>
            This project could not be found.
          </EmptyStateDescription>
        </EmptyStateHeader>
        <EmptyStateContent>
          <Button onClick={props.onBack} size="sm" variant="outline">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Projects
          </Button>
        </EmptyStateContent>
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <FolderGit2 className="h-10 w-10 text-muted-foreground/40" />
      <p className="text-sm font-medium text-foreground">
        {props.project.name}
      </p>
      <p className="text-sm text-muted-foreground">
        This project does not have any available repositories yet.
      </p>
      <UnavailableProjectRepositories project={props.project} />
    </div>
  );
}
