import * as React from "react";

import { cn } from "@/shared/lib/cn";

type SegmentOption<Value extends string> = {
  value: Value;
  label: string;
  Icon?: React.ComponentType<{ className?: string }>;
};

type SegmentedControlSize = "compact" | "default" | "wide";

const SIZE_CLASSES: Record<SegmentedControlSize, string> = {
  compact: "w-48",
  default: "w-60",
  wide: "w-72",
};

/**
 * A mutually exclusive control with equal-width, optionally scrubbable options.
 *
 * **Not migrated to `@heroui-pro/react/segment`** — three gaps, re-verified
 * against the installed `@heroui-pro/react` 1.0.0-beta.8 and react-aria 3.51.0,
 * each of which would cost behaviour or break the E2E contract:
 *
 * - `SegmentRoot` is a `ToggleButtonGroup` with `selectionMode: "single"`
 *   hardcoded and omitted from its prop type. React Aria's
 *   `useToggleButtonGroupItem` then sets `role="radio"` and `aria-checked` on
 *   every item, **deletes `aria-pressed`**, and turns the group into a
 *   `role="radiogroup"`. Unlike the menus batch, this cannot be re-emitted from
 *   the outside: `ToggleButton` builds its DOM props with
 *   `filterDOMProps(props, { global: true })`, which forwards only `id`,
 *   `dir`/`lang`/`hidden`/`inert`/`translate`, `data-*` and global events, so
 *   `role` and `aria-pressed` never reach the element — and it merges React
 *   Aria's `buttonProps` after them, so the radio role would win even if they
 *   did. The buttons below are toggle buttons inside a `fieldset`/`legend`:
 *   `messaging.spec.ts` asserts `aria-pressed` on `link-preview-style-rich`,
 *   and `appearance-previews.spec.ts` finds the current option with
 *   `button[aria-pressed="true"]`.
 * - `Segment.Item` renders its own `SelectionIndicator`, so the indicator
 *   becomes one node per option, mounted only while that option is selected and
 *   moved by `SharedElement`'s FLIP pass (`element.style.translate` plus
 *   `getAnimations()`), not by a CSS transition. This control emits a single
 *   persistent sliding indicator under `indicatorTestId`, which
 *   `buzz-theme-screenshots.spec.ts` resolves as one element and asserts
 *   `transition-duration: 0.2s` and `transition-property: transform` on.
 * - `onPreviewChange` — the pointer-capture scrub that live-previews a value
 *   while dragging across the control, used by all four appearance settings —
 *   has no counterpart, and `ToggleButtonGroup`'s own press handling would
 *   fight the pointer capture.
 */
