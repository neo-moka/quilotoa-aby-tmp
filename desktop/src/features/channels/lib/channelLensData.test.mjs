import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMessageExcerpt,
  countDiffLineChanges,
  countThreadAgentParticipants,
  groupChannelCodeArtifactsByFile,
  selectChannelCodeArtifacts,
  selectChannelFileArtifacts,
  selectChannelNeedsYouItems,
  selectChannelThreadRows,
  selectChannelWorkingAgents,
  shortCommitSha,
} from "./channelLensData.ts";

const KIND_DIFF = 40008;
const KIND_APPROVAL = 46010;

function makeMessage(id, createdAt, overrides = {}) {
  return {
    id,
    createdAt,
    author: "agent",
    time: "",
    body: "",
    depth: 0,
    ...overrides,
  };
}

function makeEntry(id, createdAt, summary = null) {
  return { message: makeMessage(id, createdAt), summary };
}

function makeSummary(threadHeadId, replyCount, lastReplyAt) {
  return { threadHeadId, replyCount, lastReplyAt, participants: [] };
}

function makeFeedItem(id, createdAt, overrides = {}) {
  return {
    id,
    kind: 40001,
    pubkey: "abc",
    content: "",
    createdAt,
    channelId: "channel-a",
    channelName: "general",
    tags: [],
    category: "needs_action",
    ...overrides,
  };
}

test("selectChannelThreadRows keeps only summarized entries", () => {
  const rows = selectChannelThreadRows([
    makeEntry("plain", 100),
    makeEntry("thread", 90, makeSummary("thread", 3, 500)),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "thread");
  assert.equal(rows[0].replyCount, 3);
});

test("selectChannelThreadRows sorts by last activity, newest first", () => {
  const rows = selectChannelThreadRows([
    makeEntry("old", 10, makeSummary("old", 1, 200)),
    makeEntry("new", 20, makeSummary("new", 1, 900)),
    makeEntry("mid", 30, makeSummary("mid", 1, 400)),
  ]);

  assert.deepEqual(
    rows.map((row) => row.id),
    ["new", "mid", "old"],
  );
});

test("selectChannelThreadRows falls back to the head timestamp", () => {
  const rows = selectChannelThreadRows([
    makeEntry("head-only", 700, makeSummary("head-only", 2, null)),
    makeEntry("replied", 10, makeSummary("replied", 1, 300)),
  ]);

  assert.equal(rows[0].id, "head-only");
  assert.equal(rows[0].lastActivityAt, 700);
});

test("selectChannelThreadRows breaks ties on id so the order is total", () => {
  const rows = selectChannelThreadRows([
    makeEntry("b", 10, makeSummary("b", 1, 500)),
    makeEntry("a", 10, makeSummary("a", 1, 500)),
  ]);

  assert.deepEqual(
    rows.map((row) => row.id),
    ["a", "b"],
  );
});

test("selectChannelCodeArtifacts reads the diff tags it is given", () => {
  const artifacts = selectChannelCodeArtifacts([
    makeMessage("chat", 50, { kind: 40001 }),
    makeMessage("diff", 60, {
      kind: KIND_DIFF,
      body: "--- a/src/x.ts\n+++ b/src/x.ts\n@@\n+added\n+added\n-gone\n context",
      tags: [
        ["file", " src/x.ts "],
        ["commit", "0123456789abcdef"],
        ["description", "Tidy up"],
        ["repo", "https://example.test/repo"],
      ],
    }),
  ]);

  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0].filePath, "src/x.ts");
  assert.equal(artifacts[0].commitSha, "0123456");
  assert.equal(artifacts[0].description, "Tidy up");
  assert.equal(artifacts[0].repoUrl, "https://example.test/repo");
  assert.equal(artifacts[0].added, 2);
  assert.equal(artifacts[0].removed, 1);
});

test("selectChannelCodeArtifacts nulls empty tags instead of showing blanks", () => {
  const artifacts = selectChannelCodeArtifacts([
    makeMessage("diff", 10, {
      kind: KIND_DIFF,
      tags: [
        ["file", "  "],
        ["commit", ""],
      ],
    }),
  ]);

  assert.equal(artifacts[0].filePath, null);
  assert.equal(artifacts[0].commitSha, null);
});

test("groupChannelCodeArtifactsByFile collapses repeat commits to one path", () => {
  const artifacts = selectChannelCodeArtifacts([
    makeMessage("d1", 10, { kind: KIND_DIFF, tags: [["file", "a.ts"]] }),
    makeMessage("d2", 30, { kind: KIND_DIFF, tags: [["file", "a.ts"]] }),
    makeMessage("d3", 20, { kind: KIND_DIFF, tags: [["file", "b.ts"]] }),
  ]);
  const groups = groupChannelCodeArtifactsByFile(artifacts);

  assert.deepEqual(
    groups.map((group) => group.filePath),
    ["a.ts", "b.ts"],
  );
  assert.equal(groups[0].artifacts.length, 2);
  assert.equal(groups[0].latestAt, 30);
});

