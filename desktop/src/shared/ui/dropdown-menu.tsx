import * as React from "react";
import { Dropdown, Header, Separator } from "@heroui/react";
import { mergeProps, mergeRefs } from "@react-aria/utils";
import { Check, Circle } from "lucide-react";
import { Pressable, RootMenuTriggerStateContext } from "react-aria-components";

import { cn } from "@/shared/lib/cn";
import type { MenuSelectEventHandler } from "@/shared/ui/menuCollection";
import {
  MENU_INDICATOR_SLOT_CLASS,
  MENU_ITEM_CLASS,
  MENU_LIST_CLASS,
  MENU_POPOVER_CLASS,
  MENU_POPOVER_MOTION_CLASS,
  MENU_POPOVER_SIDE_MOTION_CLASS,
  MENU_SELECTABLE_ITEM_CLASS,
  MENU_SUB_TRIGGER_CLASS,
  runSelectHandler,
  syntheticClick,
  useMenuItemNode,
  useTextValue,
} from "@/shared/ui/menuCollection";
import {
  POPOVER_SHADOW_STYLE,
  POPOVER_SURFACE_CLASS,
} from "@/shared/ui/popoverSurface";

/**
 * Radix-shaped surface over HeroUI's `Dropdown` (React Aria under the hood).
 *
 * The exported names, props and DOM contract match the Radix wrapper this
 * replaced, so the 50-odd call sites keep working unchanged. Three mappings are
 * load-bearing and easy to get wrong:
 *
 * 1. **Selection state belongs to the collection, not the item.** React Aria
 *    derives `menuitemradio` / `menuitemcheckbox` from the selection manager in
 *    scope. `selectionMode` therefore goes on a `Dropdown.Section` (see
 *    `DropdownMenuRadioGroup` / `DropdownMenuCheckboxItem`) and never on the
 *    root `Dropdown.Menu`, which would turn every plain item into a radio.
 * 2. **HeroUI splits the popover from the menu**, where Radix had one node.
 *    `DropdownMenuContent` renders both: consumer `className`/`data-*` land on
 *    the popover (the surface they style), `role="menu"` stays on the list.
 * 3. **`asChild` does not exist.** Triggers compose through React Aria's
 *    `Pressable`, which merges the press props into the caller's own element,
 *    so trigger markup and its `data-testid` are untouched.
 */

type Align = "center" | "end" | "start";
type Side = "bottom" | "left" | "right" | "top";
type MenuPlacement = NonNullable<
  React.ComponentProps<typeof Dropdown.Popover>["placement"]
>;

/** Radix positions with `side` + `align`; React Aria takes a single placement
 * string, where `center` alignment is the bare side. Its cross-axis names track
 * the axis rather than the writing direction, so a side menu aligns
 * top/bottom where Radix said start/end. */
const toPlacement = (side: Side, align: Align): MenuPlacement => {
  if (align === "center") return side;
  if (side === "left" || side === "right") {
    return `${side} ${align === "start" ? "top" : "bottom"}`;
  }
  return `${side} ${align}`;
};

const useMenuClose = () => {
  const state = React.useContext(RootMenuTriggerStateContext);
  return React.useCallback(() => {
    state?.close();
  }, [state]);
};

type CloseAutoFocusHandler = (event: Event) => void;

type DropdownMenuContextValue = {
  isModal: boolean;
  registerCloseAutoFocus: (handler: CloseAutoFocusHandler | undefined) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

const DropdownMenuContext =
  React.createContext<DropdownMenuContextValue | null>(null);

/**
 * Radix's `onCloseAutoFocus` has no React Aria counterpart: its `Overlay`
 * hard-codes `restoreFocus`. That restore is skipped when focus already sits
 * outside the popover's focus scope as it unmounts, so parking focus on the
 * trigger before the unmount suppresses it; the next frame releases the trigger
 * unless something else (a composer, a dialog) already claimed focus.
 */
const applyCloseAutoFocus = (
  trigger: HTMLElement | null,
  handler: CloseAutoFocusHandler | undefined,
) => {
  if (!handler) return;
  const event = new CustomEvent("buzz.menu.closeAutoFocus", {
    cancelable: true,
  });
  handler(event);
  if (!event.defaultPrevented || !trigger) return;
  trigger.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    if (document.activeElement === trigger) trigger.blur();
  });
};

type DropdownMenuProps = {
  children?: React.ReactNode;
  defaultOpen?: boolean;
  modal?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
};

