import { Clock } from "lucide-react";
import * as React from "react";

import {
  parseCustomDateTime,
  TIME_PRESETS,
  todayDateString,
} from "@/features/reminders/lib/timePresets";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Input } from "@/shared/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/shared/ui/popover";

/**
 * Clock-icon dropdown of snooze presets plus a "Custom…" popover with a native
 * date/time picker. Calls `onSnooze` with a future Unix timestamp (seconds).
 * The custom surface uses the shared {@link parseCustomDateTime} guard so a
 * past time is rejected rather than firing immediately.
 */
export function SnoozeMenu({
  disabled,
  onSnooze,
}: {
  disabled?: boolean;
  onSnooze: (notBefore: number) => void;
}) {
  const [customOpen, setCustomOpen] = React.useState(false);
  const [customDate, setCustomDate] = React.useState(todayDateString);
  const [customTime, setCustomTime] = React.useState("09:00");

  const customTimestamp = parseCustomDateTime(customDate, customTime);

  return (
    // The custom picker is anchored to the trigger rather than nested in the
    // menu: the menu is a collection, and a popover trigger wrapped around an
    // item would discard every item in it.
    <Popover open={customOpen} onOpenChange={setCustomOpen}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PopoverAnchor asChild>
            <Button
              className="h-7 w-7 p-0"
              disabled={disabled}
              size="sm"
              title="Snooze"
              type="button"
              variant="ghost"
            >
              <Clock className="h-4 w-4" />
            </Button>
          </PopoverAnchor>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {TIME_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.label}
              onSelect={() => onSnooze(preset.getTimestamp())}
            >
              {preset.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              // Keep the menu from closing over the picker it just opened.
              event.preventDefault();
              setCustomOpen(true);
            }}
          >
            Custom…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <PopoverContent align="end" className="w-auto space-y-3">
        <p className="text-sm font-medium">Snooze until</p>
        <div className="flex gap-2">
          <Input
            aria-label="Snooze date"
            className="flex-1"
            min={todayDateString()}
            onChange={(event) => setCustomDate(event.target.value)}
            type="date"
            value={customDate}
          />
          <Input
            aria-label="Snooze time"
            className="w-[120px]"
            onChange={(event) => setCustomTime(event.target.value)}
            type="time"
            value={customTime}
          />
        </div>
        <Button
          className="w-full"
          disabled={customTimestamp === null}
          onClick={() => {
            if (customTimestamp === null) return;
            onSnooze(customTimestamp);
            setCustomOpen(false);
          }}
          type="button"
        >
          Snooze
        </Button>
      </PopoverContent>
    </Popover>
  );
}
