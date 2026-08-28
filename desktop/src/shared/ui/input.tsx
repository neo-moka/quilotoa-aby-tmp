import * as React from "react";
import { Input as HeroInput } from "@heroui/react";

import { cn } from "@/shared/lib/cn";

/**
 * HeroUI's `Input` renders React Aria's `Input`, which spreads every prop it is
 * given onto the `<input>` — so the props surface stays exactly the DOM one the
 * 61 call sites already pass, and `data-testid`, `id` and `name` land on the
 * same node as before. What it adds is the `data-hovered` / `data-focused` /
 * `data-focus-visible` state contract and the ability to be driven by a
 * surrounding `TextField`.
 *
 * The appearance stays Buzz's. HeroUI's `.input` skin paints fields with
 * `--field-background`, which the theming contract maps to the app's `--input`
 * — a border-weight grey — so adopting it wholesale would repaint every field
 * in the app. Parity first; the field skin is a separate decision.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <HeroInput
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-input/40 bg-background px-3 py-1 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
