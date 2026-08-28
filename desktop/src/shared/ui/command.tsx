import type * as React from "react";
// Subpath, not the package root: the root barrel pulls in `sheet`, whose
// `use-scale-background` calls `window.matchMedia` at module scope and throws
// under jsdom. Bundler and `tsc` are fine either way; this keeps the unit test
// importable.
import {
  CommandBackdrop,
  CommandContainer,
  CommandDialog,
  CommandFooter,
  CommandGroup,
  CommandHeader,
  CommandInputGroup,
  CommandInputGroupClearButton,
  CommandInputGroupInput,
  CommandInputGroupPrefix,
  CommandInputGroupSuffix,
  CommandItem,
  CommandList,
  CommandRoot,
  CommandSeparator,
} from "@heroui-pro/react/command";

import { cn } from "@/shared/lib/cn";
import { HERO_MUTED_SCOPE } from "@/shared/ui/heroMutedScope";

/**
 * Surface over HeroUI Pro's `Command`. It carries three adjustments and nothing
 * else — every part still renders Pro's element with Pro's `data-slot`, so
 * `command.css` keeps applying.
 *
 * **1. Filtering is off by default.** `Command.Dialog` wraps its children in a
 * React Aria `Autocomplete` and defaults to a case-insensitive `contains` filter
 * over each item's `textValue` (`dist/components/command/command.js`,
 * `filter ?? d`). Right for a static command list, wrong for this app: results
 * come back already filtered by the relay's Postgres FTS, so a second client
 * pass would silently drop hits matched by stemming, by a description, or by an
 * author name absent from the visible label. Pass `filter` explicitly to opt
 * back in for a genuinely client-side list.
 *
 * **2. `--muted` is re-pointed per reading node, never on the dialog.**
 * Verified against the *compiled* `dist/css/components/command.css` rather than
 * the `@apply` source the MCP returns: `var(--muted)` is read exactly 8 times,
 * none of them behind an already-mapped token, and **all 8 are `color:`** —
 * placeholder, input prefix, input suffix, item `svg`, item `kbd`, group
 * heading, footer, empty state. So [`HERO_MUTED_SCOPE`](./heroMutedScope.ts) is
 * the right value for every one of them.
 *
 * Placement is the part that bites. Scoping the whole dialog is what broke
 * `EmptyState` in the widgets lot — nested controls inherited the re-point and
 * their hover backgrounds resolved to a text grey. So the scope goes on the node
 * that owns each read (or the nearest reachable ancestor, for the heading and
 * empty state, which Pro renders internally): `InputGroup`, `Group`, `List`,
 * `Item`, `Footer`. `Dialog` stays clean.
 *
 * Four of those five still contain app markup, and this app spends `--muted` on
 * a **surface** (`bg-muted`, 226 files). That is not hypothetical here: the
 * search result rows use `bg-muted/45` and `hover:bg-muted/35`
 * (`SearchResultRow.tsx`). App content that needs the surface back wraps itself
 * in {@link COMMAND_APP_CONTENT_SCOPE}. `Container` captures the value first,
 * because custom properties resolve per element — capturing and re-pointing on
 * one element would make the capture read the value being replaced.
 *
 * **3. `Command.List` is a React Aria `Menu`, not a listbox.** Items come out as
 * `role="menuitem"` inside `role="menu"`. Anything migrating off a
 * `role="listbox"` / `role="option"` list changes its accessibility tree.
 * `command.test.mjs` pins the emitted roles so that is a decision, not a
 * surprise.
 */

/**
 * Restores `--muted` to its app meaning (a surface) for app markup nested inside
 * the palette. Needed only by subtrees that use `bg-muted`; text reading
 * `text-muted-foreground` is unaffected either way.
 */
export const COMMAND_APP_CONTENT_SCOPE = "[--muted:var(--buzz-muted-surface)]";

/** Captures the app's surface `--muted` so nested content can reclaim it. */
const COMMAND_MUTED_CAPTURE = "[--buzz-muted-surface:var(--muted)]";

const KEEP_SERVER_ORDER = () => true;

function ScopedContainer({
  className,
  ...props
}: React.ComponentProps<typeof CommandContainer>) {
  return (
    <CommandContainer
      className={cn(COMMAND_MUTED_CAPTURE, className)}
      {...props}
    />
  );
}

function UnfilteredDialog({
  className,
  filter,
  ...props
}: React.ComponentProps<typeof CommandDialog>) {
  return (
    <CommandDialog
      className={className}
      filter={filter ?? KEEP_SERVER_ORDER}
      {...props}
    />
  );
}

function ScopedInputGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandInputGroup>) {
  return (
    <CommandInputGroup className={cn(HERO_MUTED_SCOPE, className)} {...props} />
  );
}

function ScopedList<T extends object>({
  className,
  ...props
}: React.ComponentProps<typeof CommandList<T>>) {
  return <CommandList className={cn(HERO_MUTED_SCOPE, className)} {...props} />;
}

function ScopedItem<T extends object>({
  className,
  ...props
}: React.ComponentProps<typeof CommandItem<T>>) {
  return <CommandItem className={cn(HERO_MUTED_SCOPE, className)} {...props} />;
}

function ScopedGroup<T extends object>({
  className,
  ...props
}: React.ComponentProps<typeof CommandGroup<T>>) {
  return (
    <CommandGroup className={cn(HERO_MUTED_SCOPE, className)} {...props} />
  );
}

function ScopedFooter({
  className,
  ...props
}: React.ComponentProps<typeof CommandFooter>) {
  return (
    <CommandFooter className={cn(HERO_MUTED_SCOPE, className)} {...props} />
  );
}

const InputGroup = Object.assign(ScopedInputGroup, {
  ClearButton: CommandInputGroupClearButton,
  Input: CommandInputGroupInput,
  Prefix: CommandInputGroupPrefix,
  Suffix: CommandInputGroupSuffix,
});

function CommandRootWrapper(props: React.ComponentProps<typeof CommandRoot>) {
  return <CommandRoot {...props} />;
}

// The parts hang off a local wrapper, never off Pro's own `CommandRoot`:
// `Object.assign` mutates its target, so assigning onto the imported binding
// would hand this app's overrides to every other consumer of the package. The
// root has to stay a function — it is callable *and* carries its parts, so
// spreading it into an object literal would drop the component itself.
export const Command = Object.assign(CommandRootWrapper, {
  Backdrop: CommandBackdrop,
  Container: ScopedContainer,
  Dialog: UnfilteredDialog,
  Footer: ScopedFooter,
  Group: ScopedGroup,
  Header: CommandHeader,
  InputGroup,
  Item: ScopedItem,
  List: ScopedList,
  Separator: CommandSeparator,
});
