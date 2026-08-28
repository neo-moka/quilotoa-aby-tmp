import * as React from "react";
import { TextArea } from "@heroui/react";

import { cn } from "@/shared/lib/cn";

/**
 * React Aria's `TextArea` under HeroUI's wrapper. As with `input.tsx` the props
 * surface stays the DOM one and the Buzz skin is kept — see the note there for
 * why HeroUI's field appearance is deferred rather than adopted here.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <TextArea
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      className={cn(
        "flex min-h-20 w-full rounded-lg border border-input/40 bg-background px-3 py-2 text-base transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
