import { Check, Copy } from "lucide-react";
import * as React from "react";

import { copyTextToClipboard } from "@/shared/lib/clipboard";
import { cn } from "@/shared/lib/cn";
import { safeNpub } from "@/shared/lib/nostrUtils";
import { truncatePubkey } from "@/shared/lib/pubkey";
import { Button } from "@/shared/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useHoverPopover } from "@/shared/ui/useHoverPopover";

/** Preserved from this site's hand-rolled timer; see `useHoverPopover`. */
const HOVER_CLOSE_DELAY_MS = 200;

type PubKeyProps = {
  /** 64-char hex pubkey. */
  pubkey: string;
  /**
   * `compact` — truncated hex, click/tap opens a popover with the full npub,
   * full hex, and copy buttons. The default for identity display in lists,
   * cards, and metadata rows.
   *
   * `full` — the complete npub rendered inline with copy buttons. Required on
   * security-decision surfaces (invite/approve, removal, trust/pairing, new
   * DM, key import): a truncated key is forgeable by vanity grinding, so
   * decisions must be made against the whole key.
   */
  variant?: "compact" | "full";
  /** Render compact keys as text when a parent row owns the interaction. */
  interactive?: boolean;
  className?: string;
  testId?: string;
};

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = React.useState(false);
  const resetTimer = React.useRef<number | undefined>(undefined);
  React.useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  return (
    <div className="flex min-w-0 items-start gap-1.5">
      <div className="min-w-0 flex-1">
        <div className="text-2xs font-medium text-muted-foreground">
          {label}
        </div>
        <div className="break-all font-mono text-xs">{value}</div>
      </div>
      <Button
        aria-label={`Copy ${label}`}
        onClick={() => {
          copyTextToClipboard(value, `${label} copied`);
          setCopied(true);
          window.clearTimeout(resetTimer.current);
          resetTimer.current = window.setTimeout(() => setCopied(false), 1500);
        }}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

function PubKeyDetails({ pubkey }: { pubkey: string }) {
  const npub = safeNpub(pubkey);
  return (
    <div className="space-y-2">
      {npub ? <CopyRow label="npub" value={npub} /> : null}
      <CopyRow label="hex" value={pubkey} />
    </div>
  );
}

/**
 * Canonical pubkey display. See the `variant` prop for when each form is
 * appropriate; never render a hand-truncated pubkey outside this component.
 */
export function PubKey({
  pubkey,
  variant = "compact",
  interactive = true,
  className,
  testId,
}: PubKeyProps) {
  const hover = useHoverPopover({ closeDelay: HOVER_CLOSE_DELAY_MS });
  // Only the pointer handlers, not the whole `triggerProps`. This trigger has
  // never opened on focus, and `PubKey` renders inside lists and cards — adding
  // it would pop a card open for every identity a keyboard user tabs past.
  // Enabling it is an accessibility change to make on purpose, not a side
  // effect of sharing the timers.
  const { onMouseEnter, onMouseLeave } = hover.triggerProps;

  if (variant === "full") {
    const npub = safeNpub(pubkey);
    return (
      <span
        className={cn("inline-flex min-w-0 items-center gap-1", className)}
        data-testid={testId}
      >
        <span className="break-all font-mono text-xs">{npub ?? pubkey}</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              aria-label="Copy public key"
              size="icon-xs"
              type="button"
              variant="ghost"
            >
              <Copy />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-96 max-w-[90vw]">
            <PubKeyDetails pubkey={pubkey} />
          </PopoverContent>
        </Popover>
      </span>
    );
  }

  if (!interactive) {
    return (
      <span className={cn("font-mono", className)} data-testid={testId}>
        {truncatePubkey(pubkey)}
      </span>
    );
  }

  return (
    <Popover onOpenChange={hover.setOpen} open={hover.open}>
      <PopoverTrigger asChild>
        <button
          aria-label="Show full public key"
          className={cn(
            "cursor-pointer rounded font-mono hover:underline focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
            className,
          )}
          data-testid={testId}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          type="button"
        >
          {truncatePubkey(pubkey)}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-96 max-w-[90vw]"
        {...hover.contentProps}
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <PubKeyDetails pubkey={pubkey} />
      </PopoverContent>
    </Popover>
  );
}
