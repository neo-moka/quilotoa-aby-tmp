// The composer's caret is the contract this file exists to defend. Eighteen
// popovers open with `onOpenAutoFocus={e => e.preventDefault()}` so the emoji
// picker, the mention popovers and the typeahead comboboxes can appear without
// taking the keyboard away from the editor behind them — and they still have to
// dismiss on Escape and on a click outside while that focus sits elsewhere.
//
// Nothing else in the repo asserts on any of this. `just ci` does not run
// Playwright, there are no pixel baselines, and a popover that steals the
// keyboard or refuses to close passes typecheck, lint, build and CI in green;
// it only surfaces in a user's hands. These tests are the missing net, and they
// are the acceptance criteria for the HeroUI/React Aria port of `popover.tsx`
// (see `docs/heroui-migration/component-map.md` §6ter for why it has not
// landed).
import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
});

before(() => {
  Object.assign(globalThis, {
    // Node has its own `CustomEvent`/`Event` globals, and the mirroring loop
    // below skips anything already defined — so without these two the events
    // Radix constructs are rejected by jsdom's `dispatchEvent` as foreign.
    CustomEvent: dom.window.CustomEvent,
    document: dom.window.document,
    Element: dom.window.Element,
    Event: dom.window.Event,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    Node: dom.window.Node,
    window: dom.window,
  });
  dom.window.matchMedia = () => ({
    addEventListener() {},
    addListener() {},
    matches: false,
    removeEventListener() {},
    removeListener() {},
  });
  globalThis.matchMedia = dom.window.matchMedia;
  class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  }
  dom.window.ResizeObserver = ResizeObserver;
  globalThis.ResizeObserver = ResizeObserver;
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  for (const key of Object.getOwnPropertyNames(dom.window)) {
    if (key in globalThis) continue;
    try {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        get: () => dom.window[key],
      });
    } catch {
      // A few window properties cannot be mirrored onto globalThis; skip them.
    }
  }
});

afterEach(async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

after(() => dom.window.close());

/**
 * Renders a composer input beside a popover, the way every one of the
 * focus-sensitive call sites is shaped: an editor that owns the caret, a
 * trigger, and a panel with something focusable inside it.
 */
const renderPopover = async ({ contentProps = {}, open }) => {
  const { createElement: h } = await import("react");
  const { render } = await import("@testing-library/react");
  const popover = await import("@/shared/ui/popover");

  const result = render(
    h(
      "div",
      null,
      h("input", { "data-testid": "composer", type: "text" }),
      h(
        popover.Popover,
        { open, onOpenChange: () => {} },
        h(
          popover.PopoverTrigger,
          { asChild: true },
          h(
            "button",
            { "data-testid": "popover-trigger", type: "button" },
            "…",
          ),
        ),
        h(
          popover.PopoverContent,
          { "data-testid": "popover-content", ...contentProps },
          h(
            "button",
            { "data-testid": "popover-first-button", type: "button" },
            "First",
          ),
        ),
      ),
    ),
  );

  return { ...result, h, popover };
};

const focusComposer = async () => {
  const { screen } = await import("@testing-library/react");
  const composer = screen.getByTestId("composer");
  composer.focus();
  assert.equal(document.activeElement, composer, "composer starts focused");
  return composer;
};

/** The close-autofocus step is deferred a tick, exactly as Radix deferred it. */
const flushCloseAutoFocus = async () => {
  const { act } = await import("@testing-library/react");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1));
  });
};

test("a cancelled open event leaves the caret in the composer", async () => {
  const { rerender, h, popover } = await renderPopover({ open: false });
  const composer = await focusComposer();
  const { act, screen } = await import("@testing-library/react");

  await act(async () => {
    rerender(
      h(
        "div",
        null,
        h("input", { "data-testid": "composer", type: "text" }),
        h(
          popover.Popover,
          { open: true, onOpenChange: () => {} },
          h(
            popover.PopoverTrigger,
            { asChild: true },
            h(
              "button",
              { "data-testid": "popover-trigger", type: "button" },
              "…",
            ),
          ),
          h(
            popover.PopoverContent,
            {
              "data-testid": "popover-content",
              onOpenAutoFocus: (event) => event.preventDefault(),
            },
            h(
              "button",
              { "data-testid": "popover-first-button", type: "button" },
              "First",
            ),
          ),
        ),
      ),
    );
  });

  assert.ok(screen.getByTestId("popover-content"), "the popover did open");
  assert.equal(
    document.activeElement,
    composer,
    "focus stayed on the composer while the popover opened",
  );
});

