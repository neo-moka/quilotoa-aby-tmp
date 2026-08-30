import type * as React from "react";
import * as BuzzTheme from "@/app/BuzzThemeSurfaces";
import { RightDock } from "@/features/dock/RightDock";
import { HuddleRoomHeader, HuddleStartingView } from "@/features/huddle";
import { MainInsetProvider } from "@/shared/layout/MainInsetContext";
import { chromeCssVarDefaults } from "@/shared/layout/chromeLayout";
import { cn } from "@/shared/lib/cn";
import { SidebarInset, useSidebar } from "@/shared/ui/sidebar";

type AppShellChannelSurfaceProps = {
  children: React.ReactNode;
  hasCommunityRail: boolean;
  isHuddleRoom: boolean;
  isHuddleRoomStarting: boolean;
  mainInsetRef: React.RefObject<HTMLElement | null>;
  terminal?: React.ReactNode;
};

export function AppShellChannelSurface({
  children,
  hasCommunityRail,
  isHuddleRoom,
  isHuddleRoomStarting,
  mainInsetRef,
  terminal,
}: AppShellChannelSurfaceProps) {
  const { isMobile, openMobile, state: sidebarState } = useSidebar();
  const hasCollapsedSidebarGutter =
    !isHuddleRoom &&
    !hasCommunityRail &&
    (isMobile ? !openMobile : sidebarState === "collapsed");

  return (
    <MainInsetProvider mainInsetRef={mainInsetRef}>
      <SidebarInset
        ref={mainInsetRef}
        className={cn(
          "isolate z-0 min-h-0 min-w-0 overflow-hidden",
          isHuddleRoom ? "bg-background" : "bg-sidebar",
          hasCollapsedSidebarGutter && "pl-2",
        )}
        data-buzz-content-surface={isHuddleRoom ? true : undefined}
        data-buzz-content-unframed={isHuddleRoom ? true : undefined}
        data-buzz-glass-inset
        data-buzz-shadow-viewport
        style={chromeCssVarDefaults as React.CSSProperties}
      >
        {hasCollapsedSidebarGutter ? (
          <div
            className="absolute inset-y-0 left-0 w-2 bg-sidebar"
            data-collapsed-content-gutter
          />
        ) : null}
        {isHuddleRoom && !isHuddleRoomStarting ? <HuddleRoomHeader /> : null}
        {/* The dock is a sibling card on the sidebar-colored shell — the
            same pod grammar as the content card — not a column inside it. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-row">
          <BuzzTheme.ContentSurface terminal={terminal} unframed={isHuddleRoom}>
            {isHuddleRoomStarting ? <HuddleStartingView /> : children}
          </BuzzTheme.ContentSurface>
          {isHuddleRoom ? null : <RightDock />}
        </div>
      </SidebarInset>
    </MainInsetProvider>
  );
}
