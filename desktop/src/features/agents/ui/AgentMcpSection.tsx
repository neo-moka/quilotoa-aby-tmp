import { Plug } from "lucide-react";
import * as React from "react";

import {
  MCP_LIST_ENV_KEY,
  resolveAgentMcpSelection,
  serializeMcpList,
  toggleMcpName,
} from "@/features/agents/lib/mcpConnections";
import { useGlobalAgentConfig } from "@/features/agents/useGlobalAgentConfig";
import { Checkbox } from "@/shared/ui/checkbox";

import { useAgentRunLocation } from "./AgentRunLocationContext";
import type { EnvVarsValue } from "./EnvVarsEditor";

/**
 * Per-agent MCP assignment: a view over the agent's `NEOMOKA_MCP` env var.
 *
 * No var on the agent → it inherits the global default list ("Set agent
 * defaults" → MCP connections). Customizing writes the exact set; "Use
 * defaults" deletes the var again. Applied by the deploy provider on the
 * agent's next start, so the section only renders for remote run targets —
 * local agents don't go through a provider and would silently ignore it.
 */
export function AgentMcpSection({
  envVars,
  onEnvVarsChange,
}: {
  envVars: EnvVarsValue;
  onEnvVarsChange: (value: EnvVarsValue) => void;
}) {
  const runLocation = useAgentRunLocation();
  const { globalConfig } = useGlobalAgentConfig();

  const { catalog, customized, effective, globalDefaults } = React.useMemo(
    () => resolveAgentMcpSelection(envVars, globalConfig.env_vars ?? {}),
    [envVars, globalConfig.env_vars],
  );

  if (runLocation !== "remote" || catalog.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="agent-mcp-section">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-medium">
          <Plug aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
          MCP servers
        </h3>
        <button
          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          data-testid="agent-mcp-mode-toggle"
          onClick={() => {
            if (customized) {
              const next = { ...envVars };
              delete next[MCP_LIST_ENV_KEY];
              onEnvVarsChange(next);
            } else {
              onEnvVarsChange({
                ...envVars,
                [MCP_LIST_ENV_KEY]: serializeMcpList(globalDefaults),
              });
            }
          }}
          type="button"
        >
          {customized ? "Use defaults" : "Customize"}
        </button>
      </div>
      {customized ? (
        <ul className="flex flex-col gap-1">
          {catalog.map((name) => (
            <li key={name}>
              <label
                className="flex cursor-pointer items-center gap-2 text-sm"
                htmlFor={`agent-mcp-${name}`}
              >
                <Checkbox
                  data-testid={`agent-mcp-${name}`}
                  id={`agent-mcp-${name}`}
                  isSelected={effective.includes(name)}
                  onChange={(checked: boolean) =>
                    onEnvVarsChange(toggleMcpName(envVars, name, checked))
                  }
                />
                {name}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          Inheriting defaults:{" "}
          {effective.length > 0 ? effective.join(", ") : "none"}. Applied on the
          agent's next start.
        </p>
      )}
    </div>
  );
}
