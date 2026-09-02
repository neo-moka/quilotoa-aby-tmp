import { Plug, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import {
  BUILTIN_MCP_NAMES,
  MCP_LIST_ENV_KEY,
  parseMcpDefs,
  parseMcpList,
  removeMcpDef,
  toggleMcpName,
  upsertMcpDef,
  type McpConnectionDef,
} from "@/features/agents/lib/mcpConnections";
import { Button } from "@/shared/ui/button";
import { Switch } from "@/shared/ui/switch";

import { AddMcpConnectionDialog } from "./AddMcpConnectionDialog";

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

  const [addOpen, setAddOpen] = React.useState(false);

  const handleAdd = (def: McpConnectionDef, fleetDefault: boolean) => {
    let next = upsertMcpDef(envVars, def);
    if (fleetDefault) next = toggleMcpName(next, def.name, true);
    onEnvVarsChange(next);
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

      <Button
        onClick={() => setAddOpen(true)}
        size="sm"
        type="button"
        variant="secondary"
      >
        <Plus className="mr-1 h-3.5 w-3.5" />
        Add connection
      </Button>

      <AddMcpConnectionDialog
        existingNames={rows.map((row) => row.name)}
        onAdd={handleAdd}
        onOpenChange={setAddOpen}
        open={addOpen}
      />
    </div>
  );
}
