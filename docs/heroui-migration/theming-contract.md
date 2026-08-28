Contrato de temas — migración a HeroUI Pro
==========================================

`draft` — vinculante para todo trabajo de migración a `@heroui-pro/react`.

Este documento es la **única fuente de verdad** sobre cómo el sistema de temas
de la app y el de HeroUI v3 se reconcilian. Ningún agente debe inventar su
propio mapeo de tokens ni introducir una paleta paralela.

Requisito no negociable: **se preserva el soporte de temas claro y oscuro sin
regresiones visuales.**

---

## 1. El conflicto

Los dos sistemas comparten siete nombres de custom property y los guardan en
formatos mutuamente inválidos. **Ambos leen los tokens crudos**, así que no hay
capa de indirección donde interceptar.

| | Formato | Ejemplo | Consumo |
|---|---|---|---|
| App | triplete HSL pelado | `--background: 220 23.08% 94.9%` | `hsl(var(--background))` |
| HeroUI v3 | color completo oklch | `--background: oklch(0.9702 0 0)` | `var(--background)` |

Tokens en colisión: `--background`, `--foreground`, `--accent`,
`--accent-foreground`, `--border`, `--muted`, `--radius`.

**Más cinco desde la capa Pro, con falla distinta.** `@heroui-pro/react/css`
define `--chart-1..5` en `:root` como una rampa derivada del accent
(`oklch(from var(--accent) calc(l ± 0.12) c h)`). La app también los define
(`theme.css:42-46`, `:108-112`) y los consume en `animations.css:715-727`.

Acá no hay ruptura visible: hay **override silencioso**. Pro se importa después,
gana, y los cinco colores elegidos a mano quedan reemplazados por una rampa
generada. Se ve como "cambiaron los colores del gradiente", no como "está roto".
Remedio: redeclararlos **después** del import de Pro, no convertirlos como los
otros siete.

Falla en las dos direcciones:

- Si gana la app → HeroUI evalúa `var(--accent)` = `266 85.05% 58.04%`, que no
  es un color válido → sus componentes se renderizan sin fondo.
- Si gana HeroUI → la app evalúa `hsl(oklch(...))`, inválido → se cae el
  theming completo.

Hoy no está roto: nadie importa todavía `@heroui/styles`
(`desktop/src/shared/styles/globals.css`). El conflicto aparece con ese import.
Por el orden de capas ganaría la app, así que el síntoma sería "los componentes
de HeroUI se ven rotos" — fácil de diagnosticar mal como bug de la beta.

## 2. La decisión

**Unificar en valores de color completos.** Los tokens de la app pasan de
triplete a color completo, y los 182 usos de `hsl(var(--x))` se desenvuelven.

Se descartó:

- *Puente vía `@theme inline`* — no funciona. El CSS de los componentes de
  HeroUI consume los tokens crudos (`var(--accent)`, `var(--danger)`,
  `var(--default)`), no el namespace `--color-*` de Tailwind.
  Verificado en `node_modules/@heroui/styles/dist/components/button.css`.
- *Scoping a un contenedor* — frágil durante una migración gradual, donde
  componentes de ambos sistemas se intercalan en el mismo árbol.

Beneficio: HeroUI adopta automáticamente la paleta Catppuccin de la app, en
claro y en oscuro, sin escribir un tema paralelo.

## 3. Lo que ya es compatible — no tocar

**El selector de modo oscuro coincide.** HeroUI activa su tema oscuro con
`.dark` (además de `[data-theme="dark"]`), que es exactamente el mecanismo
existente:

```css
/* desktop/src/shared/styles/globals.css */
@custom-variant dark (&:where(.dark, .dark *));
```

El toggle de tema actual maneja HeroUI sin puente alguno. **No introducir
`data-theme`, no tocar el toggle, no agregar un provider de tema.**

**El contrato tipográfico rem/zoom se mantiene intacto.** El zoom escala el
`font-size` del `<html>` (`desktop/src/app/useWebviewZoomShortcuts.ts`); solo
el texto en `rem` acompaña. Los componentes de HeroUI que traigan tamaños en
`px` deben corregirse a tokens rem — ver `desktop/scripts/check-px-text.mjs`,
que falla ante literales arbitrarios tanto px como rem.

## 4. Mapa de tokens semilla

HeroUI define ~60 tokens pero **deriva casi todos** con
`color-mix(in oklab, …)`. Solo hay que mapear las semillas; `*-hover`,
`*-soft`, `background-secondary/tertiary` y `field-*` salen solos.

