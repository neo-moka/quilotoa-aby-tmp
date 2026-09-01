import assert from "node:assert/strict";
import test from "node:test";

import { getSentMessageLink } from "./messageLinks.ts";

const EVENT_ID =
  "49f280e0ab35e829861df182655806da22637f060735d67aa241dde36b8e9d08";

function toolItem(overrides = {}) {
  return {
    type: "tool",
    status: "completed",
    isError: false,
    descriptor: { renderClass: "message" },
    channelId: "chan-1",
    args: {},
    result: "",
    ...overrides,
  };
}

test("resolves the link from a direct JSON result", () => {
  const link = getSentMessageLink(
    toolItem({ result: `{"accepted":true,"event_id":"${EVENT_ID}"}` }),
  );
  assert.deepEqual(link, { channelId: "chan-1", messageId: EVENT_ID });
});

test("resolves the link from a markdown-wrapped terminal result", () => {
  const link = getSentMessageLink(
    toolItem({
      result: `terminal result\n- **output:** {"accepted":true,"event_id":"${EVENT_ID}","mention_pubkeys":[],"message":""}\n- **exit_code:** 0`,
    }),
  );
  assert.deepEqual(link, { channelId: "chan-1", messageId: EVENT_ID });
});

test("a rejected embedded send yields no link", () => {
  const link = getSentMessageLink(
    toolItem({
      result: `terminal result\n- **output:** {"accepted":false,"event_id":"${EVENT_ID}"}\n- **exit_code:** 0`,
    }),
  );
  assert.equal(link, null);
});
