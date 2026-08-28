import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Shared "every cited doc section still exists" guard.
 *
 * Code comments cite the migration map by section — `§6ter`, `§6septies` — to
 * explain why something is written the way it is. Those pointers rot silently
 * in a way no other check sees: renumbering a section, or landing a branch that
 * was written against the old numbering, leaves the citation resolving to a
 * *different* section that still exists. The reader follows it, finds prose
 * that is internally coherent, and never suspects they are in the wrong place.
 *
 * That has now happened four times in one migration, most recently because a
 * verification was correct when it ran and went stale on the next merge: the
 * two files carrying the stale pointers did not exist in the base yet.
 *
 * The check is deliberately two-sided. A dangling citation is an error. A
 * section nobody cites is reported but not fatal — most sections are meant to
 * be read, not linked, so it is a hint that a rename orphaned something, not a
 * rule.
 */

/** `## 6ter. Title` / `### 4. Title` → the id `6ter` / `4`. */
const HEADING_RE = /^#{2,4}\s+(\d+[a-z]*)\.\s/gm;
/**
 * `§6ter`, `§ 6ter`, `§7.2`. The dotted tail is kept so it survives into the
 * report, but only the leading segment is resolved against a heading: `§7.2`
 * means item 2 of the numbered list under `## 7.`, not a `## 7.2` of its own.
 */
const CITATION_RE = /§\s?(\d+[a-z]*(?:\.\d+)*)/g;
/** Any markdown file named inline, e.g. `component-map.md` or `a/b/c.md`. */
const DOC_MENTION_RE = /([\w.-]+\.md)/g;

async function walkFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
    }),
  );
  return files.flat();
}

const toPosix = (value) => value.split(path.sep).join("/");

/** Section ids declared by headings, their titles, and any declared twice. */
export function parseSections(markdown) {
  const titles = new Map();
  for (const line of markdown.split("\n")) {
    HEADING_RE.lastIndex = 0;
    const match = HEADING_RE.exec(line);
    if (!match) continue;
    const id = match[1];
    const title = line.slice(match[0].length).trim();
    titles.set(id, [...(titles.get(id) ?? []), title]);
  }
  return {
    ids: new Set(titles.keys()),
    titles,
    duplicated: [...titles.entries()]
      .filter(([, list]) => list.length > 1)
      .map(([id]) => id)
      .sort(),
  };
}

/**
 * Verifies that a section number still names the section it is expected to.
 *
 * Existence alone is one question short, the same way testid coverage was: the
 * renumbering that prompted this guard moved one section from `6quinquies` to
 * `6septies` **and gave `6quinquies` to another lot**, so every stale citation
 * kept resolving — to prose that reads as coherent and is about something else.
 * An existence check passes that cleanly. Anchoring the number to a phrase from
 * its title is what actually catches it.
 *
 * Anchor a section only when code cites it; the list is meant to stay short.
 */
export function checkAnchors(titles, anchors) {
  const failures = [];
  for (const anchor of anchors) {
    const found = titles.get(anchor.section) ?? [];
    if (found.length === 0) {
      failures.push({ ...anchor, reason: "the section no longer exists" });
      continue;
    }
    if (!found.some((title) => title.includes(anchor.titleIncludes))) {
      failures.push({
        ...anchor,
        reason: `it is now titled ${found.map((title) => `"${title}"`).join(" / ")}`,
      });
    }
  }
  return failures;
}

/**
 * Every `§id` citation in `content`, with the doc it names.
 *
 * Attribution is by the markdown filename on the same line, because `§4` is
 * not a global address: `component-map.md §4` is the `asChild` inventory,
 * `theming-contract.md §4` is the token role inversion, and
 * `welcome-kickoff-silent-failures.md §1` is neither. Resolving all of them
 * against one doc would report agreement that does not exist — and the two
 * cross-doc citations in this repo happen to hit numbers the map also uses, so
 * the check would have passed while proving nothing.
 *
 * A citation on a line that names no doc is returned with `doc: null` and
 * counted, not resolved. Silence there would be the same false confidence in a
 * quieter form.
 */
export function parseCitations(content) {
  const citations = [];
  content.split("\n").forEach((line, index) => {
    const docs = [...line.matchAll(DOC_MENTION_RE)].map((match) => match[1]);
    for (const match of line.matchAll(CITATION_RE)) {
      citations.push({
        id: match[1],
        // `§7.2` addresses item 2 of the list under `## 7.`, not a heading of
        // its own, so only the leading segment resolves.
        headingId: match[1].split(".")[0],
        doc: docs.length === 1 ? docs[0] : (docs[0] ?? null),
        line: index + 1,
        text: line.trim(),
      });
    }
  });
  return citations;
}

