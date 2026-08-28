import * as React from "react";
import { Header } from "@heroui/react";
import { ContextMenu as HeroContextMenu } from "@heroui-pro/react";
import { mergeProps, mergeRefs } from "@react-aria/utils";
import { Check, Circle } from "lucide-react";

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
 * Radix-shaped surface over HeroUI Pro's `ContextMenu`, mirroring
 * `dropdown-menu.tsx` — same role mapping, same `onSelect` semantics, same
 * split between popover and menu. Two things are specific to this one:
 *
 * - **The trigger keeps being the caller's element.** Pro's trigger renders a
 *   positioned `<div>` of its own, which would slip an extra box between the
 *   sidebar's `<ul>` and its rows. Its `render` prop is HeroUI's answer to
 *   `asChild`, so the caller's element takes the handlers instead, and gets
 *   `relative` because Pro anchors the popover to a zero-sized child.
 * - **Open state is held here.** Pro's root exposes no imperative close, so the
 *   surface controls it and hands `close()` to items that need to close after
 *   an `onSelect` that did not prevent the default.
 */

type ContextMenuContextValue = {
  close: () => void;
  isOpen: boolean;
};

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(
  null,
);

const useContextMenuClose = () => {
  const context = React.useContext(ContextMenuContext);
  return React.useCallback(() => {
    context?.close();
  }, [context]);
};

type ContextMenuProps = {
  children?: React.ReactNode;
  /** Radix-only. React Aria hides outside content from assistive tech while an
   * overlay is open regardless; accepted so call sites keep compiling. */
  modal?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const ContextMenu = ({ children, onOpenChange }: ContextMenuProps) => {
  const [open, setOpen] = React.useState(false);

  const handleOpenChange = React.useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      onOpenChange?.(isOpen);
    },
    [onOpenChange],
  );

  const context = React.useMemo<ContextMenuContextValue>(
    () => ({ close: () => handleOpenChange(false), isOpen: open }),
    [handleOpenChange, open],
  );

  return (
    <ContextMenuContext.Provider value={context}>
      <HeroContextMenu onOpenChange={handleOpenChange} open={open}>
        {children}
      </HeroContextMenu>
    </ContextMenuContext.Provider>
  );
};
ContextMenu.displayName = "ContextMenu";

type ContextMenuTriggerChild = React.ReactElement<{
  [prop: string]: unknown;
  children?: React.ReactNode;
  className?: string;
  ref?: React.Ref<HTMLElement>;
}>;

type ContextMenuTriggerProps = {
  /** Props injected by a wrapping `asChild` parent, which Radix used to pass
   * down the tree. */
  [prop: string]: unknown;
  asChild?: boolean;
  children: React.ReactNode;
  className?: string;
};

const ContextMenuTrigger = ({
  asChild,
  children,
  className,
  ...forwarded
}: ContextMenuTriggerProps) => {
  const context = React.useContext(ContextMenuContext);
  // Radix marked the trigger with `data-state`; React Aria does not, and
  // trigger styles here depend on it.
  const dataState = context?.isOpen ? "open" : "closed";

  if (!asChild) {
    return (
      <HeroContextMenu.Trigger
        {...forwarded}
        className={className}
        data-state={dataState}
      >
        {children}
      </HeroContextMenu.Trigger>
    );
  }

  const child = React.Children.only(children) as ContextMenuTriggerChild;

  return (
    <HeroContextMenu.Trigger
      render={({ children: triggerChildren, ref, ...triggerProps }) => {
        // Pro appends a zero-sized anchor the popover positions against. It has
        // to travel into the caller's element, which then also has to be the
        // anchor's containing block.
        const [anchor] = React.Children.toArray(triggerChildren).slice(-1);

        return React.cloneElement(child, {
          ...mergeProps(child.props, triggerProps, forwarded),
          "data-state": dataState,
          children: (
            <>
              {child.props.children}
              {anchor}
            </>
          ),
          className: cn(child.props.className, "relative", className),
          ref: mergeRefs(child.props.ref, ref as React.Ref<HTMLElement>),
        });
      }}
    >
      {null}
    </HeroContextMenu.Trigger>
  );
};
ContextMenuTrigger.displayName = "ContextMenuTrigger";

type ContextMenuContentProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

const ContextMenuContent = ({
  children,
  className,
  style,
  ...props
}: ContextMenuContentProps) => (
  <HeroContextMenu.Popover
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
    <HeroContextMenu.Menu className={MENU_LIST_CLASS}>
      {children}
    </HeroContextMenu.Menu>
  </HeroContextMenu.Popover>
);
ContextMenuContent.displayName = "ContextMenuContent";

type ContextMenuItemProps = {
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

const ContextMenuItem = ({
  children,
  className,
  disabled,
  inset,
  onClick,
  onSelect,
  textValue,
  title,
  ...props
}: ContextMenuItemProps) => {
  const [ref, setNode] = useMenuItemNode(title);
  const close = useContextMenuClose();
  const resolvedTextValue = useTextValue(children, textValue);

  const handleAction = () => {
    const prevented = onSelect ? runSelectHandler(onSelect) : false;
    onClick?.(syntheticClick(ref.current));
    if (onSelect && !prevented) close();
  };

  return (
    <HeroContextMenu.Item
      className={cn(MENU_ITEM_CLASS, inset && "pl-8", className)}
      isDisabled={disabled}
      onAction={handleAction}
      ref={setNode}
      shouldCloseOnSelect={onSelect ? false : undefined}
      textValue={resolvedTextValue}
      {...props}
    >
      {children}
    </HeroContextMenu.Item>
  );
};
ContextMenuItem.displayName = "ContextMenuItem";

type ContextMenuCheckboxItemProps = {
  checked?: boolean;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  onSelect?: MenuSelectEventHandler;
  textValue?: string;
};

const ContextMenuCheckboxItem = ({
  checked = false,
  children,
  className,
  disabled,
  onCheckedChange,
  onSelect,
  textValue,
  ...props
}: ContextMenuCheckboxItemProps) => {
  const key = React.useId();
  const close = useContextMenuClose();
  const resolvedTextValue = useTextValue(children, textValue);

  // Its own single-item multiple-selection section: that is what makes React
  // Aria emit `menuitemcheckbox` here without touching the plain items around
  // it.
  return (
    <HeroContextMenu.Section
      onSelectionChange={(keys) => {
        if (keys === "all") return;
        onCheckedChange?.(keys.has(key));
      }}
      selectedKeys={checked ? [key] : []}
      selectionMode="multiple"
    >
      <HeroContextMenu.Item
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
          <HeroContextMenu.ItemIndicator>
            {({ isSelected }) =>
              isSelected ? <Check className="h-4 w-4" /> : <span />
            }
          </HeroContextMenu.ItemIndicator>
        </span>
        {children}
      </HeroContextMenu.Item>
    </HeroContextMenu.Section>
  );
};
ContextMenuCheckboxItem.displayName = "ContextMenuCheckboxItem";

type ContextMenuRadioGroupProps = {
  children?: React.ReactNode;
  className?: string;
  onValueChange?: (value: string) => void;
  value?: string;
};

const ContextMenuRadioGroup = ({
  children,
  className,
  onValueChange,
  value,
}: ContextMenuRadioGroupProps) => (
  <HeroContextMenu.Section
    className={className}
    onSelectionChange={(keys) => {
      if (keys === "all") return;
      const [selected] = keys;
      if (selected == null) return;
      onValueChange?.(String(selected));
    }}
    selectedKeys={value == null ? [] : [value]}
    selectionMode="single"
  >
    {children}
  </HeroContextMenu.Section>
);
ContextMenuRadioGroup.displayName = "ContextMenuRadioGroup";

type ContextMenuRadioItemProps = {
  "aria-label"?: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onSelect?: MenuSelectEventHandler;
  textValue?: string;
  value: string;
};

const ContextMenuRadioItem = ({
  children,
  className,
  disabled,
  onSelect,
  textValue,
  value,
  ...props
}: ContextMenuRadioItemProps) => {
  const close = useContextMenuClose();
  const resolvedTextValue = useTextValue(children, textValue);

  return (
    <HeroContextMenu.Item
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
        <HeroContextMenu.ItemIndicator type="dot">
          {({ isSelected }) =>
            isSelected ? <Circle className="h-2 w-2 fill-current" /> : <span />
          }
        </HeroContextMenu.ItemIndicator>
      </span>
      {children}
    </HeroContextMenu.Item>
  );
};
ContextMenuRadioItem.displayName = "ContextMenuRadioItem";

type ContextMenuLabelProps = {
  children?: React.ReactNode;
  className?: string;
  inset?: boolean;
};

const ContextMenuLabel = ({
  children,
  className,
  inset,
  ...props
}: ContextMenuLabelProps) => (
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
ContextMenuLabel.displayName = "ContextMenuLabel";

type ContextMenuSeparatorProps = {
  className?: string;
};

const ContextMenuSeparator = ({
  className,
  ...props
}: ContextMenuSeparatorProps) => (
  <HeroContextMenu.Separator
    className={cn("-mx-1 my-1 h-px w-auto bg-muted", className)}
    {...props}
  />
);
ContextMenuSeparator.displayName = "ContextMenuSeparator";

const ContextMenuShortcut = ({
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
ContextMenuShortcut.displayName = "ContextMenuShortcut";

type ContextMenuGroupProps = {
  children?: React.ReactNode;
  className?: string;
};

/** A section with no `selectionMode` inherits the surrounding one, so grouped
 * items keep the plain `menuitem` role. */
const ContextMenuGroup = ({ children, className }: ContextMenuGroupProps) => (
  <HeroContextMenu.Section className={className}>
    {children}
  </HeroContextMenu.Section>
);
ContextMenuGroup.displayName = "ContextMenuGroup";

/** React Aria portals overlays itself; kept so Radix-shaped trees still compile. */
const ContextMenuPortal = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);
ContextMenuPortal.displayName = "ContextMenuPortal";

const ContextMenuSub = ({ children }: { children?: React.ReactNode }) => (
  <HeroContextMenu.SubmenuTrigger>
    {
      // React Aria reads the trigger item and its popover positionally.
      React.Children.toArray(children) as [
        React.ReactElement,
        React.ReactElement,
      ]
    }
  </HeroContextMenu.SubmenuTrigger>
);
ContextMenuSub.displayName = "ContextMenuSub";

type ContextMenuSubTriggerProps = {
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  inset?: boolean;
  textValue?: string;
};

const ContextMenuSubTrigger = ({
  children,
  className,
  disabled,
  inset,
  textValue,
  ...props
}: ContextMenuSubTriggerProps) => {
  const resolvedTextValue = useTextValue(children, textValue);

  return (
    <HeroContextMenu.Item
      className={cn(MENU_SUB_TRIGGER_CLASS, inset && "pl-8", className)}
      isDisabled={disabled}
      textValue={resolvedTextValue}
      {...props}
    >
      {children}
      <HeroContextMenu.SubmenuIndicator className="ml-auto" />
    </HeroContextMenu.Item>
  );
};
ContextMenuSubTrigger.displayName = "ContextMenuSubTrigger";

type ContextMenuSubContentProps = {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

const ContextMenuSubContent = ({
  children,
  className,
  style,
  ...props
}: ContextMenuSubContentProps) => (
  <HeroContextMenu.Popover
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
    <HeroContextMenu.Menu className={MENU_LIST_CLASS}>
      {children}
    </HeroContextMenu.Menu>
  </HeroContextMenu.Popover>
);
ContextMenuSubContent.displayName = "ContextMenuSubContent";

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
