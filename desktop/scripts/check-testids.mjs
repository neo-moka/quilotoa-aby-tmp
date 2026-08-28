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

// Testids whose emitter is pinned to a file, and sometimes to an element.
//
// Coverage alone answers "does *something* still emit this", which is one
// question short. Two components can emit the same shape:
// `channel-${channel.name}` in `SidebarSection` and `channel-${…}` in
// `SearchResultItem` both compile to `/^channel-.+$/`, so deleting either one
// leaves every `channel-general` consumer covered by the other — verified, the
// check stayed green through that exact deletion before anchors existed.
//
// The list is deliberately short. Anchor a testid only when its consumers fail
// *silently*: the 13 that `theme.css` paints through, and the ones runtime code
// resolves with `querySelector`. Spec-only testids already fail loudly in CI.
//
// Not anchored on purpose: `projects-section-${filter}`
// (`ProjectsToolbar.tsx:115`) and `message-input` (`VideoPlayer.tsx:1572`) are
// runtime consumers too, but they belong to other surfaces being migrated in
// parallel. Anchoring them would freeze another lot's markup mid-flight. Add
// them once those lots land.
const anchors = [
  // The 15 `app-sidebar` rules in `theme.css` hang off this one node, and it is
  // the container selector for 36 of the 67 testid rules in the file.
  {
    testId: "app-sidebar",
    file: "src/features/sidebar/ui/AppSidebar.tsx",
    why: "container for 36 of the 67 [data-testid] rules in theme.css",
  },
  {
    testId: "settings-sidebar",
    file: "src/features/settings/ui/SettingsView.tsx",
    why: "container for 10 theme.css rules (active pill, hover, group labels)",
  },
  {
    testId: "sidebar-pinned-header",
    file: "src/features/sidebar/ui/AppSidebarPinnedHeader.tsx",
    why: "theme.css clears its background and ::before for the shell gradient",
  },
  // The one testid with a *functional* consumer, not just a visual one.
  {
    testId: "open-search",
    file: "src/features/search/ui/TopbarSearch.tsx",
    tag: "button",
    why: "projectsSectionMeta.openAppSearch does querySelector<HTMLButtonElement>(…)?.click(); on a div[role=button] the cast resolves to null and the Projects search entry point silently stops working",
  },
  // Per-row-type foreground: channels, DMs and nav rows each read a different
  // `--buzz-*-fg` through these three list containers.
  {
    testId: "stream-list",
    file: "src/features/sidebar/ui/AppSidebar.tsx",
    why: "theme.css scopes --buzz-channel-fg to rows inside it",
  },
  {
    testId: "starred-list",
    file: "src/features/sidebar/ui/AppSidebar.tsx",
    why: "theme.css scopes --buzz-channel-fg to rows inside it",
  },
  {
    testId: "dm-list",
    file: "src/features/sidebar/ui/AppSidebar.tsx",
    why: "theme.css scopes --buzz-dm-fg to rows inside it",
  },
  {
    testId: "sidebar-primary-menu",
    file: "src/features/sidebar/ui/AppSidebarPinnedHeader.tsx",
    why: "theme.css scopes --buzz-nav-fg to the Inbox/Pulse/Projects/Agents rows",
  },
  {
    testId: "sidebar-profile-card",
    file: "src/features/sidebar/ui/SidebarProfileCard.tsx",
    why: "theme.css gives it the inactive-row hover tint",
  },
  {
    testId: "community-rail",
    file: "src/features/sidebar/ui/CommunityRail.tsx",
    why: "theme.css makes it transparent so the shell gradient shows through",
  },
  {
    testId: "app-top-chrome",
    file: "src/app/AppTopChrome.tsx",
    why: "theme.css colours the sidebar trigger and history buttons through it",
  },
  {
    testId: "global-back",
    file: "src/app/AppTopChrome.tsx",
    why: "theme.css gives it --buzz-chrome-foreground",
  },
  {
    testId: "global-forward",
    file: "src/app/AppTopChrome.tsx",
    why: "theme.css gives it --buzz-chrome-foreground",
  },
  // Dynamic emitter. Not styled by theme.css, anchored because it is the
  // repo's densest testid family by spec traffic (`channel-general`,
  // `channel-random`) and no grep of string literals finds it.
  {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: the anchor key is the emitter's source text, `${…}` included — it is matched literally, not interpolated.
    testId: "channel-${channel.name}",
    file: "src/features/sidebar/ui/SidebarSection.tsx",
    why: "sole emitter of the channel-<name> family; SearchResultItem emits the same shape and would mask its loss",
  },
];

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
  anchors,
  label: "Desktop",
  scriptPath: "desktop/scripts/check-testids.mjs",
  // Pathspec is resolved from `projectRoot`, which is where git runs.
  gitPathspec: "src",
});
