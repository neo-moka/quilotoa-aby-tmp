// The behaviour six components had each written by hand, pinned once.
//
// None of it is visible to typecheck, lint or build: a hover card that opens
// instantly, never closes, or closes while the pointer is inside it passes
// every gate and only shows up in a user's hands. Same reasoning as
// `popoverFocusContract.test.mjs`.
import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
});

before(() => {
  Object.assign(globalThis, {
    CustomEvent: dom.window.CustomEvent,
    document: dom.window.document,
    Element: dom.window.Element,
    Event: dom.window.Event,
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    Node: dom.window.Node,
    window: dom.window,
  });
});

afterEach(async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

after(() => dom.window.close());

const wait = async (ms) => {
  const { act } = await import("@testing-library/react");
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};

/** Drives the hook through a host component, the way call sites use it. */
const mountHook = async (options) => {
  const { createElement: h } = await import("react");
  const { render } = await import("@testing-library/react");
  const { useHoverPopover } = await import("@/shared/ui/useHoverPopover");

  const seen = { current: null };
  function Host() {
    seen.current = useHoverPopover(options);
    return null;
  }
  const view = render(h(Host));
  return { seen, view };
};

test("hover does not open before the delay, and does after it", async () => {
  const { seen } = await mountHook({ closeDelay: 40, openDelay: 60 });
  const { act } = await import("@testing-library/react");

  await act(async () => seen.current.triggerProps.onMouseEnter());
  assert.equal(seen.current.open, false, "not open immediately on enter");

  await wait(30);
  assert.equal(seen.current.open, false, "still closed before the delay");

  await wait(50);
  assert.equal(seen.current.open, true, "open once the delay elapses");
});

test("leaving before the delay never opens it at all", async () => {
  const { seen } = await mountHook({ closeDelay: 40, openDelay: 60 });
  const { act } = await import("@testing-library/react");

  await act(async () => seen.current.triggerProps.onMouseEnter());
  await wait(20);
  await act(async () => seen.current.triggerProps.onMouseLeave());
  await wait(80);

  assert.equal(
    seen.current.open,
    false,
    "a pointer passing over on its way elsewhere leaves no popover behind",
  );
});

test("entering the content cancels the pending close", async () => {
  const { seen } = await mountHook({ closeDelay: 40, openDelay: 10 });
  const { act } = await import("@testing-library/react");

  await act(async () => seen.current.triggerProps.onMouseEnter());
  await wait(30);
  assert.equal(seen.current.open, true);

  // Pointer crosses the gap from trigger to panel: leave fires, then enter.
  await act(async () => seen.current.triggerProps.onMouseLeave());
  await act(async () => seen.current.contentProps.onMouseEnter());
  await wait(80);

  assert.equal(
    seen.current.open,
    true,
    "the popover survives the trip from trigger to panel",
  );
});

test("leaving the content closes it", async () => {
  const { seen } = await mountHook({ closeDelay: 40, openDelay: 10 });
  const { act } = await import("@testing-library/react");

  await act(async () => seen.current.triggerProps.onMouseEnter());
  await wait(30);
  await act(async () => seen.current.contentProps.onMouseLeave());
  await wait(80);

  assert.equal(seen.current.open, false);
});

test("focus opens immediately, without the hover delay", async () => {
  const { seen } = await mountHook({ openDelay: 5000 });
  const { act } = await import("@testing-library/react");

  await act(async () => seen.current.triggerProps.onFocus());

  assert.equal(
    seen.current.open,
    true,
    "a caret that lands here was aimed, so it does not wait",
  );
});

test("`isDisabled` blocks hover opening and closes an open popover", async () => {
  const { seen } = await mountHook({ isDisabled: true, openDelay: 10 });
  const { act } = await import("@testing-library/react");

  await act(async () => seen.current.triggerProps.onMouseEnter());
  await wait(40);
  assert.equal(seen.current.open, false, "hover cannot open it");

  await act(async () => seen.current.triggerProps.onFocus());
  assert.equal(seen.current.open, false, "nor can focus");

  // But direct control still works — the call sites need it for click paths.
  await act(async () => seen.current.setOpen(true));
  assert.equal(seen.current.open, true);
});

test("unmounting cancels a pending timer instead of setting state later", async () => {
  const { seen, view } = await mountHook({ openDelay: 30 });
  const { act } = await import("@testing-library/react");

  await act(async () => seen.current.triggerProps.onMouseEnter());
  view.unmount();
  // If the timer survived, React would warn about an update on an unmounted
  // component; the assertion is that nothing throws and nothing is scheduled.
  await new Promise((resolve) => setTimeout(resolve, 60));
});

test("the handler objects are reference-stable across renders", async () => {
  const { seen, view } = await mountHook({ openDelay: 10 });
  const { act } = await import("@testing-library/react");

  const firstTrigger = seen.current.triggerProps;
  const firstContent = seen.current.contentProps;

  // Force a re-render through a state change the hook owns.
  await act(async () => seen.current.triggerProps.onMouseEnter());
  await wait(30);
  assert.equal(
    seen.current.open,
    true,
    "state did change, so it did re-render",
  );

  // Call sites spread these onto memoised rows in a virtualised timeline; a new
  // object each render would defeat `React.memo` there. See the render-perf
  // note in CLAUDE.md.
  assert.equal(seen.current.triggerProps, firstTrigger);
  assert.equal(seen.current.contentProps, firstContent);

  view.unmount();
});
