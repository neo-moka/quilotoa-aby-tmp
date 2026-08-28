import { RecoveryScreen } from "./RecoveryScreen";

export function RelaunchRequiredScreen() {
  return (
    <RecoveryScreen
      testId="relaunch-required"
      title="Restart ABY to finish recovery"
      body="Your identity was updated. ABY needs to restart so syncing and agents run under it."
    />
  );
}
