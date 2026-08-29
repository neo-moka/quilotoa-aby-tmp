/**
 * One heading voice for every collapsible sidebar section.
 *
 * Three components (channels, projects, DMs) carried private copies of these
 * strings, which is exactly how the column ended up speaking two type styles:
 * the copies inherited `SidebarGroupLabel`'s sentence-case `text-xs` while the
 * Now blocks used `SidebarSectionHeading`'s small caps. The typography now
 * lives here once and matches the Now headings — small caps, `text-2xs`, the
 * same tracking — so collapsible and static headings differ in affordance
 * (chevron, hover), never in voice.
 */
export const SECTION_LABEL_BUTTON_CLASS =
  "group/section-label flex w-fit max-w-[calc(100%-3rem)] cursor-pointer appearance-none items-center gap-1 text-left text-2xs font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground focus-visible:text-sidebar-foreground";

export const SECTION_LABEL_CHEVRON_CLASS =
  "relative size-2.5 shrink-0 text-current opacity-0 transition-[color,opacity] group-hover/sidebar-section:opacity-100 group-hover/section-label:opacity-100 group-focus-within/sidebar-section:opacity-100 group-focus-visible/section-label:opacity-100 group-data-[section-actions-open=true]/sidebar-section:opacity-100";

export const SECTION_LABEL_CHEVRON_ICON_CLASS =
  "absolute left-1/2 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2";
