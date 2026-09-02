import assert from "node:assert/strict";
import test from "node:test";

import {
  isValidMcpName,
  mcpCatalogNames,
  mcpDefEnvEntry,
  mcpDefEnvKey,
  parseMcpDefs,
  parseMcpList,
  removeMcpDef,
  resolveAgentMcpSelection,
  serializeMcpList,
  toggleMcpName,
  upsertMcpDef,
  validateMcpDraft,
} from "./mcpConnections.ts";

test("names: lowercase slugs only, env-suffix safe", () => {
  assert.ok(isValidMcpName("dropi"));
  assert.ok(isValidMcpName("meli-ads"));
  assert.equal(isValidMcpName("Dropi"), false);
  assert.equal(isValidMcpName("2fast"), false);
  assert.equal(isValidMcpName(""), false);
  assert.equal(isValidMcpName("a".repeat(25)), false);
  assert.equal(mcpDefEnvKey("meli-ads"), "NEOMOKA_MCP_DEF_MELI_ADS");
});

test("list parse/serialize: trims, dedupes, keeps order; null = absent", () => {
  assert.deepEqual(parseMcpList(" dropi , foo,dropi,"), ["dropi", "foo"]);
  assert.deepEqual(parseMcpList(""), []);
  assert.deepEqual(parseMcpList(null), []);
  assert.equal(serializeMcpList(["dropi", "foo"]), "dropi,foo");
});

test("def entry: exactly one of url or command, auth optional", () => {
  const [key, value] = mcpDefEnvEntry({
    name: "foo",
    url: " https://mcp.example/mcp ",
    auth: "tok",
  });
  assert.equal(key, "NEOMOKA_MCP_DEF_FOO");
  assert.deepEqual(JSON.parse(value), {
    name: "foo",
    url: "https://mcp.example/mcp",
    auth: "tok",
  });
  const [, stdio] = mcpDefEnvEntry({ name: "bar", command: "/bin/bar-mcp" });
  assert.deepEqual(JSON.parse(stdio), { name: "bar", command: "/bin/bar-mcp" });
  assert.throws(() => mcpDefEnvEntry({ name: "x!", url: "https://x" }));
  assert.throws(() => mcpDefEnvEntry({ name: "both", url: "u", command: "c" }));
  assert.throws(() => mcpDefEnvEntry({ name: "none" }));
});

test("defs round-trip through an env map; junk is skipped", () => {
  let env = {};
  env = upsertMcpDef(env, { name: "foo", url: "https://f/mcp", auth: "t" });
  env = upsertMcpDef(env, { name: "bar", command: "/bin/bar-mcp" });
  env.NEOMOKA_MCP_DEF_BROKEN = "{not json";
  env.NEOMOKA_MCP_DEF_MISMATCH = JSON.stringify({ name: "otro", url: "u" });
  const defs = parseMcpDefs(env);
  assert.deepEqual(
    defs.map((def) => def.name),
    ["bar", "foo"],
  );
  assert.equal(defs[1].auth, "t");
});

test("catalog: built-ins first, user defs appended, no shadowing", () => {
  let env = upsertMcpDef({}, { name: "foo", url: "https://f/mcp" });
  env = upsertMcpDef(env, { name: "dropi", url: "https://sombra/mcp" });
  assert.deepEqual(mcpCatalogNames(env), ["dropi", "foo"]);
});

test("remove drops the def and its default-list mention", () => {
  let env = upsertMcpDef({}, { name: "foo", url: "https://f/mcp" });
  env = toggleMcpName(env, "foo", true);
  env = toggleMcpName(env, "dropi", true);
  env = removeMcpDef(env, "foo");
  assert.equal(env.NEOMOKA_MCP_DEF_FOO, undefined);
  assert.equal(env.NEOMOKA_MCP, "dropi");
});

test("draft validation: normalizes, rejects dupes and incomplete forms", () => {
  const base = { name: "", kind: "remote", url: "", auth: "", command: "" };
  const ok = validateMcpDraft(
    { ...base, name: " Foo ", url: "https://f/mcp" },
    ["dropi"],
  );
  assert.equal(ok.error, undefined);
  assert.equal(ok.def.name, "foo");
  assert.ok(validateMcpDraft({ ...base, name: "x!" }, []).error);
  assert.ok(validateMcpDraft({ ...base, name: "dropi" }, ["dropi"]).error);
  assert.ok(validateMcpDraft({ ...base, name: "foo" }, []).error);
  assert.ok(
    validateMcpDraft({ ...base, name: "foo", kind: "command" }, []).error,
  );
  const cmd = validateMcpDraft(
    { ...base, name: "bar", kind: "command", command: "/bin/bar-mcp" },
    [],
  );
  assert.equal(cmd.def.command, "/bin/bar-mcp");
});

test("agent selection: inherits until the agent pins its own list", () => {
  const globalEnv = upsertMcpDef(
    { NEOMOKA_MCP: "dropi" },
    { name: "foo", url: "https://f/mcp" },
  );
  const inheriting = resolveAgentMcpSelection({}, globalEnv);
  assert.deepEqual(inheriting, {
    catalog: ["dropi", "foo"],
    customized: false,
    effective: ["dropi"],
    globalDefaults: ["dropi"],
  });
  const pinned = resolveAgentMcpSelection({ NEOMOKA_MCP: "foo" }, globalEnv);
  assert.equal(pinned.customized, true);
  assert.deepEqual(pinned.effective, ["foo"]);
  const optedOut = resolveAgentMcpSelection({ NEOMOKA_MCP: "" }, globalEnv);
  assert.equal(optedOut.customized, true);
  assert.deepEqual(optedOut.effective, []);
});

test("toggle is idempotent and preserves other entries", () => {
  let env = { NEOMOKA_MCP: "dropi" };
  env = toggleMcpName(env, "dropi", true);
  assert.equal(env.NEOMOKA_MCP, "dropi");
  env = toggleMcpName(env, "foo", true);
  assert.equal(env.NEOMOKA_MCP, "dropi,foo");
  env = toggleMcpName(env, "dropi", false);
  assert.equal(env.NEOMOKA_MCP, "foo");
});
