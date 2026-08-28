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

## 5. Valores de la paleta

Catppuccin Latte (claro) / Macchiato (oscuro), tal como están hoy en
`desktop/src/shared/styles/globals/theme.css`.

| Token de la app | Claro (`:root`) | Oscuro (`.dark`) |
|---|---|---|
| `--background` | `220 23.08% 94.9%` | `232 23.4% 18.43%` |
| `--foreground` | `234 16.02% 35.49%` | `227 68.25% 87.65%` |
| `--card` | `220 23.08% 94.9%` | `232 23.4% 18.43%` |
| `--popover` | `220 23.08% 94.9%` | `232 23.4% 18.43%` |
| `--primary` | `266 85.05% 58.04%` | `267 82.69% 79.61%` |
| `--primary-foreground` | `220 23.08% 94.9%` | `232 23.4% 18.43%` |
| `--secondary` | `223 15.91% 82.75%` | `230 18.8% 26.08%` |
| `--muted-foreground` | `233 12.8% 41.37%` | `228 39.22% 80%` |
| `--destructive` | `347 86.67% 44.12%` | `351 73.91% 72.94%` |
| `--border` / `--input` | `225 13.56% 76.86%` | `231 15.61% 33.92%` |
| `--ring` | `234 16.02% 35.49%` | `227 68.25% 87.65%` |
| `--radius` | `0.625rem` | *(igual)* |

`--radius` también colisiona: HeroUI usa `0.5rem`. **Gana el valor de la app**
(`0.625rem`) — es una decisión de diseño existente, y HeroUI deriva
`--field-radius: calc(var(--radius) * 1.5)` a partir de él.

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

### Los 56 usos con alfa son el punto delicado

`hsl(var(--border) / 0.8)` deja de ser válido cuando `--border` ya es un color
completo. Reemplazo, en orden de preferencia:

```css
/* preferido — sintaxis de color relativo */
hsl(from var(--border) h s l / 0.8)

/* alternativa */
color-mix(in srgb, var(--border) 80%, transparent)
```

La app corre en el webview de Tauri (Chromium), así que ambas están
disponibles; el soporte de navegadores no es un factor.

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
