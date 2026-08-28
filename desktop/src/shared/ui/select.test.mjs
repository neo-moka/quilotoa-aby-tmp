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

const renderSelect = async (props = {}) => {
  const React = (await import("react")).default;
  const { render } = await import("@testing-library/react");
  const { Select } = await import("./select.tsx");

  const { container } = render(
    React.createElement(
      Select,
      props,
      React.createElement("option", { value: "a" }, "A"),
    ),
  );
  const node = container.firstElementChild;
  assert.ok(node, "select rendered nothing");
  return node;
};

// It must stay a real <select>: the whole reason for not taking Pro's
// NativeSelect was to avoid a wrapper element changing the DOM shape at every
// call site, and several of these sit inside flex rows that depend on it.
test("renders a bare select element with no wrapper", async () => {
  const node = await renderSelect();

  assert.equal(node.tagName, "SELECT");
  assert.ok(node.classList.contains("empty-state") === false);
});

// `data-testid` is a styling and E2E contract, and check-testids-core.mjs now
// gates it. `id` matters too: several call sites pair the select with a
// `<label htmlFor>`.
test("forwards data-testid, id and disabled to the select", async () => {
  const node = await renderSelect({
    "data-testid": "channel-management-add-role",
    disabled: true,
    id: "channel-member-role",
  });

  assert.equal(node.getAttribute("data-testid"), "channel-management-add-role");
  assert.equal(node.getAttribute("id"), "channel-member-role");
  assert.ok(node.disabled);
});

// Geometry parity with Input is the point of the component — if these drift
// apart again, a select and a text field stop looking like the same control.
test("defaults to the same geometry as Input", async () => {
  const node = await renderSelect();

  for (const cls of [
    "h-9",
    "w-full",
    "rounded-lg",
    "border-input/40",
    "px-3",
  ]) {
    assert.ok(
      node.classList.contains(cls),
      `missing ${cls}; classes were: ${node.className}`,
    );
  }
});

// `cn` is tailwind-merge backed, which is what lets the compact row variants
// keep a smaller height and the workflow form opt out of the native arrow.
// Without the merge these would collide with the defaults instead of replacing
// them, and every call site would need the full class string back.
test("caller classes replace conflicting defaults rather than stacking", async () => {
  const compact = await renderSelect({ className: "h-8 w-auto px-2 text-xs" });

  assert.ok(compact.classList.contains("h-8"));
  assert.ok(!compact.classList.contains("h-9"), "h-9 was not replaced");
  assert.ok(compact.classList.contains("w-auto"));
  assert.ok(!compact.classList.contains("w-full"), "w-full was not replaced");
  assert.ok(!compact.classList.contains("px-3"), "px-3 was not replaced");

  const chevron = await renderSelect({ className: "appearance-none pr-8" });
  assert.ok(chevron.classList.contains("appearance-none"));
});
