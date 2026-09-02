import assert from "node:assert/strict";
import test from "node:test";

import {
  filterMcpTools,
  mcpToolBadges,
  parseToolArguments,
} from "./mcpToolsPanel.ts";

const TOOLS = [
  {
    name: "notion-search",
    title: "Search Notion",
    description: "Search the workspace",
    inputCount: 10,
    annotations: {
      readOnlyHint: true,
      destructiveHint: null,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
  {
    name: "notion-update-page",
    title: null,
    description: null,
    inputCount: 15,
    annotations: {
      readOnlyHint: null,
      destructiveHint: true,
      idempotentHint: null,
      openWorldHint: null,
    },
  },
];

test("filter matches name, title, and description, case-insensitive", () => {
  assert.equal(filterMcpTools(TOOLS, "").length, 2);
  assert.equal(filterMcpTools(TOOLS, "SEARCH")[0].name, "notion-search");
  assert.equal(filterMcpTools(TOOLS, "workspace").length, 1);
  assert.equal(filterMcpTools(TOOLS, "update-page").length, 1);
  assert.equal(filterMcpTools(TOOLS, "nope").length, 0);
});

test("badges come only from explicit true hints", () => {
  const search = mcpToolBadges(TOOLS[0].annotations).map((b) => b.label);
  assert.deepEqual(search, [
    "Read-only hint",
    "Idempotent hint",
    "External access hint",
  ]);
  const update = mcpToolBadges(TOOLS[1].annotations);
  assert.deepEqual(update, [
    { label: "Destructive hint", tone: "destructive" },
  ]);
});

test("argument parsing: empty is {}, junk and non-objects are errors", () => {
  assert.deepEqual(parseToolArguments("  "), { args: {} });
  assert.deepEqual(parseToolArguments('{"q": "zapatos"}'), {
    args: { q: "zapatos" },
  });
  assert.ok(parseToolArguments("{oops").error);
  assert.ok(parseToolArguments("[1,2]").error);
  assert.ok(parseToolArguments('"text"').error);
});
