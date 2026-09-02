import { Plug, Trash2 } from "lucide-react";
import * as React from "react";

import {
  BUILTIN_MCP_NAMES,
  MCP_LIST_ENV_KEY,
  parseMcpDefs,
  parseMcpList,
  removeMcpDef,
  toggleMcpName,
  upsertMcpDef,
  validateMcpDraft,
  type McpConnectionDef,
} from "@/features/agents/lib/mcpConnections";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";

type ConnectionRow = McpConnectionDef & { builtin: boolean };

/**
 * Global MCP connections catalog, edited as a view over the defaults env map
 * (`NEOMOKA_MCP` + `NEOMOKA_MCP_DEF_*`). Definitions travel to remote agents
 * through the normal global→agent env layering; the deploy provider
 * materializes each connection on the target server and applies the default
 * list on every agent Start. Local agents ignore these vars.
 */
export function McpConnectionsSection({
  envVars,
  onEnvVarsChange,
}: {
  envVars: Record<string, string>;
  onEnvVarsChange: (next: Record<string, string>) => void;
}) {
  const defaults = React.useMemo(
    () => new Set(parseMcpList(envVars[MCP_LIST_ENV_KEY])),
    [envVars],
  );
  const rows = React.useMemo<ConnectionRow[]>(() => {
    const defined = parseMcpDefs(envVars).map((def) => ({
      ...def,
      builtin: false,
    }));
    const builtins: ConnectionRow[] = BUILTIN_MCP_NAMES.filter(
      (name) => !defined.some((def) => def.name === name),
    ).map((name) => ({ name, builtin: true }));
    return [...builtins, ...defined];
  }, [envVars]);

  const [draftName, setDraftName] = React.useState("");
  const [draftKind, setDraftKind] = React.useState<"remote" | "command">(
    "remote",
  );
  const [draftUrl, setDraftUrl] = React.useState("");
  const [draftAuth, setDraftAuth] = React.useState("");
  const [draftCommand, setDraftCommand] = React.useState("");
  const [draftError, setDraftError] = React.useState<string | null>(null);

  const resetDraft = () => {
    setDraftName("");
    setDraftUrl("");
    setDraftAuth("");
    setDraftCommand("");
    setDraftError(null);
  };

  const handleAdd = () => {
    const result = validateMcpDraft(
      {
        name: draftName,
        kind: draftKind,
        url: draftUrl,
        auth: draftAuth,
        command: draftCommand,
      },
      rows.map((row) => row.name),
    );
    if (result.error !== undefined) {
      setDraftError(result.error);
      return;
    }
    onEnvVarsChange(upsertMcpDef(envVars, result.def));
    resetDraft();
  };

  return (
    <div className="space-y-3" data-testid="mcp-connections-section">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Plug aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
          MCP connections
        </h3>
        <p className="text-xs text-muted-foreground">
          Shared tool servers for remotely deployed agents. Define a connection
          once, then turn it on for the whole fleet here or per agent in each
          agent's MCP section. Changes reach an agent on its next start.
        </p>
      </div>

      {rows.length > 0 ? (
        <ul className="flex flex-col gap-1.5">
          {rows.map((row) => (
            <li
              className="flex items-center gap-3 rounded-md border border-border/60 px-3 py-2"
              data-testid={`mcp-connection-${row.name}`}
              key={row.name}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.builtin
                    ? "Built-in — provisioned on the server"
                    : (row.url ?? row.command)}
                </p>
              </div>
              <label
                className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
                htmlFor={`mcp-default-${row.name}`}
              >
                Default for all agents
                <Switch
                  data-testid={`mcp-default-${row.name}`}
                  id={`mcp-default-${row.name}`}
                  isSelected={defaults.has(row.name)}
                  onChange={(checked: boolean) =>
                    onEnvVarsChange(toggleMcpName(envVars, row.name, checked))
                  }
                />
              </label>
              {row.builtin ? null : (
                <Button
                  aria-label={`Remove ${row.name}`}
                  onClick={() =>
                    onEnvVarsChange(removeMcpDef(envVars, row.name))
                  }
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="space-y-2 rounded-md border border-dashed border-border/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Connection name"
            className="h-8 w-36"
            onChange={(event) => setDraftName(event.target.value)}
            placeholder="name (e.g. meli-ads)"
            value={draftName}
          />
          <div className="flex items-center gap-1 rounded-md bg-muted/50 p-0.5 text-xs">
            {(["remote", "command"] as const).map((kind) => (
              <button
                className={
                  draftKind === kind
                    ? "rounded bg-background px-2 py-1 font-medium shadow-sm"
                    : "rounded px-2 py-1 text-muted-foreground"
                }
                key={kind}
                onClick={() => setDraftKind(kind)}
                type="button"
              >
                {kind === "remote" ? "Remote URL" : "Command"}
              </button>
            ))}
          </div>
        </div>
        {draftKind === "remote" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              aria-label="MCP URL"
              className="h-8 min-w-56 flex-1"
              onChange={(event) => setDraftUrl(event.target.value)}
              placeholder="https://host/mcp"
              value={draftUrl}
            />
            <Input
              aria-label="Bearer credential"
              className="h-8 w-44"
              onChange={(event) => setDraftAuth(event.target.value)}
              placeholder="bearer (optional)"
              type="password"
              value={draftAuth}
            />
          </div>
        ) : (
          <Input
            aria-label="Command path"
            className="h-8 w-full"
            onChange={(event) => setDraftCommand(event.target.value)}
            placeholder="/opt/buzz-agents/bin/my-mcp"
            value={draftCommand}
          />
        )}
        {draftError ? (
          <p className="text-xs text-destructive">{draftError}</p>
        ) : null}
        <Button onClick={handleAdd} size="sm" type="button" variant="secondary">
          Add connection
        </Button>
      </div>
    </div>
  );
}
