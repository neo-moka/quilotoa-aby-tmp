import type { ManagedAgent } from "@/shared/api/types";
import { Select } from "@/shared/ui/select";

type AddChannelBotReuseGuardProps = {
  reusableAgent: ManagedAgent;
  forceNew: boolean;
  onForceNewChange: (forceNew: boolean) => void;
  disabled: boolean;
};

export function AddChannelBotReuseGuard({
  reusableAgent,
  forceNew,
  onForceNewChange,
  disabled,
}: AddChannelBotReuseGuardProps) {
  const statusLabel =
    reusableAgent.status === "running" || reusableAgent.status === "deployed"
      ? "running"
      : "stopped";

  return (
    <div className="space-y-2" data-testid="agent-instance-mode">
      <label className="text-sm font-medium" htmlFor="agent-instance-mode">
        Agent instance
      </label>
      <Select
        disabled={disabled}
        id="agent-instance-mode"
        onChange={(e) => onForceNewChange(e.target.value === "new")}
        value={forceNew ? "new" : "reuse"}
      >
        <option value="reuse">Reuse existing agent</option>
        <option value="new">Create new instance</option>
      </Select>
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {reusableAgent.name}
        </span>{" "}
        is already {statusLabel}. Reusing adds it to this channel without
        creating a duplicate keypair.
      </p>
    </div>
  );
}
