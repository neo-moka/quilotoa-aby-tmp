import {
  Clock3,
  Octagon,
  Settings,
  Sparkles,
  TerminalSquare,
} from "lucide-react";

import type { ActiveTurnSummary } from "@/features/agents/activeAgentTurnsStore";
import { cancelManagedAgentTurn } from "@/shared/api/agentControl";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Switch } from "@/shared/ui/switch";
import { toast } from "@/shared/ui/toast";
import {
  setTranscriptAnimationEnabled,
  useTranscriptAnimationEnabled,
} from "./transcriptAnimationPreference";
import {
  setTranscriptTimestampsEnabled,
  useTranscriptTimestampsEnabled,
} from "./transcriptTimestampPreference";

/**
 * View settings for the activity panel, plus the one action that is not a view
 * setting.
 *
 * Three of the four controls carry over from the channel panel unchanged, and
 * two of them needed no decision because the code had already made it:
 * `setTranscriptAnimationEnabled` and `setTranscriptTimestampsEnabled` are
 * device-level stores shared by every transcript surface, so they are neither
 * per-agent nor per-panel — toggling here changes the channel panel too, which
 * is the existing contract, not a new one.
 *
 * Animations also already compose correctly with the system preference:
 * `AgentSessionTranscriptList` disables them when `prefers-reduced-motion` is
 * set *or* the toggle is off, so a user can switch them off while the system is
 * silent, but cannot switch them on against a system that asked for less
 * motion. That is the intended direction and needs no change here.
 *
 * **Stop current turn is the exception, and it is not merely ambiguous — it is
 * under-determined.** The control frame is `{ type: "cancel_turn", channelId }`,
 * so cancelling is per *turn in a channel*, and `useActiveAgentTurns` returns an
 * array precisely because one agent can be working in several channels at once.
 * A panel that is channel-agnostic therefore cannot always name what "the
 * current turn" is. Rather than guess a channel:
 *
 * - one active turn — enabled, and the label names the channel it will stop, so
 *   the target is stated rather than implied;
 * - several — disabled, pointing at the channel panel, which knows which turn
 *   the reader means because the reader is standing in it;
 * - none — disabled, as in the channel panel.
 */
export function AgentActivitySettingsMenu({
  activeTurns,
  agentName,
  agentPubkey,
  channelNameFor,
  onShowRawChange,
  showRaw,
}: {
  activeTurns: readonly ActiveTurnSummary[];
  agentName: string;
  agentPubkey: string;
  /** Resolves a channel id to a display name for the stop-turn label. */
  channelNameFor: (channelId: string) => string | null;
  onShowRawChange: (showRaw: boolean) => void;
  showRaw: boolean;
}) {
  const animateActivity = useTranscriptAnimationEnabled();
  const showTimestamps = useTranscriptTimestampsEnabled();

  const soleTurn = activeTurns.length === 1 ? activeTurns[0] : null;
  const soleTurnChannelName = soleTurn
    ? channelNameFor(soleTurn.channelId)
    : null;

  async function handleStopTurn(turn: ActiveTurnSummary) {
    try {
      await cancelManagedAgentTurn(agentPubkey, turn.channelId);
      toast.success(
        `Stop signal sent to ${agentName}. It may take a moment to respond.`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Failed to stop ${agentName}'s current turn.`,
      );
    }
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Activity settings"
          className="relative"
          data-testid="agent-activity-settings-trigger"
          size="icon-xs"
          variant="ghost"
        >
          <Settings />
          {activeTurns.length > 0 ? (
            <span
              aria-hidden="true"
              className="absolute right-1 bottom-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
              data-testid="agent-activity-settings-live-badge"
            />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-56"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DropdownMenuItem
          className="items-start gap-3"
          data-testid="agent-activity-toggle-raw-feed"
          onSelect={(event) => {
            event.preventDefault();
            onShowRawChange(!showRaw);
          }}
          title={
            showRaw
              ? "Hide raw JSON-RPC payloads."
              : "Show raw JSON-RPC payloads for this agent."
          }
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-medium">
              <TerminalSquare className="h-4 w-4 text-muted-foreground" />
              Raw
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Show raw JSON-RPC activity.
            </span>
          </span>
          <Switch
            aria-hidden="true"
            className="pointer-events-none mt-0.5"
            excludeFromTabOrder
            isSelected={showRaw}
          />
        </DropdownMenuItem>
        <DropdownMenuItem
          className="items-start gap-3"
          data-testid="agent-activity-toggle-animate-activity"
          disabled={showRaw}
          onSelect={(event) => {
            event.preventDefault();
            setTranscriptAnimationEnabled(!animateActivity);
          }}
          title={
            showRaw
              ? "Raw activity rows don't animate in."
              : animateActivity
                ? "Stop animating new activity rows."
                : "Animate new activity rows as they arrive."
          }
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Show Animations
            </span>
          </span>
          <Switch
            aria-hidden="true"
            className="pointer-events-none mt-0.5"
            excludeFromTabOrder
            isSelected={animateActivity && !showRaw}
          />
        </DropdownMenuItem>
        <DropdownMenuItem
          className="items-start gap-3"
          data-testid="agent-activity-toggle-show-timestamps"
          onSelect={(event) => {
            event.preventDefault();
            setTranscriptTimestampsEnabled(!showTimestamps);
          }}
          title={
            showTimestamps
              ? "Hide per-row activity timestamps."
              : "Show a timestamp under each activity row."
          }
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Clock3 className="h-4 w-4 text-muted-foreground" />
              Show Timestamps
            </span>
          </span>
          <Switch
            aria-hidden="true"
            className="pointer-events-none mt-0.5"
            excludeFromTabOrder
            isSelected={showTimestamps}
          />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="items-start gap-3"
          data-testid="agent-activity-stop-turn"
          disabled={soleTurn === null}
          onSelect={() => {
            if (soleTurn) void handleStopTurn(soleTurn);
          }}
          title={
            soleTurn
              ? "Interrupt the current ACP turn without stopping the agent process."
              : activeTurns.length > 1
                ? `${agentName} is working in ${activeTurns.length} channels — stop the turn from the channel it belongs to.`
                : "Available while the agent is working."
          }
        >
          <Octagon className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Stop current turn</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {soleTurn
                ? soleTurnChannelName
                  ? `In #${soleTurnChannelName}.`
                  : "In its active channel."
                : activeTurns.length > 1
                  ? `Working in ${activeTurns.length} channels.`
                  : "Available while the agent is working."}
            </span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
