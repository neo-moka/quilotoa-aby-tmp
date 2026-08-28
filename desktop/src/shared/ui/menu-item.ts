/**
 * Shared row geometry for the popover menus that hang off the sidebar footer
 * (profile menu and the community actions submenu nested inside it).
 *
 * These two menus render as one continuous surface to the user, so their rows
 * have to agree on height, padding, radius, and hover tint. They previously
 * repeated the same long class string six times and drifted apart — different
 * paddings, two different separator colors, two different widths — which is
 * what made the pair read as two unrelated panels bolted together.
 */

/** Width shared by the profile menu and its nested community submenu. */
export const MENU_PANEL_WIDTH = "w-[264px]";

/** Standard interactive row. */
export const MENU_ITEM_CLASS =
  "flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-popover-foreground outline-hidden transition-colors hover:bg-muted/60 focus:bg-muted/60 focus:outline-none focus-visible:bg-muted/60 focus-visible:outline-none data-[state=open]:bg-muted/60";

/** Destructive row (leave community). Same geometry, red ink and tint. */
export const MENU_ITEM_DESTRUCTIVE_CLASS =
  "flex min-h-8 w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-destructive outline-hidden transition-colors hover:bg-destructive/10 focus:bg-destructive/10 focus:outline-none focus-visible:bg-destructive/10 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";

/**
 * Full-bleed hairline. The negative margin cancels the panel's `p-1` so the
 * rule spans the whole surface instead of floating inset.
 */
export const MENU_SEPARATOR_CLASS = "-mx-1 my-1 h-px border-0 bg-border/60";

/**
 * Leading icon. Every row carries one so labels line up in a single column;
 * previously the profile rows had none and the community rows did, which left
 * the two halves of the menu visibly misaligned.
 */
export const MENU_ICON_CLASS = "h-4 w-4 shrink-0 text-muted-foreground";
