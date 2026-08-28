import type * as React from "react";

import { cn } from "@/shared/lib/cn";
import { Checkbox } from "@/shared/ui/checkbox";

type MarkdownInputProps = React.ComponentProps<"input"> & {
  node?: unknown;
};

export function MarkdownInput({
  checked,
  className,
  node: _node,
  type,
  ...props
}: MarkdownInputProps) {
  if (type === "checkbox") {
    return (
      <Checkbox
        aria-label={checked ? "Completed task" : "Incomplete task"}
        className={cn(
          "pointer-events-none mr-1.5 inline-flex align-[-0.125rem] data-[disabled=true]:opacity-45",
          className,
        )}
        excludeFromTabOrder
        isDisabled
        isSelected={Boolean(checked)}
      />
    );
  }

  return <input {...props} className={className} type={type} />;
}
