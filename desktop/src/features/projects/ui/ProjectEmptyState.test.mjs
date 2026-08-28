import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { JSDOM } from "jsdom";

let cleanup;
let createElement;
let render;
let ProjectEmptyState;

// Both assertions below guard silent failures — neither would surface as a
// build or type error, and both are properties of the installed Pro beta rather
// than of this file:
//
//   - Pro's `EmptyState` root renders through `dom.div`, which spreads its
//     props. React Aria's `filterDOMProps` — used elsewhere in the same package
//     — would instead drop `data-testid` without a word, taking the ids
//     `theme.css` and the E2E specs select on with it.
//   - `empty-state.css` reads `var(--muted)` for the description, which this app
//     spends on a surface colour. If the scope class stops being applied the
//     copy stays in the DOM and simply becomes unreadable.
before(async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  Object.assign(globalThis, {
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    window: dom.window,
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  // `navigator` is getter-only on Node, so it takes defineProperty rather than
  // assignment — the same shape `TerminalSubstrate.test.mjs` uses.
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: dom.window.navigator,
    writable: true,
  });

  ({ createElement } = await import("react"));
  ({ cleanup, render } = await import("@testing-library/react"));
  ({ ProjectEmptyState } = await import("./ProjectEmptyState.tsx"));
});

after(() => {
  cleanup?.();
});

test("passes data-testid through Pro's root instead of filtering it away", () => {
  const { container } = render(
    createElement(ProjectEmptyState, {
      "data-testid": "project-pull-requests-empty",
      description: "No reviews yet.",
    }),
  );

  const root = container.querySelector(
    '[data-testid="project-pull-requests-empty"]',
  );
  assert.ok(root, "data-testid did not survive the Pro root");
  assert.match(root.className, /\bempty-state\b/);
});

test("scopes --muted to the text token so the description stays legible", () => {
  const { container } = render(
    createElement(ProjectEmptyState, { description: "No reviews yet." }),
  );

  const root = container.querySelector(".empty-state");
  assert.ok(
    root.className.includes("[--muted:var(--muted-foreground)]"),
    "the muted scope is missing — the description would render in a surface colour",
  );
  assert.ok(container.querySelector(".empty-state__description"));
});
