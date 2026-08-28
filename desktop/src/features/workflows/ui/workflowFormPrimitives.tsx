import { ChevronDown } from "lucide-react";
import type * as React from "react";
import { Select } from "@/shared/ui/select";

/**
 * Hand-rolled because the app owns no select control — `dropdown-menu` is a
 * menu and `segmented-control` is a toggle bar — and `features/` does not
 * import HeroUI directly. **Migrate to `shared/ui/select.tsx` when it lands**;
 * this is one of four hand-rolled selects that have drifted apart (three
 * heights, two radii, two border tokens, and two with no chevron at all, left
 * on the OS-drawn arrow that system chrome paints in its own colours).
 *
 * Three findings from evaluating Pro's `NativeSelect` here, verified against
 * the installed 1.0.0-beta.8 `dist` rather than the docs, for whoever builds
 * that primitive:
 *
 * - `NativeSelect.Trigger` *does* spread its rest props onto the real
 *   `<select>`; it is plain JSX with no React Aria `filterDOMProps` in the
 *   path, so `data-testid` survives. That matters — `onboarding-backup.spec.ts`
 *   drives `backup-passphrase-separator` through `selectOption()`.
 * - Its CSS reads `--muted` twice, but both are guarded as
 *   `var(--field-placeholder, var(--muted))`, and `--field-placeholder` is
 *   already mapped in `heroui.css`, so the inverted-`--muted` hazard stays
 *   dormant and `HERO_MUTED_SCOPE` is not needed. The indicator still wants an
 *   explicit colour utility: that token resolves at `:root` and would carry the
 *   root value into the onboarding sub-themes, where a utility resolves at the
 *   element instead.
 * - It dims a select whose `option[value=""]` is checked, treating the empty
 *   value as an unfilled placeholder. `ChannelTemplatesSettingsCard`'s runtime
 *   row uses `value=""` for "Default", a real choice, so that one needs the
 *   dimming pinned off or it reads as unset.
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
