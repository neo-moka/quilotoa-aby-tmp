import type { TranscriptItem } from "../agentSessionTypes";
import {
  asRecord,
  getToolString,
  parseToolResultValue,
} from "../agentSessionUtils";

export type SentMessageLink = {
  channelId: string;
  messageId: string;
};

export function getSentMessageLink(
  item: Extract<TranscriptItem, { type: "tool" }>,
): SentMessageLink | null {
  if (item.status !== "completed" || item.isError) {
    return null;
  }

  if (item.descriptor?.renderClass !== "message") {
    return null;
  }

  const channelId =
    item.channelId ?? getToolString(item.args, ["channel_id", "channelId"]);
  if (!channelId) {
    return null;
  }

  const resultRecord = getMessageSendResultRecord(item.result);
  if (!resultRecord || resultRecord.accepted === false) {
    return null;
  }

  const messageId = getToolString(resultRecord, [
    "event_id",
    "eventId",
    "message_id",
    "messageId",
  ]);
  if (!messageId) {
    return null;
  }

  return {
    channelId,
    messageId,
  };
}

function getMessageSendResultRecord(
  result: string,
): Record<string, unknown> | null {
  const parsed = parseToolResultValue(result);
  const directRecord = asRecord(parsed);
  if (getMessageEventId(directRecord)) {
    return directRecord;
  }

  const stdout = getToolString(directRecord, ["stdout"]);
  if (stdout) {
    const stdoutRecord = asRecord(parseToolResultValue(stdout));
    if (getMessageEventId(stdoutRecord)) {
      return stdoutRecord;
    }
  }

  // ACP terminal results wrap the CLI's JSON in markdown
  // ("- **output:** {\"accepted\":true,\"event_id\":…}"), so neither the
  // direct parse nor the stdout field sees it — without this the sent
  // bubble can never resolve its content and shows "unavailable".
  return embeddedMessageSendRecord(result);
}

function embeddedMessageSendRecord(
  result: string,
): Record<string, unknown> | null {
  const match = result.match(
    /\{[^{}]*"(?:event_id|eventId|message_id|messageId)"[^{}]*\}/,
  );
  if (!match) return null;
  try {
    const record = asRecord(JSON.parse(match[0]));
    return getMessageEventId(record) ? record : null;
  } catch {
    return null;
  }
}

function getMessageEventId(record: Record<string, unknown>) {
  return getToolString(record, [
    "event_id",
    "eventId",
    "message_id",
    "messageId",
  ]);
}
