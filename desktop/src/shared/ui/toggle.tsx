import type * as React from "react";
import { ToggleButton } from "@heroui/react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

/**
 * Buzz's own size and variant ramp, kept on top of HeroUI's `toggle-button`
 * base: HeroUI stops at `sm` (36px) while the transcript and mention rows need
 * the 20px `xs` step, and it has no `outline`. These utilities sit in Tailwind's
 * `utilities` layer, so they win over the BEM base without `!important`.
 *
 * `[&_svg]:m-0` neutralises the icon margins HeroUI's base applies; the state
 * selector is `data-[selected=true]`, not Radix's `data-[state=on]`.
 */
const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:m-0 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        ghost:
          "bg-transparent hover:bg-muted/70 hover:text-foreground data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
        outline:
          "border border-input/40 bg-background hover:bg-muted/70 data-[selected=true]:bg-muted data-[selected=true]:text-foreground",
      },
      size: {
        default: "h-9 px-3 min-w-9",
        xs: "h-5 min-h-0 min-w-0 gap-1 rounded-md px-1.5 text-xs font-medium [&_svg]:size-3.5",
        sm: "h-8 px-2 min-w-8",
        lg: "h-10 px-3 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ToggleProps = Omit<
  React.ComponentProps<typeof ToggleButton.Root>,
  "size" | "variant"
> &
  VariantProps<typeof toggleVariants> & {
    /**
     * Native tooltip text. React Aria filters `title` off the button it
     * renders, so it is carried by a wrapper — one that only exists when a
     * title is actually given.
     */
    title?: string;
  };

function Toggle({ className, size, title, variant, ...props }: ToggleProps) {
  const button = (
    <ToggleButton
      {...props}
      className={cn(toggleVariants({ variant, size, className }))}
    />
  );

  return title ? (
    <span className="inline-flex" title={title}>
      {button}
    </span>
  ) : (
    button
  );
}

export { Toggle, toggleVariants };
