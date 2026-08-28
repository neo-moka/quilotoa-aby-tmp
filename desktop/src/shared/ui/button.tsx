import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

/**
 * Deliberately not HeroUI's `Button`. Lote F set out to migrate it and the
 * conclusion was to conserve; `buttonHeroUiGap.test.mjs` pins the upstream
 * facts below so this is re-checkable rather than folklore.
 *
 * 1. **It removes no Radix.** The only Radix here is `Slot`, and `Slot` stays
 *    regardless: `card.tsx`, `sidebar.tsx` and `attachment.tsx` also use it,
 *    and 86 Radix `asChild` parents wrap a `<Button>` child — tooltip (27),
 *    `AlertDialogCancel` (17), `AlertDialogAction` (16), `PopoverTrigger` (11),
 *    `DialogClose` (9), `DialogTrigger` (3), `PopoverAnchor` (3). Those
 *    overlays stay on Radix by the Lote A decision (component-map §6ter), so
 *    the dependency does not go away and neither does the `asChild` prop.
 *
 * 2. **Its visual layer is unusable here.** `.button--primary` and friends key
 *    off `--accent` / `--default` / `--danger`; `--accent` is deliberately
 *    unmapped (theming-contract §4, trampa 2), which is why the form controls
 *    needed `HERO_ACCENT_SCOPE`. On top of that `variant="link"` has no HeroUI
 *    analog, `xs` and `icon-xs` (h-6) sit below HeroUI's h-8 floor, and the
 *    base carries `rounded-3xl`, `md:h-9` and `sm:size-4` — viewport-dependent
 *    sizing this app's flat ramp does not have. The stylesheet would be
 *    imported only to be overridden.
 *
 * 3. **The prop contract narrows from pass-through to an allowlist, silently.**
 *    This is the blocking one. `ButtonProps` here extends
 *    `ButtonHTMLAttributes`, so 523 call sites were written against an open
 *    contract. React Aria's `filterDOMProps` admits only `id`, `data-*`,
 *    `dir/lang/hidden/inert/translate`, global mouse/pointer/touch events and a
 *    fixed `aria-*` set. Measured against the current call sites:
 *
 *      - `disabled` (269 sites) is ignored outright — React Aria reads
 *        `isDisabled`. The button renders enabled *and still fires `onClick`*.
 *      - `title` (35) is dropped. `toggle.tsx` solved this with a wrapper
 *        `<span>`, which is fine for a handful and not for 35 buttons sitting
 *        in flex rows.
 *      - `role` and `aria-selected` (6, all `PulseTabBar.tsx`) are dropped,
 *        turning a tablist into six plain buttons. `pulse` emits no testids
 *        (component-map §6bis), so nothing would catch it.
 *      - `aria-busy` (2), `aria-hidden` (1) dropped; `tabIndex` (3) is not just
 *        dropped but overwritten to `0`, so a deliberately unfocusable button
 *        becomes tabbable.
 *
 *    A wrapper can translate `disabled` and `tabIndex`, and could carry the
 *    rest imperatively. What it cannot do is keep the contract open: every
 *    future prop outside the allowlist fails the same silent way, and
 *    typecheck, lint, unit tests and build all stay green.
 *
 * What would change the decision: React Aria forwarding unknown attributes (or
 * HeroUI exposing an element-level escape hatch the way `Tabs` does with
 * `render`), plus `--accent` carrying `--primary` app-wide.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90",
        outline: "border border-input/40 bg-background hover:bg-muted/70",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        xs: "h-6 px-2 text-xs",
        lg: "h-10 px-8",
        icon: "h-8 w-8",
        "icon-xs": "h-6 w-6 [&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
