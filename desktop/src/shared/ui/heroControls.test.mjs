import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

import { JSDOM } from "jsdom";

/**
 * Pins the DOM contract the HeroUI form controls emit, because the Playwright
 * suite reads it directly: `data-testid` lands on the field wrapper, selection
 * shows up as `data-selected` rather than Radix's `data-state`, and the node
 * carrying `role="switch"` / `role="checkbox"` is the hidden input the field
 * drives. Anything asserting `toBeChecked()` on the test-id node depends on
 * these three facts together.
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

afterEach(async () => {
  const { cleanup } = await import("@testing-library/react");
  cleanup();
});

after(() => dom.window.close());

test("switch marks state on the field and keeps the role on its input", async () => {
  const React = await import("react");
  const { fireEvent, render } = await import("@testing-library/react");
  const { Switch } = await import("./switch.tsx");

  const changes = [];
  const view = render(
    React.createElement(Switch, {
      "data-testid": "demo-switch",
      id: "demo-switch-input",
      isSelected: true,
      onChange: (value) => changes.push(value),
    }),
  );

  const field = view.getByTestId("demo-switch");
  assert.equal(field.tagName, "DIV");
  assert.equal(field.getAttribute("data-slot"), "switch");
  assert.equal(field.getAttribute("data-selected"), "true");
  assert.equal(field.getAttribute("data-state"), null);

  const input = view.getByRole("switch");
  assert.equal(input.tagName, "INPUT");
  assert.equal(input.id, "demo-switch-input");
  assert.equal(input.checked, true);
  assert.ok(field.contains(input));

  fireEvent.click(input);
  assert.deepEqual(changes, [false]);
});

test("switch reports disabled on the field and on its input", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Switch } = await import("./switch.tsx");

  const view = render(
    React.createElement(Switch, {
      "aria-label": "Demo",
      "data-testid": "demo-switch",
      isDisabled: true,
    }),
  );

  const field = view.getByTestId("demo-switch");
  assert.equal(field.getAttribute("data-disabled"), "true");
  assert.equal(view.getByRole("switch", { hidden: true }).disabled, true);
});

test("checkbox distinguishes selected from indeterminate on the field", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Checkbox } = await import("./checkbox.tsx");

  const selected = render(
    React.createElement(Checkbox, {
      "aria-label": "Demo",
      "data-testid": "demo-checkbox",
      isSelected: true,
    }),
  );
  const selectedField = selected.getByTestId("demo-checkbox");
  assert.equal(selectedField.getAttribute("data-selected"), "true");
  assert.equal(selectedField.getAttribute("data-indeterminate"), null);
  assert.equal(selected.getByRole("checkbox").checked, true);

  selected.rerender(
    React.createElement(Checkbox, {
      "aria-label": "Demo",
      "data-testid": "demo-checkbox",
      isIndeterminate: true,
      isSelected: false,
    }),
  );
  const mixedField = selected.getByTestId("demo-checkbox");
  assert.equal(mixedField.getAttribute("data-indeterminate"), "true");
  assert.equal(mixedField.getAttribute("data-selected"), null);
});

test("toggle stays a button and reports selection two ways", async () => {
  const React = await import("react");
  const { fireEvent, render } = await import("@testing-library/react");
  const { Toggle } = await import("./toggle.tsx");

  const changes = [];
  const view = render(
    React.createElement(
      Toggle,
      {
        "aria-label": "Demo",
        "data-testid": "demo-toggle",
        isSelected: true,
        onChange: (value) => changes.push(value),
      },
      "Demo",
    ),
  );

  const button = view.getByTestId("demo-toggle");
  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(button.getAttribute("data-selected"), "true");
  assert.equal(button.getAttribute("data-state"), null);

  fireEvent.click(button);
  assert.deepEqual(changes, [false]);
});

test("input and textarea keep the test id on the field element", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  const { Input } = await import("./input.tsx");
  const { Textarea } = await import("./textarea.tsx");

  const view = render(
    React.createElement(
      "div",
      null,
      React.createElement(Input, {
        "aria-label": "Demo input",
        "data-testid": "demo-input",
        defaultValue: "hello",
        name: "demo",
      }),
      React.createElement(Textarea, {
        "aria-label": "Demo textarea",
        "data-testid": "demo-textarea",
        defaultValue: "world",
      }),
    ),
  );

  const input = view.getByTestId("demo-input");
  assert.equal(input.tagName, "INPUT");
  assert.equal(input.name, "demo");
  assert.equal(input.value, "hello");

  const textarea = view.getByTestId("demo-textarea");
  assert.equal(textarea.tagName, "TEXTAREA");
  assert.equal(textarea.value, "world");
});
