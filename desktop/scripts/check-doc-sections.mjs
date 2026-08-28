import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDocSectionCheck } from "../../scripts/check-doc-sections-core.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");

// Production code cites the HeroUI migration map by section to explain why a
// wrapper is shaped the way it is — `§6ter` for the overlays that stay on
// Radix, `§6septies` for the chat components that were evaluated and rejected.
//
// Those citations are the one kind of documentation pointer that fails
// silently *and* convincingly. A renumbered section does not dangle: it lands
// on a different section that still exists, and the reader gets prose that is
// internally coherent and about something else. It happened four times during
// this migration, the last time because a verification was correct when it ran
// and went stale when two branches carrying old-numbering citations landed
// afterwards.
// Existence alone would not have caught the incident. `6quinquies` was the
// chat evaluation, got renumbered to `6septies`, and another lot took the old
// number — so the stale citations kept resolving, to a section about something
// else. Anchoring each cited number to a phrase from its title is what closes
// that. Anchor a section when code cites it; the list stays short by design.
const anchors = [
  {
    section: "6ter",
    titleIncludes: "Los overlays se quedan en Radix",
    why: "popover.tsx, dialog.tsx, sheet.tsx, alert-dialog.tsx, useHoverPopover.ts, popoverFocusContract.test.mjs",
  },
  {
    section: "6septies",
    titleIncludes: "Los componentes de chat de Pro",
    why: "useHoverPopover.ts, emojiReactionButtonHeroUiGap.test.mjs",
  },
  {
    section: "6quinquies",
    titleIncludes: "El shell no adopta Pro",
    why: "AppTopChrome.tsx",
  },
  {
    section: "4",
    titleIncludes: "Los dos cambios de API",
    why: "sidebar.tsx (the `asChild` inventory)",
  },
  {
    section: "7",
    titleIncludes: "Reglas duras",
    why: "tooltip.tsx cites §7.2, an item in this section's list",
  },
];

await runDocSectionCheck({
  projectRoot,
  docPath: "docs/heroui-migration/component-map.md",
  sourceRoots: ["desktop/src"],
  sourceExtensions: new Set([".ts", ".tsx", ".mjs", ".css"]),
  label: "Desktop",
  scriptPath: "desktop/scripts/check-doc-sections.mjs",
  anchors,
});
