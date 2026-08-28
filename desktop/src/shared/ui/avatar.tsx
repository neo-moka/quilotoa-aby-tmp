import * as React from "react";
import {
  AvatarFallback as HeroAvatarFallback,
  AvatarImage as HeroAvatarImage,
  AvatarRoot as HeroAvatarRoot,
} from "@heroui/react/avatar";

import { cn } from "@/shared/lib/cn";

/**
 * HeroUI's Avatar is itself a thin layer over `@radix-ui/react-avatar` — the
 * same primitive this wrapper used directly before. Migrating changes which
 * package owns the styling, not the runtime behaviour, and it does NOT remove
 * Radix from the dependency tree.
 *
 * HeroUI's own `avatarVariants` classes land in `layer(components)` (see
 * `shared/styles/globals/heroui.css`), so the Tailwind utilities below — which
 * live in the later `utilities` layer — win on every property they name. The
 * defaults here therefore reproduce the previous appearance exactly; the two
 * marked neutralisations exist only to cancel a HeroUI default the old wrapper
 * never had.
 */

const Avatar = React.forwardRef<
  React.ElementRef<typeof HeroAvatarRoot>,
  React.ComponentPropsWithoutRef<typeof HeroAvatarRoot>
>(({ className, ...props }, ref) => (
  <HeroAvatarRoot
    ref={ref}
    className={cn(
      // `bg-transparent` neutralises HeroUI's `bg-default`: callers layer their
      // own fill on the fallback, and animated avatars need the root to stay
      // clear so their pop-out backdrop is not flattened.
      "relative flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-transparent",
      className,
    )}
    {...props}
  />
));
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof HeroAvatarImage>,
  React.ComponentPropsWithoutRef<typeof HeroAvatarImage>
>(({ className, ...props }, ref) => (
  <HeroAvatarImage
    ref={ref}
    className={cn("aspect-square h-full w-full avatar-sdr-clamp", className)}
    decoding="async"
    loading="lazy"
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof HeroAvatarFallback>,
  React.ComponentPropsWithoutRef<typeof HeroAvatarFallback>
>(({ className, ...props }, ref) => (
  <HeroAvatarFallback
    ref={ref}
    className={cn(
      // `text-[length:inherit]` neutralises HeroUI's `text-sm` on the fallback
      // slot. Callers (see `UserAvatar`) set the initials' size on the root and
      // rely on inheritance; a fixed size there would render every avatar's
      // initials at one step regardless of the avatar's own size.
      "flex h-full w-full items-center justify-center rounded-[inherit] bg-muted text-[length:inherit]",
      className,
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
