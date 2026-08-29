import assert from "node:assert/strict";
import test from "node:test";

import {
  parseApprovalExpiry,
  resolveAgentMessageProvenance,
  resolveChannelApprovalRequest,
} from "./agentMessageProvenance.ts";

const PUBKEY =
  "1111111111111111111111111111111111111111111111111111111111111111";

const NOW = 1_800_000_000;

function provenance(overrides = {}) {
  return resolveAgentMessageProvenance({
    author: "charlie",
    canOpenActivity: true,
    isAgent: true,
    ownerLabel: "you",
    ownerPubkey: PUBKEY,
    pubkey: PUBKEY,
    ...overrides,
  });
}

test("a message from a human carries no agent provenance", () => {
  assert.equal(provenance({ isAgent: false }), null);
  assert.equal(provenance({ isAgent: undefined }), null);
});

test("an agent message keeps its owner grammar", () => {
  const resolved = provenance();
  assert.equal(resolved?.ownerLabel, "you");
  assert.equal(resolved?.ownerPubkey, PUBKEY);
});

test("an unverified owner resolves to null rather than being dropped", () => {
  const resolved = provenance({ ownerLabel: undefined, ownerPubkey: null });
  assert.equal(resolved?.ownerLabel, null);
  assert.equal(resolved?.ownerPubkey, null);
});

test("the activity affordance is withheld where nothing can open it", () => {
  assert.equal(provenance({ canOpenActivity: false })?.activityPubkey, null);
  assert.equal(provenance({ pubkey: null })?.activityPubkey, null);
  assert.equal(provenance()?.activityPubkey, PUBKEY);
});

test("the activity label names the agent, falling back when it is blank", () => {
  assert.equal(provenance()?.activityLabel, "View charlie activity");
  assert.equal(
    provenance({ author: "   " })?.activityLabel,
    "View agent activity",
  );
});

test("expiry parses both the ISO and unix-seconds spellings", () => {
  assert.equal(parseApprovalExpiry("1800000000"), 1_800_000_000);
  assert.equal(parseApprovalExpiry("2027-01-15T10:30:00Z"), 1_800_009_000);
  assert.equal(parseApprovalExpiry(null), null);
  assert.equal(parseApprovalExpiry("not a date"), null);
});

test("an approval request with no tags still describes itself", () => {
  const resolved = resolveChannelApprovalRequest({}, NOW);
  assert.equal(resolved.request, "A workflow step is waiting for approval.");
  assert.equal(resolved.status, "pending");
  assert.equal(resolved.approverSpec, null);
  assert.equal(resolved.expiresAt, null);
  assert.equal(resolved.workflowId, null);
});

test("an approval request reads its body and tags", () => {
  const resolved = resolveChannelApprovalRequest(
    {
      body: "  Deploy queue-worker to staging  ",
      tags: [
        ["h", "channel-1"],
        ["d", "workflow-7"],
        ["approver_spec", "@ops"],
        ["expires_at", String(NOW + 3_600)],
      ],
    },
    NOW,
  );
  assert.equal(resolved.request, "Deploy queue-worker to staging");
  assert.equal(resolved.approverSpec, "@ops");
  assert.equal(resolved.expiresAt, NOW + 3_600);
  assert.equal(resolved.workflowId, "workflow-7");
  assert.equal(resolved.status, "pending");
});

test("a passed deadline expires a request still waiting", () => {
  const resolved = resolveChannelApprovalRequest(
    { tags: [["expires_at", String(NOW - 1)]] },
    NOW,
  );
  assert.equal(resolved.status, "expired");
});

test("a recorded decision survives its deadline", () => {
  for (const decision of ["granted", "denied"]) {
    const resolved = resolveChannelApprovalRequest(
      {
        tags: [
          ["status", decision],
          ["expires_at", String(NOW - 10_000)],
        ],
      },
      NOW,
    );
    assert.equal(resolved.status, decision);
  }
});

test("an unrecognised status reads as pending, not as a fifth state", () => {
  const resolved = resolveChannelApprovalRequest(
    { tags: [["status", "escalated"]] },
    NOW,
  );
  assert.equal(resolved.status, "pending");
});

test("a status tag is matched case-insensitively", () => {
  const resolved = resolveChannelApprovalRequest(
    { tags: [["status", "GRANTED"]] },
    NOW,
  );
  assert.equal(resolved.status, "granted");
});
