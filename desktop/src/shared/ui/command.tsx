import type * as React from "react";
import { Command as HeroCommand } from "@heroui-pro/react";

import { cn } from "@/shared/lib/cn";
import { HERO_MUTED_SCOPE } from "@/shared/ui/heroMutedScope";

/**
 * Surface over HeroUI Pro's `Command`, carrying the three adjustments this app
 * needs before the palette is usable. Nothing here changes Pro's DOM: every
 * part still renders Pro's element with Pro's `data-slot`, so `command.css`
 * keeps applying.
 *
 * **1. Filtering is off by default.** `Command.Dialog` wraps its children in a
 * React Aria `Autocomplete` and defaults to a case-insensitive `contains`
 * filter over each item's `textValue`
 * (`@heroui-pro/react/dist/components/command/command.js`, `filter ?? d`). That
 * is right for a static command list and wrong for this app, whose results come
 * back already filtered by the relay's Postgres FTS. Left on, it would re-filter
 * server hits against the raw query string and silently drop anything matched by
 * stemming, by a description, or by an author name that is not in the visible
 * label. `filter={() => true}` is the documented escape hatch and this surface
 * makes it the default; pass `filter` explicitly to opt back in for a genuinely
 * client-side list.
 *
 * **2. `--muted` is re-pointed, and the surface value is kept reachable.**
 * `command.css` reads `var(--muted)` eight times — placeholder, input prefix and
 * suffix, item `svg` and `kbd`, group heading, footer, empty state. All eight are
 * text or icon colours, so [`HERO_MUTED_SCOPE`](./heroMutedScope.ts) is correct
 * for every one of them, and it goes on the dialog rather than on a caller's
 * wrapper as that file requires.
 *
 * But a palette is a container: app markup renders *inside* `Command.Item` and
 * `Command.Footer`, and this app spends `--muted` on a **surface**. A nested
 * `bg-muted` would therefore paint a background with a text grey — the same
 * inversion one level down. This is not hypothetical: the search result rows use
 * `bg-muted/45` and `hover:bg-muted/35` (`SearchResultRow.tsx`).
 *
 * So `Container` captures the surface value into `--buzz-muted-surface` before
 * `Dialog` re-points `--muted`. Custom properties resolve per element, so the
 * capture has to happen on an ancestor — doing both on one element would make
 * the capture read the value being replaced. App content that needs the surface
 * back wraps itself in {@link COMMAND_APP_CONTENT_SCOPE}.
 *
 * **3. `Command.List` is a React Aria `Menu`, not a listbox.** Items come out as
 * `role="menuitem"` inside `role="menu"`. Anything migrating off a
 * `role="listbox"` / `role="option"` list changes its accessibility tree and any
 * spec asserting those roles. `command.test.mjs` pins the emitted roles so the
 * change is a decision, not a surprise.
 */

/**
 * Restores `--muted` to its app meaning (a surface) for app markup nested inside
 * the palette. Only needed by subtrees that use `bg-muted`; text that reads
 * `text-muted-foreground` is unaffected either way.
 */
export const COMMAND_APP_CONTENT_SCOPE = "[--muted:var(--buzz-muted-surface)]";

/** Captures the app's surface `--muted` so nested content can reclaim it. */
const COMMAND_MUTED_CAPTURE = "[--buzz-muted-surface:var(--muted)]";

type CommandContainerProps = React.ComponentProps<typeof HeroCommand.Container>;
type CommandDialogProps = React.ComponentProps<typeof HeroCommand.Dialog>;

const KEEP_SERVER_ORDER = () => true;

function CommandContainer({ className, ...props }: CommandContainerProps) {
  return (
    <HeroCommand.Container
      className={cn(COMMAND_MUTED_CAPTURE, className)}
      {...props}
    />
  );
}

function CommandDialog({ className, filter, ...props }: CommandDialogProps) {
  return (
    <HeroCommand.Dialog
      className={cn(HERO_MUTED_SCOPE, className)}
      filter={filter ?? KEEP_SERVER_ORDER}
      {...props}
    />
  );
}

function CommandRoot(props: React.ComponentProps<typeof HeroCommand>) {
  return <HeroCommand {...props} />;
}

// Assign onto a local root, never onto `HeroCommand` itself: mutating the
// imported module object would hand this app's overrides to every other
// consumer of `@heroui-pro/react`. The root must stay a function — `Command` is
// callable *and* carries its parts, so spreading it into an object literal
// would drop the component and leave React with a plain object.
export const Command = Object.assign(CommandRoot, HeroCommand, {
  Container: CommandContainer,
  Dialog: CommandDialog,
});
