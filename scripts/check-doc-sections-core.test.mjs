import assert from "node:assert/strict";
import test from "node:test";

import {
  checkAnchors,
  parseCitations,
  parseSections,
} from "./check-doc-sections-core.mjs";

/**
 * The shape that made this guard necessary. `6quater` appears twice, which the
 * real map has done for a while, and the numbering runs past plain integers
 * into the Latin ordinals the map uses.
 */
const map = [
  "# Component map",
  "",
  "## 4. Los dos cambios de API",
  "text",
  "## 6. Reparto en paralelo",
  "text",
  "### 6bis. `data-testid` NO es solo contrato de test",
  "text",
  "## 6ter. Los overlays se quedan en Radix",
  "text",
  "## 6quater. Cierre de wrappers",
  "text",
  "## 6quater. El botón migra vía `render`",
  "text",
  "## 6septies. Los componentes de chat de Pro",
  "text",
  "## 7. Reglas duras",
].join("\n");

test("headings become section ids, Latin ordinals included", () => {
  const { ids } = parseSections(map);

  assert.deepEqual(
    [...ids].sort(),
    ["4", "6", "6bis", "6quater", "6septies", "6ter", "7"],
    "ordinal suffixes are part of the id, not stripped to the number",
  );
});

test("a section declared twice is reported as duplicated", () => {
  const { duplicated } = parseSections(map);

  // Citations to a duplicated id are ambiguous: the reader cannot tell which
  // of the two sections the code meant.
  assert.deepEqual(duplicated, ["6quater"]);
});

test("prose that merely contains a number is not a heading", () => {
  const { ids } = parseSections(
    ["Se reparten así: 6 grupos.", "3. Not a heading either."].join("\n"),
  );

  assert.equal(ids.size, 0);
});

test("citations are found with and without a space after the section sign", () => {
  const found = parseCitations(
    [
      " * arrives; see `component-map.md` §6ter and §6septies.",
      " * See `component-map.md` § 4 for the count.",
    ].join("\n"),
  );

  assert.deepEqual(
    found.map((citation) => citation.id),
    ["6ter", "6septies", "4"],
  );
  assert.equal(found[0].line, 1);
  assert.equal(found[2].line, 2);
});

test("a citation is attributed to the document named on its line", () => {
  const found = parseCitations(
    [
      " * `docs/heroui-migration/component-map.md` §6ter; the behaviour",
      " * inversion `theming-contract.md` §4 describes",
      " * See docs/welcome-kickoff-silent-failures.md §1.",
    ].join("\n"),
  );

  // All three are `§<small number>`, and two of them collide with real
  // component-map sections. Resolving them against one document would report
  // agreement that does not exist.
  assert.deepEqual(
    found.map((citation) => citation.doc),
    [
      "component-map.md",
      "theming-contract.md",
      "welcome-kickoff-silent-failures.md",
    ],
  );
});

test("a citation with no document on its line is left unattributed, not guessed", () => {
  const [citation] = parseCitations("// See §6ter for why.");

  assert.equal(citation.doc, null);
});

test("`§7.2` addresses an item under `## 7.`, not a heading of its own", () => {
  const [citation] = parseCitations(" * See component-map.md §7.2.");

  assert.equal(citation.id, "7.2", "the full address survives into the report");
  assert.equal(
    citation.headingId,
    "7",
    "but resolution stops at the heading, so a list-item reference is not a false dangle",
  );
});

test("the failure this guard exists for: a citation that still resolves, but to the wrong section", () => {
  const { ids } = parseSections(map);
  const cited = parseCitations("// See §6quinquies for the evidence.");

  // Before the rename, `6quinquies` was the chat evaluation. After it, the
  // chat evaluation is `6septies` and `6quinquies` belongs to another lot. A
  // guard that only asked "does the target exist" would pass this once the
  // other lot lands its section — which is exactly why the check runs against
  // the citations in code rather than against the doc alone.
  assert.equal(ids.has(cited[0].id), false, "dangling while the id is absent");

  const afterOtherLotLands = parseSections(
    `${map}\n## 6quinquies. El shell no adopta Pro`,
  );
  assert.equal(
    afterOtherLotLands.ids.has(cited[0].id),
    true,
    "and silently valid once something else claims the number — the reason the fix is to repoint citations at merge time, not to trust a one-off grep",
  );
});

test("an anchor catches the number being reused by another section", () => {
  // The incident, exactly: the chat evaluation moves off `6septies`, and the
  // button lot takes the number. Existence checking passes — `§6septies`
  // resolves — and the reader lands on the wrong lot's verdicts.
  const renumbered = parseSections(
    [
      "## 6octies. Los componentes de chat de Pro",
      "## 6septies. El botón migra vía `render`",
    ].join("\n"),
  );

  assert.equal(
    renumbered.ids.has("6septies"),
    true,
    "the citation still resolves, which is the whole problem",
  );

  const [failure] = checkAnchors(renumbered.titles, [
    {
      section: "6septies",
      titleIncludes: "Los componentes de chat de Pro",
      why: "useHoverPopover.ts",
    },
  ]);
  assert.match(failure.reason, /now titled "El botón migra/);
});

test("an anchor also catches the section disappearing outright", () => {
  const { titles } = parseSections(
    "## 6octies. Los componentes de chat de Pro",
  );

  const [failure] = checkAnchors(titles, [
    {
      section: "6septies",
      titleIncludes: "Los componentes de chat de Pro",
      why: "useHoverPopover.ts",
    },
  ]);
  assert.equal(failure.reason, "the section no longer exists");
});

test("an anchor passes while the number still names its section", () => {
  const { titles } = parseSections(map);

  assert.deepEqual(
    checkAnchors(titles, [
      {
        section: "6ter",
        titleIncludes: "Los overlays se quedan en Radix",
        why: "popover.tsx",
      },
      { section: "7", titleIncludes: "Reglas duras", why: "tooltip.tsx" },
    ]),
    [],
  );
});

test("an uncited section is detectable without being an error", () => {
  const { ids } = parseSections(map);
  const cited = new Set(
    parseCitations("// §6ter and §7").map((citation) => citation.id),
  );

  const uncited = [...ids].filter((id) => !cited.has(id)).sort();
  assert.deepEqual(uncited, ["4", "6", "6bis", "6quater", "6septies"]);
});
