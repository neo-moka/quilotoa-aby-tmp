import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});

before(() => {
  Object.assign(globalThis, {
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    IS_REACT_ACT_ENVIRONMENT: true,
    window: dom.window,
  });
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });
});

afterEach(async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

after(() => dom.window.close());

const renderEmptyState = async (rootProps = {}, children) => {
  const React = (await import("react")).default;
  const { render } = await import("@testing-library/react");
  const parts = await import("./empty-state.tsx");

  const { container } = render(
    React.createElement(
      parts.EmptyState,
      rootProps,
      children ? children(React, parts) : null,
    ),
  );
  const node = container.firstElementChild;
  assert.ok(node, "empty state rendered nothing");
  return { node, container };
};

// `data-testid` is a styling and E2E contract here, not a test detail:
// `projects-v3-screenshots.spec.ts` locates this surface by testid, and
// theme.css styles ~68 selectors by one. React Aria's filterDOMProps is an
// allowlist, so a HeroUI upgrade could start dropping it with nothing else in
// the suite noticing.
test("the root forwards data-testid and the caller's className", async () => {
  const { node } = await renderEmptyState({
    className: "min-h-64 justify-center",
    "data-testid": "project-repository-unavailable",
  });

  assert.equal(
    node.getAttribute("data-testid"),
    "project-repository-unavailable",
  );
  assert.ok(node.classList.contains("min-h-64"));
  assert.ok(node.classList.contains("justify-center"));
});

// Pro paints `.empty-state__media` and `__description` with `var(--muted)`,
// which in this app is a *surface* token, not a foreground — secondary text
// would land at 82.75% lightness in light and 16% in dark, i.e. invisible in
// both. Those two are the only places this stylesheet reads the token, and the
// scope belongs on them and nowhere higher. If it ever stops being applied the
// regression is silent, because nothing throws and both themes fail the same
// way. See shared/ui/heroMutedScope.ts.
test("media and description re-point --muted onto the app's foreground token", async () => {
  const { HERO_MUTED_SCOPE } = await import("./heroMutedScope.ts");
  assert.equal(HERO_MUTED_SCOPE, "[--muted:var(--muted-foreground)]");

  const { container } = await renderEmptyState({}, (React, parts) =>
    React.createElement(
      parts.EmptyStateHeader,
      null,
      React.createElement(parts.EmptyStateMedia, {
        "data-testid": "media",
      }),
      React.createElement(parts.EmptyStateDescription, null, "Clone it."),
    ),
  );

  for (const selector of [".empty-state__media", ".empty-state__description"]) {
    const el = container.querySelector(selector);
    assert.ok(el, `${selector} did not render`);
    assert.ok(
      el.classList.contains(HERO_MUTED_SCOPE),
      `${selector} is missing the muted scope; classes were: ${el.className}`,
    );
  }
});

// The scope must NOT sit on the root. The root wraps caller markup, and the
// app's Button uses `hover:bg-muted/70` for its outline variant — a root scope
// would make every outline button in an empty state hover to the text grey
// instead of the surface grey, reintroducing the inversion one level down.
test("the root does not carry the muted scope, so caller markup is unaffected", async () => {
  const { HERO_MUTED_SCOPE } = await import("./heroMutedScope.ts");
  const { node } = await renderEmptyState();

  assert.ok(
    !node.classList.contains(HERO_MUTED_SCOPE),
    "the muted scope leaked onto the root, which wraps caller markup",
  );
});

// The base class is what the Pro stylesheet hooks onto. Adding app classes must
// not displace it.
test("the Pro base class survives alongside app classes", async () => {
  const { node } = await renderEmptyState({ className: "px-8" });

  assert.ok(node.classList.contains("empty-state"));
  assert.ok(node.classList.contains("px-8"));
});

// The title carries a heading role in the surfaces migrated so far, which both
// call sites already had as an <h3>. Promoting it would add headings to specs
// that count them.
test("the title stays an h3 and the description stays a p", async () => {
  const { container } = await renderEmptyState({}, (React, parts) =>
    React.createElement(
      parts.EmptyStateHeader,
      null,
      React.createElement(parts.EmptyStateTitle, null, "Code hosted on github"),
      React.createElement(parts.EmptyStateDescription, null, "Clone it."),
    ),
  );

  assert.equal(container.querySelectorAll("h3").length, 1);
  assert.equal(
    container.querySelector("h3")?.textContent,
    "Code hosted on github",
  );
  assert.equal(container.querySelector("p")?.textContent, "Clone it.");
});

// Pro stacks its action area in a column; every call site here lays buttons out
// side by side, so the wrapper re-rows it. A caller-supplied direction must
// still win.
test("content is a wrapping row by default and callers can override it", async () => {
  const React = (await import("react")).default;
  const { render } = await import("@testing-library/react");
  const parts = await import("./empty-state.tsx");

  const { container } = render(
    React.createElement(
      parts.EmptyStateContent,
      { "data-testid": "actions" },
      "actions",
    ),
  );
  const node = container.firstElementChild;
  assert.ok(node.classList.contains("flex-row"));
  assert.ok(node.classList.contains("flex-wrap"));
  assert.equal(node.getAttribute("data-testid"), "actions");
});
