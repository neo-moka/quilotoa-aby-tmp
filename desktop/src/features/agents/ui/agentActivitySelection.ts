/**
 * Which agent the activity panel should show.
 *
 * Split out of the panel because it is the only real logic in it, and because
 * the panel itself cannot be exercised without a DOM: the fallback order is
 * what decides whether opening the panel mid-turn lands on something moving or
 * on an idle first row.
 *
 * Order, and the reason for each step:
 *
 * 1. An explicit choice, but only while it is still selectable — an agent can
 *    stop or be removed while its pubkey sits in the URL, and a stale value
 *    must not blank the panel.
 * 2. Otherwise the first agent with a turn in flight, so the panel opens on
 *    activity rather than on alphabetical chance.
 * 3. Otherwise the first agent, so a panel with agents is never empty.
 */
export function resolveActivityAgentPubkey({
  agentPubkeys,
  selectedPubkey,
  workingPubkeys,
}: {
  agentPubkeys: readonly string[];
  selectedPubkey: string | null;
  workingPubkeys: ReadonlySet<string>;
}): string | null {
  if (selectedPubkey && agentPubkeys.includes(selectedPubkey)) {
    return selectedPubkey;
  }

  return (
    agentPubkeys.find((pubkey) => workingPubkeys.has(pubkey)) ??
    agentPubkeys[0] ??
    null
  );
}
