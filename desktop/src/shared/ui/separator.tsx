import * as React from "react";
import { Separator as HeroSeparator } from "@heroui/react";

import { cn } from "@/shared/lib/cn";

/**
 * HeroUI's Separator, kept behind this wrapper because it cannot express
 * `decorative` on its own.
 *
 * Radix derived the ARIA role from that prop: `decorative` — this wrapper's
 * default, and what every one of its call sites relies on — rendered
 * `role="none"`, keeping a purely visual divider out of the accessibility tree.
 * HeroUI has no equivalent prop, and React Aria will not take the role from the
 * caller either: `filterDOMProps` drops `aria-hidden` outright, and
 * `useSeparator`'s own `role="separator"` wins the `mergeProps` merge, so both
 * obvious escape hatches are dead ends. Verified against
 * `react-aria-components/dist/private/Separator.mjs` and by rendering every
 * combination, not from documentation.
 *
 * The documented `render` prop is the one hook that does work, so `decorative`
 * goes through it. `elementType="div"` is not cosmetic: HeroUI renders
 * horizontal separators as `<hr>` and warns on every render when a custom
 * `render` returns a different element. Pinning the element type silences that
 * warning and keeps the emitted DOM identical to the Radix version this
 * replaced — `<div role="none" data-orientation="…">` — so the two menu specs
 * that count `getByRole("separator")` stay pinned to the menu's own separators.
 */

type SeparatorProps = Omit<
  React.ComponentPropsWithoutRef<typeof HeroSeparator>,
  "elementType" | "render"
> & {
  /**
   * Hide the separator from assistive technology, as a purely visual divider.
   * Defaults to `true`, matching the Radix wrapper this replaced.
   */
  decorative?: boolean;
};

const renderDecorative = (props: React.ComponentPropsWithRef<"div">) => (
  <div {...props} role="none" />
);

const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref,
  ) => (
    <HeroSeparator
      ref={ref}
      elementType="div"
      orientation={orientation}
      render={decorative ? renderDecorative : undefined}
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal"
          ? "h-[1px] w-full"
          : // `min-h-0 self-auto` cancel HeroUI's `min-h-2` and `self-stretch`,
            // which the Radix original never had.
            "h-full min-h-0 w-[1px] self-auto",
        className,
      )}
      {...props}
    />
  ),
);
Separator.displayName = "Separator";

export { Separator };
