import { Tab, TabList, TabPanel, TabsRoot } from "@heroui/react/tabs";
import * as React from "react";

import { cn } from "@/shared/lib/cn";

/**
 * Tabs on HeroUI (React Aria) behind the Radix-shaped API the app already
 * uses: `value` / `defaultValue` / `onValueChange` on the root, `value` on
 * triggers and panels, `disabled` on triggers.
 *
 * Two React Aria traits force the shape of this file:
 *
 * 1. **Selection lives on the collection, not the item.** `Tabs.Root` owns
 *    `selectedKey`; a tab never declares its own selected state. The root
 *    below therefore mirrors `defaultValue` into state and always hands React
 *    Aria a `selectedKey`, which also keeps `useTabListState` from
 *    force-selecting a tab (it only does that when `selectedKey == null`) and
 *    firing `onValueChange` on mount.
 * 2. **`TabList` renders its collection, not its children.** React Aria
 *    discards anything in the list that is not a `Tab`, so the sliding
 *    indicators several call sites render inside `TabsList` would silently
 *    vanish. `TabsList` splits them out and re-inserts them through the
 *    `render` escape hatch, in the same box and the same DOM position as
 *    before.
 *
 * Radix emits `data-state="active" | "inactive"`; React Aria emits
 * `data-selected`. Both are kept: 15 `data-[state=active]:` class hooks and
 * the E2E suite read `data-state`.
 */

const TabsSelectionContext = React.createContext<string | null>(null);

type TabsProps = Omit<
  React.ComponentPropsWithoutRef<typeof TabsRoot>,
  "children" | "defaultSelectedKey" | "onSelectionChange" | "selectedKey"
> & {
  children: React.ReactNode;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  value?: string;
};

function Tabs({
  children,
  className,
  defaultValue,
  onValueChange,
  value,
  ...props
}: TabsProps) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] =
    React.useState(defaultValue);
  const selectedValue = isControlled ? value : uncontrolledValue;

  const handleSelectionChange = React.useCallback(
    (key: React.Key) => {
      const nextValue = String(key);
      if (!isControlled) setUncontrolledValue(nextValue);
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange],
  );

  return (
    <TabsSelectionContext.Provider value={selectedValue ?? null}>
      <TabsRoot
        // `block gap-0` neutralises HeroUI's `flex gap-2` base so call sites
        // that pass no layout class keep the block box Radix gave them.
        className={cn("block gap-0", className)}
        onSelectionChange={handleSelectionChange}
        selectedKey={selectedValue}
        {...props}
      >
        {children}
      </TabsRoot>
    </TabsSelectionContext.Provider>
  );
}

type TabsListProps = Omit<React.ComponentProps<typeof TabList>, "render">;

function TabsList({ children, className, ...props }: TabsListProps) {
  // Only `TabsTrigger` may reach React Aria's collection. Everything else —
  // in practice the hand-rolled sliding indicators — is rendered alongside it.
  // `Children.toArray` drops the empty slots and assigns the keys both lists
  // need; React Aria keys the collection off each tab's `id`, not its React
  // key, so the prefix it adds is harmless.
  const allChildren = React.Children.toArray(children);
  const isTab = (child: React.ReactNode) =>
    React.isValidElement(child) && child.type === TabsTrigger;
  const tabs = allChildren.filter(isTab);
  const decorations = allChildren.filter((child) => !isTab(child));

  return (
    <TabList
      className={cn(
        // `min-w-0` neutralises HeroUI's `min-w-full` on horizontal lists.
        "inline-flex h-9 min-w-0 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
      render={({ children: renderedTabs, ...listProps }) => (
        <div {...listProps}>
          {decorations}
          {renderedTabs}
        </div>
      )}
      {...props}
    >
      {tabs}
    </TabList>
  );
}

type TabsTriggerProps = Omit<
  React.ComponentProps<typeof Tab>,
  "id" | "render"
> & {
  "aria-current"?: React.AriaAttributes["aria-current"];
  disabled?: boolean;
  title?: string;
  value: string;
};

function TabsTrigger({
  "aria-current": ariaCurrent,
  className,
  disabled,
  title,
  value,
  ...props
}: TabsTriggerProps) {
  const selectedValue = React.useContext(TabsSelectionContext);

  // React Aria's `filterDOMProps` only lets `id`, `data-*`, the labelling
  // ARIA attributes and a short global list reach the DOM, so attributes
  // Radix forwarded verbatim would disappear without a sound. Re-apply them
  // on the element React Aria renders.
  const passthrough =
    ariaCurrent != null || title != null
      ? { "aria-current": ariaCurrent, title }
      : undefined;

  return (
    <Tab
      className={cn(
        // `h-auto w-auto` and the explicit text colour neutralise HeroUI's
        // `h-8 w-full text-muted` base — `--muted` is a surface token in this
        // app, so inheriting it would paint the label the colour of its own
        // background.
        "inline-flex h-auto w-auto items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium text-muted-foreground ring-offset-background transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
        className,
      )}
      data-state={selectedValue === value ? "active" : "inactive"}
      id={value}
      isDisabled={disabled}
      render={
        passthrough
          ? // React Aria types the render props for `div | a` because a tab
            // with an `href` renders an anchor. No call site passes one, so
            // the element is always a div.
            (domProps) => (
              <div
                {...(domProps as React.ComponentPropsWithRef<"div">)}
                {...passthrough}
              />
            )
          : undefined
      }
      {...props}
    />
  );
}

type TabsContentProps = Omit<React.ComponentProps<typeof TabPanel>, "id"> & {
  value: string;
};

function TabsContent({ className, value, ...props }: TabsContentProps) {
  return (
    <TabPanel
      // `p-0` neutralises HeroUI's `p-2` base; React Aria only mounts the
      // selected panel, so `data-state` is always "active" when it renders.
      className={cn(
        "mt-2 p-0 ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      data-state="active"
      id={value}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
