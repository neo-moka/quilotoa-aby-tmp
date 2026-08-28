/* Sonner-compatible façade over HeroUI's Toast.
 *
 * Eighty-eight modules call `toast.success(…)` / `toast.error(…)` directly.
 * Rewriting those call sites would have been the bulk of this migration and
 * none of its value, so the imperative surface they already use is kept
 * verbatim and only its implementation moved to `@heroui/react`. Consumers
 * changed one import specifier and nothing else.
 *
 * The two libraries agree on more than they disagree: HeroUI's own
 * `DEFAULT_TOAST_TIMEOUT` is commented "matches sonner's default". What it
 * lacks is documented at each mapping below.
 */
import { Spinner, Toast, toast as heroToast } from "@heroui/react";
import type { ToastContentValue } from "@heroui/react";
import type { ReactNode } from "react";

/* Sonner's visual defaults. HeroUI ships wider toasts (460) and a tighter
   stack (12), so restate sonner's numbers rather than inherit a resize the
   user would notice. `bottom end` is sonner's `bottom-right`. */
const TOAST_WIDTH = 356;
const TOAST_GAP = 14;
const MAX_VISIBLE_TOASTS = 3;

/** Sonner accepts a caller-chosen id of either type. */
type ToastId = string | number;

type ToastVariant = "default" | "success" | "danger" | "warning" | "info";

/* Sonner hands the action a DOM event and re-reads `defaultPrevented` after
   the handler returns. Only `preventDefault` is ever called on it here, so
   that is all the shim promises — a narrower type than sonner's MouseEvent,
   and enough for every existing handler. */
interface ToastActionEvent {
  preventDefault: () => void;
}

interface ToastAction {
  label: ReactNode;
  onClick: (event: ToastActionEvent) => void;
}

export interface ToastOptions {
  action?: ToastAction | undefined;
  description?: ReactNode;
  /** Milliseconds; `Number.POSITIVE_INFINITY` pins the toast open. */
  duration?: number;
  id?: ToastId | undefined;
}

/* Caller ids are HeroUI's one real gap: `ToastQueue.add` mints its own key and
   offers no way to supply one, so the correspondence is kept here. Entries are
   dropped in `onClose`, which bounds the map to toasts that are actually on
   screen. */
const heroKeyById = new Map<ToastId, string>();
let generatedIdCount = 0;

/** Mutable because the action handler needs a key that `add` has not returned yet. */
interface ToastHandle {
  key: string | undefined;
}

function resolveTimeout(
  variant: ToastVariant | "loading",
  duration: number | undefined,
): number | undefined {
  // Sonner's loading toasts never expire on their own; something later
  // replaces or dismisses them.
  if (variant === "loading") {
    return duration !== undefined && Number.isFinite(duration) ? duration : 0;
  }
  // Undefined defers to HeroUI's 4000ms, which is already sonner's lifetime.
  if (duration === undefined) return undefined;
  // HeroUI spells "never auto-dismiss" as 0, sonner as Infinity.
  return Number.isFinite(duration) ? duration : 0;
}

function runAction(handle: ToastHandle, action: ToastAction): void {
  let isDefaultPrevented = false;
  action.onClick({
    preventDefault: () => {
      isDefaultPrevented = true;
    },
  });
  if (isDefaultPrevented) return;
  // Sonner closes an action toast once its handler resolves. HeroUI does not,
  // so reproduce it. Handlers that replaced this toast (same caller id) have
  // already left `handle.key` pointing at the closed one, making this a no-op
  // rather than a close of their replacement.
  if (handle.key !== undefined) heroToast.close(handle.key);
}

function emit(
  variant: ToastVariant | "loading",
  message: ReactNode,
  options: Parameters<typeof heroToast>[1],
): string {
  switch (variant) {
    case "success":
      return heroToast.success(message, options);
    case "danger":
      return heroToast.danger(message, options);
    case "warning":
      return heroToast.warning(message, options);
    case "info":
      return heroToast.info(message, options);
    default:
      return heroToast(message, options);
  }
}

