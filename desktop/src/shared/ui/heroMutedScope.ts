/**
 * HeroUI and this app both own a token called `--muted`, and they mean opposite
 * things.
 *
 * - HeroUI's `--muted` is a *foreground*: `oklch(0.5517 0.0138 285.94)`, a mid
 *   grey for secondary text. Its own theme proves the intent by deriving
 *   `--field-placeholder: var(--muted)`.
 * - This app's `--muted` is a *background*: `hsl(223 15.91% 82.75%)` in light,
 *   `hsl(220 6% 16%)` in dark. Its secondary-text token is a separate
 *   `--muted-foreground`.
 *
 * `heroui.css` maps every seed the app has an equivalent for, but `--muted`
 * looks already-owned under the same name, so it is left alone — and
 * `@heroui/styles`' `@theme inline` then binds `--color-muted: var(--muted)`.
 * The result is that every HeroUI rule written as `@apply text-muted` compiles
 * to `color: var(--muted)` and paints secondary text with the app's *surface*
 * grey: 82.75% lightness on a near-white background in light, 16% on a near
 * black one in dark. It fails in both themes, which is why no theme toggle
 * catches it.
 *
 * Unlike the `--accent` gap in `heroAccentScope.ts`, `ThemeProvider` does not
 * write `--muted` inline on `<html>`, so a stylesheet could reclaim it. It must
 * not: the app spends `bg-muted` on ~470 call sites that all depend on the
 * surface meaning, and repointing the token globally would repaint every one of
 * them with a text grey.
 *
 * So the fix is scoped, like the accent one — re-point `--muted` for the
 * subtree a HeroUI component owns, and leave the global mapping alone.
 *
 * **Caveat for callers:** inside this scope `bg-muted` also flips to the
 * foreground grey. Style surfaces within the scope with `bg-secondary` or an
 * explicit colour, not `bg-muted`.
 *
 * 51 of the 67 Pro component stylesheets reference the token, so this applies
 * well beyond the component that first needed it.
 */
export const HERO_MUTED_SCOPE = "[--muted:var(--muted-foreground)]";
