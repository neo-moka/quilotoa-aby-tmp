import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

// The store is the panel's back button: `AgentActivityPanel` reads it to pick
// between the runs list and one agent's transcript. These tests drive it
// headlessly through the non-React accessors — `useAgentRunPanelView` is a thin
// `useSyncExternalStore` over exactly the pair exercised below.

import {
  getAgentRunPanelView,
  resetAgentRunPanelStore,
  showAgentRunDetail,
  showAgentRunsList,
  subscribeAgentRunPanelView,
} from "./agentRunPanelStore.ts";

/** Collects notifications for the life of one test. */
function watch() {
  const calls = { count: 0 };
  calls.unsubscribe = subscribeAgentRunPanelView(() => {
    calls.count += 1;
  });
  return calls;
}

describe("agentRunPanelStore", () => {
  beforeEach(() => {
    resetAgentRunPanelStore();
  });

  it("defaults to the runs list", () => {
    assert.equal(getAgentRunPanelView(), "runs");
  });

  it("moves to detail and back", () => {
    showAgentRunDetail();
    assert.equal(getAgentRunPanelView(), "detail");

    showAgentRunsList();
    assert.equal(getAgentRunPanelView(), "runs");
  });

  it("notifies subscribers on a real transition", () => {
    const seen = watch();

    showAgentRunDetail();
    assert.equal(seen.count, 1);

    showAgentRunsList();
    assert.equal(seen.count, 2);

    seen.unsubscribe();
  });

  it("does not notify when the view does not move", () => {
    const seen = watch();

    // Already on "runs" — a repeated back press must not re-render every
    // subscriber for a state that did not change.
    showAgentRunsList();
    assert.equal(seen.count, 0);

    showAgentRunDetail();
    showAgentRunDetail();
    assert.equal(seen.count, 1);

    seen.unsubscribe();
  });

  it("stops notifying after unsubscribe", () => {
    const seen = watch();
    seen.unsubscribe();

    showAgentRunDetail();
    assert.equal(seen.count, 0);
  });

  it("resets to the runs list on community switch", () => {
    showAgentRunDetail();
    resetAgentRunPanelStore();
    assert.equal(getAgentRunPanelView(), "runs");
  });

  it("notifies on reset even when already showing the runs list", () => {
    const seen = watch();

    // Unconditional by design: a community switch tears down the whole
    // community-scoped subtree, and a subscriber already on "runs" still needs
    // the tick to re-read everything that changed alongside it.
    resetAgentRunPanelStore();
    assert.equal(seen.count, 1);

    seen.unsubscribe();
  });
});
