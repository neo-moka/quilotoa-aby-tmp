import { AtSign, Bell, ShieldCheck } from "lucide-react";
import type * as React from "react";

import type { NeedsYouRow as NeedsYouRowData } from "@/features/sidebar/lib/sidebarNowData";
import { formatCompactAge } from "@/features/sidebar/lib/sidebarNowData";
import { cn } from "@/shared/lib/cn";
import { useNow } from "@/shared/lib/useNow";
import { SidebarMenuButton, SidebarMenuItem } from "@/shared/ui/sidebar";

function rowIcon(row: NeedsYouRowData) {
  if (row.isApproval) return ShieldCheck;
  return row.category === "mention" ? AtSign : Bell;
}

/**
 * One pending item in the sidebar's "Needs you" block.
 *
 * Two lines, not one: the label line says what kind of thing is waiting, the
 * detail line says where and quotes enough of it to triage without clicking
 * through. A single 256px line could only fit the label, which forces a
 * round-trip to find out whether "Mention" can wait — the question this block
 * exists to answer in place.
 *
 * Ticks once a minute rather than once a second: the age is rendered in whole
 * minutes, so a faster clock would re-render every row for a value that cannot
 * have changed.
 */
export function SidebarNeedsYouRow({
  onSelect,
  row,
}: {
  onSelect: (row: NeedsYouRowData) => void;
  row: NeedsYouRowData;
}): React.ReactElement {
  const now = useNow(60_000);
  const Icon = rowIcon(row);
  const age = formatCompactAge(row.createdAt, now);
  const where = row.channelName ? `#${row.channelName}` : "";
  const detail = [where, row.snippet].filter(Boolean).join(" · ");

  return (
    <SidebarMenuItem className="group/menu-item">
      <SidebarMenuButton
        className="h-auto items-start py-1.5 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-foreground"
        data-testid="sidebar-needs-you-row"
        onClick={() => onSelect(row)}
        tooltip={`${row.label}${where ? ` in ${where}` : ""} · ${age}`}
        type="button"
      >
        <Icon
          className={cn(
            "mt-px shrink-0",
            row.isApproval ? "text-warning" : "text-primary",
          )}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={cn(
              "min-w-0 truncate leading-tight",
              row.isApproval && "font-medium text-sidebar-foreground",
            )}
          >
            {row.label}
          </span>
          {detail ? (
            <span
              className="min-w-0 truncate text-2xs leading-tight text-sidebar-foreground/50"
              data-testid="sidebar-needs-you-detail"
            >
              {detail}
            </span>
          ) : null}
        </span>
        <span className="mt-px shrink-0 text-2xs leading-none tabular-nums text-sidebar-foreground/50">
          {age}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
