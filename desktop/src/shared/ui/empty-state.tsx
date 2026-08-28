import type * as React from "react";
import { EmptyState as HeroEmptyState } from "@heroui-pro/react";

import { cn } from "@/shared/lib/cn";
import { HERO_MUTED_SCOPE } from "@/shared/ui/heroMutedScope";

/**
 * Thin surface over HeroUI Pro's `EmptyState`.
 *
 * This is the one Pro widget in this batch whose base CSS is worth taking: it
 * declares layout and type scale only — no border, no shadow, no radius, no
 * brand colour — so the app's identity survives without a neutralisation pass.
 * `--md` already resolves to the shape the app hand-rolled (`text-base
 * font-semibold` title over a `text-sm` description), and `--lg`'s icon well
 * (`size-14`, `svg size-6`) matches the inbox placeholder to the pixel.
 *
 * Two things it does not inherit:
 *
 * - **`--muted`.** Pro paints `.empty-state__media` and `__description` with
 *   it, and in this app that token is a surface, not a foreground. The root
 *   carries {@link HERO_MUTED_SCOPE}; see that file for why the fix cannot be
 *   global. Do not use `bg-muted` inside an `EmptyState` — it flips meaning.
 * - **`Media`'s `icon` variant.** Pro's is a `rounded-full` `bg-default` well.
 *   The app's icon frames vary per surface (rounded square with a border, bare
 *   glyph, avatar), so the default unopinionated variant is the one to reach
 *   for, with the frame supplied by the caller. `variant="icon"` stays
 *   available for surfaces that do want Pro's circle.
 *
 * `Content` is re-stacked to a row: Pro columns its action area, and every
 * caller here lays buttons out side by side.
 */

type EmptyStateProps = React.ComponentProps<typeof HeroEmptyState>;

const EmptyState = ({ className, ...props }: EmptyStateProps) => (
  <HeroEmptyState className={cn(HERO_MUTED_SCOPE, className)} {...props} />
);
EmptyState.displayName = "EmptyState";

type EmptyStateHeaderProps = React.ComponentProps<typeof HeroEmptyState.Header>;

const EmptyStateHeader = (props: EmptyStateHeaderProps) => (
  <HeroEmptyState.Header {...props} />
);
EmptyStateHeader.displayName = "EmptyStateHeader";

type EmptyStateMediaProps = React.ComponentProps<typeof HeroEmptyState.Media>;

const EmptyStateMedia = (props: EmptyStateMediaProps) => (
  <HeroEmptyState.Media {...props} />
);
EmptyStateMedia.displayName = "EmptyStateMedia";

type EmptyStateTitleProps = React.ComponentProps<typeof HeroEmptyState.Title>;

const EmptyStateTitle = (props: EmptyStateTitleProps) => (
  <HeroEmptyState.Title {...props} />
);
EmptyStateTitle.displayName = "EmptyStateTitle";

type EmptyStateDescriptionProps = React.ComponentProps<
  typeof HeroEmptyState.Description
>;

const EmptyStateDescription = (props: EmptyStateDescriptionProps) => (
  <HeroEmptyState.Description {...props} />
);
EmptyStateDescription.displayName = "EmptyStateDescription";

type EmptyStateContentProps = React.ComponentProps<
  typeof HeroEmptyState.Content
>;

const EmptyStateContent = ({ className, ...props }: EmptyStateContentProps) => (
  <HeroEmptyState.Content
    className={cn("flex-row flex-wrap justify-center", className)}
    {...props}
  />
);
EmptyStateContent.displayName = "EmptyStateContent";

export {
  EmptyState,
  EmptyStateHeader,
  EmptyStateMedia,
  EmptyStateTitle,
  EmptyStateDescription,
  EmptyStateContent,
};
