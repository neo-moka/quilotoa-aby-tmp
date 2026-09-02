/**
 * Contract tests for scripts/buzz-backend-neomoka, the fork's backend
 * provider. Every case spawns the real script (python3, stdlib-only) exactly
 * like the desktop's invoke_provider does — one JSON on stdin, one JSON on
 * stdout — with deploys in dry_run mode so nothing ever reaches the server.
 * The generated remote bash lands on stderr, which is what the assertions
 * inspect. These encode the manual dry-run checks the provider was shipped
 * with; if the deploy contract drifts, this is the suite that catches it.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const PROVIDER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../scripts/buzz-backend-neomoka",
);

function invoke(request) {
  const result = spawnSync("python3", [PROVIDER], {
    input: JSON.stringify(request),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `provider exit: ${result.stderr}`);
  return { response: JSON.parse(result.stdout), stderr: result.stderr };
}

function deployRequest(overrides = {}) {
  return {
    op: "deploy",
    request_id: "test",
    provider_config: { dry_run: true },
    agent: {
      name: "Iris Prueba",
      relay_url: "wss://relay.example",
      private_key_nsec: "nsec1fakefakefake",
      auth_tag: ["auth", "own", "", "sig"],
      respond_to: "anyone",
      idle_timeout_seconds: 300,
      launch: {
        command: "hermes-acp",
        args: [],
        env: { TMPDIR: "/tmp/iris", ...(overrides.env ?? {}) },
        policy_env: {
          BUZZ_ACP_LAZY_POOL: "true",
          BUZZ_ACP_MODEL: "gpt-5.6-sol",
          ...(overrides.policy_env ?? {}),
        },
      },
    },
  };
}

function agentEnvFrom(stderr) {
  const match = stderr.match(
    /printf '%s' (\S+) \| base64 -d > \/home\/dropshipping\/iris-prueba\/agent\.env/,
  );
  assert.ok(match, "agent.env write missing from remote script");
  return Buffer.from(match[1], "base64").toString();
}

test("info: exact strict-contract fields, protocol v1", () => {
  const { response } = invoke({ op: "info", request_id: "t" });
  assert.deepEqual(
    Object.keys(response).sort(),
    ["config_schema", "description", "name", "ok", "protocol_version", "version"],
  );
  assert.equal(response.ok, true);
  assert.equal(response.protocol_version, 1);
  assert.equal(typeof response.config_schema.properties, "object");
});

test("deploy: agent.env mirrors the local spawn contract", () => {
  const { response, stderr } = invoke(deployRequest());
  assert.deepEqual(response, { ok: true, agent_id: "iris-prueba", dry_run: true });
  const env = agentEnvFrom(stderr);
  assert.match(env, /BUZZ_ACP_AGENT_COMMAND="hermes-acp"/);
  // Empty args stay empty (join verbatim) — forcing "acp" would run
  // "hermes-acp acp" on the server.
  assert.match(env, /BUZZ_ACP_AGENT_ARGS=""/);
  assert.match(env, /BUZZ_AUTH_TAG="\[\\"auth\\", \\"own\\", \\"\\", \\"sig\\"\]"/);
  assert.match(env, /BUZZ_ACP_IDLE_TIMEOUT="300"/);
  assert.match(env, /TMPDIR="\/tmp\/iris"/);
});

test("deploy: multiline system prompt diverts to a sidecar file", () => {
  const { stderr } = invoke(
    deployRequest({ policy_env: { BUZZ_ACP_SYSTEM_PROMPT: "a\nb" } }),
  );
  const env = agentEnvFrom(stderr);
  assert.doesNotMatch(env, /BUZZ_ACP_SYSTEM_PROMPT="/);
  assert.match(
    env,
    /BUZZ_ACP_SYSTEM_PROMPT_FILE="\/home\/dropshipping\/iris-prueba\/system-prompt\.md"/,
  );
  assert.match(stderr, /system-prompt\.md/);
});

test("NEOMOKA_MCP present applies the exact set; absent touches nothing", () => {
  const on = invoke(deployRequest({ env: { NEOMOKA_MCP: "dropi" } })).stderr;
  assert.match(on, /usermod -aG mcpdropi iris-prueba/);
  const off = invoke(deployRequest({ env: { NEOMOKA_MCP: "" } })).stderr;
  assert.match(off, /gpasswd -d iris-prueba mcpdropi/);
  const unknown = invoke(
    deployRequest({ env: { NEOMOKA_MCP: "dropi,fantasma" } }),
  ).stderr;
  assert.match(unknown, /fantasma.*ignorado/);
  const absent = invoke(deployRequest()).stderr;
  assert.doesNotMatch(absent, /MCP por agente/);
});

test("catalog defs provision group/token/wrapper and never persist", () => {
  const def = JSON.stringify({
    name: "foo",
    url: "https://mcp.foo.example/mcp",
    auth: "tok-secreto-123",
  });
  const { stderr } = invoke(
    deployRequest({
      env: { NEOMOKA_MCP: "dropi,foo", NEOMOKA_MCP_DEF_FOO: def },
    }),
  );
  assert.match(stderr, /groupadd mcpfoo/);
  assert.match(stderr, /chown root:mcpfoo \/opt\/buzz-agents\/mcp\/foo-mcp-token/);
  assert.match(stderr, /usermod -aG mcpfoo iris-prueba/);
  const env = agentEnvFrom(stderr);
  assert.doesNotMatch(env, /NEOMOKA_MCP_DEF_FOO/);
  // The bearer travels base64-encoded on the ssh stdin, never in cleartext.
  assert.doesNotMatch(stderr, /tok-secreto-123/);
  const wrapper = stderr.match(
    /printf '%s' (\S+) \| base64 -d > \/opt\/buzz-agents\/bin\/foo-mcp/,
  );
  assert.ok(wrapper, "wrapper write missing");
  const wrapperBody = Buffer.from(wrapper[1], "base64").toString();
  assert.match(wrapperBody, /mcp-remote https:\/\/mcp\.foo\.example\/mcp/);
  assert.match(wrapperBody, /Bearer \$\(cat \/opt\/buzz-agents\/mcp\/foo-mcp-token\)/);
});

test("errors come back as ok:false JSON, exit 0", () => {
  const bogus = invoke({ op: "bogus" });
  assert.equal(bogus.response.ok, false);
  const incomplete = invoke({ op: "deploy", agent: { name: "X" } });
  assert.equal(incomplete.response.ok, false);
  assert.match(incomplete.response.error, /launch\.command|agent_command/);
});
