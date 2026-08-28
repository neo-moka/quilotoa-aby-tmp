import * as React from "react";
import { Button as HeroButton } from "@heroui/react";
import { Slot } from "@radix-ui/react-slot";
import { mergeRefs } from "@react-aria/utils";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/cn";

/**
 * HeroUI's `Button` under Buzz's own skin and DOM prop surface.
 *
 * The 523 call sites were written against `ButtonHTMLAttributes`, an open
 * pass-through, and React Aria's `filterDOMProps` is an allowlist: `id`,
 * `data-*`, `dir/lang/hidden/inert/translate`, global pointer events and a
 * fixed `aria-*` set. Everything else is dropped with no error — measured on
 * the current call sites, that is `title` (35), `role` and `aria-selected` (6,
 * all `PulseTabBar`), `aria-busy` (2) and `aria-hidden` (1); `disabled` (269)
 * is ignored outright because React Aria reads `isDisabled`; and `tabIndex` (3)
 * is not dropped but overwritten to `0`.
 *
 * `render` is what makes the migration possible: it replaces the element
 * HeroUI would emit, so the caller's remaining HTML attributes are spread onto
 * the same node *after* React Aria's, and the contract stays open rather than
 * narrowing to the allowlist. `buttonHeroUiGap.test.mjs` pins both halves — the
 * upstream gap and this wrapper closing it.
 *
 * Three deliberate choices:
 *
 * - **`onClick` stays a DOM handler**, chained after React Aria's rather than
 *   translated to `onPress`. `usePress` would still call it, but on the
 *   keyboard path it synthesises a `MouseEvent`, which drops `currentTarget`
 *   and zeroes `detail`. Of 418 handlers 15 read the event; `AgentsView` reads
 *   `currentTarget` and `ThreadViewModeToggle` reads `detail` to tell keyboard
 *   activation from a click. Chaining keeps all 418 byte-identical and still
 *   lets React Aria do its press bookkeeping.
 * - **`asChild` keeps `Slot`.** `render` only legitimately returns a `<button>`
 *   — hand it an `<a>` and HeroUI warns "Unexpected DOM element returned by
 *   custom `render` function", because the press and focus behaviour it
 *   installs assumes button semantics. The six `asChild` sites wrap `<a>`, so
 *   they keep Radix's `Slot`, which stays in the tree regardless: `card.tsx`,
 *   `sidebar.tsx` and `attachment.tsx` use it too, and 86 Radix `asChild`
 *   parents wrap a `<Button>` child.
 * - **Buzz's variants stay, HeroUI's are neutralised.** Its colour variants
 *   resolve from `--accent`, which this app deliberately leaves unmapped
 *   (theming-contract §4), and `variant="link"`, `xs` and `icon-xs` have no
 *   analog. `@heroui/styles/components/index.css` is imported app-wide, so
 *   `.button` applies whether or not we opt in; the base below cancels the
 *   parts that would otherwise show through.
 */
const buttonVariants = cva(
  // The trailing group cancels `.button`'s opinions, which arrive from the
  // global HeroUI stylesheet in `layer(components)` and would otherwise land on
  // every button in the app. Tailwind utilities outrank that layer, so no
  // `!important` is needed:
  //   static / isolation-auto — `.button` is `relative isolate`, which would
  //     re-anchor absolutely positioned children and open a stacking context.
  //     `cn` runs tailwind-merge, so a call site passing `relative` still wins.
  //   [--button-bg] / [--button-fg] — `.button--*` set these and `.button`
  //     paints `background-color`/`color` from them, which would tint the
  //     variants that intentionally set neither (`ghost`, `outline`, `link`).
  //   [&_svg]:m-0 — `.button` gives icons `-mx-0.5 my-0.5`.
  //   scale-100 on press — `.button:active` applies `scale(0.97)`.
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 static isolation-auto [--button-bg:transparent] [--button-fg:inherit] [&_svg]:m-0 active:scale-100 data-[pressed=true]:scale-100",
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
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild) {
      return <Slot className={classes} ref={ref} {...props} />;
    }

    const { disabled, onClick, type = "button", ...rest } = props;

    return (
      <HeroButton
        className={classes}
        isDisabled={disabled}
        render={(heroProps) => (
          <button
            {...heroProps}
            {...rest}
            onClick={(event) => {
              // React Aria's own handler first, so its press state settles
              // before the caller runs and can call stopPropagation.
              heroProps.onClick?.(event);
              onClick?.(event);
            }}
            ref={mergeRefs(heroProps.ref as React.Ref<HTMLButtonElement>, ref)}
            type={type}
          />
        )}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
