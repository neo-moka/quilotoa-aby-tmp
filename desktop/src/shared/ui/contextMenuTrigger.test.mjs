// The context menu's trigger is the one place where HeroUI would otherwise
// change the DOM: Pro renders a positioned <div> of its own, which inside the
// sidebar would sit between the <ul> and its rows. The surface uses HeroUI's
// `render` prop so the caller's element stays exactly where it was — with its
// test id, which `theme.css` also styles by.
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

const renderRow = async () => {
  const { createElement: h } = await import("react");
  const { render } = await import("@testing-library/react");
  const menu = await import("@/shared/ui/context-menu");

  render(
    h(
      "ul",
      { "data-testid": "row-list" },
      h(
        menu.ContextMenu,
        null,
        h(
          menu.ContextMenuTrigger,
          { asChild: true },
          h(
            "li",
            { className: "channel-row", "data-testid": "channel-general" },
            "general",
          ),
        ),
        h(
          menu.ContextMenuContent,
          null,
          h(
            menu.ContextMenuItem,
            { "data-testid": "mute-channel-general" },
            "Mute channel",
          ),
          h(menu.ContextMenuSeparator, null),
          h(menu.ContextMenuItem, { disabled: true }, "Leave"),
        ),
      ),
    ),
  );

  return menu;
};

test("the trigger stays the caller's element, in place", async () => {
  await renderRow();
  const { screen } = await import("@testing-library/react");

  const row = screen.getByTestId("channel-general");
  assert.equal(row.tagName, "LI");
  assert.equal(row.parentElement?.tagName, "UL");
  assert.ok(row.className.includes("channel-row"));
  // The popover anchors to a zero-sized child, so the row has to be its
  // containing block.
  assert.ok(row.className.includes("relative"));
  assert.equal(row.getAttribute("data-state"), "closed");
  assert.ok(row.textContent?.startsWith("general"));
});

test("right-clicking opens a menu whose items keep their roles and test ids", async () => {
  await renderRow();
  const { fireEvent, screen } = await import("@testing-library/react");

  fireEvent.contextMenu(screen.getByTestId("channel-general"), {
    clientX: 10,
    clientY: 10,
  });

  assert.equal(screen.getAllByRole("menu").length, 1);
  assert.equal(screen.getAllByRole("menuitem").length, 2);
  assert.equal(
    screen.getByTestId("mute-channel-general").getAttribute("role"),
    "menuitem",
  );
  assert.equal(screen.getAllByRole("separator").length, 1);
  assert.equal(
    screen.getByTestId("channel-general").getAttribute("data-state"),
    "open",
  );
});
