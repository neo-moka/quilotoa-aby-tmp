import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

import { JSDOM } from "jsdom";

/**
 * Pins the DOM contract `Skeleton` emits now that it sits on HeroUI's
 * `SkeletonRoot`. Three facts hold the rest of the app up:
 *
 * - it is still a `div` carrying `t-skel-bar`, which `scroll-history.spec.ts`
 *   counts to assert the cold-load skeleton is gone;
 * - `is-pulsing` still gates the animation, so the reveal stop and the
 *   `prefers-reduced-motion` opt-out in `skeleton.css` still reach it;
 * - HeroUI's own animation classes never appear, because `.skeleton--pulse` is
 *   a bare `animate-pulse` with no reduced-motion guard.
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
    Node: dom.window.Node,
    SVGElement: dom.window.SVGElement,
    window: dom.window,
  });
});

afterEach(async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

after(() => dom.window.close());

test("skeleton keeps its own classes and takes HeroUI's base unanimated", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Skeleton } = await import("./skeleton.tsx");

  const view = render(
    React.createElement(Skeleton, {
      className: "h-4 w-24",
      "data-testid": "demo-skeleton",
    }),
  );

  const bar = view.getByTestId("demo-skeleton");
  assert.equal(bar.tagName, "DIV");
  assert.equal(bar.getAttribute("aria-hidden"), "true");

  const classes = bar.className.split(/\s+/);
  // Buzz's own hooks — the animation and the E2E locator both read these.
  assert.ok(classes.includes("t-skel-bar"));
  assert.ok(classes.includes("is-pulsing"));
  // The skin, which must still beat HeroUI's `rounded-sm` / `bg-surface-*`.
  assert.ok(classes.includes("rounded-md"));
  assert.ok(classes.includes("bg-primary/10"));
  // Caller classes survive the merge.
  assert.ok(classes.includes("h-4"));
  assert.ok(classes.includes("w-24"));
  // HeroUI's base is adopted; its animation variants are not.
  assert.ok(classes.includes("skeleton"));
  assert.ok(!classes.includes("skeleton--pulse"));
  assert.ok(!classes.includes("skeleton--shimmer"));
});

test("skeleton drops only its own pulse when pulsing is off", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Skeleton } = await import("./skeleton.tsx");

  const view = render(
    React.createElement(Skeleton, {
      "data-testid": "demo-skeleton",
      pulsing: false,
    }),
  );

  const classes = view.getByTestId("demo-skeleton").className.split(/\s+/);
  assert.ok(classes.includes("t-skel-bar"));
  assert.ok(!classes.includes("is-pulsing"));
  assert.ok(!classes.includes("skeleton--pulse"));
  assert.ok(!classes.includes("skeleton--shimmer"));
});

test("skeleton reveal keeps its crossfade nodes and loading state", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Skeleton, SkeletonReveal } = await import("./skeleton.tsx");

  const view = render(
    React.createElement(
      SkeletonReveal,
      {
        "data-testid": "demo-reveal",
        loading: true,
        skeleton: React.createElement(Skeleton, { "data-testid": "demo-bar" }),
      },
      "content",
    ),
  );

  const root = view.getByTestId("demo-reveal");
  assert.equal(root.getAttribute("data-state"), "loading");
  assert.equal(root.getAttribute("data-layout"), "flow");
  assert.ok(root.className.split(/\s+/).includes("t-skel"));
  assert.ok(!root.className.split(/\s+/).includes("is-revealed"));
  assert.ok(root.querySelector(".t-skel-skeleton.is-pulsing"));
  assert.ok(root.querySelector(".t-skel-content"));
  assert.ok(view.getByTestId("demo-bar"));

  view.rerender(
    React.createElement(
      SkeletonReveal,
      {
        "data-testid": "demo-reveal",
        loading: false,
        skeleton: React.createElement(Skeleton, { "data-testid": "demo-bar" }),
      },
      "content",
    ),
  );

  const revealed = view.getByTestId("demo-reveal");
  assert.equal(revealed.getAttribute("data-state"), "loaded");
  assert.ok(revealed.className.split(/\s+/).includes("is-revealed"));
});
