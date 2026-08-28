import * as React from "react";

/**
 * Shared pieces of the two Radix-shaped menu surfaces built on HeroUI —
 * `dropdown-menu.tsx` (OSS `Dropdown`) and `context-menu.tsx` (Pro
 * `ContextMenu`). Both render React Aria collections, so they need the same
 * translations for props React Aria does not have.
 */

export const MENU_ITEM_CLASS =
  "relative flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg py-2 pl-2 pr-4 text-sm outline-hidden transition-colors data-[focused]:bg-muted/50 data-[focused]:text-foreground data-[hovered]:bg-muted/50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0";

export const MENU_SELECTABLE_ITEM_CLASS =
  "relative flex min-h-9 cursor-default select-none items-center rounded-lg py-2 pl-8 pr-4 text-sm outline-hidden transition-colors data-[focused]:bg-muted/50 data-[focused]:text-foreground data-[hovered]:bg-muted/50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

export const MENU_SUB_TRIGGER_CLASS =
  "flex min-h-9 cursor-default select-none items-center gap-2 rounded-lg py-2 pl-2 pr-4 text-sm outline-hidden data-[focused]:bg-muted/50 data-[hovered]:bg-muted/50 data-[open]:bg-muted/50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * React Aria reports popover lifecycle through `data-entering` / `data-exiting`
 * and its side through `data-placement`, where Radix used `data-state` and
 * `data-side`. Same motion, different attribute names.
 */
export const MENU_POPOVER_MOTION_CLASS =
  "duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] data-[exiting]:duration-100 data-[entering]:animate-in data-[exiting]:animate-out data-[exiting]:fade-out-0 data-[entering]:fade-in-0 data-[exiting]:zoom-out-95 data-[entering]:zoom-in-95 motion-reduce:animate-none";

export const MENU_POPOVER_SIDE_MOTION_CLASS =
  "data-[placement=bottom]:slide-in-from-top-1 data-[placement=left]:slide-in-from-right-1 data-[placement=right]:slide-in-from-left-1 data-[placement=top]:slide-in-from-bottom-1";

/** Padding lives on the menu list, which is the node HeroUI pads. */
export const MENU_POPOVER_CLASS =
  "z-50 overflow-y-auto overflow-x-hidden rounded-xl p-0";

export const MENU_LIST_CLASS = "gap-0 p-1";

export const MENU_INDICATOR_SLOT_CLASS =
  "absolute left-2 flex h-3.5 w-3.5 items-center justify-center";

export type MenuSelectEventHandler = (event: Event) => void;

/**
 * Radix items decide whether the menu closes by preventing the default of the
 * `onSelect` event. React Aria decides it up front through
 * `shouldCloseOnSelect`, so the surfaces run the handler against a cancelable
 * event and close by hand when it was not prevented.
 */
export const runSelectHandler = (onSelect: MenuSelectEventHandler) => {
  const event = new CustomEvent("buzz.menu.select", { cancelable: true });
  onSelect(event);
  return event.defaultPrevented;
};

/**
 * Radix items receive a real DOM click; React Aria routes activation through
 * `onAction`, which carries no event. Callers only read `currentTarget`, so a
 * minimal stand-in keeps their signature intact.
 */
export const syntheticClick = (node: HTMLElement | null) =>
  ({
    bubbles: true,
    cancelable: true,
    currentTarget: node,
    defaultPrevented: false,
    isDefaultPrevented: () => false,
    isPropagationStopped: () => false,
    preventDefault: () => {},
    stopPropagation: () => {},
    target: node,
    type: "click",
  }) as unknown as React.MouseEvent<HTMLDivElement>;

/**
 * Collect the text of an item so typeahead keeps working for items built out of
 * icons and elements. React Aria only derives it automatically when the
 * children are plain text.
 */
export const deriveTextValue = (node: React.ReactNode): string => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) {
    return node
      .map((child) => deriveTextValue(child as React.ReactNode))
      .filter(Boolean)
      .join(" ");
  }
  if (React.isValidElement(node)) {
    const { children } = node.props as { children?: React.ReactNode };
    return deriveTextValue(children);
  }
  return "";
};

/**
 * A menu item's DOM node, plus the `title` React Aria drops on the way in — the
 * native tooltip items use to explain why an action is disabled. A callback ref
 * rather than an effect: the collection renders the item element after the
 * surrounding component's effects have already run, so an effect would only ever
 * see a null ref.
 */
export const useMenuItemNode = (title?: string) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const setNode = React.useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      if (!node) return;
      if (title == null) node.removeAttribute("title");
      else node.setAttribute("title", title);
    },
    [title],
  );

  return [ref, setNode] as const;
};

export const useTextValue = (children: React.ReactNode, textValue?: string) =>
  React.useMemo(
    () => textValue ?? (deriveTextValue(children).trim() || undefined),
    [children, textValue],
  );
