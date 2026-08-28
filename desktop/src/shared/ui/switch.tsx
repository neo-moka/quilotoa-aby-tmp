import type * as React from "react";
import { Switch as HeroSwitch } from "@heroui/react";

import { cn } from "@/shared/lib/cn";
import { HERO_ACCENT_SCOPE } from "./heroAccentScope";

/**
 * HeroUI's switch is a `SwitchField` (a `div`) wrapping a `SwitchButton`
 * (a `label`) that holds the visually hidden `input[role=switch]`. That is a
 * different shape from the Radix `button[role=switch]` it replaces: `className`
 * and `data-*` land on the outer field, the state lives on `data-selected`
 * rather than `data-state`, and `id` is forwarded to the hidden input so
 * `<label htmlFor>` keeps working.
 *
 * `w-fit` matters more than it looks. HeroUI's field is `display: flex`, so in a
 * block context it would stretch to the full row while the clickable label
 * stays shrink-to-fit at its left edge — the old Radix root was a fixed-size
 * inline box. That both shifts layout and leaves the middle of the element
 * inert, which is exactly where a click lands.
 */
type SwitchProps = Omit<
  React.ComponentProps<typeof HeroSwitch.Root>,
  "children"
> & {
  /** Label content, rendered beside the track inside the clickable area. */
  children?: React.ReactNode;
  /** Classes for the track. The root `className` styles the field around it. */
  controlClassName?: string;
  /** Classes for the knob. */
  thumbClassName?: string;
};

function Switch({
  children,
  className,
  controlClassName,
  thumbClassName,
  ...props
}: SwitchProps) {
  return (
    <HeroSwitch.Root
      {...props}
      className={cn(HERO_ACCENT_SCOPE, "w-fit", className)}
    >
      <HeroSwitch.Content>
        <HeroSwitch.Control className={controlClassName}>
          <HeroSwitch.Thumb className={thumbClassName} />
        </HeroSwitch.Control>
        {children}
      </HeroSwitch.Content>
    </HeroSwitch.Root>
  );
}

export { Switch };
