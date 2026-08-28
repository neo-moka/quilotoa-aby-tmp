import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

import { JSDOM } from "jsdom";

/**
 * Two halves, and they only mean something together.
 *
 * The first group pins the gap in HeroUI's `Button`: React Aria's
 * `filterDOMProps` is an allowlist, so attributes outside it vanish with no
 * error. The second group pins that `button.tsx` closes that gap through the
 * `render` escape hatch. If the first group starts failing, upstream has fixed
 * the gap and the neutralising in the wrapper can be reconsidered; if the
 * second group fails, the wrapper has stopped protecting 523 call sites.
 */
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

before(() => {
  Object.assign(globalThis, {
    CustomEvent: dom.window.CustomEvent,
    document: dom.window.document,
    Element: dom.window.Element,
    Event: dom.window.Event,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    HTMLElement: dom.window.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: true,
    MouseEvent: dom.window.MouseEvent,
    Node: dom.window.Node,
    // React Aria narrows event targets with `target instanceof SVGElement`
    // while tearing press handlers down; without the global that throws from
    // inside cleanup instead of from an assertion.
    SVGElement: dom.window.SVGElement,
    window: dom.window,
  });
});

afterEach(async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

after(() => dom.window.close());

/** Renders raw HeroUI, i.e. what the wrapper has to compensate for. */
async function renderHeroButton(props) {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Button } = await import("@heroui/react");

  const view = render(React.createElement(Button, { ...props }, "Label"));
  return view.container.firstElementChild;
}

/** Renders the app's wrapper. */
async function renderButton(props) {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Button } = await import("./button.tsx");

  const view = render(React.createElement(Button, { ...props }, "Label"));
  return view.container.firstElementChild;
}

// ---------------------------------------------------------------------------
// The gap in raw HeroUI.
// ---------------------------------------------------------------------------

test("raw HeroUI ignores `disabled` and stays clickable", async () => {
  const { fireEvent } = await import("@testing-library/react");

  let clicks = 0;
  const el = await renderHeroButton({
    disabled: true,
    onClick: () => {
      clicks += 1;
    },
  });

  assert.equal(el.hasAttribute("disabled"), false);
  fireEvent.click(el);
  assert.equal(clicks, 1);
});

test("raw HeroUI drops attributes outside React Aria's allowlist", async () => {
  const el = await renderHeroButton({
    "aria-busy": true,
    "aria-selected": true,
    role: "tab",
    title: "native tooltip",
  });

  for (const attr of ["aria-busy", "aria-selected", "role", "title"]) {
    assert.equal(el.getAttribute(attr), null, `expected ${attr} to be dropped`);
  }
});

test("raw HeroUI overwrites a negative `tabIndex` with 0", async () => {
  const el = await renderHeroButton({ tabIndex: -1 });
  assert.equal(el.getAttribute("tabindex"), "0");
});

// ---------------------------------------------------------------------------
// The wrapper closing it.
// ---------------------------------------------------------------------------

test("the wrapper honours `disabled` again", async () => {
  const { fireEvent } = await import("@testing-library/react");

  let clicks = 0;
  const el = await renderButton({
    disabled: true,
    onClick: () => {
      clicks += 1;
    },
  });

  assert.equal(el.hasAttribute("disabled"), true);
  fireEvent.click(el);
  assert.equal(clicks, 0);
});

test("the wrapper keeps the attributes React Aria drops", async () => {
  const el = await renderButton({
    "aria-busy": true,
    "aria-selected": true,
    "data-testid": "probe",
    role: "tab",
    tabIndex: -1,
    title: "native tooltip",
  });

  // PulseTabBar's six tabs depend on role + aria-selected together, and `pulse`
  // emits no testids, so nothing else in the suite would notice them going.
  assert.equal(el.getAttribute("role"), "tab");
  assert.equal(el.getAttribute("aria-selected"), "true");
  assert.equal(el.getAttribute("aria-busy"), "true");
  assert.equal(el.getAttribute("title"), "native tooltip");
  assert.equal(el.getAttribute("tabindex"), "-1");
  assert.equal(el.getAttribute("data-testid"), "probe");
});