test("groupChannelCodeArtifactsByFile pools untagged diffs into one group", () => {
  const artifacts = selectChannelCodeArtifacts([
    makeMessage("d1", 10, { kind: KIND_DIFF }),
    makeMessage("d2", 20, { kind: KIND_DIFF }),
  ]);
  const groups = groupChannelCodeArtifactsByFile(artifacts);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].filePath, null);
  assert.equal(groups[0].artifacts.length, 2);
});

test("countDiffLineChanges ignores unified diff file headers", () => {
  assert.deepEqual(
    countDiffLineChanges("--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n"),
    { added: 1, removed: 1 },
  );
  assert.deepEqual(countDiffLineChanges(undefined), { added: 0, removed: 0 });
});

test("shortCommitSha shortens only what is long enough to shorten", () => {
  assert.equal(shortCommitSha("0123456789"), "0123456");
  assert.equal(shortCommitSha("012345"), "012345");
  assert.equal(shortCommitSha("   "), null);
  assert.equal(shortCommitSha(null), null);
});

test("selectChannelFileArtifacts lifts imeta attachments off messages", () => {
  const files = selectChannelFileArtifacts([
    makeMessage("no-tags", 10),
    makeMessage("with-file", 20, {
      tags: [
        ["h", "channel-a"],
        [
          "imeta",
          "url https://media.test/abc.png",
          "m image/png",
          "size 2048",
          "filename diagram.png",
        ],
      ],
    }),
  ]);

  assert.equal(files.length, 1);
  assert.equal(files[0].id, "with-file:https://media.test/abc.png");
  assert.equal(files[0].label, "diagram.png");
  assert.equal(files[0].mimeType, "image/png");
  assert.equal(files[0].sizeBytes, 2048);
});

test("selectChannelFileArtifacts names an unnamed file from its url", () => {
  const files = selectChannelFileArtifacts([
    makeMessage("m", 10, {
      tags: [
        ["imeta", "url https://media.test/deadbeef.webp?v=2", "m image/webp"],
      ],
    }),
  ]);

  assert.equal(files[0].label, "deadbeef.webp");
  assert.equal(files[0].sizeBytes, null);
});

test("selectChannelNeedsYouItems scopes to the channel and floats approvals", () => {
  const items = selectChannelNeedsYouItems(
    [
      makeFeedItem("other-channel", 900, { channelId: "channel-b" }),
      makeFeedItem("recent", 500),
      makeFeedItem("approval", 100, { kind: KIND_APPROVAL }),
      makeFeedItem("older", 300),
    ],
    "channel-a",
  );

  assert.deepEqual(
    items.map((item) => item.id),
    ["approval", "recent", "older"],
  );
});

test("selectChannelNeedsYouItems is empty without a channel or feed", () => {
  assert.deepEqual(selectChannelNeedsYouItems(undefined, "channel-a"), []);
  assert.deepEqual(
    selectChannelNeedsYouItems([makeFeedItem("x", 1)], null),
    [],
  );
});

test("selectChannelWorkingAgents narrows the store to one channel", () => {
  const working = selectChannelWorkingAgents(
    [
      {
        channelId: "channel-b",
        anchorAt: 5,
        agentCount: 1,
        agentPubkeys: ["z"],
      },
      {
        channelId: "channel-a",
        anchorAt: 1_700,
        agentCount: 2,
        agentPubkeys: ["bb", "aa"],
      },
    ],
    "channel-a",
  );

  assert.deepEqual(working, { agentPubkeys: ["aa", "bb"], anchorAt: 1_700 });
});

test("selectChannelWorkingAgents reports absence as null", () => {
  assert.equal(selectChannelWorkingAgents([], "channel-a"), null);
  assert.equal(
    selectChannelWorkingAgents(
      [
        {
          channelId: "channel-a",
          anchorAt: 1,
          agentCount: 0,
          agentPubkeys: [],
        },
      ],
      "channel-a",
    ),
    null,
  );
  assert.equal(
    selectChannelWorkingAgents(
      [
        {
          channelId: "channel-a",
          anchorAt: 1,
          agentCount: 1,
          agentPubkeys: ["a"],
        },
      ],
      null,
    ),
    null,
  );
});

test("buildMessageExcerpt collapses whitespace and truncates", () => {
  assert.equal(buildMessageExcerpt("  hello\n\n  world  "), "hello world");
  assert.equal(buildMessageExcerpt(undefined), "");
  assert.equal(buildMessageExcerpt("abcdefghij", 5), "abcd…");
});

test("countThreadAgentParticipants counts known agents once, case-insensitively", () => {
  const row = {
    message: makeMessage("root", 1, { pubkey: "AGENT-A" }),
    participants: [
      { id: "agent-a", author: "scout", avatarUrl: null },
      { id: "agent-b", author: "patch", avatarUrl: null },
      { id: "human-1", author: "Ana", avatarUrl: null },
    ],
  };

  assert.equal(
    countThreadAgentParticipants(row, new Set(["agent-a", "agent-b"])),
    2,
  );
});

test("countThreadAgentParticipants is zero with no agents or no roster", () => {
  const row = {
    message: makeMessage("root", 1, { pubkey: "human-1" }),
    participants: [{ id: "human-2", author: "Iris", avatarUrl: null }],
  };

  assert.equal(countThreadAgentParticipants(row, new Set(["agent-a"])), 0);
  assert.equal(countThreadAgentParticipants(row, new Set()), 0);
});
