import * as React from "react";
import { toSvg } from "jdenticon";

type IdenticonProps = {
  /** Stable seed. Use a pubkey, not a display name, so the image survives renames. */
  value: string;
  /** Rendered size in px. jdenticon rasterises to this box, so it is not a text size. */
  size?: number;
  className?: string;
  testId?: string;
};

/**
 * Deterministic geometric avatar, for identities that have neither a picture
 * nor a name.
 *
 * The alternative is initials, and initials of a key are worse than nothing:
 * `getInitials` strips the `…` out of a truncated npub and reads the two halves
 * as words, so every nameless account renders as "N" plus one random letter —
 * a plausible-looking monogram that belongs to no one. An identicon is honestly
 * non-verbal and, being seeded on the pubkey, is at least stable and distinct
 * per account.
 *
 * `features/messages/ui/BotIdenticon.tsx` does the same thing for numbered bot
 * copies. It predates this file and is not imported here — features may not
 * import from other features — so the two coexist until someone collapses that
 * one onto this.
 */
export const Identicon = React.memo(function Identicon({
  value,
  size = 32,
  className,
  testId,
}: IdenticonProps) {
  const svgHtml = React.useMemo(() => toSvg(value, size), [value, size]);

  return (
    <div
      aria-hidden="true"
      className={className}
      data-testid={testId}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: jdenticon emits its own SVG string.
      dangerouslySetInnerHTML={{ __html: svgHtml }}
      style={{ height: size, width: size }}
    />
  );
});
