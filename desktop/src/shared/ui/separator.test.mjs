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

const renderSeparator = async (props) => {
  const React = (await import("react")).default;
  const { render } = await import("@testing-library/react");
  const { Separator } = await import("./separator.tsx");

  const { container } = render(React.createElement(Separator, props));
  const node = container.firstElementChild;
  assert.ok(node, "separator rendered nothing");
  return node;
};

// HeroUI has no `decorative` prop and React Aria refuses a caller-supplied role
// or `aria-hidden`, so the wrapper reaches for the `render` escape hatch. If a
// HeroUI upgrade breaks that, these separators silently re-enter the
// accessibility tree and the menu specs that count `getByRole("separator")`
// start seeing extras. Nothing else in the suite would notice.
test("separators are decorative by default", async () => {
  const node = await renderSeparator({});

  assert.equal(node.tagName, "DIV");
  assert.equal(node.getAttribute("role"), "none");
  assert.equal(node.getAttribute("data-orientation"), "horizontal");
});

test("decorative={false} exposes the separator role", async () => {
  const node = await renderSeparator({ decorative: false });

  assert.equal(node.getAttribute("role"), "separator");
});

test("vertical separators keep their orientation in both roles", async () => {
  const decorative = await renderSeparator({ orientation: "vertical" });
  assert.equal(decorative.getAttribute("role"), "none");
  assert.equal(decorative.getAttribute("data-orientation"), "vertical");

  const semantic = await renderSeparator({
    decorative: false,
    orientation: "vertical",
  });
  assert.equal(semantic.getAttribute("aria-orientation"), "vertical");
});

// `data-testid` is a styling and E2E contract, and React Aria's filterDOMProps
// is selective about what it forwards.
test("callers keep their data-testid and className", async () => {
  const node = await renderSeparator({
    className: "bg-input/40",
    "data-testid": "persona-share-link-divider",
  });

  assert.equal(node.getAttribute("data-testid"), "persona-share-link-divider");
  assert.ok(node.classList.contains("bg-input/40"));
});
