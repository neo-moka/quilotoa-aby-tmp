import { execFileSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Shared "no orphaned `data-testid` consumer" guard.
 *
 * `data-testid` is not only a test hook in this repo. Three different consumers
 * depend on the exact same strings, and only one of them fails loudly:
 *
 *   - **specs** — `desktop/tests/**` drives the app through `getByTestId`.
 *     Playwright runs in CI only; neither `just ci` nor `just check` runs it,
 *     so a dropped testid survives every local gate.
 *   - **styles** — `shared/styles/globals/theme.css` paints the app surfaces
 *     through `[data-testid="…"]` selectors. Losing one throws nothing: the
 *     element degrades to unthemed chrome that still renders.
 *   - **runtime** — production code resolves focus targets and scroll anchors
 *     with `querySelector`/`closest` on testids. Losing one breaks user-visible
 *     behaviour, silently.
 *
 * This guard compares what those consumers ask for against what the source
 * actually emits, and fails when a consumed testid has no emitter left.
 * Swapping a hand-rolled component for a library one (the HeroUI migration) is
 * exactly the change that drops a testid without touching whatever needed it.
 *
 * It deliberately does NOT flag emitters nobody consumes — unused testids are
 * cheap, and whole feature areas carry them ahead of test coverage.
 *
 * ## Emission patterns it understands
 *
 *   1. **Literal** — `data-testid="app-sidebar"`.
 *   2. **Via a component's own prop** — `testId=`, `dataTestId=`, `listTestId=`,
 *      `testIds={{ chip: … }}`, destructured defaults (`testId = "…"`), and
 *      props a component forwards into `data-testid={…}` even when the name
 *      says nothing about testids (`switchId`). Carrier names are discovered
 *      from the code, not hardcoded, and resolved to a fixpoint.
 *   3. **Dynamic template** — `` `channel-${channel.name}` `` becomes a pattern
 *      that covers `channel-general`. Where an interpolation resolves to a
 *      known set of literals (the `optionTestIdPrefix="font-size"` shape), the
 *      template is expanded with them so `font-size-default` matches exactly
 *      rather than through a wildcard.
 *
 * ## What it deliberately does not treat as a contract
 *
 *   - **Absence assertions.** `expect(getByTestId(x)).toHaveCount(0)` asserts
 *     that `x` is *not* rendered. Nothing has to emit it, and several such
 *     testids never existed in the app at all.
 *   - **Spec-injected elements.** Specs that build their own DOM
 *     (`element.dataset.testid = "…"`) own those testids; the app never emits
 *     them.
 *
 * ## Known limits — the guard reports these instead of pretending
 *
 * Extraction is textual, not a type-aware AST walk. Everything it cannot
 * resolve is counted in the `unresolved` bucket printed with the result:
 *
 *   - `getByTestId(someVariable)` where the variable is a function parameter or
 *     an import. Only same-file `const NAME = "…"` bindings are resolved.
 *   - Consumers whose template has no leading literal (`` `${prefix}-icon` ``):
 *     nothing to anchor a prefix search on.
 *   - Whole spec files that inject testids through a *variable*
 *     (`el.dataset.testid = testId`, value passed as a call argument): misses
 *     in those files are downgraded, because the emitter is the spec itself.
 *   - Emitter templates whose literal content is shorter than
 *     `MIN_PATTERN_LITERAL_LENGTH` (`` `${a}-${b}` ``): their pattern would
 *     match nearly every testid in the repo and neuter the guard, so they are
 *     dropped rather than trusted.
 *
 * Dynamic emitter patterns also over-match by construction: `channel-${name}`
 * covers the literal `channel-composer-overlay` even though a different element
 * emits that one. That direction costs a missed detection, never a false alarm.
 */

// A dynamic emitter pattern is only trusted when its literal (non-interpolated)
// content is at least this long. `${a}-${b}` yields `^.+-.+$`, which matches
// almost every testid in the repo; trusting it would mark everything covered.
const MIN_PATTERN_LITERAL_LENGTH = 4;

// Ceilings that keep template expansion from exploding on a widely-used
// carrier name.
const MAX_CARRIER_VALUES = 40;
const MAX_EXPANSIONS = 120;
const CARRIER_ROUNDS = 4;

// Identifiers that plausibly carry a testid (or a testid fragment). Anything
// else found inside a `data-testid={…}` expression — `option.value`,
// `hasError`, a type annotation — would drag unrelated string literals into
// the emitter set and quietly neuter the guard.
const CARRIER_NAME_RE = /test-?id|prefix|[a-z0-9]Id$/i;

// `data-testid`, or any identifier that reads as a testid prop (`testId`,
// `listTestId`, `dataTestid`, `testIds`), followed by `:` or `=`. The negative
// lookahead keeps `===`, `==` and `=>` out.
// The `_?` matters: module constants are conventionally SCREAMING_SNAKE
// (`AUXILIARY_PANEL_CLOSE_TEST_ID`), and without it the scanner skips every
// testid held in one — which reads as "this testid has no emitter" rather than
// as a gap in the scanner.
const SINK_RE =
  /(data-testid|[A-Za-z_$][\w$]*[Tt][Ee][Ss][Tt]_?[Ii][Dd]s?|[Tt][Ee][Ss][Tt]_?[Ii][Dd]s?)\s*\??\s*[:=](?![=>])/g;

const GET_BY_TEST_ID_RE = /\bgetByTestId\s*\(\s*/g;
// `[data-testid="x"]`, `[data-testid^="x"]`, … in stylesheets and in selector
// strings embedded in .ts/.tsx. A prefix/substring operator makes the consumer
// dynamic: it asks for a family, not an exact id.
const SELECTOR_RE = /\[\s*data-testid\s*([~^|*$]?)=\s*(["']?)([^\]"']*)\2\s*\]/g;
const SAME_FILE_CONST_RE =
  /\bconst\s+([A-Za-z_$][\w$]*)\s*(?::[^=]*)?=\s*(["'`])/g;
// A spec can consume a testid precisely to assert the element is *not* there.
// Such a consumer needs no emitter — it is satisfied by absence — so counting
// it as orphaned reports a passing test as a broken contract. Beyond
// `toHaveCount(0)`, Playwright spells this as a detached/hidden `waitFor`, a
// negated visibility expectation, or `toBeHidden`.
const ABSENCE_RE =
  /\.toHaveCount\(\s*0\s*,?\s*\)|state:\s*["'](?:detached|hidden)["']|\.not\.\s*to(?:BeVisible|BeAttached|BeInTheDocument)\(|\.toBeHidden\(/;
// A spec building its own element: `el.dataset.testid = …` /
// `el.setAttribute("data-testid", …)`.
const SPEC_INJECTION_RE =
  /(?:\.dataset\.testid\s*=|\.setAttribute\(\s*["']data-testid["']\s*,)\s*/g;

/* ------------------------------------------------------------------ *
 * Literal scanning helpers
 * ------------------------------------------------------------------ */

/** Reads a quoted string starting at `start` (which points at the quote). */
function readQuoted(source, start) {
  const quote = source[start];
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (char === quote) {
      return { value: source.slice(start + 1, i), end: i + 1 };
    }
    if (char === "\n") return null;
  }
  return null;
}

/**
 * Reads a template literal starting at the backtick, keeping `${…}` spans
 * intact so the caller can turn them into wildcards. Nested templates and
 * quotes inside an interpolation are consumed as part of the outer value.
 */
function readTemplate(source, start) {
  let depth = 0;
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i];
    if (char === "\\") {
      i++;
      continue;
    }
    if (depth === 0 && char === "`") {
      return { value: source.slice(start + 1, i), end: i + 1 };
    }
    if (char === "$" && source[i + 1] === "{") {
      depth++;
      i++;
      continue;
    }
    if (depth > 0) {
      if (char === "{") depth++;
      else if (char === "}") depth--;
      else if (char === '"' || char === "'" || char === "`") {
        const nested =
          char === "`" ? readTemplate(source, i) : readQuoted(source, i);
        if (!nested) return null;
        i = nested.end - 1;
      }
    }
  }
  return null;
}

function readLiteral(source, start) {
  const char = source[start];
  if (char === "`") return readTemplate(source, start);
  if (char === '"' || char === "'") return readQuoted(source, start);
  return null;
}

/** Reads a balanced `{ … }` block starting at the opening brace. */
function readBraced(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (char === '"' || char === "'" || char === "`") {
      const literal = readLiteral(source, i);
      if (!literal) return null;
      i = literal.end - 1;
      continue;
    }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) {
        return { value: source.slice(start + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

/** Every string/template literal in a chunk of code, in source order. */
function literalsIn(text) {
  const found = [];
  for (let i = 0; i < text.length; i++) {
    const literal = readLiteral(text, i);
    if (!literal) continue;
    found.push(literal.value);
    i = literal.end - 1;
  }
  return found;
}

function lineOf(source, index) {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === "\n") line++;
  }
  return line;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------------------------------------------ *
 * Patterns
 * ------------------------------------------------------------------ */

/** The `${…}` spans of a raw template value, with balanced braces. */
function interpolationSpans(raw) {
  const spans = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] !== "$" || raw[i + 1] !== "{") continue;
    let depth = 1;
    let j = i + 2;
    for (; j < raw.length && depth > 0; j++) {
      if (raw[j] === "{") depth++;
      else if (raw[j] === "}") depth--;
    }
    spans.push({ start: i, end: j, expression: raw.slice(i + 2, j - 1) });
    i = j - 1;
  }
  return spans;
}

/**
 * Turns a raw testid value into a matchable pattern. `${…}` spans become
 * wildcards; everything else stays literal.
 *
 * @returns {{raw: string, dynamic: boolean, prefix: string, literalLength: number, regex: RegExp, sample: string}}
 */
export function parseTestIdPattern(raw) {
  const spans = interpolationSpans(raw);
  const segments = [];
  let cursor = 0;
  for (const span of spans) {
    segments.push(raw.slice(cursor, span.start));
    cursor = span.end;
  }
  segments.push(raw.slice(cursor));

  return {
    raw,
    dynamic: spans.length > 0,
    prefix: segments[0],
    literalLength: segments.join("").length,
    regex: new RegExp(`^${segments.map(escapeRegExp).join(".+")}$`),
    // A concrete instance of the pattern, used to test one dynamic value
    // against another dynamic pattern without unifying them symbolically.
    sample: segments.join(""),
  };
}

/**
 * Expands `${…}` spans whose expression is a carrier with known literal
 * values, so `` `${optionTestIdPrefix}-${value}` `` with the prefix bound to
 * `"font-size"` yields the usable `font-size-${value}`.
 */
export function expandTemplate(raw, carrierValues, depth = 0) {
  if (depth >= 3) return [raw];
  for (const span of interpolationSpans(raw)) {
    const name = span.expression.trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;
    const values = carrierValues.get(name);
    if (!values || values.size === 0 || values.size > MAX_CARRIER_VALUES) {
      continue;
    }
    const expanded = [raw];
    for (const value of values) {
      const next = raw.slice(0, span.start) + value + raw.slice(span.end);
      expanded.push(...expandTemplate(next, carrierValues, depth + 1));
      if (expanded.length > MAX_EXPANSIONS) break;
    }
    return expanded.slice(0, MAX_EXPANSIONS);
  }
  return [raw];
}

/* ------------------------------------------------------------------ *
 * Emitters
 * ------------------------------------------------------------------ */

/** Carrier / builder identifiers referenced by a testid-valued expression. */
function classifyExpression(expression) {
  const carriers = new Set();
  const builders = new Set();
  for (const match of expression.matchAll(/([A-Za-z_$][\w$]*)\s*(\()?/g)) {
    const name = match[1];
    if (!CARRIER_NAME_RE.test(name)) continue;
    if (match[2]) builders.add(name);
    else carriers.add(name);
  }
  return { carriers, builders };
}

/**
 * Walks every `<name>: …` / `<name> = …` sink matched by `sinkRe` and reports
 * the literal values found plus the identifiers those values defer to.
 */
function extractFromSinks(content, sinkRe, relativePath) {
  const values = [];
  const passThrough = new Set();
  const interpolated = new Set();
  const builders = new Set();

  sinkRe.lastIndex = 0;
  let match = sinkRe.exec(content);
  while (match) {
    // `[data-testid="x"]` is a *selector*, not an emission. The consumer
    // passes pick those up instead.
    if (content[match.index - 1] === "[") {
      match = sinkRe.exec(content);
      continue;
    }

    let cursor = match.index + match[0].length;
    while (cursor < content.length && /\s/.test(content[cursor])) cursor++;
    const lineNumber = lineOf(content, match.index);
    const literal = readLiteral(content, cursor);

    if (literal) {
      values.push({ raw: literal.value, relativePath, lineNumber });
      for (const span of interpolationSpans(literal.value)) {
        for (const name of classifyExpression(span.expression).carriers) {
          interpolated.add(name);
        }
      }
      sinkRe.lastIndex = literal.end;
    } else if (content[cursor] === "{") {
      const block = readBraced(content, cursor);
      if (block) {
        const literals = literalsIn(block.value);
        for (const raw of literals) {
          values.push({ raw, relativePath, lineNumber });
          for (const span of interpolationSpans(raw)) {
            for (const name of classifyExpression(span.expression).carriers) {
              interpolated.add(name);
            }
          }
        }
        if (literals.length === 0) {
          const classified = classifyExpression(block.value);
          for (const name of classified.carriers) passThrough.add(name);
          for (const name of classified.builders) builders.add(name);
        }
        sinkRe.lastIndex = block.end;
      }
    }
    match = sinkRe.exec(content);
  }

  return { values, passThrough, interpolated, builders };
}

/** Literals inside the body of `function NAME(…) { … }` / `const NAME = …`. */
function extractFromBuilder(content, name, relativePath) {
  const values = [];
  const defRe = new RegExp(
    `\\b(?:function\\s+|const\\s+|let\\s+)${escapeRegExp(name)}\\b`,
    "g",
  );
  for (const match of content.matchAll(defRe)) {
    const braceOffset = content.slice(match.index, match.index + 200).indexOf("{");
    const body =
      braceOffset >= 0
        ? readBraced(content, match.index + braceOffset)?.value
        : undefined;
    // Expression-bodied arrow (`const x = (a) => \`…\``): fall back to the
    // rest of the statement.
    const text = body ?? content.slice(match.index, match.index + 300);
    for (const raw of literalsIn(text)) {
      values.push({
        raw,
        relativePath,
        lineNumber: lineOf(content, match.index),
      });
    }
  }
  return values;
}

/**
 * Collects every testid the source can emit.
 *
 * @param {Array<{relativePath: string, content: string}>} files
 * @returns {Array<{raw: string, relativePath: string, lineNumber: number}>}
 */
export function collectEmitters(files) {
  const emitters = [];
  const passThrough = new Set();
  const builders = new Set();
  const pending = new Set();
  /** @type {Map<string, Set<string>>} */
  const carrierValues = new Map();

  const absorb = (result, { asEmitter }) => {
    if (asEmitter) emitters.push(...result.values);
    for (const name of result.passThrough) {
      passThrough.add(name);
      pending.add(name);
    }
    for (const name of result.interpolated) pending.add(name);
    for (const name of result.builders) builders.add(name);
  };

  for (const file of files) {
    absorb(extractFromSinks(file.content, SINK_RE, file.relativePath), {
      asEmitter: true,
    });
  }

  // Carrier props are resolved to a fixpoint: a carrier's own call sites may
  // hand off to yet another carrier name.
  const seen = new Set();
  for (let round = 0; round < CARRIER_ROUNDS; round++) {
    const names = [...pending].filter((name) => !seen.has(name));
    if (names.length === 0) break;
    for (const name of names) seen.add(name);
    const carrierRe = new RegExp(
      `\\b(?:${names.map(escapeRegExp).join("|")})\\s*\\??\\s*[:=](?![=>])`,
      "g",
    );
    for (const file of files) {
      const result = extractFromSinks(
        file.content,
        carrierRe,
        file.relativePath,
      );
      // A carrier's values are emitters only when the carrier is forwarded
      // straight into `data-testid`; when it only feeds a `${…}` span it is a
      // fragment, and becomes an emitter through template expansion instead.
      absorb(result, { asEmitter: false });
      for (const value of result.values) {
        const matchedName = names.find((name) =>
          new RegExp(`\\b${escapeRegExp(name)}\\s*\\??\\s*[:=]`).test(
            file.content.slice(
              Math.max(0, indexOfLine(file.content, value.lineNumber)),
              indexOfLine(file.content, value.lineNumber + 1),
            ),
          ),
        );
        if (matchedName) {
          const bucket = carrierValues.get(matchedName) ?? new Set();
          bucket.add(value.raw);
          carrierValues.set(matchedName, bucket);
          if (passThrough.has(matchedName)) emitters.push(value);
        }
      }
    }
  }

  for (const name of builders) {
    for (const file of files) {
      if (!file.content.includes(name)) continue;
      emitters.push(...extractFromBuilder(file.content, name, file.relativePath));
    }
  }

  const expanded = [];
  for (const emitter of emitters) {
    for (const raw of expandTemplate(emitter.raw, carrierValues)) {
      expanded.push(raw === emitter.raw ? emitter : { ...emitter, raw });
    }
  }
  return expanded;
}

/** Byte offset where `lineNumber` starts (1-based); end of file if past it. */
function indexOfLine(content, lineNumber) {
  if (lineNumber <= 1) return 0;
  let line = 1;
  for (let i = 0; i < content.length; i++) {
    if (content[i] !== "\n") continue;
    line++;
    if (line === lineNumber) return i + 1;
  }
  return content.length;
}

/**
 * Indexes emitters into exact literals plus trusted dynamic patterns.
 *
 * @param {Array<{raw: string, relativePath: string, lineNumber: number}>} emitters
 */
export function buildEmitterIndex(emitters) {
  const literals = new Map();
  const patterns = [];
  const untrustedPatterns = [];

  for (const emitter of emitters) {
    const pattern = parseTestIdPattern(emitter.raw);
    if (!pattern.dynamic) {
      if (!literals.has(emitter.raw)) literals.set(emitter.raw, emitter);
      // A literal handed to a component as a testid prop is a family root, not
      // a leaf: `<UserAvatar testId="message-avatar" />` makes the avatar emit
      // `message-avatar-image` and `message-avatar-fallback` from a different
      // file. Resolving that properly means following the prop across modules,
      // which this scanner does not do, so the literal is registered as
      // covering its own `-` descendants too.
      //
      // Deliberately widening: it can mask the loss of one member of a family
      // whose root still exists. The alternative — reporting every prop-passed
      // family as orphaned — produces noise that gets the whole guard ignored,
      // which costs more.
      patterns.push({
        ...emitter,
        pattern: {
          raw: `${emitter.raw}-\${*}`,
          dynamic: true,
          prefix: `${emitter.raw}-`,
          literalLength: emitter.raw.length + 1,
          regex: new RegExp(`^${escapeRegExp(`${emitter.raw}-`)}.+$`),
          sample: `${emitter.raw}-`,
        },
      });
      continue;
    }
    const entry = { ...emitter, pattern };
    if (pattern.literalLength < MIN_PATTERN_LITERAL_LENGTH) {
      untrustedPatterns.push(entry);
      continue;
    }
    patterns.push(entry);
  }

  return { literals, patterns, untrustedPatterns };
}

/* ------------------------------------------------------------------ *
 * Consumers
 * ------------------------------------------------------------------ */

function sameFileConstants(content) {
  const constants = new Map();
  for (const match of content.matchAll(SAME_FILE_CONST_RE)) {
    const literal = readLiteral(content, match.index + match[0].length - 1);
    if (literal) constants.set(match[1], literal.value);
  }
  return constants;
}

/** Is this `getByTestId` call asserting the element is *absent*? */
function isInlineAbsenceAssertion(content, endIndex) {
  const slice = content.slice(endIndex, endIndex + 400);
  const stop = slice.indexOf(";");
  return ABSENCE_RE.test(stop >= 0 ? slice.slice(0, stop) : slice);
}

/** The `const NAME =` this call is bound to, if any. */
function boundConstantName(content, startIndex) {
  const lineStart = content.lastIndexOf("\n", startIndex) + 1;
  return /\bconst\s+([A-Za-z_$][\w$]*)\s*=/.exec(
    content.slice(lineStart, startIndex),
  )?.[1];
}

/**
 * A locator bound to a name that is only ever asserted absent — the spec is
 * pinning "this must not render", which no emitter has to satisfy.
 */
function isAbsenceOnlyBinding(content, name) {
  const useRe = new RegExp(`\\b${escapeRegExp(name)}\\b`, "g");
  let absences = 0;
  let uses = 0;
  for (const match of content.matchAll(useRe)) {
    const before = content.slice(Math.max(0, match.index - 8), match.index);
    if (/\bconst\s+$/.test(before)) continue;
    uses++;
    const after = content.slice(match.index, match.index + 200);
    if (new RegExp(`^${escapeRegExp(name)}\\s*\\)*\\s*${ABSENCE_RE.source}`).test(after)) {
      absences++;
    }
  }
  return uses > 0 && absences === uses;
}

/**
 * `getByTestId(…)` plus `[data-testid="…"]` selector strings in spec files.
 *
 * @param {Array<{relativePath: string, content: string}>} files
 */
export function collectSpecConsumers(files) {
  const consumers = [];
  const unresolved = [];

  for (const { relativePath, content } of files) {
    const constants = sameFileConstants(content);

    GET_BY_TEST_ID_RE.lastIndex = 0;
    let match = GET_BY_TEST_ID_RE.exec(content);
    while (match) {
      const cursor = match.index + match[0].length;
      const lineNumber = lineOf(content, match.index);
      const literal = readLiteral(content, cursor);
      const identifier = literal
        ? undefined
        : /^[A-Za-z_$][\w$]*/.exec(content.slice(cursor))?.[0];
      const raw = literal ? literal.value : constants.get(identifier ?? "");

      if (raw === undefined) {
        unresolved.push({
          reason: "getByTestId argument is a variable",
          detail: identifier ?? "expression",
          relativePath,
          lineNumber,
        });
      } else {
        const bound = boundConstantName(content, match.index);
        const absent =
          isInlineAbsenceAssertion(content, literal?.end ?? cursor) ||
          (bound !== undefined && isAbsenceOnlyBinding(content, bound));
        if (!absent) {
          consumers.push({ raw, relativePath, lineNumber, kind: "spec" });
        }
      }
      match = GET_BY_TEST_ID_RE.exec(content);
    }

    consumers.push(...collectSelectorConsumers(relativePath, content, "spec"));
  }

  return { consumers, unresolved };
}

function collectSelectorConsumers(relativePath, content, kind) {
  const consumers = [];
  for (const match of content.matchAll(SELECTOR_RE)) {
    const operator = match[1];
    if (operator === "$" || operator === "*" || operator === "~") continue;
    consumers.push({
      // `^=` asks for a family: model it as the same wildcard shape a dynamic
      // emitter has, so a `channel-${name}` emitter satisfies it.
      raw: operator === "^" ? `${match[3]}\${*}` : match[3],
      relativePath,
      lineNumber: lineOf(content, match.index),
      kind,
    });
  }
  return consumers;
}

/**
 * `[data-testid="…"]` selectors in stylesheets — the production styling
 * contract, and the consumer whose loss is completely silent.
 *
 * @param {Array<{relativePath: string, content: string}>} files
 */
export function collectStyleConsumers(files) {
  return files.flatMap(({ relativePath, content }) =>
    collectSelectorConsumers(relativePath, content, "style"),
  );
}

/**
 * `querySelector` / `closest` / `matches` selectors in production sources.
 *
 * @param {Array<{relativePath: string, content: string}>} files
 */
export function collectRuntimeConsumers(files) {
  return files.flatMap(({ relativePath, content }) =>
    collectSelectorConsumers(relativePath, content, "runtime"),
  );
}

/**
 * Testids a spec creates itself (`el.dataset.testid = "x"`). Returns the
 * literal ones as emitters, and flags files that inject through a variable —
 * those cannot be resolved, so misses in them are downgraded rather than
 * reported as app regressions.
 *
 * @param {Array<{relativePath: string, content: string}>} files
 */
export function collectSpecEmitters(files) {
  const emitters = [];
  const dynamicInjectionFiles = new Set();

  for (const { relativePath, content } of files) {
    SPEC_INJECTION_RE.lastIndex = 0;
    let match = SPEC_INJECTION_RE.exec(content);
    while (match) {
      const cursor = match.index + match[0].length;
      const literal = readLiteral(content, cursor);
      if (literal) {
        emitters.push({
          raw: literal.value,
          relativePath,
          lineNumber: lineOf(content, match.index),
        });
      } else {
        dynamicInjectionFiles.add(relativePath);
      }
      match = SPEC_INJECTION_RE.exec(content);
    }
  }

  return { emitters, dynamicInjectionFiles };
}

/* ------------------------------------------------------------------ *
 * Coverage
 * ------------------------------------------------------------------ */

/**
 * Is a consumed testid still emitted somewhere?
 *
 * An exact consumer matches an exact emitter or a dynamic emitter pattern.
 * A dynamic consumer is matched by instantiating it (each `${…}` becomes a
 * placeholder) and testing that instance against the emitter patterns, plus a
 * prefix search over the literals. Unifying two patterns symbolically is not
 * decidable from text alone; this is the strongest signal available without a
 * type-aware AST walk.
 *
 * @returns {"covered" | "missing" | "unresolved"}
 */
export function coverageOf(consumer, index) {
  const pattern = parseTestIdPattern(consumer.raw);

  if (!pattern.dynamic) {
    if (index.literals.has(consumer.raw)) return "covered";
    return index.patterns.some((emitter) =>
      emitter.pattern.regex.test(consumer.raw),
    )
      ? "covered"
      : "missing";
  }

  const { prefix, sample } = pattern;
  if (prefix.length === 0) return "unresolved";
  for (const literal of index.literals.keys()) {
    if (literal.startsWith(prefix)) return "covered";
  }
  for (const emitter of index.patterns) {
    if (emitter.pattern.regex.test(sample)) return "covered";
    const emitterPrefix = emitter.pattern.prefix;
    if (emitterPrefix.length > 0 && emitterPrefix.startsWith(prefix)) {
      return "covered";
    }
  }
  return "missing";
}

/**
 * Groups uncovered consumers by testid.
 *
 * @param {Array<object>} consumers
 * @param {ReturnType<typeof buildEmitterIndex>} index
 * @param {object} [options]
 * @param {Set<string>} [options.overrides] Retired testids, keyed by the testid.
 * @param {Set<string>} [options.downgradedFiles] Files whose misses are unresolved.
 */
export function findMissing(consumers, index, options = {}) {
  const overrides = options.overrides ?? new Set();
  const downgradedFiles = options.downgradedFiles ?? new Set();
  const missing = new Map();
  const unresolved = [];

  for (const consumer of consumers) {
    if (overrides.has(consumer.raw)) continue;
    const coverage = coverageOf(consumer, index);
    if (coverage === "covered") continue;
    if (coverage === "unresolved") {
      unresolved.push({
        reason: "consumer template has no leading literal",
        detail: consumer.raw,
        relativePath: consumer.relativePath,
        lineNumber: consumer.lineNumber,
      });
      continue;
    }
    if (downgradedFiles.has(consumer.relativePath)) {
      unresolved.push({
        reason: "spec injects testids through a variable",
        detail: consumer.raw,
        relativePath: consumer.relativePath,
        lineNumber: consumer.lineNumber,
      });
      continue;
    }
    const entry = missing.get(consumer.raw) ?? { raw: consumer.raw, sites: [] };
    entry.sites.push(consumer);
    missing.set(consumer.raw, entry);
  }

  return { missing: [...missing.values()], unresolved };
}

/* ------------------------------------------------------------------ *
 * Reporting helpers
 * ------------------------------------------------------------------ */

/**
 * Where a now-missing testid used to be emitted. Best effort: a failure here
 * costs a line of the report, never the check itself.
 */
export function findPreviousEmitters(testId, { cwd, pathspec, refs }) {
  const needle = parseTestIdPattern(testId).prefix || testId;
  if (needle.length < 3) return [];
  for (const ref of refs) {
    try {
      const output = execFileSync(
        "git",
        ["grep", "-n", "--fixed-strings", "-e", needle, ref, "--", pathspec],
        { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const hits = output
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [, file, lineNumber] = line.split(":");
          return `${file}:${lineNumber}`;
        });
      if (hits.length > 0) {
        return [...new Set(hits)].slice(0, 3).map((hit) => `${ref}:${hit}`);
      }
    } catch {
      // Ref missing, not a git checkout, or no match — try the next ref.
    }
  }
  return [];
}

/* ------------------------------------------------------------------ *
 * Runner
 * ------------------------------------------------------------------ */

async function walkFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return walkFiles(fullPath);
      return [fullPath];
    }),
  );
  return files.flat();
}

async function readGroup(projectRoot, roots, extensions, ignore) {
  const paths = (
    await Promise.all(
      roots.map((root) => {
        const dir = path.join(projectRoot, root);
        return fs
          .access(dir)
          .then(() => walkFiles(dir))
          .catch(() => []);
      }),
    )
  ).flat();

  const files = [];
  for (const filePath of paths) {
    // Roots and override keys are authored with `/`; `path.relative` yields
    // `\` on Windows, so normalise before any comparison.
    const relativePath = path
      .relative(projectRoot, filePath)
      .split(path.sep)
      .join("/");
    if (!extensions.has(path.extname(relativePath))) continue;
    if (ignore.some((pattern) => pattern.test(relativePath))) continue;
    files.push({ relativePath, content: await fs.readFile(filePath, "utf8") });
  }
  return files;
}

const KIND_LABEL = {
  spec: "spec",
  style: "theme css",
  runtime: "querySelector",
};

/* ------------------------------------------------------------------ *
 * Anchors
 * ------------------------------------------------------------------ */

/**
 * Tag name owning the JSX attribute at `index`: the nearest element opened
 * before it. Attributes always precede children, so scanning backwards for the
 * last `<Tag` is sound for well-formed JSX.
 */
function owningTag(content, index) {
  let tag = null;
  for (const match of content.slice(0, index).matchAll(/<([A-Za-z][\w.]*)/g)) {
    tag = match[1];
  }
  return tag;
}

/**
 * Coverage answers "does *something* still emit this testid", which is one
 * question short of the contract. Two components can emit the same shape —
 * `channel-${channel.name}` in `SidebarSection` and `channel-${…}` in
 * `SearchResultItem` both compile to `/^channel-.+$/` — so deleting either one
 * leaves every `channel-general` consumer covered by the other and the check
 * stays green. Coverage also says nothing about the *kind* of node: `theme.css`
 * needs the testid on the element carrying the surface class, and
 * `projectsSectionMeta.openAppSearch` does
 * `querySelector<HTMLButtonElement>('[data-testid="open-search"]')?.click()`,
 * which resolves to `null` on a `div[role=button]` and silently stops working.
 *
 * An anchor pins both: this exact emitter, in this file, and optionally on this
 * element. Anchor only the testids whose consumers fail silently — the ones
 * `theme.css` styles and the ones runtime code queries. Spec-only testids
 * already fail loudly in CI and do not need one.
 *
 * @param {Array<{testId: string, file: string, tag?: string, why: string}>} anchors
 * @param {Array<{raw: string, relativePath: string, lineNumber: number}>} emitters
 * @param {Array<{relativePath: string, content: string}>} sourceFiles
 */
export function checkAnchors(anchors, emitters, sourceFiles) {
  const contents = new Map(
    sourceFiles.map((file) => [file.relativePath, file.content]),
  );
  const failures = [];

  for (const anchor of anchors) {
    const matches = emitters.filter(
      (emitter) =>
        emitter.raw === anchor.testId &&
        emitter.relativePath === anchor.file,
    );

    if (matches.length === 0) {
      const elsewhere = emitters
        .filter((emitter) => emitter.raw === anchor.testId)
        .map((emitter) => `${emitter.relativePath}:${emitter.lineNumber}`);
      failures.push({
        anchor,
        detail:
          elsewhere.length > 0
            ? `no longer emitted there; found at ${elsewhere.join(", ")}`
            : "no longer emitted anywhere",
      });
      continue;
    }

    if (!anchor.tag) continue;
    const content = contents.get(anchor.file) ?? "";
    const tags = matches.map((match) => {
      const lineStart = indexOfLine(content, match.lineNumber);
      const attribute = content.indexOf("data-testid", lineStart);
      return owningTag(content, attribute < 0 ? lineStart : attribute);
    });
    if (!tags.includes(anchor.tag)) {
      failures.push({
        anchor,
        detail: `emitted on <${tags.filter(Boolean).join(">, <") || "?"}>, not <${anchor.tag}>`,
      });
    }
  }

  return failures;
}

/**
 * @param {object} options
 * @param {string} options.projectRoot Absolute path the roots resolve against.
 * @param {string[]} options.sourceRoots Directories that emit testids.
 * @param {Set<string>} options.sourceExtensions
 * @param {string[]} options.specRoots Directories holding Playwright specs.
 * @param {Set<string>} options.specExtensions
 * @param {string[]} options.styleRoots Directories holding stylesheets.
 * @param {Set<string>} options.styleExtensions
 * @param {RegExp[]} [options.ignore] Relative paths to skip everywhere.
 * @param {Set<string>} [options.overrides] Deliberately retired testids.
 * @param {Array<object>} [options.anchors] Emitters pinned to a file and element.
 * @param {string} options.label Human label for the failure header.
 * @param {string} options.scriptPath Path mentioned in the failure hint.
 * @param {string} [options.gitPathspec] Pathspec used to locate prior emitters.
 */
export async function runTestIdCheck({
  projectRoot,
  sourceRoots,
  sourceExtensions,
  specRoots,
  specExtensions,
  styleRoots,
  styleExtensions,
  ignore = [],
  overrides = new Set(),
  anchors = [],
  label,
  scriptPath,
  gitPathspec,
}) {
  const [sourceFiles, specFiles, styleFiles] = await Promise.all([
    readGroup(projectRoot, sourceRoots, sourceExtensions, ignore),
    readGroup(projectRoot, specRoots, specExtensions, ignore),
    readGroup(projectRoot, styleRoots, styleExtensions, ignore),
  ]);

  const appEmitters = collectEmitters(sourceFiles);
  const spec = collectSpecConsumers(specFiles);
  const specEmitters = collectSpecEmitters(specFiles);
  const index = buildEmitterIndex([...appEmitters, ...specEmitters.emitters]);

  const consumers = [
    ...spec.consumers,
    ...collectStyleConsumers(styleFiles),
    ...collectRuntimeConsumers(sourceFiles),
  ];

  const { missing, unresolved } = findMissing(consumers, index, {
    overrides,
    downgradedFiles: specEmitters.dynamicInjectionFiles,
  });
  const allUnresolved = [...spec.unresolved, ...unresolved];
  const anchorFailures = checkAnchors(anchors, appEmitters, sourceFiles);

  if (anchorFailures.length > 0) {
    console.error(
      `${label} data-testid contract check failed: ${anchorFailures.length} ` +
        `anchored testid(s) moved off the node their silent consumers need.\n`,
    );
    for (const { anchor, detail } of anchorFailures) {
      console.error(`  "${anchor.testId}" — ${detail}`);
      console.error(
        `      expected in ${anchor.file}${anchor.tag ? ` on <${anchor.tag}>` : ""}`,
      );
      console.error(`      why: ${anchor.why}`);
    }
    console.error(
      `\nAn anchor exists because this testid's consumers fail silently — the ` +
        `theme stylesheet paints through it, or runtime code queries it. ` +
        `Coverage elsewhere does not substitute: re-emit it on the node that ` +
        `replaced the old one, or update the anchor in \`${scriptPath}\` in the ` +
        `same change that moves it deliberately.`,
    );
    process.exit(1);
  }

  if (missing.length === 0) {
    console.log(
      `${label} data-testid contract: ${index.literals.size} literal + ` +
        `${index.patterns.length} dynamic emitters cover ${consumers.length} ` +
        `consumer references (${allUnresolved.length} unresolved, ` +
        `${index.untrustedPatterns.length} patterns too generic to trust), ` +
        `${anchors.length} anchored to a node.`,
    );
    return;
  }

  console.error(
    `${label} data-testid contract check failed: ${missing.length} consumed ` +
      `testid(s) have no emitter left in ${sourceRoots.join(", ")}.\n`,
  );
  for (const entry of missing.sort((a, b) => a.raw.localeCompare(b.raw))) {
    console.error(`  "${entry.raw}"`);
    const byKind = new Map();
    for (const site of entry.sites) {
      const list = byKind.get(site.kind) ?? [];
      list.push(`${site.relativePath}:${site.lineNumber}`);
      byKind.set(site.kind, list);
    }
    for (const [kind, sites] of byKind) {
      const shown = sites.slice(0, 3).join(", ");
      const extra = sites.length > 3 ? ` (+${sites.length - 3} more)` : "";
      console.error(`      consumed by ${KIND_LABEL[kind]}: ${shown}${extra}`);
    }
    const previous = gitPathspec
      ? findPreviousEmitters(entry.raw, {
          cwd: projectRoot,
          pathspec: gitPathspec,
          refs: ["HEAD", "origin/main"],
        })
      : [];
    if (previous.length > 0) {
      console.error(`      previously emitted at: ${previous.join(", ")}`);
    }
  }
  console.error(
    `\nRe-emit the testid on the node that replaced the old one. A testid is a ` +
      `contract with the E2E suite, with the \`[data-testid]\` rules in the theme ` +
      `stylesheet, and with runtime \`querySelector\` calls — and only the first ` +
      `of those three fails loudly. If the retirement is deliberate, drop the ` +
      `consumer in the same change, or add the testid to the \`overrides\` set ` +
      `in \`${scriptPath}\`.`,
  );
  process.exit(1);
}