const DropdownMenu = ({
  children,
  defaultOpen,
  modal = true,
  onOpenChange,
  open,
}: DropdownMenuProps) => {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const closeAutoFocusRef = React.useRef<CloseAutoFocusHandler | undefined>(
    undefined,
  );

  const registerCloseAutoFocus = React.useCallback(
    (handler: CloseAutoFocusHandler | undefined) => {
      closeAutoFocusRef.current = handler;
    },
    [],
  );

  const handleOpenChange = React.useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        applyCloseAutoFocus(triggerRef.current, closeAutoFocusRef.current);
      }
      onOpenChange?.(isOpen);
    },
    [onOpenChange],
  );

  const context = React.useMemo<DropdownMenuContextValue>(
    () => ({ isModal: modal, registerCloseAutoFocus, triggerRef }),
    [modal, registerCloseAutoFocus],
  );

  return (
    <DropdownMenuContext.Provider value={context}>
      <Dropdown
        defaultOpen={defaultOpen}
        isOpen={open}
        onOpenChange={handleOpenChange}
      >
        {children}
      </Dropdown>
    </DropdownMenuContext.Provider>
  );
};
DropdownMenu.displayName = "DropdownMenu";

type MenuTriggerChild = React.ReactElement<{
  [prop: string]: unknown;
  className?: string;
  ref?: React.Ref<HTMLElement>;
}>;

type DropdownMenuTriggerProps = {
  /** Props injected by a wrapping `asChild` parent — a tooltip trigger, say —
   * which Radix used to pass down the tree. */
  [prop: string]: unknown;
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
};

const DropdownMenuTrigger = ({
  asChild,
  children,
  className,
  ...forwarded
}: DropdownMenuTriggerProps) => {
  const context = React.useContext(DropdownMenuContext);
  const state = React.useContext(RootMenuTriggerStateContext);
  // Triggers style their open state with `data-[state=open]`, which Radix set
  // and React Aria does not. Re-emitting it keeps those classes — and the specs
  // that walk up to `[data-state]` — working.
  const dataState = state?.isOpen ? "open" : "closed";
  const { ref: forwardedRef, ...forwardedProps } = forwarded as {
    ref?: React.Ref<HTMLElement>;
  } & Record<string, unknown>;

  const element = children as MenuTriggerChild;
  const child = asChild ? (
    React.cloneElement(element, {
      ...mergeProps(element.props, forwardedProps),
      "data-state": dataState,
      ref: mergeRefs(element.props.ref, forwardedRef),
    })
  ) : (
    <button
      {...forwardedProps}
      className={className}
      data-state={dataState}
      ref={forwardedRef as React.Ref<HTMLButtonElement>}
      type="button"
    >
      {children}
    </button>
  );

  return <Pressable ref={context?.triggerRef}>{child}</Pressable>;
};
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

type DropdownMenuPanelProps = {
  children?: React.ReactNode;
  className?: string;
};

/**
 * Escape hatch for content that is not a menu item — a loading row, an error
 * message, an empty state. A React Aria menu is a collection: anything in it
 * that is not an item, section, separator or header silently drops the *whole*
 * collection, leaving an empty menu with no error. Panels are lifted out of the
 * menu and rendered directly in the popover, above it.
 */
const DropdownMenuPanel = ({ children, className }: DropdownMenuPanelProps) => (
  <div className={className}>{children}</div>
);
DropdownMenuPanel.displayName = "DropdownMenuPanel";

type DropdownMenuContentProps = {
  align?: Align;
  alignOffset?: number;
  children?: React.ReactNode;
  className?: string;
  /** Radix-only: React Aria mounts overlay content on demand. Accepted so call
   * sites keep compiling; the menu simply mounts when it opens. */
  forceMount?: boolean;
  onCloseAutoFocus?: CloseAutoFocusHandler;
  onTouchMoveCapture?: React.TouchEventHandler<HTMLDivElement>;
  onWheelCapture?: React.WheelEventHandler<HTMLDivElement>;
  side?: Side;
  sideOffset?: number;
  style?: React.CSSProperties;
};

