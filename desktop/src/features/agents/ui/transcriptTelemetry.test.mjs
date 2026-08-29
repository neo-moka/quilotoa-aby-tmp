import assert from "node:assert/strict";
import test from "node:test";

import {
  isTranscriptTelemetryItem,
  selectPolishedTranscriptItems,
} from "./transcriptTelemetry.ts";

function lifecycle(title, id = title.toLowerCase()) {
  return {
    id,
    type: "lifecycle",
    renderClass: "status",
    title,
    text: "…",
    timestamp: "2026-08-29T07:39:00.000Z",
    agentPubkey: "pk",
    sessionId: "s1",
    turnId: "t1",
  };
}

test("telemetry filter drops Usage and Commands lifecycle rows only", () => {
  const usage = lifecycle("Usage");
  const commands = lifecycle("Commands");
  const mode = lifecycle("Mode");
  const message = { ...lifecycle("Usage", "msg"), type: "message" };

  assert.equal(isTranscriptTelemetryItem(usage), true);
  assert.equal(isTranscriptTelemetryItem(commands), true);
  assert.equal(isTranscriptTelemetryItem(mode), false);
  assert.equal(isTranscriptTelemetryItem(message), false);

  assert.deepEqual(
    selectPolishedTranscriptItems([usage, mode, commands, message]),
    [mode, message],
  );
});
