import type * as React from "react";
import { Settings2 } from "lucide-react";

import { ProfileAvatar } from "@/features/profile/ui/ProfileAvatar";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

import type { AgentGraphNode } from "./agentGraphModel";

/**
 * Who appears on the graph: every roster participant (agents and humans)
 * with a checkbox. Unchecking hides the node and every edge touching it;
 * the choice persists per user (see the storage wiring in AgentGraphView).
 */
export function AgentGraphFilterPopover({
  nodes,
  hiddenPubkeys,
  onToggle,
}: {
  /** The FULL unfiltered node list, so hidden participants stay listed. */
  nodes: AgentGraphNode[];
  hiddenPubkeys: ReadonlySet<string>;
  onToggle: (pubkey: string, visible: boolean) => void;
}): React.ReactElement {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Choose who appears in the graph"
          data-testid="agent-graph-filter-trigger"
          size="icon"
          title="Who appears"
          type="button"
          variant="ghost"
        >
          <Settings2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2" side="left">
        <p className="px-2 pb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
          Show in graph
        </p>
        <ul className="flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {nodes.map((node) => (
            <li key={node.pubkey}>
              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60">
                <Checkbox
                  isSelected={!hiddenPubkeys.has(node.pubkey)}
                  onChange={(checked) =>
                    onToggle(node.pubkey, checked === true)
                  }
                />
                <ProfileAvatar
                  avatarUrl={node.avatarUrl}
                  className="h-5 w-5 shrink-0"
                  label={node.name}
                />
                <span className="min-w-0 truncate text-sm">
                  {node.name}
                  {node.isViewer ? " (you)" : ""}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