const DropdownMenuContent = ({
  align = "center",
  alignOffset,
  children,
  className,
  forceMount: _forceMount,
  onCloseAutoFocus,
  side = "bottom",
  sideOffset = 4,
  style,
  ...props
}: DropdownMenuContentProps) => {
  const context = React.useContext(DropdownMenuContext);
  const registerCloseAutoFocus = context?.registerCloseAutoFocus;

  React.useEffect(() => {
    registerCloseAutoFocus?.(onCloseAutoFocus);
    return () => registerCloseAutoFocus?.(undefined);
  }, [onCloseAutoFocus, registerCloseAutoFocus]);

  const panels: React.ReactNode[] = [];
  const collection: React.ReactNode[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === DropdownMenuPanel) {
      panels.push(child);
    } else {
      collection.push(child);
    }
  });

  return (
    <Dropdown.Popover
      className={cn(
        MENU_POPOVER_CLASS,
        MENU_POPOVER_MOTION_CLASS,
        MENU_POPOVER_SIDE_MOTION_CLASS,
        POPOVER_SURFACE_CLASS,
        className,
        "min-w-60",
      )}
      crossOffset={alignOffset}
      data-state="open"
      isNonModal={context ? !context.isModal : undefined}
      offset={sideOffset}
      placement={toPlacement(side, align)}
      style={{ ...POPOVER_SHADOW_STYLE, ...style }}
      {...props}
    >
      {panels}
      <Dropdown.Menu className={MENU_LIST_CLASS}>{collection}</Dropdown.Menu>
    </Dropdown.Popover>
  );
};
DropdownMenuContent.displayName = "DropdownMenuContent";

type DropdownMenuItemProps = {
  "aria-label"?: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  inset?: boolean;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  onSelect?: MenuSelectEventHandler;
  textValue?: string;
  title?: string;
};

const DropdownMenuItem = ({
  children,
  className,
  disabled,
  inset,
  onClick,
  onSelect,
  textValue,
  title,
  ...props
}: DropdownMenuItemProps) => {
  const [ref, setNode] = useMenuItemNode(title);
  const close = useMenuClose();
  const resolvedTextValue = useTextValue(children, textValue);

  const handleAction = () => {
    const prevented = onSelect ? runSelectHandler(onSelect) : false;
    onClick?.(syntheticClick(ref.current));
    if (onSelect && !prevented) close();
  };

  return (
    <Dropdown.Item
      className={cn(MENU_ITEM_CLASS, inset && "pl-8", className)}
      isDisabled={disabled}
      onAction={handleAction}
      ref={setNode}
      shouldCloseOnSelect={onSelect ? false : undefined}
      textValue={resolvedTextValue}
      {...props}
    >
      {children}
    </Dropdown.Item>
  );
};
DropdownMenuItem.displayName = "DropdownMenuItem";

type DropdownMenuCheckboxItemProps = {
  checked?: boolean;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onSelect?: MenuSelectEventHandler;
  textValue?: string;
};

const DropdownMenuCheckboxItem = ({
  checked = false,
  children,
  className,
  disabled,
  onCheckedChange,
  onSelect,
  textValue,
  ...props
}: DropdownMenuCheckboxItemProps) => {
  const key = React.useId();
  const close = useMenuClose();
  const resolvedTextValue = useTextValue(children, textValue);

  // A checkbox item is its own single-item multiple-selection section: that is
  // what makes React Aria emit `menuitemcheckbox` for this item alone, without
  // touching the plain items around it.
  return (
    <Dropdown.Section
      onSelectionChange={(keys) => {
        if (keys === "all") return;
        onCheckedChange?.(keys.has(key));
      }}
      selectedKeys={checked ? [key] : []}
      selectionMode="multiple"
    >
      <Dropdown.Item
        className={cn(MENU_SELECTABLE_ITEM_CLASS, className)}
        id={key}
        isDisabled={disabled}
        onAction={() => {
          const prevented = onSelect ? runSelectHandler(onSelect) : false;
          if (!prevented) close();
        }}
        shouldCloseOnSelect={false}
        textValue={resolvedTextValue}
        {...props}
      >
        <span className={MENU_INDICATOR_SLOT_CLASS}>
          <Dropdown.ItemIndicator>
            {({ isSelected }) =>
              isSelected ? <Check className="h-4 w-4" /> : <span />
            }
          </Dropdown.ItemIndicator>
        </span>
        {children}
      </Dropdown.Item>
    </Dropdown.Section>
  );
};
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

type DropdownMenuRadioGroupProps = {
  children?: React.ReactNode;
  className?: string;
  onValueChange?: (value: string) => void;
  value?: string;
};

const DropdownMenuRadioGroup = ({
  children,
  className,
  onValueChange,
  value,
}: DropdownMenuRadioGroupProps) => (
  <Dropdown.Section
    className={className}
    onSelectionChange={(keys) => {
      if (keys === "all") return;
      const [selected] = keys;
      // React Aria allows deselecting the active radio; Radix never emitted an
      // empty value, so hold the current one instead.
      if (selected == null) return;
      onValueChange?.(String(selected));
    }}
    selectedKeys={value == null ? [] : [value]}
    selectionMode="single"
  >
    {children}
  </Dropdown.Section>
);
DropdownMenuRadioGroup.displayName = "DropdownMenuRadioGroup";

