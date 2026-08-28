import { ArrowLeft, FolderGit2 } from "lucide-react";

import type { Project } from "@/features/projects/hooks";
import { Button } from "@/shared/ui/button";
import { ProjectEmptyState } from "./ProjectEmptyState";
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

export function ProjectDetailUnavailableState(
  props: ProjectDetailUnavailableStateProps,
) {
  if (props.kind === "load-error") {
    return (
      <ProjectEmptyState
        actions={
          <>
            <Button onClick={props.onRetry} size="sm" variant="outline">
              Retry
            </Button>
            <Button onClick={props.onBack} size="sm" variant="ghost">
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back to Projects
            </Button>
          </>
        }
        className="flex-1 justify-center"
        icon={FolderGit2}
        title="Failed to load project"
        titleClassName="text-red-400"
      />
    );
  }

  if (props.kind === "not-found") {
    return (
      <ProjectEmptyState
        actions={
          <Button onClick={props.onBack} size="sm" variant="outline">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Projects
          </Button>
        }
        className="flex-1 justify-center"
        description="This project could not be found."
        icon={FolderGit2}
      />
    );
  }

  return (
    <ProjectEmptyState
      actions={<UnavailableProjectRepositories project={props.project} />}
      className="flex-1 justify-center"
      description="This project does not have any available repositories yet."
      icon={FolderGit2}
      title={props.project.name}
    />
  );
}
