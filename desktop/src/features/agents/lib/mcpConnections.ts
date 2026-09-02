/**
 * MCP connections, modeled over env vars so they ride the existing
 * global → persona → agent layering and the provider deploy channel
 * without any new storage or protocol:
 *
 * - `NEOMOKA_MCP` — comma list of connection names enabled for the scope
 *   that defines it (global defaults = fleet-wide; an agent's own value
 *   overrides the global one; empty string = none).
 * - `NEOMOKA_MCP_DEF_<NAME>` — JSON definition of a connection
 *   (`{"url","auth"}` for remote servers bridged via mcp-remote, or
 *   `{"command"}` for stdio). Defined globally; the deploy provider
 *   materializes wrapper/token/group on the target server and strips
 *   these vars from the agent's persisted env.
 */

export const MCP_LIST_ENV_KEY = "NEOMOKA_MCP";
export const MCP_DEF_ENV_PREFIX = "NEOMOKA_MCP_DEF_";

/** Built-in connections provisioned on the server outside the catalog. */
export const BUILTIN_MCP_NAMES = ["dropi"] as const;

export type McpConnectionDef = {
  name: string;
  /** Remote MCP endpoint (mutually exclusive with `command`). */
  url?: string;
  /** Bearer credential for `url`. Optional: some endpoints are open. */
  auth?: string;
  /** stdio command (mutually exclusive with `url`). */
  command?: string;
};

/** Valid connection name: lowercase slug, safe as env suffix and Unix group. */
export function isValidMcpName(name: string): boolean {
  return /^[a-z][a-z0-9-]{0,23}$/.test(name);
}

export function mcpDefEnvKey(name: string): string {
  return `${MCP_DEF_ENV_PREFIX}${name.toUpperCase().replace(/-/g, "_")}`;
}

/** Parse a `NEOMOKA_MCP` value into an ordered, deduplicated name list. */
export function parseMcpList(value: string | undefined | null): string[] {
  if (value == null) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of value.split(",")) {
    const name = raw.trim();
    if (name.length === 0 || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function serializeMcpList(names: readonly string[]): string {
  return names.join(",");
}

/** Extract every connection defined in an env map, name-sorted. */
export function parseMcpDefs(
  envVars: Readonly<Record<string, string>>,
): McpConnectionDef[] {
  const defs: McpConnectionDef[] = [];
  for (const [key, value] of Object.entries(envVars)) {
    if (!key.startsWith(MCP_DEF_ENV_PREFIX)) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(value);
    } catch {
      continue;
    }
    if (typeof parsed !== "object" || parsed === null) continue;
    const record = parsed as Record<string, unknown>;
    const name =
      typeof record.name === "string" && isValidMcpName(record.name)
        ? record.name
        : null;
    if (!name || mcpDefEnvKey(name) !== key) continue;
    defs.push({
      name,
      url: typeof record.url === "string" ? record.url : undefined,
      auth: typeof record.auth === "string" ? record.auth : undefined,
      command: typeof record.command === "string" ? record.command : undefined,
    });
  }
  defs.sort((a, b) => a.name.localeCompare(b.name));
  return defs;
}

/**
 * The full catalog visible to assignment UIs: built-ins first, then
 * user-defined connections (a user definition never shadows a built-in).
 */
export function mcpCatalogNames(
  envVars: Readonly<Record<string, string>>,
): string[] {
  const names: string[] = [...BUILTIN_MCP_NAMES];
  for (const def of parseMcpDefs(envVars)) {
    if (!names.includes(def.name)) names.push(def.name);
  }
  return names;
}

/** Serialize a definition into its env entry. Throws on invalid input. */
export function mcpDefEnvEntry(def: McpConnectionDef): [string, string] {
  if (!isValidMcpName(def.name)) {
    throw new Error(`invalid MCP connection name: ${def.name}`);
  }
  const hasUrl = Boolean(def.url?.trim());
  const hasCommand = Boolean(def.command?.trim());
  if (hasUrl === hasCommand) {
    throw new Error("an MCP connection needs exactly one of url or command");
  }
  const body: Record<string, string> = { name: def.name };
  if (hasUrl) {
    body.url = (def.url as string).trim();
    const auth = def.auth?.trim();
    if (auth) body.auth = auth;
  } else {
    body.command = (def.command as string).trim();
  }
  return [mcpDefEnvKey(def.name), JSON.stringify(body)];
}

/** Apply a catalog edit to an env map, returning a new map. */
export function upsertMcpDef(
  envVars: Readonly<Record<string, string>>,
  def: McpConnectionDef,
): Record<string, string> {
  const [key, value] = mcpDefEnvEntry(def);
  return { ...envVars, [key]: value };
}

/**
 * Remove a connection: its definition and every mention in the given env
 * map's default list.
 */
export function removeMcpDef(
  envVars: Readonly<Record<string, string>>,
  name: string,
): Record<string, string> {
  const next = { ...envVars };
  delete next[mcpDefEnvKey(name)];
  const list = parseMcpList(next[MCP_LIST_ENV_KEY]);
  if (list.includes(name)) {
    next[MCP_LIST_ENV_KEY] = serializeMcpList(
      list.filter((entry) => entry !== name),
    );
  }
  return next;
}

/** Toggle a connection inside a scope's `NEOMOKA_MCP` list. */
export function toggleMcpName(
  envVars: Readonly<Record<string, string>>,
  name: string,
  enabled: boolean,
): Record<string, string> {
  const list = parseMcpList(envVars[MCP_LIST_ENV_KEY]);
  const has = list.includes(name);
  if (enabled === has) return { ...envVars };
  const nextList = enabled
    ? [...list, name]
    : list.filter((entry) => entry !== name);
  return { ...envVars, [MCP_LIST_ENV_KEY]: serializeMcpList(nextList) };
}
