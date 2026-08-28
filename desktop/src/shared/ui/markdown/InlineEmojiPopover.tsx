import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { useHoverPopover } from "@/shared/ui/useHoverPopover";

/** Preserved from this site's hand-rolled timer; see `useHoverPopover`. */
const INLINE_EMOJI_CLOSE_DELAY_MS = 150;

export function InlineEmojiPopover({
  alt,
  resolvedSrc,
}: {
  alt: string | undefined;
  resolvedSrc: string;
}) {
  const hover = useHoverPopover({ closeDelay: INLINE_EMOJI_CLOSE_DELAY_MS });
  const label = alt?.trim() || "Custom emoji";

  return (
    <Popover open={hover.open} onOpenChange={hover.setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex border-0 bg-transparent p-0 align-middle text-inherit"
          aria-label={label}
          {...hover.triggerProps}
        >
          <img
            alt={alt}
            title={label}
            src={resolvedSrc}
            data-custom-emoji=""
            className="mx-px inline-block h-[1.25em] w-auto max-w-none align-middle"
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="top"
        sideOffset={6}
        className="w-auto min-w-32 max-w-56 rounded-xl p-3"
        {...hover.contentProps}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center">
            <img
              alt={alt}
              src={resolvedSrc}
              className="inline-block h-12 w-12 object-contain"
              draggable={false}
            />
          </div>
          <div className="max-w-[12rem] text-balance text-sm font-semibold leading-snug text-popover-foreground">
            {label}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
