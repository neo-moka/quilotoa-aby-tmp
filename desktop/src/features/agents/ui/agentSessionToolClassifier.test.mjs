import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTool,
  parseBuzzCliCommand,
  tokenizeShellCommand,
} from "./agentSessionToolClassifier.ts";

test("tokenizeShellCommand preserves quoted strings and command separators", () => {
  assert.deepEqual(
    tokenizeShellCommand(
      'echo "hello world" | buzz messages send --content - --channel agents; buzz feed get',
    ),
    [
      "echo",
      "hello world",
      "|",
      "buzz",
      "messages",
      "send",
      "--content",
      "-",
      "--channel",
      "agents",
      ";",
      "buzz",
      "feed",
      "get",
    ],
  );
});

test("parseBuzzCliCommand returns null preview for echo-piped stdin sends", () => {
  const descriptor = parseBuzzCliCommand(
    'echo "Permission wired" | buzz messages send --channel agents --content -',
  );

  assert.equal(descriptor?.renderClass, "message");
  assert.equal(descriptor?.label, "Send Message");
  assert.equal(descriptor?.preview, null);
  assert.equal(descriptor?.operation, "messages.send");
});

test("parseBuzzCliCommand returns null preview for printf-piped stdin sends", () => {
  const descriptor = parseBuzzCliCommand(
    "printf 'hello\\n\\nworld\\n' | buzz messages send --channel a6e0737c-4205-4bcc-9741-2aad800e613f --content -",
  );

  assert.equal(descriptor?.renderClass, "message");
  assert.equal(descriptor?.preview, null);
});

test("parseBuzzCliCommand returns null preview for heredoc/cat stdin sends", () => {
  const descriptor = parseBuzzCliCommand(
    'buzz messages send --channel some-uuid --content "$(cat /tmp/file)"',
  );

  assert.equal(descriptor?.renderClass, "message");
  assert.equal(descriptor?.preview, null);
});

test("parseBuzzCliCommand returns null preview for --content with embedded command substitution", () => {
  const descriptor = parseBuzzCliCommand(
    'buzz messages send --channel some-uuid --content "prefix $(cat /tmp/f)"',
  );

  assert.equal(descriptor?.renderClass, "message");
  assert.equal(descriptor?.preview, null);
});

test("parseBuzzCliCommand returns null preview for --content with a bare variable", () => {
  const descriptor = parseBuzzCliCommand(
    'buzz messages send --channel some-uuid --content "$MESSAGE"',
  );

  assert.equal(descriptor?.renderClass, "message");
  assert.equal(descriptor?.preview, null);
});

test("parseBuzzCliCommand returns null preview for --content with a prefixed variable", () => {
  const descriptor = parseBuzzCliCommand(
    'buzz messages send --channel some-uuid --content "prefix $MESSAGE"',
  );

  assert.equal(descriptor?.renderClass, "message");
  assert.equal(descriptor?.preview, null);
});

test("parseBuzzCliCommand preserves inline --content for sends", () => {
  const descriptor = parseBuzzCliCommand(
    'buzz messages send --channel agents --content "Hello from inline"',
  );

  assert.equal(descriptor?.renderClass, "message");
  assert.equal(descriptor?.preview, "Hello from inline");
});

test("parseBuzzCliCommand preserves --content=inline for sends", () => {
  const descriptor = parseBuzzCliCommand(
    "buzz messages send --channel agents --content=Acknowledged",
  );

  assert.equal(descriptor?.renderClass, "message");
  assert.equal(descriptor?.preview, "Acknowledged");
});

test("parseBuzzCliCommand never surfaces --channel as preview for sends", () => {
  const commands = [
    "printf 'msg' | buzz messages send --channel my-uuid --content -",
    'buzz messages send --channel my-uuid --content "$(cat /tmp/f)"',
    "buzz messages send --channel my-uuid --content -",
  ];

  for (const cmd of commands) {
    const descriptor = parseBuzzCliCommand(cmd);
    assert.equal(descriptor?.renderClass, "message");
    assert.notEqual(
      descriptor?.preview,
      "my-uuid",
      `send preview leaked --channel for: ${cmd}`,
    );
  }
});

