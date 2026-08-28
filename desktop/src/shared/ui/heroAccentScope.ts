/**
 * HeroUI paints every selected control — switch track, checkbox fill, focus
 * tint — with `--accent`. This app spends that token on its subtle hover
 * surface instead of on brand, and `ThemeProvider` writes it inline on `<html>`
 * so no stylesheet can reclaim it; see the "Known gap" note at the foot of
 * `shared/styles/globals/heroui.css`.
 *
 * Left alone the consequence is not subtle: `--accent` and `--default` both
 * derive from `elevate(0.06)`, so a checked switch and an unchecked one resolve
 * to the *same* grey and the control stops reading as a control. Re-pointing
 * the brand tokens for the subtree the control owns keeps the states apart
 * without touching the global mapping — and turns into a no-op the day
 * `--accent` carries `--primary` app-wide.
 *
 * `--accent-hover` is derived from `--accent` on `:root`, so descendants
 * inherit it already resolved and it has to be re-pointed too. It lands on
 * `--primary` flat, which is what the Radix controls did before this migration.
 */
export const HERO_ACCENT_SCOPE =
  "[--accent:var(--primary)] [--accent-hover:var(--primary)] [--accent-foreground:var(--primary-foreground)]";
