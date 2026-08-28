import { cn } from "@/shared/lib/cn";
import { ComboBox } from "@/shared/ui/combobox";
import {
  type PersonaDropdownOption,
  PERSONA_FIELD_CONTROL_CLASS,
  PERSONA_FIELD_SHELL_CLASS,
} from "./agentConfigOptions";

type PersonaModelComboboxProps = {
  disabled?: boolean;
  id: string;
  onValueChange: (value: string) => void;
  options: readonly PersonaDropdownOption[];
  placeholder: string;
  value: string;
};

/**
 * Model picker for the persona dialog.
 *
 * This was a bespoke picker — a `role="combobox"` button, a Radix popover, a
 * separate search `<input>`, and options rendered as `<button>`s with a
 * `highlightedIndex` walked by hand. It looked right and read wrong: the
 * trigger named no popup, so `aria-controls` and `aria-activedescendant` were
 * both absent, and the options carried no `role="option"` — a screen reader
 * announced "button" and never the position in the list. That gap is in the
 * collection semantics, so `shared/ui/combobox` (React Aria) replaces it
 * rather than patching attributes onto the old markup.
 *
 * The visible trade is that the trigger is now an `<input>`: typing filters in
 * place instead of opening a second search field. `PERSONA_FIELD_SHELL_CLASS`
 * keeps the field's outer skin so it still sits flush with the other persona
 * fields.
 */
export function PersonaModelCombobox({
  disabled,
  id,
  onValueChange,
  options,
  placeholder,
  value,
}: PersonaModelComboboxProps) {
  return (
    <ComboBox
      className={PERSONA_FIELD_SHELL_CLASS}
      disabled={disabled}
      emptyMessage="No models match"
      id={id}
      inputClassName={cn(
        "h-11 border-0 bg-transparent px-3 py-2 text-sm leading-6 shadow-none",
        PERSONA_FIELD_CONTROL_CLASS,
      )}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      value={value}
    />
  );
}