/**
 * @param {object} options
 * @param {string} options.projectRoot Absolute path the roots resolve against.
 * @param {string} options.docPath Doc holding the sections, relative to `projectRoot`.
 * @param {string[]} options.sourceRoots Directories to scan for citations.
 * @param {Set<string>} options.sourceExtensions Extensions to scan.
 * @param {string} options.label Human label for the output.
 * @param {string} options.scriptPath Path mentioned in the failure hint.
 */
export async function runDocSectionCheck({
  projectRoot,
  docPath,
  sourceRoots,
  sourceExtensions,
  label,
  scriptPath,
  anchors = [],
}) {
  const absoluteDoc = path.resolve(projectRoot, docPath);
  const markdown = await fs.readFile(absoluteDoc, "utf8").catch(() => null);
  if (markdown === null) {
    console.error(
      `${label}: cannot read ${docPath}. If the doc moved, update ${scriptPath}.`,
    );
    process.exit(1);
  }

  const { ids, titles, duplicated } = parseSections(markdown);

  const anchorFailures = checkAnchors(titles, anchors);
  if (anchorFailures.length > 0) {
    console.error(
      `${label}: ${anchorFailures.length} section number(s) no longer name the section the code cites.\n` +
        `This is the failure existence checking cannot see — the citation still resolves, ` +
        `just to different prose.\n`,
    );
    for (const failure of anchorFailures) {
      console.error(
        `  §${failure.section} should be "${failure.titleIncludes}" — ${failure.reason}`,
      );
      console.error(`    cited by: ${failure.why}`);
    }
    console.error(
      `\nRepoint the citations in code, then update the anchor in ${scriptPath}.`,
    );
    process.exit(1);
  }

  const files = (
    await Promise.all(
      sourceRoots.map((root) => {
        const dir = path.join(projectRoot, root);
        return fs
          .access(dir)
          .then(() => walkFiles(dir))
          .catch(() => []);
      }),
    )
  ).flat();

  const docName = path.basename(docPath);
  const dangling = [];
  const citedIds = new Set();
  const unattributed = [];

  for (const filePath of files) {
    if (!sourceExtensions.has(path.extname(filePath))) continue;
    const content = await fs.readFile(filePath, "utf8");
    if (!content.includes("§")) continue;

    const relativePath = toPosix(path.relative(projectRoot, filePath));
    for (const citation of parseCitations(content)) {
      if (citation.doc === null) {
        unattributed.push({ ...citation, file: relativePath });
        continue;
      }
      // Citations of some other document are none of this check's business.
      if (citation.doc !== docName) continue;

      citedIds.add(citation.headingId);
      if (!ids.has(citation.headingId)) {
        dangling.push({ ...citation, file: relativePath });
      }
    }
  }

  if (dangling.length > 0) {
    console.error(
      `${label}: ${dangling.length} citation(s) point at a section that does not exist in ${docPath}.\n` +
        `A renumbered section does not break the build — the pointer just lands on different prose, ` +
        `which reads as coherent and sends the reader somewhere else entirely.\n`,
    );
    for (const item of dangling) {
      console.error(`  ${item.file}:${item.line}: §${item.id} — ${item.text}`);
    }
    console.error(`\nSections that do exist: ${[...ids].sort().join(", ")}`);
    process.exit(1);
  }

  // Informational from here down: never fatal.
  const uncited = [...ids].filter((id) => !citedIds.has(id)).sort();
  console.log(
    `${label} doc-section contract: ${citedIds.size} section(s) of ${docName} ` +
      `cited from ${sourceRoots.join(", ")}, all resolving` +
      (uncited.length > 0
        ? `; ${uncited.length} section(s) cited by nobody`
        : ""),
  );

  if (duplicated.length > 0) {
    console.log(
      `  note: ${docName} declares ${duplicated.map((id) => `§${id}`).join(", ")} ` +
        `more than once, so citations to those are ambiguous.`,
    );
  }
  if (unattributed.length > 0) {
    console.log(
      `  note: ${unattributed.length} citation(s) name no .md on their line, so ` +
        `they cannot be resolved against any document:`,
    );
    for (const item of unattributed) {
      console.log(`    ${item.file}:${item.line}: §${item.id}`);
    }
  }

  // The anchor list is curated, so adding a citation without adding its anchor
  // is a manual step that would otherwise be invisible — and an unanchored
  // citation is covered only by existence, which is the weaker half of this
  // check. Naming them keeps that gap visible without making it a rule.
  const anchored = new Set(anchors.map((anchor) => anchor.section));
  const unanchored = [...citedIds].filter((id) => !anchored.has(id)).sort();
  if (unanchored.length > 0) {
    console.log(
      `  note: ${unanchored.length} cited section(s) have no anchor, so only ` +
        `their existence is checked, not that the number still names them: ` +
        `${unanchored.map((id) => `§${id}`).join(", ")}`,
    );
  }
}
