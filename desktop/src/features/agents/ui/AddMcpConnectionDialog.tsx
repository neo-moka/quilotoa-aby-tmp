import * as React from "react";

import {
  validateMcpDraft,
  type McpConnectionDef,
  type McpDraft,
} from "@/features/agents/lib/mcpConnections";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { SegmentedControl } from "@/shared/ui/segmented-control";

const EMPTY_DRAFT: McpDraft = {
  name: "",
  kind: "remote",
  url: "",
  authMode: "apikey",
  auth: "",
  command: "",
};

/**
 * "Add a custom MCP server" — the connectors-style dialog for the global MCP
 * catalog. Deliberately narrower than the big-SaaS reference it mirrors:
 * agents authenticate with one shared org credential (a bearer the server
 * stores per connection), so there is no OAuth flow and no per-user account
 * choice — the honest knobs are the transport, the key, and whether the
 * connection defaults to the whole fleet or stays opt-in per agent.
 */
export function AddMcpConnectionDialog({
  existingNames,
  onAdd,
  onOpenChange,
  open,
}: {
  existingNames: readonly string[];
  /** Store the definition; `fleetDefault` turns it on for all agents. */
  onAdd: (def: McpConnectionDef, fleetDefault: boolean) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [draft, setDraft] = React.useState<McpDraft>(EMPTY_DRAFT);
  const [audience, setAudience] = React.useState<"everyone" | "per-agent">(
    "everyone",
  );
  const [error, setError] = React.useState<string | null>(null);

  const patchDraft = (patch: Partial<McpDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setError(null);
  };

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDraft(EMPTY_DRAFT);
      setAudience("everyone");
      setError(null);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = () => {
    const result = validateMcpDraft(draft, existingNames);
    if (result.error !== undefined) {
      setError(result.error);
      return;
    }
    onAdd(result.def, audience === "everyone");
    close(false);
  };

  return (
    <Dialog onOpenChange={close} open={open}>
      <DialogContent className="max-w-md" data-testid="add-mcp-dialog">
        <DialogHeader>
          <DialogTitle>Add a custom MCP server</DialogTitle>
          <DialogDescription>
            Shared tool server for your remotely deployed agents. The credential
            is stored once on the deploy server; agents get access on their next
            start.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="mcp-add-name">
              Name
            </label>
            <Input
              id="mcp-add-name"
              onChange={(event) => patchDraft({ name: event.target.value })}
              placeholder="notion"
              value={draft.name}
            />
          </div>

          <SegmentedControl
            legend="Connection type"
            onValueChange={(kind: "remote" | "command") => patchDraft({ kind })}
            optionTestIdPrefix="mcp-add-kind"
            options={[
              { value: "remote", label: "Remote URL" },
              { value: "command", label: "Command" },
            ]}
            testId="mcp-add-kind"
            value={draft.kind}
          />

          {draft.kind === "remote" ? (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="mcp-add-url">
                  Server URL
                </label>
                <Input
                  id="mcp-add-url"
                  onChange={(event) => patchDraft({ url: event.target.value })}
                  placeholder="https://mcp.example.com/mcp"
                  value={draft.url}
                />
              </div>
              <SegmentedControl
                legend="Authentication"
                onValueChange={(authMode: "apikey" | "none") =>
                  patchDraft({ authMode })
                }
                optionTestIdPrefix="mcp-add-auth"
                options={[
                  { value: "apikey", label: "API key" },
                  { value: "none", label: "None" },
                ]}
                testId="mcp-add-auth"
                value={draft.authMode}
              />
              {draft.authMode === "apikey" ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium" htmlFor="mcp-add-key">
                    API key
                  </label>
                  <Input
                    id="mcp-add-key"
                    onChange={(event) =>
                      patchDraft({ auth: event.target.value })
                    }
                    placeholder="sk-..."
                    type="password"
                    value={draft.auth}
                  />
                  <p className="text-xs text-muted-foreground">
                    Sent as a Bearer header. Stored server-side, shared by every
                    agent you enable this for.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="mcp-add-command">
                Command
              </label>
              <Input
                id="mcp-add-command"
                onChange={(event) =>
                  patchDraft({ command: event.target.value })
                }
                placeholder="/opt/buzz-agents/bin/my-mcp"
                value={draft.command}
              />
              <p className="text-xs text-muted-foreground">
                A stdio executable available on the deploy server.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <SegmentedControl
              legend="Who can use this?"
              onValueChange={setAudience}
              optionTestIdPrefix="mcp-add-audience"
              options={[
                { value: "everyone", label: "All agents" },
                { value: "per-agent", label: "Per agent" },
              ]}
              testId="mcp-add-audience"
              value={audience}
            />
            <p className="text-xs text-muted-foreground">
              {audience === "everyone"
                ? "Enabled by default for every remote agent."
                : "Off by default — turn it on in each agent's MCP section."}
            </p>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button onClick={() => close(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            data-testid="mcp-add-submit"
            onClick={handleSubmit}
            type="button"
          >
            Add connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
