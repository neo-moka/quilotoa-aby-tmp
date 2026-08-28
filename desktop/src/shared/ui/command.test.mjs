// Pins what Pro's `Command` actually emits, because two of its behaviours would
// otherwise only surface in a browser: the accessibility roles it gives the
// results list, and the client-side filter it applies to items that this app
// gets back already filtered by the relay.
//
// The desktop search dialog has no unit coverage and its only end-to-end net is
// Playwright, so these assertions are the difference between "the adoption is
// safe" as a prediction and as a fact.
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

const renderPalette = async ({ inputValue = "", filter } = {}) => {
  const { createElement: h } = await import("react");
  const { render } = await import("@testing-library/react");
  const { Command } = await import("@/shared/ui/command");

  const dialogProps = { "data-testid": "search-results", inputValue };
  if (filter) dialogProps.filter = filter;

  render(
    h(
      Command,
      null,
      h(
        Command.Backdrop,
        { isOpen: true },
        h(
          Command.Container,
          null,
          h(
            Command.Dialog,
            dialogProps,
            h(
              Command.InputGroup,
              null,
              h(Command.InputGroup.Input, { placeholder: "Search" }),
            ),
            h(
              Command.List,
              { "data-testid": "search-results-list" },
              h(Command.Item, { textValue: "general" }, "general"),
              h(Command.Item, { textValue: "random" }, "random"),
            ),
          ),
        ),
      ),
    ),
  );

  return dom.window.document;
};

test("the testids the theme and the specs need land on Pro's own nodes", async () => {
  const document = await renderPalette();

  const dialog = document.querySelector('[data-testid="search-results"]');
  const list = document.querySelector('[data-testid="search-results-list"]');

  assert.ok(dialog, "Command.Dialog dropped data-testid");
  assert.ok(list, "Command.List dropped data-testid");
  // Same node, so `command.css` and the testid cannot drift apart.
  assert.equal(dialog.dataset.slot, "command-dialog");
  assert.equal(list.dataset.slot, "command-list");
});

test("the list is a menu, not a listbox", async () => {
  const document = await renderPalette();

  const list = document.querySelector('[data-testid="search-results-list"]');
  assert.equal(list.getAttribute("role"), "menu");

  const roles = [...document.querySelectorAll("[role]")].map((node) =>
    node.getAttribute("role"),
  );
  assert.ok(
    roles.includes("menuitem"),
    `expected a menuitem, got roles: ${roles.join(", ")}`,
  );
  assert.ok(
    !roles.includes("listbox") && !roles.includes("option"),
    "Pro's Command does not emit listbox/option; a caller migrating off those roles changes its accessibility tree",
  );
});

test("the surface disables Pro's client-side filter by default", async () => {
  // Results arrive already filtered by the relay. With Pro's default `contains`
  // filter, an input value matching neither label would empty the list.
  const document = await renderPalette({ inputValue: "zzz-no-such-channel" });

  const items = document.querySelectorAll('[data-slot="command-item"]');
  assert.equal(
    items.length,
    2,
    "server-provided results were re-filtered away",
  );
});

test("an explicit filter still wins over the default", async () => {
  const document = await renderPalette({
    inputValue: "general",
    filter: (textValue, input) => textValue.includes(input),
  });

  const items = [...document.querySelectorAll('[data-slot="command-item"]')];
  assert.deepEqual(
    items.map((item) => item.textContent),
    ["general"],
  );
});

test("the muted re-point sits on the dialog, above app content, with the surface captured on the container", async () => {
  const document = await renderPalette();

  const container = document.querySelector('[data-slot="command-container"]');
  const dialog = document.querySelector('[data-slot="command-dialog"]');

  // Order matters: the capture has to resolve before the re-point, so it cannot
  // live on the same element.
  assert.match(container.className, /\[--buzz-muted-surface:var\(--muted\)\]/);
  assert.match(dialog.className, /\[--muted:var\(--muted-foreground\)\]/);
  assert.ok(
    !container.className.includes("[--muted:var(--muted-foreground)]"),
    "capture and re-point collapsed onto one element",
  );
});
