import * as React from "react";
import { ChevronLeft, ChevronRight, SquareTerminal } from "lucide-react";

import { toggleRightDock, useRightDock } from "@/features/dock/rightDockStore";
import { NotificationsBell } from "@/features/notifications/ui/NotificationsBell";
import {
  toggleTerminalPanel,
  useTerminalPanel,
} from "@/features/terminal/terminalPanelStore";
import { setTopChromeSearchSlot } from "@/shared/layout/topChromeSearchSlot";
import { isMacPlatform } from "@/shared/lib/platform";
import { useIsFullscreen } from "@/shared/lib/useIsFullscreen";
import { Button } from "@/shared/ui/button";
import { DrawerPanelIcon } from "@/shared/ui/DrawerPanelIcon";
import { cn } from "@/shared/lib/cn";
import { topChromeBackdrop } from "@/shared/layout/chromeLayout";
import { useOptionalSidebar } from "@/shared/ui/sidebar";

/**
 * Deliberately not `Navbar` from `@heroui-pro/react`, and the shell around it
 * deliberately not `AppLayout`. This row is not navigation: it is the Tauri
 * window title bar. It carries `data-tauri-drag-region` on specific nodes, pads
 * in fixed px to clear the macOS traffic lights, and exposes the
 * `#app-top-chrome-content` portal that `ProjectDetailChrome` centres against.
 * Pro's `Navbar` compound puts none of those on nodes we can reach, and a
 * `<nav>` landmark around window controls is worse a11y than the plain `div`.
 *
 * `AppLayout` is not a separate call: its docs state it renders a
 * `Sidebar.Provider` internally and forbid wrapping it in your own, so adopting
 * it means adopting Pro's `Sidebar` — whose `data-sidebar` vocabulary has an
 * empty intersection with the seven values `theme.css` styles against. See
 * `docs/heroui-migration/component-map.md` §6quinquies for the evidence.
 */
type AppTopChromeProps = {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  hasCommunityRail?: boolean;
  /** Active community, shown as the window's standing title. */
  communityName?: string | null;
  /**
   * Whether the terminal panel can open right now (it needs an active channel
   * plus identity/relay context). The trigger stays visible but disabled
   * without it, so the affordance is discoverable outside channels.
   */
  terminalAvailable?: boolean;
};

// Fixed px on purpose (button box + glyph): these controls sit beside the
// native macOS traffic lights, which ignore the app's Cmd +/- text zoom, so
// the row must not grow or shrink with the rem scale. Deliberate exception
// to the rem-first rule.
const TOP_CHROME_ICON_BUTTON_CLASS =
  "h-[28px] w-[28px] rounded-[4px] text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const HISTORY_ICON_BUTTON_CLASS =
  "h-[28px] w-[24px] rounded-[4px] text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&_svg]:size-[16px]";

function preventTopChromeWheel(event: WheelEvent) {
  event.preventDefault();
}

/**
 * The community's name, standing where a macOS document title would.
 *
 * The title bar spent most of its width as empty drag region, and the one
 * thing the app never said anywhere was which community the window is in —
 * the sidebar leads with search and the switcher lives in the footer menu.
 *
 * Hidden while a screen projects its own chrome into `#app-top-chrome-content`
 * (projects center a breadcrumb there); two titles in one strip read as two
 * apps. Watched with a MutationObserver because portals mount after this row.
 */
function useTopChromeContentPortalBusy() {
  const [portalBusy, setPortalBusy] = React.useState(false);

  React.useEffect(() => {
    const portal = document.getElementById("app-top-chrome-content");
    if (!portal) return;
    const update = () => setPortalBusy(portal.childElementCount > 0);
    update();
    const observer = new MutationObserver(update);
    observer.observe(portal, { childList: true });
    return () => observer.disconnect();
  }, []);

  return portalBusy;
}

function TopChromeCommunityLabel({ name }: { name: string }) {
  const portalBusy = useTopChromeContentPortalBusy();

  if (portalBusy) return null;

  return (
    <span
      className="ml-2 min-w-0 truncate text-sm font-semibold text-sidebar-foreground/80"
      data-tauri-drag-region
      data-testid="app-top-chrome-community"
    >
      {name}
    </span>
  );
}

/**
 * Centered mount point for the global search trigger. The sidebar owns the
 * search (channels, labels and navigation are wired there) and portals its
 * trigger here — see `AppSidebarPinnedHeader`. Hidden while a screen projects
 * its own chrome into `#app-top-chrome-content`, same rule as the community
 * label; `display: none` rather than unmount so the portal target survives.
 */
function TopChromeSearchSlot() {
  const portalBusy = useTopChromeContentPortalBusy();

  return (
    <div
      // True vertical center, deliberately without the macOS +3px nudge the
      // nav buttons carry: on a 32px pill the nudge reads as misalignment
      // (11px above vs 5px below), while a 3px delta against the small
      // controls is imperceptible.
      className={cn(
        "absolute left-1/2 top-1/2 z-10 w-[min(34rem,40vw)] -translate-x-1/2 -translate-y-1/2",
        portalBusy && "hidden",
      )}
      data-testid="top-chrome-search-slot"
      ref={setTopChromeSearchSlot}
    />
  );
}

/**
 * Right-edge counterpart of the sidebar trigger. It toggles the app-level
 * right dock (`features/dock`) — a standing column on every screen whose
 * default view is agent activity — so it is never gated on a channel.
 */
