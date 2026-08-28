/**
 * The ABY wordmark, drawn as the product mark inside the app (loading gates,
 * onboarding, repository cards, runtime icon). It replaces the bee `BuzzMark`
 * so the in-app logo matches the app icon and favicon.
 *
 * Rendered as SVG text in the app's own typeface rather than traced outlines:
 * the mark is a plain wordmark, so type keeps it identical to the icon at every
 * size, and it stays a two-line change if the wording shifts again. It paints
 * in `currentColor` like the mark it replaces.
 *
 * The viewBox deliberately matches `BuzzMark`'s 466x309 so every existing call
 * site keeps reserving exactly the same box — the callers set width/height in
 * Tailwind and several of them pin both axes.
 */
export function AbyMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={["aby-mark", className].filter(Boolean).join(" ")}
      fill="currentColor"
      viewBox="0 0 466 309"
    >
      <text
        dominantBaseline="middle"
        fontFamily='"Inter Variable", Inter, "Avenir Next", "Segoe UI", sans-serif'
        fontSize="196"
        fontWeight="700"
        letterSpacing="-8"
        textAnchor="middle"
        x="233"
        y="164"
      >
        ABY
      </text>
    </svg>
  );
}