| Token HeroUI | ← token de la app | Nota |
|---|---|---|
| `--background` | `--background` | mismo rol |
| `--foreground` | `--foreground` | mismo rol |
| `--surface` | `--card` | |
| `--surface-foreground` | `--card-foreground` | |
| `--overlay` | `--popover` | |
| `--overlay-foreground` | `--popover-foreground` | |
| `--muted` | `--muted-foreground` | **⚠ ver trampa 1** |
| `--default` | `--secondary` | botón neutro |
| `--default-foreground` | `--secondary-foreground` | |
| `--accent` | `--primary` | **⚠ ver trampa 2** |
| `--accent-foreground` | `--primary-foreground` | |
| `--danger` | `--destructive` | |
| `--danger-foreground` | `--destructive-foreground` | |
| `--border` | `--border` | mismo rol |
| `--separator` | `--border` | |
| `--focus` | `--ring` | |
| `--field-background` | `--input` | |
| `--success`, `--warning` | *sin equivalente* | derivar de la paleta Catppuccin; no dejar el default de HeroUI |

### Trampa 1 — `--muted` tiene rol invertido

En shadcn (el vocabulario de la app) `--muted` es una **superficie** clara y
`--muted-foreground` es el texto. En HeroUI `--muted` es directamente un
**color de texto** (`oklch(0.5517 0.0138 285.94)`, gris medio).

Mapear `--muted → --muted` deja todo el texto atenuado de HeroUI pintado con
un color de fondo. Va a `--muted-foreground`.

### Trampa 2 — `--accent` no es el accent de shadcn

En HeroUI `--accent` es el **color de marca / acción** (su default es un azul
saturado, `oklch(0.6204 0.195 253.83)`); es lo que pinta los botones primarios,
y además `--focus: var(--accent)`.

En shadcn `--accent` es una superficie gris tenue de hover. Mapearlo literal
deja todos los botones primarios de HeroUI en gris claro. Va a `--primary`
(el mauve de Catppuccin).

## 5. La paleta no es fija: son 61 temas generados en runtime

> **Corrección.** Una versión anterior de este documento presentaba los valores
> de `:root` / `.dark` de `theme.css:2-124` como "la paleta Catppuccin de la
> app". Es falso, y cambia el alcance del trabajo.

Ese bloque es un **fallback estático que se pisa apenas monta React**. Los
valores reales los genera `createThemeVars`
(`desktop/src/shared/theme/adaptive-theme.ts:191`) derivando ~38 tokens a
partir de tres colores de un tema de Shiki. Hay **61 temas**
(`theme-loader.ts:64-127`) y el default de la app es `buzz`, no Catppuccin —
Catppuccin son 4 de los 61.

Derivaciones, para que quede claro que no hay valores que copiar:

- `--muted` = `--accent` = `--secondary` = `elevate(0.06)`
- `--popover` = `elevate(0.08)`
- `--border` = `--input` = `mix(bg, fg, 0.15 oscuro / 0.12 claro)`
- `--sidebar-background` = `calculateChromeColors()`, búsqueda binaria por
  luminancia
- `--muted-foreground` = color de comentario del tema de sintaxis

Consecuencias vinculantes:

1. **El mapa del §4 tiene que dar resultado válido para 61 entradas
   generadas**, no para una paleta elegida a mano. `--success` y `--warning`
   no se pueden hardcodear: hay que derivarlos como el resto, o quedan pegados
   mientras los otros 60 temas cambian.
2. **Validar sobre una muestra, nunca sobre dos temas.** Los que más estresan
   `elevate()` y `calculateChromeColors()`: `buzz`, `buzz-dark`,
   `github-light-high-contrast`, `synthwave-84`, `vitesse-black`.

### `isDark` tampoco es una preferencia

Se deduce de la luminancia del fondo del tema (`adaptive-theme.ts:197`):
`luminance(syntaxBg) < 0.5`. Elegir tema y elegir esquema son la misma acción;
no hay booleano que puentear. Refuerza la decisión del §3.

### Los tokens se escriben inline en `<html>`

`ThemeProvider.tsx:444-447` y `:405-407` hacen `root.style.setProperty(key,
value)`. **Un estilo inline en el root gana contra toda regla de hoja de
estilos**, sin importar capa, orden de import ni especificidad.

Por eso `:root { --accent: … }` de HeroUI **nunca se aplica**, y el patrón de
override que documenta HeroUI es inviable mientras `ThemeProvider` esté
montado. No es una cuestión de orden de capas: es estructural.

### El radio no se resuelve ganando `--radius`

HeroUI deriva su escala: `--radius-sm: calc(var(--radius) * 0.5)` → 5px.
Buzz define `rounded-sm: calc(var(--radius) - 4px)` → 6px
(`tailwind.config.js:61-65`). **La escala derivada difiere aunque `--radius`
coincida.** Hay que decidir explícitamente qué escala de radios gana, o
`rounded-sm/md/xl/2xl/3xl` cambian de geometría en toda la app.

