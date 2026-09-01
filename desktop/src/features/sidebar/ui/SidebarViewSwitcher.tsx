import type * as React from "react";

import {
  setSidebarView,
  SIDEBAR_VIEWS,
  useSidebarView,
} from "@/features/sidebar/lib/sidebarViewStore";
import { cn } from "@/shared/lib/cn";

/**
 * The `Now / Rooms / People` segmented control under the community name.
 *
 * Three filters rather than three destinations: the sidebar keeps showing the
 * same column, narrowed. That is why this is a pill group and not a tab bar or
 * a route — nothing below it unmounts a screen, and the main pane never moves.
 *
 * Built on real radio inputs behind the pills rather than buttons wearing
 * `role="radio"`. A segmented control looks like it should answer arrow keys
 * and occupy one stop in the tab order, and a native radio group does both
 * without a keyboard handler to maintain — the hand-rolled version had to
 * re-implement roving focus and would drift from it.
 */
export function SidebarViewSwitcher({
  className,
}: {
  className?: string;
}): React.ReactElement {
  const selected = useSidebarView();

  return (
    <fieldset
      className={cn(
        // `container-type` lets the pills answer to the switcher's own width:
        // in a narrow sidebar the labels give way (truncate, then sr-only)
        // instead of overflowing the pill group.
        "flex min-w-0 items-center gap-0.5 rounded-lg bg-sidebar-border/30 p-0.5 [container-type:inline-size]",
        className,
      )}
      data-testid="sidebar-view-switcher"
    >
      <legend className="sr-only">Sidebar view</legend>
      {SIDEBAR_VIEWS.map((view) => {
        const isSelected = view.id === selected;
        return (
          // `data-active` matters beyond styling hooks: the sidebar themes
          // repaint any `[data-active="true"]` inside the sidebar with their
          // subtle active surface. Without it this pill renders the raw
          // `--sidebar-active` token, which the accent system can set to the
          // theme foreground — a solid black pill behind dark text.
          <label
            className={cn(
              // Same metrics as `SidebarMenuButton` (h-8, text-sm, size-4
              // icons) so the selected pill and a selected channel row read
              // as the same control at two spots, not two different sizes.
              "flex h-8 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md px-2.5 text-sm font-medium transition-colors",
              "[@container(max-width:13rem)]:gap-0 [@container(max-width:13rem)]:px-1",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sidebar-ring",
              isSelected
                ? "bg-sidebar-active text-sidebar-active-foreground shadow-xs"
                : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
            data-active={isSelected ? "true" : "false"}
            // The clickable surface; the input inside is sr-only, so tests
            // and tooling need a hittable target.
            data-testid={`sidebar-view-option-${view.id}`}
            key={view.id}
            title={view.label}
          >
            <input
              checked={isSelected}
              className="sr-only"
              data-testid={`sidebar-view-${view.id}`}
              name="sidebar-view"
              onChange={() => setSidebarView(view.id)}
              type="radio"
              value={view.id}
            />
            <view.icon aria-hidden className="size-4 shrink-0" />
            {/* Below ~13rem the label goes screen-reader-only: icon pills
                with the name kept for a11y and in the title tooltip. */}
            <span className="truncate [@container(max-width:13rem)]:sr-only">
              {view.label}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