type DropdownMenuRadioItemProps = {
  "aria-label"?: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSelect?: MenuSelectEventHandler;
  textValue?: string;
  value: string;
};

const DropdownMenuRadioItem = ({
  children,
  className,
  disabled,
  onSelect,
  textValue,
  value,
  ...props
}: DropdownMenuRadioItemProps) => {
  const close = useMenuClose();
  const resolvedTextValue = useTextValue(children, textValue);

  return (
    <Dropdown.Item
      className={cn(MENU_SELECTABLE_ITEM_CLASS, className)}
      id={value}
      isDisabled={disabled}
      onAction={
        onSelect
          ? () => {
              if (!runSelectHandler(onSelect)) close();
            }
          : undefined
      }
      shouldCloseOnSelect={onSelect ? false : undefined}
      textValue={resolvedTextValue}
      {...props}
    >
      <span className={MENU_INDICATOR_SLOT_CLASS}>
        <Dropdown.ItemIndicator type="dot">
          {({ isSelected }) =>
            isSelected ? <Circle className="h-2 w-2 fill-current" /> : <span />
          }
        </Dropdown.ItemIndicator>
      </span>
      {children}
    </Dropdown.Item>
  );
};
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

type DropdownMenuLabelProps = {
  children?: React.ReactNode;
  className?: string;
  inset?: boolean;
};

const DropdownMenuLabel = ({
  children,
  className,
  inset,
  ...props
}: DropdownMenuLabelProps) => (
  <Header
    className={cn(
      "px-2 py-1.5 text-sm font-semibold",
      inset && "pl-8",
      className,
    )}
    {...props}
  >
    {children}
  </Header>
);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

type DropdownMenuSeparatorProps = {
  className?: string;
};

const DropdownMenuSeparator = ({
  className,
  ...props
}: DropdownMenuSeparatorProps) => (
  <Separator
    className={cn("-mx-1 my-1 h-px w-auto bg-muted", className)}
    {...props}
  />
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn("ml-auto text-xs tracking-widest opacity-60", className)}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = "DropdownMenuShortcut";

type DropdownMenuGroupProps = {
  children?: React.ReactNode;
  className?: string;
};

/** A section with no `selectionMode` inherits the surrounding one, so grouped
 * items keep the plain `menuitem` role. */
const DropdownMenuGroup = ({ children, className }: DropdownMenuGroupProps) => (
  <Dropdown.Section className={className}>{children}</Dropdown.Section>
);
DropdownMenuGroup.displayName = "DropdownMenuGroup";

/** React Aria portals overlays itself; kept so Radix-shaped trees still compile. */
const DropdownMenuPortal = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);
DropdownMenuPortal.displayName = "DropdownMenuPortal";

const DropdownMenuSub = ({ children }: { children?: React.ReactNode }) => (
  <Dropdown.SubmenuTrigger>
    {
      // React Aria reads the trigger item and its popover positionally.
      React.Children.toArray(children) as [
        React.ReactElement,
        React.ReactElement,
      ]
    }
  </Dropdown.SubmenuTrigger>
);
DropdownMenuSub.displayName = "DropdownMenuSub";

type DropdownMenuSubTriggerProps = {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  inset?: boolean;
  textValue?: string;
};

const DropdownMenuSubTrigger = ({
  children,
  className,
  disabled,
  inset,
  textValue,
  ...props
}: DropdownMenuSubTriggerProps) => {
  const resolvedTextValue = useTextValue(children, textValue);

  return (
    <Dropdown.Item
      className={cn(MENU_SUB_TRIGGER_CLASS, inset && "pl-8", className)}
      isDisabled={disabled}
      textValue={resolvedTextValue}
      {...props}
    >
      {children}
      <Dropdown.SubmenuIndicator className="ml-auto" />
    </Dropdown.Item>
  );
};
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

type DropdownMenuSubContentProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

const DropdownMenuSubContent = ({
  children,
  className,
  style,
  ...props
}: DropdownMenuSubContentProps) => (
  <Dropdown.Popover
    data-state="open"
    className={cn(
      MENU_POPOVER_CLASS,
      MENU_POPOVER_MOTION_CLASS,
      MENU_POPOVER_SIDE_MOTION_CLASS,
      POPOVER_SURFACE_CLASS,
      className,
      "min-w-60",
    )}
    style={{ ...POPOVER_SHADOW_STYLE, ...style }}
    {...props}
  >
    <Dropdown.Menu className={MENU_LIST_CLASS}>{children}</Dropdown.Menu>
  </Dropdown.Popover>
);
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPanel,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
