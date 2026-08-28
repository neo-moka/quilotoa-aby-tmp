import { NativeSelect } from "@heroui-pro/react";
import type * as React from "react";

/**
 * The app owns no select form control — `dropdown-menu` is a menu and
 * `segmented-control` is a toggle bar — so every `<select>` in the product was
 * hand-rolled, each with its own chevron math and field skin. This one is built
 * on `@heroui-pro/react`'s `NativeSelect`, which is a real `<select>` plus a
 * CSS-positioned indicator: the same control, with the placement arithmetic and
 * the `appearance: none` reset moved out of the call site.
 *
 * `NativeSelect.Trigger` spreads its remaining props straight onto the
 * `<select>` (verified against the installed 1.0.0-beta.8 `dist`, not the docs —
 * `Resizable` in the same beta silently drops them), so `id`, `disabled`,
 * `value` and `onChange` land on the same node as before.
 *
 * The skin stays Buzz's, following the precedent `shared/ui/input.tsx` set:
 * Pro's field CSS paints from `--field-background`, which the theming contract
 * maps to the app's `--input` — a border-weight grey — so taking it would
 * repaint the field. The classes below are the ones this control already had.
 * `pr-8` is kept rather than deferred to Pro's computed indicator inset because
 * `px-3` is a utility and would win over it anyway.
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
    <NativeSelect className="w-full">
      <NativeSelect.Trigger
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 pr-8 text-sm shadow-xs transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.value)}
        value={value}
        wrapperClassName="w-full"
      >
        {children}
        {/* Explicit colour utility, not Pro's `--field-placeholder` default:
            that token is declared on `:root`, so it would carry the root value
            into any sub-theme. A utility resolves at the element. */}
        <NativeSelect.Indicator className="right-2 text-muted-foreground" />
      </NativeSelect.Trigger>
    </NativeSelect>
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