test("the wrapper defaults type to button and lets a caller override it", async () => {
  assert.equal((await renderButton({})).getAttribute("type"), "button");
  assert.equal(
    (await renderButton({ type: "submit" })).getAttribute("type"),
    "submit",
  );
});

test("onClick receives a real DOM event, not a synthesised one", async () => {
  const seen = [];
  const el = await renderButton({
    onClick: (event) => {
      seen.push({
        currentTarget: event.currentTarget?.tagName,
        detail: event.detail,
        preventDefault: typeof event.preventDefault,
        stopPropagation: typeof event.stopPropagation,
      });
    },
  });

  el.dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, detail: 1 }),
  );

  // `AgentsView` reads currentTarget and `ThreadViewModeToggle` reads detail to
  // tell a keyboard activation from a click. Routing through `onPress` would
  // hand them a synthesised MouseEvent with neither.
  assert.deepEqual(seen, [
    {
      currentTarget: "BUTTON",
      detail: 1,
      preventDefault: "function",
      stopPropagation: "function",
    },
  ]);
});

test("the wrapper neutralises HeroUI's own paint and geometry", async () => {
  const el = await renderButton({ variant: "ghost" });
  const className = el.getAttribute("class") ?? "";

  // `.button` and `.button--*` still arrive from the app-wide HeroUI
  // stylesheet, so the base has to cancel what would otherwise show through on
  // the variants that set no background or colour of their own.
  for (const util of [
    "static",
    "isolation-auto",
    "[--button-bg:transparent]",
    "[--button-fg:inherit]",
    "active:scale-100",
  ]) {
    assert.ok(
      className.includes(util),
      `expected neutralising utility ${util}, got "${className}"`,
    );
  }
});

test("HeroUI only prepends to the class attribute, never reorders it", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Button, buttonVariants } = await import("./button.tsx");
  const { cn } = await import("@/shared/lib/cn");

  // Three E2E assertions name two classes in order separated by `.*`
  // (tooltip-semantics.spec.ts:101, agents.spec.ts:1016 and :2037). None of
  // them targets a button, but the invariant is worth pinning for every
  // `toHaveClass` regex in the suite: inserting classes is safe, reordering
  // the tokens is not, and nothing but Playwright would catch a reorder.
  for (const args of [
    { className: "my-caller-class", size: "default", variant: "default" },
    { className: "shrink-0 my-2", size: "icon", variant: "ghost" },
    { className: undefined, size: "sm", variant: "outline" },
  ]) {
    const view = render(React.createElement(Button, { ...args }, "Label"));
    const actual = view.container.firstElementChild.getAttribute("class");
    const composedByTheApp = cn(buttonVariants(args));

    // The app's own string survives contiguously and last, so the caller's
    // className keeps winning under tailwind-merge and relative order holds.
    assert.ok(
      actual.endsWith(composedByTheApp),
      `expected the app's classes as a contiguous suffix.\n  app:    ${composedByTheApp}\n  actual: ${actual}`,
    );
    assert.equal(
      actual.slice(0, actual.length - composedByTheApp.length).trim(),
      "button button--md button--primary",
    );
  }
});

test("asChild still renders the caller's element through Slot", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Button } = await import("./button.tsx");

  const view = render(
    React.createElement(
      Button,
      { asChild: true, variant: "outline" },
      React.createElement("a", { href: "https://example.com" }, "Open"),
    ),
  );
  const el = view.container.firstElementChild;

  // `render` only legitimately returns a <button>; the six asChild sites wrap
  // an anchor, so they keep Slot.
  assert.equal(el.tagName, "A");
  assert.equal(el.getAttribute("href"), "https://example.com");
  assert.ok((el.getAttribute("class") ?? "").includes("border"));
});

test("a forwarded ref still reaches the DOM node", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Button } = await import("./button.tsx");

  const ref = React.createRef();
  render(React.createElement(Button, { ref }, "Label"));

  // React Aria needs its own ref on that node too, so the wrapper merges them;
  // if the merge regressed, this is null and every `.focus()` call site breaks.
  assert.ok(ref.current instanceof dom.window.HTMLButtonElement);
});
