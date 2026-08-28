import type * as React from "react";
// Subpath, not the package root: the root barrel pulls in `sheet`, whose
// `use-scale-background` calls `window.matchMedia` at module scope and throws
// under jsdom.
import {
  ItemCardAction,
  ItemCardContent,
  ItemCardDescription,
  ItemCardIcon,
  ItemCardRoot,
  ItemCardTitle,
} from "@heroui-pro/react/item-card";

import { cn } from "@/shared/lib/cn";
import { HERO_MUTED_SCOPE } from "@/shared/ui/heroMutedScope";

/**
 * Surface over Pro's `ItemCard`: a horizontal row of leading figure, stacked
 * title and description, trailing action.
 *
 * One adjustment. `.item-card__description` is the component's only reader of
 * `var(--muted)` — verified against the compiled
 * `dist/css/components/item-card.css`, one occurrence, not behind a mapped
 * token — and it uses it as `color`. This app spends `--muted` on a *surface*,
 * so left alone every description renders in the panel colour. It carries
 * [`HERO_MUTED_SCOPE`](./heroMutedScope.ts) here, on the node that reads it,
 * rather than on the root: blanketing a container is what broke `EmptyState`,
 * whose nested controls inherited the re-point and hovered to a text grey.
 *
 * Nothing else is wrapped. The root is polymorphic and spreads its rest props,
 * so `ref`, `data-testid` and handlers reach the DOM node unchanged —
 * `itemCard.test.mjs` pins that, because a dropped `ref` here would break a
 * caller's popover anchoring with no error.
 *
 * `ItemCard.Icon` is re-exported as-is and is worth reading before use: it is a
 * fixed `size-9` box with `background-color: var(--default)`, its own radius,
 * and a descendant `svg { width: 1rem; height: 1rem }`. That suits a plain
 * glyph and fights anything with its own geometry — see the note in
 * `SidebarProfileCard.tsx`, which keeps its avatar outside the slot for exactly
 * that reason.
 */

function ScopedDescription({
  className,
  ...props
}: React.ComponentProps<typeof ItemCardDescription>) {
  return (
    <ItemCardDescription
      className={cn(HERO_MUTED_SCOPE, className)}
      {...props}
    />
  );
}

function ItemCardRootWrapper(props: React.ComponentProps<typeof ItemCardRoot>) {
  return <ItemCardRoot {...props} />;
}

// The parts hang off a local wrapper, never off Pro's own `ItemCardRoot`:
// `Object.assign` mutates its target, and Pro builds its namespace by attaching
// the parts to that same object, so assigning onto it would hand this app's
// overrides to every other consumer of the package.
export const ItemCard = Object.assign(ItemCardRootWrapper, {
  Action: ItemCardAction,
  Content: ItemCardContent,
  Description: ScopedDescription,
  Icon: ItemCardIcon,
  Title: ItemCardTitle,
});