function TopChromeRightPanelTrigger() {
  const dock = useRightDock();

  return (
    <Button
      aria-label="Toggle Right Dock"
      aria-pressed={dock.open}
      className={TOP_CHROME_ICON_BUTTON_CLASS}
      data-testid="top-chrome-right-panel-trigger"
      onClick={() => toggleRightDock()}
      size="icon"
      type="button"
      variant="ghost"
    >
      <DrawerPanelIcon edge="right" open={dock.open} />
      <span className="sr-only">Toggle Right Dock</span>
    </Button>
  );
}

function TopChromeTerminalTrigger({ available }: { available: boolean }) {
  const panel = useTerminalPanel();
  const isOpen = panel.mode !== "closed";

  return (
    <Button
      aria-label="Toggle Terminal"
      aria-pressed={isOpen}
      className={cn(
        TOP_CHROME_ICON_BUTTON_CLASS,
        isOpen && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
      data-testid="top-chrome-terminal-trigger"
      disabled={!available}
      onClick={() => toggleTerminalPanel()}
      size="icon"
      type="button"
      variant="ghost"
    >
      <SquareTerminal className="size-[16px]" />
      <span className="sr-only">Toggle Terminal</span>
    </Button>
  );
}

function TopChromeSidebarTrigger() {
  const sidebar = useOptionalSidebar();

  return (
    <Button
      aria-label="Toggle Sidebar"
      className={TOP_CHROME_ICON_BUTTON_CLASS}
      data-sidebar="trigger"
      disabled={!sidebar}
      onClick={() => {
        sidebar?.toggleSidebar();
      }}
      size="icon"
      type="button"
      variant="ghost"
    >
      <DrawerPanelIcon open={sidebar?.open ?? false} />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
}

export function AppTopChrome({
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  hasCommunityRail = false,
  communityName = null,
  terminalAvailable = false,
}: AppTopChromeProps) {
  const topChromeRef = React.useRef<HTMLDivElement>(null);
  const isFullscreen = useIsFullscreen();
  // On macOS the traffic-light buttons overlay the chrome (see
  // `trafficLightPosition` in `tauri.conf.json`), so the nav row clears their
  // x-position. When the community rail is present it already occupies the far
  // left, so the nav row only needs to clear the lights past the rail edge
  // rather than the full offset. In fullscreen those buttons hide.
  //
  // Fixed px on purpose: the native traffic lights do not scale with the app's
  // Cmd +/- text zoom (rem), so rem-based clearance shrinks under them when
  // zoomed out. This is a deliberate exception to the rem-first rule.
  const macChrome = isMacPlatform() && !isFullscreen;
  const navRowPaddingClass = macChrome
    ? hasCommunityRail
      ? "pl-[32px]"
      : "pl-[80px]"
    : "pl-3";
  const navRowAlignmentClass = macChrome ? "translate-y-[3px]" : null;

  React.useLayoutEffect(() => {
    const topChrome = topChromeRef.current;
    const portalTarget = topChrome?.querySelector<HTMLElement>(
      "#app-top-chrome-content",
    );
    if (!topChrome || !portalTarget) return;

    const updateCenterOffset = () => {
      const portalBounds = portalTarget.getBoundingClientRect();
      const portalCenter = portalBounds.left + portalBounds.width / 2;
      topChrome.style.setProperty(
        "--app-top-chrome-center-offset",
        `${window.innerWidth / 2 - portalCenter}px`,
      );
    };

    updateCenterOffset();
    const observer = new ResizeObserver(updateCenterOffset);
    observer.observe(topChrome);
    observer.observe(portalTarget);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const topChrome = topChromeRef.current;
    if (!topChrome) {
      return;
    }

    const options = { capture: true, passive: false };
    topChrome.addEventListener("wheel", preventTopChromeWheel, options);
    return () => {
      topChrome.removeEventListener("wheel", preventTopChromeWheel, options);
    };
  }, []);

  return (
    <div
      ref={topChromeRef}
      className={cn(
        "relative z-45 flex shrink-0 cursor-default select-none items-center bg-sidebar pr-3 text-sidebar-foreground",
        topChromeBackdrop.height,
        navRowPaddingClass,
      )}
      data-tauri-drag-region
      data-testid="app-top-chrome"
      style={
        {
          "--app-top-chrome-center-offset": "0px",
        } as React.CSSProperties
      }
    >
      <div className={cn("flex items-center gap-0.5", navRowAlignmentClass)}>
        <TopChromeSidebarTrigger />
        <Button
          aria-label="Go back"
          className={HISTORY_ICON_BUTTON_CLASS}
          data-testid="global-back"
          disabled={!canGoBack}
          onClick={onGoBack}
          size="icon"
          variant="ghost"
        >
          <ChevronLeft />
        </Button>
        <Button
          aria-label="Go forward"
          className={HISTORY_ICON_BUTTON_CLASS}
          data-testid="global-forward"
          disabled={!canGoForward}
          onClick={onGoForward}
          size="icon"
          variant="ghost"
        >
          <ChevronRight />
        </Button>
        {communityName ? (
          <TopChromeCommunityLabel name={communityName} />
        ) : null}
      </div>
      <div
        className={cn("flex min-w-0 flex-1 items-center", navRowAlignmentClass)}
        data-tauri-drag-region
        id="app-top-chrome-content"
      />
      <TopChromeSearchSlot />
      <div className={cn("flex items-center gap-0.5", navRowAlignmentClass)}>
        <NotificationsBell triggerClassName={TOP_CHROME_ICON_BUTTON_CLASS} />
        <TopChromeTerminalTrigger available={terminalAvailable} />
        <TopChromeRightPanelTrigger />
      </div>
    </div>
  );
}
