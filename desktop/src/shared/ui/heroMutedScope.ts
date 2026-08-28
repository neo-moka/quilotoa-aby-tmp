/**
 * HeroUI reads `--muted` as a **text** colour — its "muted foreground", a mid
 * grey (`oklch(0.5517 …)` light, `oklch(70.5% …)` dark). This app spends the
 * same name on a **surface**: `theme.css` declares it unlayered, `bg-muted`
 * consumes it across 226 files, and the text colour lives next door in
 * `--muted-foreground`. That is the role inversion `theming-contract.md` §4
 * calls Trampa 1, and `heroui.css` never applied it.
 *
 * Left alone the consequence is total, not cosmetic: Pro's CSS reads raw
 * `var(--muted)` 286 times, and in a component like `chain-of-thought` it lands
 * on the collapsed trigger label — the one thing visible when the row is shut.
 * It would render at 82.75% lightness on a near-white background in light mode
 * and at 16% on a near-black one in dark. Invisible in both themes, and no gate
 * catches it: tsc, biome and the build are all indifferent to a colour.
 *
 * The global mapping (`--muted: var(--muted-foreground)` in `heroui.css`) is
 * *not* the fix — it is Trampa 1 in mirror. It would repaint all 226 `bg-muted`
 * surfaces with a text grey, which is a worse bug than the one it closes. So
 * the token gets re-pointed per subtree instead, exactly like
 * [`HERO_ACCENT_SCOPE`](./heroAccentScope.ts) and for the same reason: the name
 * is spent on something else and cannot be reclaimed app-wide.
 *
 * Two mechanics worth knowing before you use it.
 *
 * **Derived tokens stay put, and that is what we want here.** `heroui.css`
 * derives `--surface-secondary` and `--segment` from `--muted` on `:root`, so
 * they resolve there and descendants inherit them already computed. Re-pointing
 * `--muted` further down does not reach back into them, and those two keep the
 * surface value they should have. This is the opposite of `--accent-hover`,
 * which had to be re-pointed by hand in the accent scope — same inheritance
 * rule, opposite thing wanted from it.
 *
 * **Put it on the leaves that read the token, not on the component root.**
 * This is the trap, and a component root is usually already too broad: every
 * consumer in the subtree follows the re-point, including *app* markup composed
 * into a Pro component. Scoping `EmptyState`'s root, for instance, is enough to
 * catch an app outline button rendered as its action — its `hover:bg-muted/70`
 * then hovers to the text grey, reintroducing the inversion one level down.
 * That is a real failure this codebase already hit, not a hypothetical. Slot
 * the class onto the Pro elements that actually resolve `--muted` and no
 * higher; a component whose children are all Pro's own is the only case where
 * the root is the right node.
 *
 * **Count only bare `var(--muted)` when deciding whether a component needs
 * this.** A usage written as `var(--<token>, var(--muted))` falls through only
 * when `<token>` is unmapped, so a component reading it exclusively that way
 * needs no scope. That is not academic: across the Pro component CSS 282 uses
 * are bare and 4 sit behind `var(--field-placeholder, …)`, which `heroui.css`
 * maps — which is the whole reason `native-select` needs no scope despite a raw
 * grep reporting two hits.
 *
 * `--muted-foreground` is the right target for all four ways Pro reads the
 * token — `color` (210), `background-color` (32), `fill` (18) and `stroke` (18)
 * — because the background uses are `color-mix` tints and indicator dots
 * derived from the text colour, never surfaces.
 */
export const HERO_MUTED_SCOPE = "[--muted:var(--muted-foreground)]";
