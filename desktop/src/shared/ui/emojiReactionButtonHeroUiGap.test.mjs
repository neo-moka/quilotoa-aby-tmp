import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after, afterEach, before, test } from "node:test";

import { JSDOM } from "jsdom";

/**
 * Why this file exists even though nothing imports `EmojiReactionButton`.
 *
 * The reaction pill in `features/messages/ui/MessageReactions.tsx` is the one
 * place in the chat core where a Pro component was a real candidate — it is the
 * only component in that evaluation Pro does *not* file under "AI", and the app
 * hand-rolls exactly what it offers. It was rejected on measured facts, not on
 * taste, and those facts are what this file pins.
 *
 * A verdict written in prose gets re-litigated; a verdict with a test gets
 * re-checked. If any group here starts failing, upstream has closed the gap and
 * adopting `EmojiReactionButton` is worth reconsidering — which is the whole
 * point. See `docs/heroui-migration/component-map.md` §6quinquies.
 *
 * Same shape as `buttonHeroUiGap.test.mjs`, which pins the equivalent gap in
 * HeroUI's `Button` — and the same ending, which is the surprise. `title` is
 * dropped here too, but `render` reclaims it exactly as it does for the button,
 * even though Pro's docs list no such prop for this component.
 *
 * So the blocker is not the dropped attribute. It is `isReadOnly`: adopting the
 * component was worth doing only because `isReadOnly` promised to remove the
 * wrapping `<span>` in `MessageReactions` that delegates hover and focus around
 * a `disabled` button. Pro's own stylesheet sets `pointer-events: none` on the
 * read-only pill, and its root forces `excludeFromTabOrder`. Neither hoverable
 * nor tabbable — the span has to stay, and with it the only reason to adopt.
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
    MouseEvent: dom.window.MouseEvent,
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

/** Renders raw Pro, i.e. what a wrapper would have to compensate for. */
async function renderProPill(props) {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  // The subpath, not the package root. The root barrel also pulls `sheet`,
  // whose `use-scale-background` calls `window.matchMedia` at module scope —
  // something jsdom does not implement, so a root import throws on import
  // rather than on an assertion. Bundled builds are unaffected; this only
  // bites bare Node tests.
  const { EmojiReactionButton } = await import(
    "@heroui-pro/react/emoji-reaction-button"
  );

  const view = render(
    React.createElement(
      EmojiReactionButton,
      { ...props },
      React.createElement(EmojiReactionButton.Emoji, null, "🎉"),
      React.createElement(EmojiReactionButton.Count, null, 3),
    ),
  );
  return view.container.firstElementChild;
}

// 1. The dropped attribute ------------------------------------------------

test("`title` never reaches the DOM", async () => {
  const pill = await renderProPill({
    "aria-label": "Toggle 🎉 reaction",
    title: "party popper",
  });

  assert.equal(
    pill.getAttribute("title"),
    null,
    "React Aria's filterDOMProps is an allowlist and `title` is not on it",
  );
  // The reaction pill uses `title` for the emoji's human name, so losing it
  // silently is a functional loss, not a cosmetic one.
  assert.equal(pill.tagName, "BUTTON");
});

test("the props the pill also depends on do survive, so the gap is exactly one attribute", async () => {
  const pill = await renderProPill({
    "aria-label": "Toggle 🎉 reaction",
    "data-testid": "reaction-pill",
    isSelected: true,
  });

  assert.equal(pill.getAttribute("data-testid"), "reaction-pill");
  assert.equal(pill.getAttribute("aria-label"), "Toggle 🎉 reaction");
  // RAC derives `aria-pressed` from `isSelected`, so the pill would not have to
  // set it by hand any more.
  assert.equal(pill.getAttribute("aria-pressed"), "true");
  assert.equal(pill.getAttribute("data-selected"), "true");
});

// 2. The escape hatch that does exist -------------------------------------

test("`render` reclaims the dropped attribute, the same hatch `button.tsx` uses", async () => {
  const React = await import("react");
  const { render } = await import("@testing-library/react");
  // The subpath, not the package root. The root barrel also pulls `sheet`,
  // whose `use-scale-background` calls `window.matchMedia` at module scope —
  // something jsdom does not implement, so a root import throws on import
  // rather than on an assertion. Bundled builds are unaffected; this only
  // bites bare Node tests.
  const { EmojiReactionButton } = await import(
    "@heroui-pro/react/emoji-reaction-button"
  );

  // Pro's docs list no `render` prop for this component, but the root spreads
  // its rest props into React Aria's `ToggleButton`, which does honour it. The
  // docs are wrong; the shipped code is what matters.
  const view = render(
    React.createElement(
      EmojiReactionButton,
      {
        "data-testid": "reaction-pill",
        isSelected: true,
        render: (props) =>
          React.createElement("button", { ...props, title: "party popper" }),
      },
      React.createElement(EmojiReactionButton.Emoji, null, "🎉"),
    ),
  );

  const pill = view.container.firstElementChild;
  assert.equal(
    pill.getAttribute("title"),
    "party popper",
    "so losing `title` is NOT what blocks adoption — it is recoverable",
  );
  // And the hatch does not cost the component's own state wiring.
  assert.equal(pill.getAttribute("data-selected"), "true");
  assert.match(pill.getAttribute("class") ?? "", /emoji-reaction-button/);
});

// 3. The two halves of `isReadOnly`, which defeat the one reason to adopt ---

test("`isReadOnly` also drops the pill out of the tab order", async () => {
  const pill = await renderProPill({
    "data-testid": "reaction-pill",
    isReadOnly: true,
  });

  assert.equal(pill.getAttribute("data-readonly"), "true");
  assert.equal(
    pill.getAttribute("tabindex"),
    "-1",
    "the root forces excludeFromTabOrder when read-only",
  );
});

test("`isReadOnly` ships `pointer-events: none`, recreating the hack it would remove", () => {
  const require = createRequire(import.meta.url);
  const cssPath = join(
    dirname(require.resolve("@heroui-pro/react/package.json")),
    "dist/css/components/emoji-reaction-button.css",
  );
  const css = readFileSync(cssPath, "utf8");

  // The sole argument for adopting this component was that `isReadOnly` keeps
  // the pill hoverable and focusable, letting `MessageReactions` drop the
  // wrapping `<span>` that delegates hover/focus around a `disabled` button.
  // Pro's own stylesheet takes that back: the read-only pill cannot be hovered,
  // so the popover listing who reacted would need the span regardless.
  assert.match(
    css,
    /\.emoji-reaction-button\[data-readonly=true\]\{pointer-events:none/,
    "if this rule is gone upstream, the isReadOnly argument is live again",
  );

  // Selected state resolves through `--accent`, which this app deliberately
  // leaves pointed at its hover surface (see `heroAccentScope.ts`). Adopting
  // the component means scoping that token or overriding the rule.
  assert.match(
    css,
    /\.emoji-reaction-button\[data-selected=true\]\{border-color:var\(--accent\)/,
  );
});
