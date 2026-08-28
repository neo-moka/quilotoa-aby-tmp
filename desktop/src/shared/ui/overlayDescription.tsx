import * as React from "react";

/**
 * Radix wired `aria-describedby` from `Dialog.Description` to `Dialog.Content`
 * automatically. React Aria's `Dialog` only auto-wires the title (via
 * `Heading slot="title"`), so the description link has to be rebuilt by hand or
 * every migrated overlay silently loses its accessible description.
 *
 * A description registers itself on mount; the overlay only emits
 * `aria-describedby` once one actually exists, so overlays without a
 * description never point at a missing id.
 */
type OverlayDescriptionContextValue = {
  descriptionId: string;
  setHasDescription: (present: boolean) => void;
};

const OverlayDescriptionContext =
  React.createContext<OverlayDescriptionContextValue | null>(null);

/** Used by the overlay surface (dialog / alert-dialog / sheet content). */
export function useOverlayDescription(): {
  describedBy: string | undefined;
  context: OverlayDescriptionContextValue;
} {
  const descriptionId = React.useId();
  const [hasDescription, setHasDescription] = React.useState(false);
  const context = React.useMemo(
    () => ({ descriptionId, setHasDescription }),
    [descriptionId],
  );

  return {
    describedBy: hasDescription ? descriptionId : undefined,
    context,
  };
}

export const OverlayDescriptionProvider = OverlayDescriptionContext.Provider;

/**
 * Used by the description element itself. Passing an explicit `id` hands
 * ownership of the wiring back to the caller and skips registration.
 */
export function useOverlayDescriptionId(explicitId?: string): string | undefined {
  const context = React.useContext(OverlayDescriptionContext);
  const shouldRegister = !explicitId && context !== null;

  React.useEffect(() => {
    if (!shouldRegister || !context) return;

    context.setHasDescription(true);
    return () => context.setHasDescription(false);
  }, [context, shouldRegister]);

  return explicitId ?? context?.descriptionId;
}
