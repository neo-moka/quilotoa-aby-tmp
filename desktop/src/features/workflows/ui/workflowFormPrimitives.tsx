import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { Select } from "@/shared/ui/select";

/**
 * The one call site that opts out of `Select`'s native disclosure arrow, via
 * `appearance-none pr-8` plus its own positioned chevron. The wrapping
 * `<div className="relative">` is the cost of that, and it is why `select.tsx`
 * keeps the native arrow as its default rather than making a wrapper universal.
 *
 * If `Select` ever moves onto HeroUI Pro's `NativeSelect`, **this site must drop
 * its own chevron** — Pro's `Trigger` renders an indicator whenever none is
 * passed, so the two would stack into a double arrow. Three things about that
 * component, verified against the installed 1.0.0-beta.8 `dist` rather than the
 * docs, so nobody has to re-derive them:
 *
 * - `Trigger` spreads its rest props onto the real `<select>` — plain JSX, no
 *   React Aria `filterDOMProps` in the path — so `data-testid`, `id` and
 *   `aria-*` survive. `check-testids` and `onboarding-backup.spec.ts`'s
 *   `selectOption()` both depend on that.
 * - `.native-select__select` sets `appearance: none` unconditionally, and Pro
 *   nests two `inline-flex` wrappers. So there is no "Pro structure, native
 *   arrow" option, and width stops coming from the `<select>`: full-width sites
 *   would need `fullWidth` on the root.
 * - It dims a select whose `option[value=""]` is checked, treating the empty
 *   value as an unfilled placeholder. `ChannelTemplatesSettingsCard`'s runtime
 *   row uses `value=""` for "Default", a real choice, so it would need that
 *   pinned off or the selection reads as unset.
 */
export function FormSelect({
  children,
  disabled,
  id,
  onChange,
  value,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  id?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <div className="relative">
      <Select
        className="appearance-none bg-transparent pr-8 text-sm"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </Select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      className="block text-xs font-medium text-muted-foreground"
      htmlFor={htmlFor}
    >
      {children}
    </label>
  );
}
