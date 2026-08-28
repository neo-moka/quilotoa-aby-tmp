import * as React from "react";

import { cn } from "@/shared/lib/cn";

/**
 * The app's bordered `<select>`, deliberately **not** built on HeroUI Pro.
 *
 * Pro ships a `NativeSelect` and it keeps the native `<select>` underneath, so
 * it carries no React Aria collection or prop-allowlist risk. It was still the
 * wrong base here: the whole component *is* a field skin — it paints
 * `--field-background`, `--color-field-border`, `--field-radius` and
 * `--field-shadow`, and HeroUI's own default is `--field-border: transparent`
 * ("no border by default on form fields"). `input.tsx` already refused that
 * skin on the record, because `--field-background` maps to the app's `--input`,
 * a border-weight grey, and adopting it would repaint every field in the app.
 * Taking Pro here would have produced exactly that repaint on selects alone,
 * leaving them mismatched against the inputs beside them.
 *
 * So this mirrors `input.tsx` instead — same height, radius, border, focus ring
 * and disabled treatment — which is what makes a select and a text field finally
 * look like the same control.
 *
 * **This does not settle the open question.** `input.tsx` says "parity first;
 * the field skin is a separate decision", and that decision is still open. This
 * file sidesteps it by matching what `Input` does today; if `Input` ever moves
 * onto HeroUI's field skin, this moves with it.
 *
 * The native disclosure arrow is kept — most call sites already showed it, and
 * a wrapper element to host a custom chevron would change the DOM shape at
 * every one of them. Callers that want the custom chevron (the workflow form)
 * pass `appearance-none pr-8` and position their own; `cn` is tailwind-merge
 * backed, so any caller class wins over the defaults here, which is also how
 * the compact row variants keep their smaller height.
 */
const SELECT_CLASS =
  "flex h-9 w-full rounded-lg border border-input/40 bg-background px-3 py-1 text-base transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm";

const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, ...props }, ref) => (
  <select className={cn(SELECT_CLASS, className)} ref={ref} {...props} />
));
Select.displayName = "Select";

export { Select, SELECT_CLASS };
