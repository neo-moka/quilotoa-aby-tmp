import { Loader, Play, RefreshCw, Search, Wrench } from "lucide-react";
import * as React from "react";

import {
  filterMcpTools,
  mcpToolBadges,
  parseToolArguments,
} from "@/features/agents/lib/mcpToolsPanel";
import {
  mcpCallTool,
  mcpProbeTools,
  type McpToolInfo,
  type McpToolsProbe,
} from "@/shared/api/tauri";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";

const BADGE_TONE_CLASS: Record<string, string> = {
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  success: "bg-green-500/10 text-green-600 dark:text-green-400",
  destructive: "bg-destructive/10 text-destructive",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

type ProbeState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; probe: McpToolsProbe };

/**
 * "View tools" for one MCP connection: the live `tools/list`, searchable,
 * with the provider's behavior hints as badges — plus a try-it runner per
 * tool (raw JSON arguments in, raw MCP result out). Listing never runs a
 * tool; only the explicit Run button does.
 */
export function McpToolsDialog({
  auth,
  connectionName,
  onOpenChange,
  open,
  url,
}: {
  auth: string | null;
  connectionName: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  url: string;
}) {
  const [state, setState] = React.useState<ProbeState>({ phase: "loading" });
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const probe = React.useCallback(() => {
    setState({ phase: "loading" });
    mcpProbeTools(url, auth)
      .then((result) => setState({ phase: "ready", probe: result }))
      .catch((error) =>
        setState({
          phase: "error",
          message:
            typeof error === "string" ? error : "Couldn't reach the server.",
        }),
      );
  }, [auth, url]);

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setExpanded(null);
    probe();
  }, [open, probe]);

  const tools =
    state.phase === "ready" ? filterMcpTools(state.probe.tools, query) : [];

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="flex max-h-[80vh] max-w-3xl flex-col"
        data-testid="mcp-tools-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench aria-hidden className="h-4 w-4 text-muted-foreground" />
            Tools available to your agents
          </DialogTitle>
          <DialogDescription>
            Live from {connectionName}. Inspecting this list does not run a
            tool. Provider annotations are hints, not guarantees.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              aria-hidden
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search tools"
              className="h-9 pl-8"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools by name or description"
              value={query}
            />
          </div>
          {state.phase === "ready" ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {state.probe.tools.length} tools exposed
            </span>
          ) : null}
          <Button
            aria-label="Refresh tools"
            disabled={state.phase === "loading"}
            onClick={probe}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className="mr-1 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {state.phase === "loading" ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader className="size-4 animate-spin" />
              Contacting the server…
            </div>
          ) : state.phase === "error" ? (
            <p className="py-6 text-sm text-destructive">{state.message}</p>
          ) : tools.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No tools match.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {tools.map((tool) => (
                <ToolCard
                  auth={auth}
                  expanded={expanded === tool.name}
                  key={tool.name}
                  onToggle={() =>
                    setExpanded((current) =>
                      current === tool.name ? null : tool.name,
                    )
                  }
                  tool={tool}
                  url={url}
                />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolCard({
  auth,
  expanded,
  onToggle,
  tool,
  url,
}: {
  auth: string | null;
  expanded: boolean;
  onToggle: () => void;
  tool: McpToolInfo;
  url: string;
}) {
  const [args, setArgs] = React.useState("{}");
  const [running, setRunning] = React.useState(false);
  const [output, setOutput] = React.useState<string | null>(null);
  const [runError, setRunError] = React.useState<string | null>(null);

  const handleRun = () => {
    const parsed = parseToolArguments(args);
    if (parsed.error !== undefined) {
      setRunError(parsed.error);
      return;
    }
    setRunning(true);
    setRunError(null);
    setOutput(null);
    mcpCallTool(url, auth, tool.name, parsed.args)
      .then((result) => setOutput(JSON.stringify(result, null, 2)))
      .catch((error) =>
        setRunError(typeof error === "string" ? error : "Tool call failed."),
      )
      .finally(() => setRunning(false));
  };

  return (
    <li
      className={cn(
        "rounded-lg border border-border/60 p-3",
        expanded && "sm:col-span-2",
      )}
      data-testid={`mcp-tool-${tool.name}`}
    >
      <button
        className="block w-full text-left"
        onClick={onToggle}
        type="button"
      >
        <p className="text-sm font-medium">{tool.title ?? tool.name}</p>
        <p className="font-mono text-xs text-muted-foreground">{tool.name}</p>
        {tool.description ? (
          <p
            className={cn(
              "mt-1 text-xs text-muted-foreground",
              !expanded && "line-clamp-2",
            )}
          >
            {tool.description}
          </p>
        ) : null}
        <span className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium">
            {tool.inputCount} input{tool.inputCount === 1 ? "" : "s"}
          </span>
          {mcpToolBadges(tool.annotations).map((badge) => (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-2xs",
                BADGE_TONE_CLASS[badge.tone],
              )}
              key={badge.label}
            >
              {badge.label}
            </span>
          ))}
        </span>
      </button>

      {expanded ? (
        <div className="mt-3 space-y-2 border-t border-border/50 pt-3">
          <label
            className="text-xs font-medium text-muted-foreground"
            htmlFor={`mcp-args-${tool.name}`}
          >
            Arguments (JSON)
          </label>
          <textarea
            className="h-20 w-full resize-y rounded-md border border-border/60 bg-background p-2 font-mono text-xs"
            id={`mcp-args-${tool.name}`}
            onChange={(event) => setArgs(event.target.value)}
            spellCheck={false}
            value={args}
          />
          <div className="flex items-center gap-2">
            <Button
              data-testid={`mcp-run-${tool.name}`}
              disabled={running}
              onClick={handleRun}
              size="sm"
              type="button"
            >
              {running ? (
                <Loader className="mr-1 size-3.5 animate-spin" />
              ) : (
                <Play className="mr-1 h-3.5 w-3.5" />
              )}
              Run tool
            </Button>
            {tool.annotations.destructiveHint === true ? (
              <span className="text-xs text-destructive">
                Marked destructive by the provider — runs against real data.
              </span>
            ) : null}
          </div>
          {runError ? (
            <p className="text-xs text-destructive">{runError}</p>
          ) : null}
          {output !== null ? (
            <pre className="max-h-56 overflow-auto rounded-md bg-muted/40 p-2 text-xs">
              {output}
            </pre>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
