import { ComboBox as HeroComboBox, ListBox } from "@heroui/react";

import { cn } from "@/shared/lib/cn";
import { Input } from "@/shared/ui/input";

export type ComboBoxOption = {
  disabled?: boolean;
  label: string;
  value: string;
};

/**
 * Filterable single-select over HeroUI's `ComboBox`, taking a flat options
 * array rather than the compound collection children.
 *
 * The reason to reach for this over a hand-rolled popover-and-buttons picker is
 * accessibility, and it is not cosmetic. A bespoke picker typically ends up
 * with a `role="combobox"` trigger that names no popup, and options that are
 * `<button>`s — so a screen reader announces "button", never "option 3 of 12",
 * and never the active-descendant as the highlight moves. React Aria's
 * collection machinery is what supplies `aria-controls`, `aria-activedescendant`,
 * `role="listbox"`/`role="option"`, typeahead, and the arrow-key semantics,
 * and none of that can be bolted onto plain buttons from the outside.
 *
 * Two consequences worth knowing before adopting it somewhere:
 *
 * - **The trigger is an `<input>`, not a `<button>`.** `id` lands on that
 *   input, so a caller that used to read the trigger's *text* has to read its
 *   *value* instead. This is inherent to a combo box: the input is both the
 *   value display and the filter, which is why there is no separate search
 *   field inside the popover.
 * - **Filtering is React Aria's**, not a `useMemo` over `options`. It filters
 *   the collection by `textValue` with a "contains" match; pass `defaultFilter`
 *   through `HeroComboBox` if a call site ever needs different matching.
 *
 * `allowsEmptyCollection` keeps the popover open when a query matches nothing,
 * so `emptyMessage` is reachable instead of the list silently closing.
 */
export function ComboBox({
  className,
  disabled = false,
  emptyMessage = "No matches",
  id,
  inputClassName,
  onValueChange,
  options,
  placeholder,
  popoverClassName,
  value,
}: {
  className?: string;
  disabled?: boolean;
  /** Rendered inside the popover when the query matches no option. */
  emptyMessage?: string;
  /** Lands on the `<input>` — the element a `#id` selector resolves to. */
  id?: string;
  inputClassName?: string;
  onValueChange: (value: string) => void;
  options: readonly ComboBoxOption[];
  placeholder?: string;
  popoverClassName?: string;
  value: string;
}) {
  const disabledKeys = options
    .filter((option) => option.disabled)
    .map((option) => option.value);

  return (
    <HeroComboBox
      allowsEmptyCollection
      className={className}
      disabledKeys={disabledKeys}
      isDisabled={disabled}
      onSelectionChange={(key) => {
        // A cleared input reports `null`; the app's option values are strings
        // (including "" for an inherited default), so normalise back to one.
        onValueChange(key == null ? "" : String(key));
      }}
      selectedKey={value}
    >
      <HeroComboBox.InputGroup>
        <Input className={inputClassName} id={id} placeholder={placeholder} />
        <HeroComboBox.Trigger />
      </HeroComboBox.InputGroup>
      {/* `pointer-events-auto` is what keeps this usable inside a modal dialog,
          and its absence is invisible: the popover paints, the options render,
          and the click lands on the dialog underneath. Radix's modal `Dialog`
          blanks `pointer-events` on `<body>` and hands them back only to its
          own content; React Aria portals to that same body and claims nothing.
          Baked in rather than left to `popoverClassName` because every caller
          inside a dialog needs it and forgetting it fails silently. Same fix,
          same reason, as `MENU_POPOVER_CLASS` in `menuCollection.ts`. */}
      <HeroComboBox.Popover
        className={cn("pointer-events-auto", popoverClassName)}
      >
        <ListBox
          renderEmptyState={() => (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground/55">
              {emptyMessage}
            </p>
          )}
        >
          {options.map((option) => (
            <ListBox.Item
              id={option.value}
              key={option.value}
              textValue={option.label}
            >
              {option.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </HeroComboBox.Popover>
    </HeroComboBox>
  );
}
