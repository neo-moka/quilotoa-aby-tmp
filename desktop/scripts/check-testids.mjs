import path from "node:path";
import { fileURLToPath } from "node:url";
import { runTestIdCheck } from "../../scripts/check-testids-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

// `data-testid` is a three-way contract in this app, and only one of the three
// consumers fails loudly when it breaks:
//
//   - Playwright specs (`tests/**`) drive the UI through `getByTestId`, but
//     Playwright runs in CI only — not in `just ci`, not in `just check`.
//   - `src/shared/styles/globals/theme.css` paints app surfaces through
//     `[data-testid="…"]` selectors. A dropped testid degrades to unthemed
//     chrome that still renders, so nothing errors and no test fails.
//   - Production code resolves focus targets and scroll anchors with
//     `querySelector('[data-testid="…"]')`. A dropped testid there breaks
//     user-visible behaviour, silently.
//
// Swapping a hand-rolled component for a library one (the HeroUI migration) is
// exactly the change that drops a testid without touching whatever needed it.
// This guard fails the moment a consumed testid has no emitter left.

// Unit tests (`src/**/*.test.mjs`) both emit and consume testids in the same
// file, and they run in `pnpm test` on every pre-push — they already fail
// loudly on their own, so they are excluded from both sides of the comparison
// rather than being modelled as an extra consumer.
const ignore = [/\.test\.mjs$/, /\.test\.tsx?$/];

// Deliberately retired testids, keyed by **the testid itself**.
//
// The sibling guards disagree on this: `check-px-text` keys exceptions by
// `path:literal` and `check-pubkey-truncation` by `path:line`. Neither fits
// here, and `path:line` is the fragile one — any edit above the line silently
// moves the exception onto an unrelated statement. A single testid is
// referenced from dozens of spec lines across many files, so a positional key
// would need dozens of entries and would rot on the first refactor. The testid
// string *is* the contract identity: it survives file moves, line drift, and
// component renames, and one entry retires it everywhere at once.
//
// Add an entry only when a testid is being retired on purpose and its
// consumers are being removed in a follow-up. Prefer deleting the consumer in
// the same change.
const overrides = new Set([]);

await runTestIdCheck({
  projectRoot,
  sourceRoots: ["src"],
  sourceExtensions: new Set([".ts", ".tsx"]),
  specRoots: ["tests"],
  specExtensions: new Set([".ts", ".mjs"]),
  styleRoots: ["src"],
  styleExtensions: new Set([".css"]),
  ignore,
  overrides,
  label: "Desktop",
  scriptPath: "desktop/scripts/check-testids.mjs",
  // Pathspec is resolved from `projectRoot`, which is where git runs.
  gitPathspec: "src",
});
