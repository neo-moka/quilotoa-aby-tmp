import assert from "node:assert/strict";
import test from "node:test";

import {
  CHANNEL_VIEW_TABS,
  getChannelViewTab,
  resetChannelViewTabStore,
  setChannelViewTab,
} from "./channelViewTabStore.ts";

const CHANNEL_A = "channel-a";
const CHANNEL_B = "channel-b";

test("a channel with no stored tab reads as the conversation", () => {
  resetChannelViewTabStore();
  assert.equal(getChannelViewTab(CHANNEL_A), "all");
});

test("a null channel reads as the conversation", () => {
  resetChannelViewTabStore();
  assert.equal(getChannelViewTab(null), "all");
});

test("each channel keeps its own tab", () => {
  resetChannelViewTabStore();
  setChannelViewTab(CHANNEL_A, "work");
  setChannelViewTab(CHANNEL_B, "artifacts");

  assert.equal(getChannelViewTab(CHANNEL_A), "work");
  assert.equal(getChannelViewTab(CHANNEL_B), "artifacts");
});

test("returning to the conversation forgets the channel rather than storing the default", () => {
  resetChannelViewTabStore();
  setChannelViewTab(CHANNEL_A, "threads");
  setChannelViewTab(CHANNEL_A, "all");

  assert.equal(getChannelViewTab(CHANNEL_A), "all");
});

test("the reset used on community switch clears every channel", () => {
  resetChannelViewTabStore();
  setChannelViewTab(CHANNEL_A, "work");
  resetChannelViewTabStore();

  assert.equal(getChannelViewTab(CHANNEL_A), "all");
});

test("every declared tab round-trips", () => {
  resetChannelViewTabStore();
  for (const tab of CHANNEL_VIEW_TABS) {
    setChannelViewTab(CHANNEL_A, tab);
    assert.equal(getChannelViewTab(CHANNEL_A), tab);
  }
});