function show(
  variant: ToastVariant | "loading",
  message: ReactNode,
  options?: ToastOptions,
): ToastId {
  generatedIdCount += 1;
  const id = options?.id ?? `buzz-toast-${generatedIdCount}`;

  /* Sonner updates a toast in place when its id is reused. HeroUI has no
     update, so the old one is closed and a replacement queued — which is the
     pattern HeroUI's own docs use for loading→result chains. The visible
     difference is that the replacement re-enters the stack instead of morphing
     in place. */
  const superseded = heroKeyById.get(id);
  if (superseded !== undefined) heroToast.close(superseded);

  const action = options?.action;
  const handle: ToastHandle = { key: undefined };

  const key = emit(variant, message, {
    ...(action
      ? {
          actionProps: {
            children: action.label,
            onPress: () => runAction(handle, action),
          },
        }
      : {}),
    description: options?.description,
    isLoading: variant === "loading",
    onClose: () => {
      // Only retire the mapping this toast still owns; a same-id replacement
      // has already claimed the entry.
      if (heroKeyById.get(id) === handle.key) heroKeyById.delete(id);
    },
    timeout: resolveTimeout(variant, options?.duration),
  });

  handle.key = key;
  heroKeyById.set(id, key);
  return id;
}

function dismiss(id?: ToastId): void {
  if (id === undefined) {
    heroToast.clear();
    heroKeyById.clear();
    return;
  }
  const key = heroKeyById.get(id);
  // Callers dismiss ids that may never have been shown; stay quiet.
  if (key === undefined) return;
  heroToast.close(key);
  heroKeyById.delete(id);
}

/**
 * Sonner's imperative toast API, backed by HeroUI.
 *
 * Every method returns the id the toast was filed under — pass it back as
 * `options.id` to replace that toast, or to `dismiss` to close it.
 */
export const toast = Object.assign(
  (message: ReactNode, options?: ToastOptions) =>
    show("default", message, options),
  {
    dismiss,
    /* Sonner's "error" is HeroUI's "danger"; the rename stops at this line. */
    error: (message: ReactNode, options?: ToastOptions) =>
      show("danger", message, options),
    info: (message: ReactNode, options?: ToastOptions) =>
      show("info", message, options),
    loading: (message: ReactNode, options?: ToastOptions) =>
      show("loading", message, options),
    success: (message: ReactNode, options?: ToastOptions) =>
      show("success", message, options),
    warning: (message: ReactNode, options?: ToastOptions) =>
      show("warning", message, options),
  },
);

/**
 * Clears the toast region and its id registry.
 *
 * Registered with `resetCommunityState` so a departing community cannot leave
 * a pinned toast — or a stale id mapping — addressing the next one.
 */
export function resetToasts(): void {
  heroToast.clear();
  heroKeyById.clear();
}

/**
 * Mounts the toast region. Rendered once, at the app root.
 */
export function Toaster() {
  return (
    <Toast.Provider
      gap={TOAST_GAP}
      maxVisibleToasts={MAX_VISIBLE_TOASTS}
      placement="bottom end"
      width={TOAST_WIDTH}
    >
      {({ toast: item }) => {
        const content = (item.content ?? {}) as ToastContentValue;
        return (
          /* `data-sonner-toast` and `data-removed` are not HeroUI's; they are
             sonner's, and eleven E2E specs select on them. Emitting them keeps
             those specs passing against a component sonner no longer renders.
             HeroUI unmounts a leaving toast rather than marking it, so anything
             in the DOM is by definition not removed. */
          <Toast
            data-removed="false"
            data-sonner-toast=""
            toast={item}
            variant={content.variant}
          >
            <Toast.Indicator variant={content.variant}>
              {content.isLoading ? (
                <Spinner color="current" size="sm" />
              ) : (
                content.indicator
              )}
            </Toast.Indicator>
            <Toast.Content>
              {content.title ? (
                <Toast.Title>{content.title}</Toast.Title>
              ) : null}
              {content.description ? (
                <Toast.Description>{content.description}</Toast.Description>
              ) : null}
            </Toast.Content>
            {content.actionProps?.children ? (
              /* `data-action` is sonner's too — one spec clicks the action
                 through it. */
              <Toast.ActionButton data-action="" {...content.actionProps} />
            ) : null}
            <Toast.CloseButton />
          </Toast>
        );
      }}
    </Toast.Provider>
  );
}