test("an uncancelled open event focuses the first control inside", async () => {
  const { rerender, h, popover } = await renderPopover({ open: false });
  await focusComposer();
  const { act, screen } = await import("@testing-library/react");

  await act(async () => {
    rerender(
      h(
        "div",
        null,
        h("input", { "data-testid": "composer", type: "text" }),
        h(
          popover.Popover,
          { open: true, onOpenChange: () => {} },
          h(
            popover.PopoverTrigger,
            { asChild: true },
            h(
              "button",
              { "data-testid": "popover-trigger", type: "button" },
              "…",
            ),
          ),
          h(
            popover.PopoverContent,
            { "data-testid": "popover-content" },
            h(
              "button",
              { "data-testid": "popover-first-button", type: "button" },
              "First",
            ),
          ),
        ),
      ),
    );
  });

  assert.equal(
    document.activeElement,
    screen.getByTestId("popover-first-button"),
    "Radix focused the first tabbable child, not just the panel",
  );
});

test("closing returns focus to the trigger, and a cancelled close does not", async () => {
  const { createElement: h } = await import("react");
  const { act, render, screen } = await import("@testing-library/react");
  const popover = await import("@/shared/ui/popover");

  const tree = (open, onCloseAutoFocus) =>
    h(
      "div",
      null,
      h("input", { "data-testid": "composer", type: "text" }),
      h(
        popover.Popover,
        { open, onOpenChange: () => {} },
        h(
          popover.PopoverTrigger,
          { asChild: true },
          h(
            "button",
            { "data-testid": "popover-trigger", type: "button" },
            "…",
          ),
        ),
        h(
          popover.PopoverContent,
          { "data-testid": "popover-content", onCloseAutoFocus },
          h(
            "button",
            { "data-testid": "popover-first-button", type: "button" },
            "First",
          ),
        ),
      ),
    );

  const { rerender } = render(tree(true, undefined));
  await act(async () => {
    rerender(tree(false, undefined));
  });
  await flushCloseAutoFocus();
  assert.equal(
    document.activeElement,
    screen.getByTestId("popover-trigger"),
    "the default close hands focus back to the trigger",
  );

  // Now the cancelled variant: the composer keeps the caret it was given.
  await act(async () => {
    rerender(tree(true, (event) => event.preventDefault()));
  });
  const composer = screen.getByTestId("composer");
  composer.focus();
  await act(async () => {
    rerender(tree(false, (event) => event.preventDefault()));
  });
  await flushCloseAutoFocus();
  assert.equal(
    document.activeElement,
    composer,
    "a cancelled close leaves focus wherever the call site put it",
  );
});

test("a popover that never took focus still dismisses", async () => {
  const { createElement: h } = await import("react");
  const { act, render, screen } = await import("@testing-library/react");
  const popover = await import("@/shared/ui/popover");

  const openChanges = [];
  const tree = h(
    "div",
    null,
    h("input", { "data-testid": "composer", type: "text" }),
    h("button", { "data-testid": "outside", type: "button" }, "Elsewhere"),
    h(
      popover.Popover,
      { open: true, onOpenChange: (next) => openChanges.push(next) },
      h(
        popover.PopoverTrigger,
        { asChild: true },
        h("button", { "data-testid": "popover-trigger", type: "button" }, "…"),
      ),
      h(
        popover.PopoverContent,
        {
          "data-testid": "popover-content",
          onOpenAutoFocus: (event) => event.preventDefault(),
        },
        h("button", { type: "button" }, "Inside"),
      ),
    ),
  );

  render(tree);
  const composer = screen.getByTestId("composer");
  composer.focus();

  // Escape while the caret is in the composer, i.e. outside the popover. React
  // Aria's `useOverlay` puts this handler on the overlay element, so it would
  // never fire here.
  await act(async () => {
    composer.dispatchEvent(
      new dom.window.KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Escape",
      }),
    );
  });
  assert.ok(
    openChanges.length > 0 && openChanges.every((next) => next === false),
    "Escape closes the popover even though focus never entered it",
  );

  // And a pointer interaction outside it. React Aria derives
  // `isDismissable: !isNonModal`, so its non-modal popover ignores this.
  openChanges.length = 0;
  const outside = screen.getByTestId("outside");
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
      outside.dispatchEvent(
        new dom.window.MouseEvent(type, { bubbles: true, cancelable: true }),
      );
    }
  });
  assert.ok(
    openChanges.length > 0 && openChanges.every((next) => next === false),
    "an outside click closes the popover even though focus never entered it",
  );
});

test("the panel keeps the dialog role and the caller's test id", async () => {
  await renderPopover({ open: true });
  const { screen } = await import("@testing-library/react");

  const content = screen.getByTestId("popover-content");
  assert.equal(content.getAttribute("role"), "dialog");
  assert.equal(
    screen.getAllByRole("dialog").length,
    1,
    "exactly one dialog node, so `getByRole` stays unambiguous",
  );
  assert.equal(
    screen.getByTestId("popover-trigger").getAttribute("aria-expanded"),
    "true",
  );
});
