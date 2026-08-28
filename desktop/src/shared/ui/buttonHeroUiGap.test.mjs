import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { JSDOM } from "jsdom";

/**
 * `button.tsx` stays on its own `<button>` rather than moving to HeroUI. The
 * reason is a prop contract, not a preference, so it is pinned here instead of
 * left as a comment: React Aria's `filterDOMProps` admits a fixed allowlist,
 * and every attribute outside it is dropped with no error.
 *
 * These tests assert the *gap*. If one starts failing, HeroUI or React Aria has
 * begun forwarding that attribute and the conservation decision in `button.tsx`
 * should be revisited — that is the point of the file.
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
    // React Aria narrows event targets with `target instanceof SVGElement`
    // while tearing press handlers down; without the global that throws from
    // inside cleanup instead of from an assertion.
    SVGElement: dom.window.SVGElement,
    window: dom.window,
  });
});

after(() => dom.window.close());

/** Renders HeroUI's Button and hands back the DOM node it produced. */
async function renderHeroButton(props) {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Button } = await import("@heroui/react");

  const view = render(React.createElement(Button, { ...props }, "Label"));
  return { el: view.container.firstElementChild, view };
}

test("HeroUI's button ignores `disabled` and stays clickable", async () => {
  const { fireEvent } = await import("@testing-library/react");

  let clicks = 0;
  const { el } = await renderHeroButton({
    disabled: true,
    onClick: () => {
      clicks += 1;
    },
  });

  // 269 call sites pass `disabled`. React Aria reads `isDisabled`, so the
  // attribute never lands and the handler still runs — a disabled destructive
  // action would still fire.
  assert.equal(el.hasAttribute("disabled"), false);
  fireEvent.click(el);
  assert.equal(clicks, 1);
});

test("HeroUI's button honours `isDisabled`", async () => {
  const { fireEvent } = await import("@testing-library/react");

  let clicks = 0;
  const { el } = await renderHeroButton({
    isDisabled: true,
    onClick: () => {
      clicks += 1;
    },
  });

  assert.equal(el.hasAttribute("disabled"), true);
  fireEvent.click(el);
  assert.equal(clicks, 0);
});

test("HeroUI's button drops attributes outside React Aria's allowlist", async () => {
  const { el } = await renderHeroButton({
    "aria-busy": true,
    "aria-hidden": true,
    "aria-selected": true,
    role: "tab",
    title: "native tooltip",
  });

  // `title` (35 sites), `role` + `aria-selected` (6, all PulseTabBar),
  // `aria-busy` (2) and `aria-hidden` (1) have no path through filterDOMProps.
  for (const attr of [
    "aria-busy",
    "aria-hidden",
    "aria-selected",
    "role",
    "title",
  ]) {
    assert.equal(el.getAttribute(attr), null, `expected ${attr} to be dropped`);
  }
});

test("HeroUI's button overwrites a negative `tabIndex` with 0", async () => {
  const { el } = await renderHeroButton({ tabIndex: -1 });

  // Worse than dropping it: `useFocusable` always emits a tabIndex, so a button
  // deliberately kept out of the tab order becomes tabbable. The supported
  // spelling is `excludeFromTabOrder`.
  assert.equal(el.getAttribute("tabindex"), "0");

  const { el: excluded } = await renderHeroButton({
    excludeFromTabOrder: true,
  });
  assert.equal(excluded.getAttribute("tabindex"), "-1");
});

test("HeroUI's button does forward data-testid, aria-label and type", async () => {
  const { el } = await renderHeroButton({
    "aria-label": "Label",
    "data-testid": "probe",
    type: "submit",
  });

  // The other half of the picture: these three do survive, so the gap above is
  // specific rather than "HeroUI drops everything".
  assert.equal(el.getAttribute("data-testid"), "probe");
  assert.equal(el.getAttribute("aria-label"), "Label");
  assert.equal(el.getAttribute("type"), "submit");
});

test("HeroUI's button paints itself with the unmapped --accent variant", async () => {
  const { el } = await renderHeroButton({});

  // `button--primary` resolves its background from `--accent`, which this app
  // deliberately leaves unmapped (theming-contract §4). Adopting the component
  // means overriding its variant layer, not consuming it.
  const className = el.getAttribute("class") ?? "";
  assert.ok(
    className.includes("button--primary"),
    `expected the default variant class, got "${className}"`,
  );
});