`--radius` sí es de los pocos tokens genuinamente CSS-only e invariante
(`0.625rem` idéntico en claro y oscuro, y `createThemeVars` no lo emite).

## 6. Regla de conversión

**84 tokens** pasan de triplete a color completo; **182 usos** se desenvuelven.

```css
/* antes */
--background: 220 23.08% 94.9%;
/* después */
--background: hsl(220 23.08% 94.9%);
```

```css
/* antes */  background-color: hsl(var(--background));
/* después */ background-color: var(--background);
```

### El formato tiene un único punto de origen

**No hay que perseguir 42 sitios de escritura.** Una sola función produce el
triplete: `hexToHsl` (`adaptive-theme.ts:141-168`), que devuelve `"H S% L%"`.
Cambiarla para que devuelva `hsl(H S% L%)` convierte de una los 33 tokens de
`createThemeVars` (`adaptive-theme.ts:236-288`) y los 9 de `applyAccentColor`
(`ThemeProvider.tsx:198-237`).

**No convertir** (ya son color completo): `--status-added`, `--status-deleted`,
`--status-modified`, `--ui-warning` (hex), `--ui-warning-bg` (`rgba()`), y los
`--buzz-gradient-*` (hex).

### Companions `-hsl` quirúrgicos, no masivos

Dos grupos no tienen salida con color completo:

- **CSS con alfa** (~56 usos, `hsl(var(--x) / 0.8)`).
- **JS que descompone canales**: `ProfileAvatarEditor.utils.ts:633-638`
  (`hslToRgbString`) y `SpoilerParticles.tsx:220-260`.

Para esos, y **solo** para los tokens que lo requieran, se conserva un
companion `--x-hsl` con el triplete. El resto va a color completo a secas. El
conjunto exacto se documenta en el commit que lo introduce.

### Tres cosas que rompen y que ningún comando de verificación detecta

1. **`desktop/index.html:48`** — ``style.backgroundColor = `hsl(${bg})` `` en
   la ruta de pintura previa al bundle. Roto = **flash negro en cada arranque
   en frío**, fuera del alcance de `pnpm check`.
2. **`buzz-theme-cache` en localStorage** guarda el blob en formato viejo. Tras
   la conversión, todo usuario con caché arranca en `hsl(hsl(220 …))` hasta que
   resuelva `applyTheme`. **Versionar la clave en el mismo commit.**
3. **Otros sitios que interpolan `hsl()`**: `ThemePreviewFrame.tsx:48` y `:52`
   (con alfa), `AppearanceSettingsControls.tsx:292`,
   `useThemePreviewVars.ts:110`.

Y dos de los consumidores JS (`ProfileAvatarEditor`, `SpoilerParticles`)
**fallan en silencio**: pintan mal en canvas sin lanzar excepción. Build y
typecheck en verde no prueban nada sobre ellos.

### Sub-temas locales: la herencia tiene que sobrevivir

Cinco contenedores redefinen el vocabulario semántico completo hacia adentro —
`.buzz-huddle-drawer`, `.buzz-huddle-popover` (`components.css:99-153`),
`.buzz-onboarding-neutral-theme`, `.buzz-onboarding-security-theme`
(`components.css:304-369`) y `[data-buzz-content-surface]`
(`theme.css:311-314`).

Todo componente de HeroUI dentro de esos scopes debe heredar del ancestro, no
de `:root`, o el drawer de huddle sale con colores claros sobre superficie
negra. **Con tokens crudos compartidos la cascada lo resuelve sola** — es un
argumento más a favor de la decisión del §2: un puente vía `@theme inline` no
habría heredado.

Ojo también: las reglas del gradiente de Buzz están **deliberadamente fuera de
`@layer`** (`theme.css:222-226`) para ganarle a las utilidades de Tailwind sin
`!important`. No meterlas en una capa.

Distribución de los 182 usos: `tailwind.config.js` 33, `markdown.css` 22,
`DiffViewer.css` 22, `terminal.css` 18, `animations.css` 17, `theme.css` 11,
`composer.css` 11, `components.css` 9, `avatar-framing.css` 9,
`utilities.css` 5, `AppearanceSettingsControls.tsx` 5, `scrollbars.css` 4,
y el resto disperso.

## 7. Orden de trabajo

La conversión del punto 6 es **prerrequisito bloqueante**. Es un cambio
atómico y verificable visualmente; hasta que esté en `main` de la rama de
migración, ningún agente debe importar `@heroui/styles` ni renderizar un
componente de HeroUI, porque va a ver colores rotos y diagnosticar el
problema equivocado.

Validación mínima de esa conversión:

```bash
cd desktop
pnpm typecheck && pnpm check && pnpm build
```

Más comparación visual claro/oscuro antes y después — la conversión es
puramente de formato, así que **cualquier diferencia de píxel es un bug**.
