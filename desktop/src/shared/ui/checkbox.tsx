import type * as React from "react";
import { Checkbox as HeroCheckbox } from "@heroui/react";
import { motion, useReducedMotion } from "motion/react";

import { cn } from "@/shared/lib/cn";
import { HERO_ACCENT_SCOPE } from "./heroAccentScope";

/**
 * HeroUI's checkbox is a `CheckboxField` (a `div`) wrapping a `CheckboxButton`
 * (a `label`) that holds the visually hidden `input[type=checkbox]`, so
 * `className` and `data-*` land on the field rather than on the box. Unlike the
 * Radix indicator, the indicator slot is always mounted — the checkmark is
 * drawn from the render state instead of from mount, which is why the motion
 * path animates on `isSelected` rather than on `initial`.
 *
 * `w-fit` keeps the field hugging the box: HeroUI's root is `display: flex` and
 * would otherwise stretch across a block parent while the clickable label stays
 * at its left edge — see the same note in `switch.tsx`.
 */
type CheckboxProps = Omit<
  React.ComponentProps<typeof HeroCheckbox.Root>,
  "children"
> & {
  /** Label content, rendered beside the box inside the clickable area. */
  children?: React.ReactNode;
  /** Classes for the box. The root `className` styles the field around it. */
  controlClassName?: string;
};

function Checkbox({
  children,
  className,
  controlClassName,
  ...props
}: CheckboxProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <HeroCheckbox.Root
      {...props}
      className={cn(HERO_ACCENT_SCOPE, "w-fit", className)}
    >
      <HeroCheckbox.Content>
        <HeroCheckbox.Control className={controlClassName}>
          <HeroCheckbox.Indicator>
            {({ isIndeterminate, isSelected }) =>
              isIndeterminate ? (
                <svg
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2.5"
                  viewBox="0 0 24 24"
                >
                  <line x1="5" x2="19" y1="12" y2="12" />
                </svg>
              ) : (
                <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <motion.path
                    animate={{
                      opacity: isSelected ? 1 : 0,
                      pathLength: isSelected ? 1 : 0,
                    }}
                    d="m5 12 4 4L19 6"
                    initial={false}
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : {
                            duration: 0.18,
                            ease: [0.23, 1, 0.32, 1],
                          }
                    }
                  />
                </svg>
              )
            }
          </HeroCheckbox.Indicator>
        </HeroCheckbox.Control>
        {children}
      </HeroCheckbox.Content>
    </HeroCheckbox.Root>
  );
}

export { Checkbox };
