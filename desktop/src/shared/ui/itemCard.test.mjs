// `SidebarProfileCard` hangs two things off the ItemCard root's ref: the
// `event.target` containment check that decides whether a click opens the
// profile popover, and `ProfilePopover`'s `triggerContainerRef` anchor. A root
// that swallowed `ref` would break both with no error and no failing type —
// so the forwarding is pinned here rather than assumed.
//
// It also pins that the description's `--muted` re-point lands on the
// description itself, since that token means "surface" in this app and Pro
// uses it as a text colour.
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

const renderCard = async (rootProps = {}) => {
  const { createElement: h } = await import("react");
  const { render } = await import("@testing-library/react");
  const { ItemCard } = await import("@/shared/ui/item-card");

  render(
    h(
      ItemCard,
      {
        "data-testid": "sidebar-profile-card",
        variant: "transparent",
        ...rootProps,
      },
      h("button", { type: "button", "data-testid": "avatar-button" }, "avatar"),
      h(
        ItemCard.Content,
        null,
        h(ItemCard.Title, { "data-testid": "profile-name" }, "Ada"),
        h(ItemCard.Description, { "data-buzz-sidebar-secondary": "" }, "buzz"),
      ),
    ),
  );

  return dom.window.document;
};

test("the root forwards ref to the real DOM node", async () => {
  const { createRef } = await import("react");
  const ref = createRef();

  const document = await renderCard({ ref });

  const card = document.querySelector('[data-testid="sidebar-profile-card"]');
  assert.ok(card, "the card did not render");
  assert.equal(ref.current, card, "ref did not reach the card element");

  // The containment check the card relies on.
  const child = document.querySelector('[data-testid="avatar-button"]');
  assert.ok(ref.current.contains(child));
});

test("the root forwards data-testid and click handlers", async () => {
  let clicks = 0;
  const document = await renderCard({
    onClick: () => {
      clicks += 1;
    },
  });

  const card = document.querySelector('[data-testid="sidebar-profile-card"]');
  assert.equal(card.dataset.slot, "item-card");

  card.dispatchEvent(
    new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }),
  );
  assert.equal(clicks, 1);
});

test("the transparent variant does not paint a surface", async () => {
  const document = await renderCard();

  const card = document.querySelector('[data-testid="sidebar-profile-card"]');
  assert.match(card.className, /item-card--transparent/);
  assert.ok(
    !card.className.includes("item-card--default"),
    "the default variant would paint var(--surface) plus a shadow",
  );
});

test("title and description keep their testids and app attributes", async () => {
  const document = await renderCard();

  const title = document.querySelector('[data-testid="profile-name"]');
  assert.equal(title.dataset.slot, "item-card-title");

  const description = document.querySelector(
    '[data-slot="item-card-description"]',
  );
  assert.ok(description.hasAttribute("data-buzz-sidebar-secondary"));
});

test("the muted re-point sits on the description, not on the root", async () => {
  const document = await renderCard();

  const card = document.querySelector('[data-testid="sidebar-profile-card"]');
  const description = document.querySelector(
    '[data-slot="item-card-description"]',
  );

  assert.match(description.className, /\[--muted:var\(--muted-foreground\)\]/);
  assert.ok(
    !card.className.includes("[--muted:var(--muted-foreground)]"),
    "the re-point blankets the row, so nested bg-muted would invert",
  );
});

test("the surface does not mutate Pro's own ItemCard namespace", async () => {
  const { ItemCard } = await import("@/shared/ui/item-card");
  const pro = await import("@heroui-pro/react/item-card");

  assert.notEqual(ItemCard, pro.ItemCardRoot);
  assert.notEqual(ItemCard.Description, pro.ItemCardDescription);
  assert.equal(
    pro.ItemCardRoot.Description,
    pro.ItemCardDescription,
    "the app's Description override leaked onto Pro's shared namespace",
  );
});
