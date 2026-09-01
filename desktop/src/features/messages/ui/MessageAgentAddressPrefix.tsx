import * as React from "react";

import type { UserProfileLookup } from "@/features/profile/lib/identity";
import { UserProfilePopover } from "@/features/profile/ui/UserProfilePopover";
import { truncatePubkey } from "@/shared/lib/pubkey";
import { InlineChip } from "@/shared/ui/InlineChip";

/** Visible send-state prefix for recipients kept in the composer address tray. */
export function MessageAgentAddressPrefix({
  profiles,
  pubkeys,
}: {
  profiles?: UserProfileLookup;
  pubkeys: readonly string[];
}) {
  // The leading-inline-content marker can inject this prefix into any first
  // prose block of the message body — including headings, whose
  // text-xl/semibold typography the chips would otherwise inherit.
  // Addressing is metadata, not prose: pin it to the conversation base size
  // regardless of the host block.
  return (
    <span className="text-message font-normal tracking-normal">
      {pubkeys.map((pubkey) => {
        const profile = profiles?.[pubkey];
        const label =
          profile?.displayName?.trim() ||
          profile?.name?.trim() ||
          truncatePubkey(pubkey);
        return (
          <React.Fragment key={pubkey}>
            {/* biome-ignore lint/a11y/useValidAriaRole: UserProfilePopover uses role for agent classification, not as an ARIA attribute. */}
            <UserProfilePopover
              botIdenticonValue={label}
              pubkey={pubkey}
              role="bot"
              triggerElement="span"
            >
              <InlineChip
                className="agent-mention-highlight"
                data-mention=""
                icon="agent"
                interactive
              >
                {label}
              </InlineChip>
            </UserProfilePopover>{" "}
          </React.Fragment>
        );
      })}
    </span>
  );
}
