import assert from "node:assert/strict";
import test from "node:test";

import { checkAnchors, collectEmitters } from "./check-testids-core.mjs";

/**
 * The two components that made anchors necessary. Both compile to the same
 * `/^channel-.+$/`, so plain coverage cannot tell them apart and deleting
 * either one leaves `channel-general` looking covered.
 */
const sidebarSection = {
  relativePath: "src/features/sidebar/ui/SidebarSection.tsx",
  content: [
    "export function ChannelRow({ channel }) {",
    "  return (",
    "    <SidebarMenuButton",
    "      data-testid={`channel-${channel.name}`}",
    "      isActive={isActive}",
    "    />",
    "  );",
    "}",
  ].join("\n"),
};

const searchResultItem = {
  relativePath: "src/features/search/ui/SearchResultItem.tsx",
  content: [
    "export function SearchResultItem({ channel }) {",
    '  return <li data-testid={`channel-${channel.id}`} />;',
    "}",
  ].join("\n"),
};

const topbarSearch = (tag) => ({
  relativePath: "src/features/search/ui/TopbarSearch.tsx",
  content: [
    "export function TopbarSearch() {",
    "  return (",
    `    <${tag}`,
    '      aria-label="Search everything"',
    '      data-testid="open-search"',
    "      onClick={open}",
    "    />",
    "  );",
    "}",
  ].join("\n"),
});

const CHANNEL_ANCHOR = {
  testId: "channel-${channel.name}",
  file: "src/features/sidebar/ui/SidebarSection.tsx",
  why: "sole emitter of the channel-<name> family",
};

const SEARCH_ANCHOR = {
  testId: "open-search",
  file: "src/features/search/ui/TopbarSearch.tsx",
  tag: "button",
  why: "queried with querySelector<HTMLButtonElement>(…)?.click()",
};

test("an anchored emitter that is still in place passes", () => {
  const files = [sidebarSection, searchResultItem, topbarSearch("button")];
  const failures = checkAnchors(
    [CHANNEL_ANCHOR, SEARCH_ANCHOR],
    collectEmitters(files),
    files,
  );

  assert.deepEqual(failures, []);
});

test("a dynamic emitter masked by an identical shape elsewhere still fails", () => {
  // `SearchResultItem` survives and keeps emitting `channel-${…}`, which is
  // exactly what let this deletion through before anchors existed.
  const files = [searchResultItem, topbarSearch("button")];
  const failures = checkAnchors(
    [CHANNEL_ANCHOR],
    collectEmitters(files),
    files,
  );

  assert.equal(failures.length, 1);
  assert.equal(failures[0].anchor.testId, "channel-${channel.name}");
  assert.match(failures[0].detail, /no longer emitted anywhere/);
});

test("an emitter that moved to another file reports where it went", () => {
  const moved = {
    relativePath: "src/features/sidebar/ui/ChannelRow.tsx",
    content: sidebarSection.content,
  };
  const files = [moved, searchResultItem];
  const failures = checkAnchors([CHANNEL_ANCHOR], collectEmitters(files), files);

  assert.equal(failures.length, 1);
  assert.match(failures[0].detail, /found at src\/features\/sidebar\/ui\/ChannelRow\.tsx:4/);
});

test("an anchored testid that changed element fails even though it is still emitted", () => {
  const files = [sidebarSection, topbarSearch("div")];
  const failures = checkAnchors([SEARCH_ANCHOR], collectEmitters(files), files);

  assert.equal(failures.length, 1);
  assert.equal(failures[0].anchor.testId, "open-search");
  assert.match(failures[0].detail, /emitted on <div>, not <button>/);
});

test("an anchor without a tag ignores the element it sits on", () => {
  const files = [sidebarSection, topbarSearch("div")];
  const { tag, ...untagged } = SEARCH_ANCHOR;
  const failures = checkAnchors([untagged], collectEmitters(files), files);

  assert.deepEqual(failures, []);
});
