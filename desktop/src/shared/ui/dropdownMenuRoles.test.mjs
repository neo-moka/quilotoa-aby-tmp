// The ARIA roles of a menu are the contract 236 E2E assertions rest on, and
// React Aria derives them from the selection manager in scope rather than from
// the item. A `selectionMode` on the wrong node turns every plain item into a
// radio, and neither typecheck nor build notices. These tests pin the mapping.
import assert from "node:assert/strict";
import { after, afterEach, before, test } from "node:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
});

before(() => {
  Object.assign(globalThis, {
    document: dom.window.document,
    Element: dom.window.Element,
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

const renderMenu = async () => {
  const { createElement: h } = await import("react");
  const { render } = await import("@testing-library/react");
  const menu = await import("@/shared/ui/dropdown-menu");

  render(
    h(
      menu.DropdownMenu,
      { defaultOpen: true },
      h(
        menu.DropdownMenuTrigger,
        { asChild: true },
        h("button", { "data-testid": "menu-trigger", type: "button" }, "Open"),
      ),
      h(
        menu.DropdownMenuContent,
        { align: "start" },
        h(menu.DropdownMenuLabel, null, "Heading"),
        h(
          menu.DropdownMenuItem,
          { "data-testid": "plain-item", title: "Plain hint" },
          "Plain",
        ),
        h(
          menu.DropdownMenuItem,
          { "data-testid": "disabled-item", disabled: true },
          "Disabled",
        ),
        h(menu.DropdownMenuSeparator, null),
        h(
          menu.DropdownMenuRadioGroup,
          { onValueChange: () => {}, value: "b" },
          h(menu.DropdownMenuRadioItem, { value: "a" }, "A"),
          h(
            menu.DropdownMenuRadioItem,
            { "data-testid": "radio-b", value: "b" },
            "B",
          ),
        ),
        h(
          menu.DropdownMenuCheckboxItem,
          { checked: true, "data-testid": "checkbox-item" },
          "Toggle",
        ),
        h(
          menu.DropdownMenuSub,
          null,
          h(
            menu.DropdownMenuSubTrigger,
            { "data-testid": "sub-trigger" },
            "More",
          ),
          h(
            menu.DropdownMenuSubContent,
            null,
            h(menu.DropdownMenuItem, null, "Nested"),
          ),
        ),
      ),
    ),
  );

  return menu;
};

test("plain items keep the menuitem role and their test ids", async () => {
  await renderMenu();
  const { screen } = await import("@testing-library/react");

  const plain = screen.getByTestId("plain-item");
  assert.equal(plain.getAttribute("role"), "menuitem");
  assert.equal(screen.getAllByRole("menu").length, 1);
  // The two plain items and the submenu trigger; the nested item only mounts
  // once the submenu opens. None of them may be dragged into the radio group's
  // selection mode.
  assert.equal(screen.getAllByRole("menuitem").length, 3);
  assert.equal(
    screen.getByTestId("sub-trigger").getAttribute("aria-haspopup"),
    "menu",
  );
  assert.equal(
    screen.getByTestId("disabled-item").getAttribute("aria-disabled"),
    "true",
  );
  assert.equal(screen.getAllByRole("separator").length, 1);
  // `title` is how disabled items explain themselves; React Aria filters unknown
  // DOM props, so this pins that it still reaches the element.
  assert.equal(plain.getAttribute("title"), "Plain hint");
});

test("radio group items become menuitemradio and report their checked state", async () => {
  await renderMenu();
  const { screen } = await import("@testing-library/react");

  const radios = screen.getAllByRole("menuitemradio");
  assert.equal(radios.length, 2);
  assert.equal(
    screen.getByTestId("radio-b").getAttribute("aria-checked"),
    "true",
  );
});

test("a checkbox item becomes menuitemcheckbox on its own", async () => {
  await renderMenu();
  const { screen } = await import("@testing-library/react");

  const checkboxes = screen.getAllByRole("menuitemcheckbox");
  assert.equal(checkboxes.length, 1);
  assert.equal(
    screen.getByTestId("checkbox-item").getAttribute("aria-checked"),
    "true",
  );
});

test("the trigger stays the caller's own element", async () => {
  await renderMenu();
  const { screen } = await import("@testing-library/react");

  const trigger = screen.getByTestId("menu-trigger");
  assert.equal(trigger.tagName, "BUTTON");
  assert.equal(trigger.getAttribute("aria-haspopup"), "true");
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
});
