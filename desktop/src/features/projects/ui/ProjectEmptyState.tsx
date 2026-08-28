import { EmptyState } from "@heroui-pro/react/empty-state";
import type { LucideIcon } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

/**
 * The one empty state for the Projects surface, over HeroUI Pro's `EmptyState`.
 *
 * Projects grew twelve of these by hand, and they had drifted apart on every
 * axis that matters: icons at 9, 10 and 12; padding at `p-4`, `py-12`, `py-16`
 * and `p-8`; dashed borders that were sometimes rounded and sometimes not; and
 * two that never centred at all. Pro supplies the anatomy (media / title /
 * description / actions) and one spacing ramp, which is the whole reason to
 * adopt it — the gap here was never a missing component, it was twelve
 * incompatible ones.
 *
 * Two things about the Pro package are worth knowing before editing this file,
 * because both contradict its published documentation:
 *
 * - **`EmptyState` is not exported from the package root** in the installed
 *   `1.0.0-beta.8`, though the docs import it from there. It resolves only
 *   through the `./empty-state` subpath. Verify the `dist`, not the docs.
 * - **The root renders through `dom.div`**, which — unlike React Aria's
 *   `filterDOMProps` — spreads what it is given. `data-testid`, `role` and
 *   `aria-*` all survive on the root, so the ids `theme.css` and the specs
 *   select on can move onto this component unchanged.
 *
 * ## What else was weighed, and left alone
 *
 * The rest of the Pro data-display set was measured against this surface and
 * not adopted. Recorded here so the next pass does not re-litigate it:
 *
 * - **`item-card` / `item-card-group`** — the four grid cards
 *   (`ProjectGridCard`, `IssueGridCard`, `PullRequestGridCard`,
 *   `RepositoryGridCard`) are strictly more. Each seats a full-bleed
 *   `<button className="absolute inset-0">` under a `pointer-events-none`
 *   content layer with `pointer-events-auto` islands for the actions menu, a
 *   choreography `item-card` has no shape for; and they carry
 *   `data-projects-grid-card` / `data-projects-text-priority`, which the
 *   density pass reads.
 * - **`data-grid`** — the repository table in `ProjectRepositoryPanel` is not a
 *   data grid. Its `<thead>` is a latest-commit banner spanning three columns,
 *   rows carry their own keyboard handling, and paging is a progressive "show
 *   next N". Pro would bring a competing selection and sort model for no gain.
 *   `ProjectsWorkItemTable` is a `sr-only` `<thead>` over a CSS grid — pure
 *   accessibility scaffolding, with no markup to replace.
 * - **`timeline` / `agenda`** — `ProjectsActivityFeed` already groups by day and
 *   is wired into the view's multi-item selection, which Pro knows nothing of.
 * - **`kanban`** — genuinely absent, and left that way on scope rather than
 *   quality: Pro ships its own drag-and-drop against the app's `@dnd-kit`, and
 *   work-item status is derived from Nostr status events, so a
 *   drag-to-change-status board is a write path into the event contracts.
 * - **`file-tree`** — the repository browser is flat-plus-breadcrumbs by
 *   design, in the GitHub idiom. Not a tree done badly; a different decision.
 * - **`stepper`, `drop-zone`, `kpi`** — no multi-step flow, no file upload and
 *   no repository metrics exist on this surface. Nothing to fill.
 */

/**
 * Pro reads `--muted` as a muted *text* colour; this app spends that token on a
 * muted *surface*. `empty-state.css` reads it raw twice — on `__media`, and on
 * `__description`, which is body copy — so left alone the description renders
 * pale grey on white in the light theme and near-black on black in the dark
 * one. Illegible in both, and nothing in CI would say so.
 *
 * Re-pointing it at `--muted-foreground` on the block itself is enough: both
 * reads are on descendants, so the variable cascades to exactly those two
 * elements and to nothing else on the page. Deliberately not mapped globally —
 * `bg-muted` means the surface in 226 files. This collapses into the shared
 * `HERO_MUTED_SCOPE` once that lands, and is a no-op the day it does.
 */
export const PROJECT_EMPTY_STATE_MUTED_SCOPE =
  "[--muted:var(--muted-foreground)]";

/** Pro sizes the icon itself only inside `[data-variant="icon"]`; a bare icon
 *  gets no sizing from the stylesheet, so the ramp is carried here. */
const MEDIA_ICON_SIZE = {
  lg: "[&_svg]:size-12",
  md: "[&_svg]:size-10",
  sm: "[&_svg]:size-8",
} as const;

type ProjectEmptyStateProps = {
  /** Buttons or links for the action row. */
  actions?: ReactNode;
  description?: ReactNode;
  /** Measure control for long copy — Pro leaves the description unbounded. */
  descriptionClassName?: string;
  icon?: LucideIcon;
  /** `"icon"` seats the glyph in Pro's circular `--default` chip. */
  mediaVariant?: "default" | "icon";
  /** Dashed outline, for the lists that render one inline. */
  outline?: boolean;
  size?: "lg" | "md" | "sm";
  title?: ReactNode;
  /** Tone override for the title — error states carry their own colour. */
  titleClassName?: string;
} & Omit<ComponentPropsWithoutRef<"div">, "children" | "title">;

export function ProjectEmptyState({
  actions,
  className,
  description,
  descriptionClassName,
  icon: Icon,
  mediaVariant = "default",
  outline = false,
  size = "md",
  title,
  titleClassName,
  ...props
}: ProjectEmptyStateProps) {
  return (
    <EmptyState
      className={cn(
        PROJECT_EMPTY_STATE_MUTED_SCOPE,
        outline && "rounded-xl border border-dashed border-border/60",
        className,
      )}
      size={size}
      {...props}
    >
      <EmptyState.Header>
        {Icon ? (
          <EmptyState.Media
            className={cn(
              mediaVariant === "default" &&
                cn(MEDIA_ICON_SIZE[size], "text-muted-foreground/40"),
            )}
            variant={mediaVariant}
          >
            <Icon />
          </EmptyState.Media>
        ) : null}
        {title ? (
          <EmptyState.Title className={titleClassName}>
            {title}
          </EmptyState.Title>
        ) : null}
        {description ? (
          <EmptyState.Description className={descriptionClassName}>
            {description}
          </EmptyState.Description>
        ) : null}
      </EmptyState.Header>
      {actions ? (
        <EmptyState.Content className="flex-row flex-wrap justify-center gap-2">
          {actions}
        </EmptyState.Content>
      ) : null}
    </EmptyState>
  );
}
