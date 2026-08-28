import assert from "node:assert/strict";
import test from "node:test";

import { resolveActivityAgentPubkey } from "./agentActivitySelection.ts";

const working = (...pubkeys) => new Set(pubkeys);

test("an explicit selection wins over a working agent", () => {
  assert.equal(
    resolveActivityAgentPubkey({
      agentPubkeys: ["a", "b"],
      selectedPubkey: "a",
      workingPubkeys: working("b"),
    }),
    "a",
  );
});

test("a selection that is no longer listed falls back instead of blanking", () => {
  // An agent can stop, or be deleted, while its pubkey still sits in the URL.
  assert.equal(
    resolveActivityAgentPubkey({
      agentPubkeys: ["a", "b"],
      selectedPubkey: "gone",
      workingPubkeys: working("b"),
    }),
    "b",
  );
});

test("with no selection it opens on the first working agent, not the first agent", () => {
  assert.equal(
    resolveActivityAgentPubkey({
      agentPubkeys: ["idle", "alsoIdle", "busy"],
      selectedPubkey: null,
      workingPubkeys: working("busy"),
    }),
    "busy",
  );
});

test("with nothing working it opens on the first agent", () => {
  assert.equal(
    resolveActivityAgentPubkey({
      agentPubkeys: ["a", "b"],
      selectedPubkey: null,
      workingPubkeys: working(),
    }),
    "a",
  );
});

test("working agents that are not listed are ignored", () => {
  // The working set is flattened from per-channel turns, so it can name agents
  // the panel does not list (stopped, or filtered out).
  assert.equal(
    resolveActivityAgentPubkey({
      agentPubkeys: ["a"],
      selectedPubkey: null,
      workingPubkeys: working("notListed"),
    }),
    "a",
  );
});

test("no agents resolves to null rather than undefined", () => {
  assert.equal(
    resolveActivityAgentPubkey({
      agentPubkeys: [],
      selectedPubkey: "a",
      workingPubkeys: working("a"),
    }),
    null,
  );
});