test("classifyTool promotes load_skill to skill-read descriptors", () => {
  const descriptor = classifyTool({
    title: "load_skill",
    toolName: "load_skill",
    buzzToolName: null,
    args: { name: "block-safe-github" },
    result: "# Safe GitHub usage at Block\n",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "skill-read");
  assert.equal(descriptor.label, "Read skill");
  assert.equal(descriptor.preview, "block-safe-github");
  assert.deepEqual(descriptor.action, {
    verb: "Read",
    object: "block-safe-github",
  });
  assert.equal(descriptor.groupKey, "skill:load");
});

test("classifyTool promotes supporting-file load_skill to skill-read file descriptors", () => {
  const descriptor = classifyTool({
    title: "load_skill",
    toolName: "load_skill",
    buzzToolName: null,
    args: { name: "block-safe-github/references/foo.md" },
    result: "# Reference\n",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "skill-read");
  assert.equal(descriptor.label, "Read skill file");
  assert.equal(descriptor.groupKey, "skill:load-file");
});

test("classifyTool promotes buzz CLI shell commands to relay operations", () => {
  const descriptor = classifyTool({
    title: "Shell",
    toolName: "dev__shell",
    buzzToolName: null,
    args: { command: "buzz channels get --channel buzz-agent-observability" },
    result: "{}",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "relay-op");
  assert.equal(descriptor.label, "Channels Get");
  assert.equal(descriptor.preview, "buzz-agent-observability");
  assert.equal(descriptor.groupKey, "buzz-cli:channels.get");
});

test("classifyTool falls back once to a generic descriptor", () => {
  const descriptor = classifyTool({
    title: "Mystery",
    toolName: "mcp__mystery",
    buzzToolName: null,
    args: { path: "notes.md" },
    result: "",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "generic");
  assert.equal(descriptor.label, "Ran tool");
  assert.equal(descriptor.preview, "notes.md");
  assert.equal(descriptor.source, "fallback");
});

test("classifyTool routes Claude Code Bash sends to the message bubble", () => {
  const descriptor = classifyTool({
    title: "Bash",
    toolName: "Bash",
    buzzToolName: null,
    args: {
      command: 'buzz messages send --channel some-uuid --content "hola equipo"',
    },
    result: "{}",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "message");
  assert.equal(descriptor.label, "Send Message");
  assert.equal(descriptor.preview, "hola equipo");
  assert.equal(descriptor.groupKey, "buzz-cli:messages.send");
});

test("classifyTool renders non-buzz Bash commands as shell rows", () => {
  const descriptor = classifyTool({
    title: "Bash",
    toolName: "Bash",
    buzzToolName: null,
    args: { command: "ls -la /tmp" },
    result: "",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "shell");
  assert.equal(descriptor.label, "Ran command");
  assert.equal(descriptor.preview, "ls -la /tmp");
});

test("classifyTool routes Gemini run_shell_command buzz ops to relay-op", () => {
  const descriptor = classifyTool({
    title: "run_shell_command",
    toolName: "run_shell_command",
    buzzToolName: null,
    args: { command: "buzz reactions add --event abc --emoji ✅" },
    result: "{}",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "relay-op");
});

test("a title-only terminal buzz command classifies as a relay op, not a raw shell row", () => {
  const descriptor = classifyTool({
    title:
      "terminal: buzz messages send --channel general --content 'hola equipo'",
    toolName: "terminal",
    buzzToolName: null,
    args: {},
    result: '{"accepted":true}',
    isError: false,
  });

  assert.equal(descriptor.renderClass, "message");
  assert.equal(descriptor.label, "Send Message");
  assert.equal(descriptor.action.verb, "Sent");
});

test("a title-only terminal non-buzz command drops the terminal prefix", () => {
  const descriptor = classifyTool({
    title: "terminal: ls -la /tmp",
    toolName: "terminal",
    buzzToolName: null,
    args: {},
    result: "",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "shell");
  assert.deepEqual(descriptor.action, { verb: "Ran", object: "ls -la /tmp" });
});

test("a prefix naming no shell tool is left alone", () => {
  const descriptor = classifyTool({
    title: "note: buzz messages send --channel general",
    toolName: "unknown_tool",
    buzzToolName: null,
    args: {},
    result: "",
    isError: false,
  });

  assert.notEqual(descriptor.renderClass, "message");
});

test("a harness reporting no tool name still classifies a titled terminal buzz command", () => {
  // Real ACP shape: extractToolIdentity derives toolName by normalizing the
  // whole title, which matches no shell base — only the title prefix says
  // this was a terminal.
  const descriptor = classifyTool({
    title: "terminal: buzz messages send --channel general --content 'hola'",
    toolName: "terminal_buzz_messages_send_channel_general_content_hola",
    buzzToolName: null,
    args: {},
    result: "",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "message");
  assert.equal(descriptor.action.verb, "Sent");
});

test("opencode execute-kind tool with bare command title classifies as buzz message send", () => {
  // opencode's ACP bridge reports no tool name: the title IS the command
  // line, and the only shell signal is ACP `kind: "execute"`, which
  // extractToolIdentity surfaces as toolName "execute".
  const descriptor = classifyTool({
    title:
      'buzz messages send --channel "e9aeef12-74b4-4971-a981-9bba82b49a81" --reply-to "96c845142f7fac" --content "hola"',
    toolName: "execute",
    buzzToolName: null,
    args: {},
    result: "",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "message");
  assert.equal(descriptor.label, "Send Message");
  assert.equal(descriptor.preview, "hola");
});

test("execute-kind tool with a non-buzz bare command renders as shell, not generic", () => {
  const descriptor = classifyTool({
    title: "ls -la /tmp",
    toolName: "execute",
    buzzToolName: null,
    args: {},
    result: "",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "shell");
  assert.equal(descriptor.label, "Ran command");
  assert.equal(descriptor.preview, "ls -la /tmp");
});

test("unknown harness tool running a buzz command in its title escapes the generic row", () => {
  // No shell signal at all (unrecognized tool name, no execute kind): the
  // last-chance buzz CLI parse should still recognize the command line.
  const descriptor = classifyTool({
    title: "buzz messages send --channel agents --content 'listo'",
    toolName: "some_future_harness_tool",
    buzzToolName: null,
    args: {},
    result: "",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "message");
  assert.equal(descriptor.label, "Send Message");
});

test("one-word titles never get mistaken for command lines", () => {
  const descriptor = classifyTool({
    title: "bash",
    toolName: "execute",
    buzzToolName: null,
    args: {},
    result: "",
    isError: false,
  });

  assert.equal(descriptor.renderClass, "shell");
  assert.equal(descriptor.preview, null);
});
