import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  getSidebarViewSnapshot,
  resetSidebarViewStore,
  setSidebarView,
  SIDEBAR_VIEWS,
  subscribeSidebarView,
} from "./sidebarViewStore.ts";

beforeEach(() => {
  resetSidebarViewStore();
});

describe("SIDEBAR_VIEWS", () => {
  it("leads with the overview so the default tab is the first one", () => {
    assert.equal(SIDEBAR_VIEWS[0].id, "now");
    assert.deepEqual(
      SIDEBAR_VIEWS.map((view) => view.id),
      ["now", "rooms", "people"],
    );
  });
});

describe("sidebarViewStore", () => {
  it("defaults to the overview", () => {
    assert.equal(getSidebarViewSnapshot(), "now");
  });

  it("publishes a change to subscribers", () => {
    let notifications = 0;
    const unsubscribe = subscribeSidebarView(() => {
      notifications += 1;
    });

    setSidebarView("rooms");

    assert.equal(getSidebarViewSnapshot(), "rooms");
    assert.equal(notifications, 1);
    unsubscribe();
  });

  it("does not notify when the selected view is unchanged", () => {
    setSidebarView("people");
    let notifications = 0;
    const unsubscribe = subscribeSidebarView(() => {
      notifications += 1;
    });

    setSidebarView("people");

    assert.equal(notifications, 0);
    unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    let notifications = 0;
    const unsubscribe = subscribeSidebarView(() => {
      notifications += 1;
    });
    unsubscribe();

    setSidebarView("rooms");

    assert.equal(notifications, 0);
  });

  it("returns an identical snapshot between changes so useSyncExternalStore settles", () => {
    setSidebarView("rooms");
    assert.equal(getSidebarViewSnapshot(), getSidebarViewSnapshot());
  });

  it("resets to the overview and tells subscribers", () => {
    setSidebarView("people");
    let notifications = 0;
    const unsubscribe = subscribeSidebarView(() => {
      notifications += 1;
    });

    resetSidebarViewStore();

    assert.equal(getSidebarViewSnapshot(), "now");
    assert.equal(notifications, 1);
    unsubscribe();
  });
});
