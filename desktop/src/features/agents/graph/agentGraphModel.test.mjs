import assert from "node:assert/strict";
import test from "node:test";

import { buildAgentGraphModel, edgesForNode } from "./agentGraphModel.ts";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);
const VIEWER = "d".repeat(64);

const roster = [
  { pubkey: A, name: "Aby", avatarUrl: "https://x/aby.png" },
  { pubkey: B, name: "Jenny", avatarUrl: null },
  { pubkey: C, name: "Sasha" },
];
const viewer = { pubkey: VIEWER, name: "You" };

function msg(id, from, tags, at, content = `message ${id}`) {
  return { id, pubkey: from, created_at: at, content, tags };
}

test("mentions become directed edges and tally node totals", () => {
  const model = buildAgentGraphModel({
    roster,
    viewer,
    events: [
      msg("1", A, [["p", B]], 100),
      msg("2", A, [["p", B]], 200),
      msg("3", B, [["p", A]], 300),
    ],
  });

  assert.equal(model.edges.length, 2);
  const ab = model.edges.find((e) => e.from === A && e.to === B);
  assert.equal(ab.count, 2);
  assert.equal(ab.lastAt, 200);
  const ba = model.edges.find((e) => e.from === B && e.to === A);
  assert.equal(ba.count, 1);
  assert.equal(model.lastAt, 300);

  const aby = model.nodes.find((n) => n.pubkey === A);
  assert.equal(aby.sent, 2);
  assert.equal(aby.received, 1);
});

test("a reply e-tag marks the pass as a dependency", () => {
  const model = buildAgentGraphModel({
    roster,
    viewer,
    events: [
      msg("1", A, [["p", B]], 100),
      msg(
        "2",
        A,
        [
          ["p", B],
          ["e", "f".repeat(64)],
        ],
        200,
      ),
    ],
  });
  const ab = model.edges[0];
  assert.equal(ab.count, 2);
  assert.equal(ab.replyCount, 1);
  assert.equal(ab.recent[0].isReply, true);
  assert.equal(ab.recent[1].isReply, false);
});

test("one message mentioning two nodes creates two edges", () => {
  const model = buildAgentGraphModel({
    roster,
    viewer,
    events: [
      msg(
        "1",
        C,
        [
          ["p", A],
          ["p", B],
          ["h", "chan-1"],
        ],
        100,
      ),
    ],
  });
  assert.equal(model.edges.length, 2);
  assert.equal(model.edges[0].recent[0].channelId, "chan-1");
});

test("authors and mentions outside the roster are ignored", () => {
  const stranger = "9".repeat(64);
  const model = buildAgentGraphModel({
    roster,
    viewer,
    events: [
      msg("1", stranger, [["p", A]], 100),
      msg("2", A, [["p", stranger]], 200),
      msg("3", A, [["p", A]], 300),
    ],
  });
  assert.equal(model.edges.length, 0);
  assert.equal(model.lastAt, null);
});

test("duplicate event ids count once", () => {
  const model = buildAgentGraphModel({
    roster,
    viewer,
    events: [msg("1", A, [["p", B]], 100), msg("1", A, [["p", B]], 100)],
  });
  assert.equal(model.edges[0].count, 1);
});

test("viewer participates and sorts last; agents sort by name", () => {
  const model = buildAgentGraphModel({
    roster,
    viewer,
    events: [msg("1", VIEWER, [["p", A]], 100)],
  });
  assert.deepEqual(
    model.nodes.map((n) => n.name),
    ["Aby", "Jenny", "Sasha", "You"],
  );
  assert.equal(model.edges[0].from, VIEWER);
});

test("edgesForNode returns traffic in both directions", () => {
  const model = buildAgentGraphModel({
    roster,
    viewer,
    events: [
      msg("1", A, [["p", B]], 100),
      msg("2", B, [["p", A]], 200),
      msg("3", C, [["p", B]], 300),
    ],
  });
  assert.equal(edgesForNode(model, A).length, 2);
  assert.equal(edgesForNode(model, C).length, 1);
});

test("long content is collapsed into a bounded snippet", () => {
  const model = buildAgentGraphModel({
    roster,
    viewer,
    events: [msg("1", A, [["p", B]], 100, `linea  uno\n${"x".repeat(300)}`)],
  });
  const snippet = model.edges[0].recent[0].snippet;
  assert.ok(snippet.startsWith("linea uno"));
  assert.ok(snippet.length <= 140);
  assert.ok(snippet.endsWith("…"));
});
