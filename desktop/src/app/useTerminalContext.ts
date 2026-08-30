import * as React from "react";

import type { Channel } from "@/shared/api/types";
import { safeNpub } from "@/shared/lib/nostrUtils";

type TerminalContext = {
  channelId: string | null;
  channelName: string | null;
  threadId: string | null;
  npub: string | null;
  relayUrl: string | null;
};

type TerminalContextResult = {
  activeChannel: Channel | null;
  terminalContext: TerminalContext;
};

export function useTerminalContext({
  channelId,
  channels,
  locationSearch,
  pubkey,
  relayUrl,
}: {
  channelId: string | null;
  channels: Channel[];
  locationSearch: unknown;
  pubkey?: string;
  relayUrl?: string;
}): TerminalContextResult {
  return React.useMemo(() => {
    const search = locationSearch as {
      thread?: unknown;
      threadRootId?: unknown;
    };
    const threadId = search.threadRootId ?? search.thread;
    const activeChannel = channelId
      ? (channels.find((candidate) => candidate.id === channelId) ?? null)
      : null;

    return {
      activeChannel,
      terminalContext: {
        channelId,
        channelName: activeChannel?.name ?? null,
        threadId:
          channelId && typeof threadId === "string" && threadId.length > 0
            ? threadId
            : null,
        npub: pubkey ? safeNpub(pubkey) : null,
        relayUrl: relayUrl ?? null,
      },
    };
  }, [channelId, channels, locationSearch, pubkey, relayUrl]);
}

/** Whether the resolved context is complete enough to open a terminal. */
export function terminalContextReady(context: {
  channelId: string | null;
  npub: string | null;
  relayUrl: string | null;
}): boolean {
  return Boolean(context.channelId && context.npub && context.relayUrl);
}

/** Applies a surface-scoped override (e.g. a lens pinning its channel). */
export function applyTerminalContextOverride<
  T extends {
    channelId: string | null;
    channelName: string | null;
    threadId: string | null;
  },
>(context: T, override: { channelId: string; channelName: string } | null): T {
  if (!override) return context;
  return {
    ...context,
    channelId: override.channelId,
    channelName: override.channelName,
    threadId: null,
  };
}

/** Terminal context with the surface-override state bundled in. */
export function useEffectiveTerminalContext(
  input: Parameters<typeof useTerminalContext>[0],
) {
  const [override, setTerminalContextOverride] = React.useState<{
    channelId: string;
    channelName: string;
  } | null>(null);
  const { activeChannel, terminalContext } = useTerminalContext(input);
  return {
    activeChannel,
    effectiveTerminalContext: applyTerminalContextOverride(
      terminalContext,
      override,
    ),
    setTerminalContextOverride,
  };
}