export function SegmentedControl<Value extends string>({
  className,
  indicatorTestId,
  legend,
  onPreviewChange,
  onValueChange,
  optionTestIdPrefix,
  options,
  size = "default",
  testId,
  value,
}: {
  className?: string;
  indicatorTestId?: string;
  legend: string;
  onPreviewChange?: (value: Value | null) => void;
  onValueChange: (value: Value) => void;
  optionTestIdPrefix: string;
  options: readonly SegmentOption<Value>[];
  size?: SegmentedControlSize;
  testId: string;
  value: Value;
}) {
  const [previewValue, setPreviewValue] = React.useState<Value | null>(null);
  const controlRef = React.useRef<HTMLFieldSetElement | null>(null);
  const activePointerIdRef = React.useRef<number | null>(null);
  const pointerStartXRef = React.useRef<number | null>(null);
  const pointerStartValueRef = React.useRef<Value | null>(null);
  const scrubValueRef = React.useRef<Value | null>(null);
  const skipPointerClickRef = React.useRef(false);
  const displayedValue = previewValue ?? value;
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === displayedValue),
  );

  const getValueAtPointer = React.useCallback(
    (element: HTMLFieldSetElement, clientX: number): Value => {
      const bounds = element.getBoundingClientRect();
      const position = Math.max(
        0,
        Math.min(bounds.width - 1, clientX - bounds.left),
      );
      const index = Math.min(
        options.length - 1,
        Math.floor((position / bounds.width) * options.length),
      );
      return options[index]?.value ?? value;
    },
    [options, value],
  );

  const preview = React.useCallback(
    (nextValue: Value | null) => {
      scrubValueRef.current = nextValue;
      setPreviewValue(nextValue);
      onPreviewChange?.(nextValue);
    },
    [onPreviewChange],
  );

  const cancelScrub = React.useCallback(() => {
    const control = controlRef.current;
    const pointerId = activePointerIdRef.current;
    activePointerIdRef.current = null;
    if (control && pointerId != null && control.hasPointerCapture(pointerId)) {
      control.releasePointerCapture(pointerId);
    }
    pointerStartXRef.current = null;
    pointerStartValueRef.current = null;
    skipPointerClickRef.current = false;
    preview(null);
  }, [preview]);

  React.useEffect(() => {
    const handleWindowBlur = () => cancelScrub();
    globalThis.addEventListener?.("blur", handleWindowBlur);
    return () => {
      globalThis.removeEventListener?.("blur", handleWindowBlur);
      cancelScrub();
    };
  }, [cancelScrub]);

  const handlePointerDown = (
    event: React.PointerEvent<HTMLFieldSetElement>,
  ) => {
    if (!onPreviewChange || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointerIdRef.current = event.pointerId;
    pointerStartXRef.current = event.clientX;
    pointerStartValueRef.current = getValueAtPointer(
      event.currentTarget,
      event.clientX,
    );
    scrubValueRef.current = null;
    skipPointerClickRef.current = true;
    event.preventDefault();
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLFieldSetElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const nextValue = getValueAtPointer(event.currentTarget, event.clientX);
    const pointerStartX = pointerStartXRef.current;
    const pointerStartValue = pointerStartValueRef.current;
    const crossedDragThreshold =
      pointerStartX != null && Math.abs(event.clientX - pointerStartX) >= 4;
    if (
      scrubValueRef.current == null &&
      !crossedDragThreshold &&
      nextValue === pointerStartValue
    ) {
      return;
    }
    if (nextValue !== scrubValueRef.current) preview(nextValue);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLFieldSetElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const nextValue = getValueAtPointer(event.currentTarget, event.clientX);
    activePointerIdRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    pointerStartXRef.current = null;
    pointerStartValueRef.current = null;
    onValueChange(nextValue);
    preview(null);
    globalThis.setTimeout(() => {
      skipPointerClickRef.current = false;
    }, 0);
  };

  const handlePointerCancel = () => cancelScrub();

  const handleLostPointerCapture = () => {
    if (activePointerIdRef.current != null) cancelScrub();
  };

  return (
    <fieldset
      className={cn(
        "relative isolate h-8 max-w-full shrink-0 overflow-hidden rounded-md bg-muted/45 p-0.5",
        SIZE_CLASSES[size],
        onPreviewChange && "touch-none select-none cursor-ew-resize",
        className,
      )}
      data-slot="segmented-control"
      data-testid={testId}
      onLostPointerCapture={handleLostPointerCapture}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      ref={controlRef}
    >
      <legend className="sr-only">{legend}</legend>
      <div
        aria-hidden="true"
        className={cn(
          "absolute bottom-0.5 left-0.5 top-0.5 z-0 rounded-md bg-background shadow-sm transition-transform duration-200 ease-in-out motion-reduce:transition-none",
          previewValue && "duration-0",
        )}
        data-testid={indicatorTestId ?? `${testId}-indicator`}
        style={{
          transform: `translateX(${selectedIndex * 100}%)`,
          width: `calc((100% - 0.25rem) / ${options.length})`,
        }}
      />
      {/* Legends escape grid/flex layout on a fieldset, so the columns live
          on an inner wrapper the legend is not part of. */}
      <div className="grid h-full auto-cols-fr grid-flow-col">
        {options.map(({ value: optionValue, label, Icon }) => (
          <button
            aria-pressed={value === optionValue}
            className={cn(
              "relative z-10 flex h-full items-center justify-center gap-1.5 rounded-md bg-transparent px-2.5 text-xs font-medium transition-colors duration-150 ease-out focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
              displayedValue === optionValue
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`${optionTestIdPrefix}-${optionValue}`}
            key={optionValue}
            onClick={(event) => {
              if (event.detail > 0 && skipPointerClickRef.current) {
                skipPointerClickRef.current = false;
                return;
              }
              onValueChange(optionValue);
            }}
            type="button"
          >
            {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
            {label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
