Actualizaciones de specs que exige la migración
==============================================

`aplicado` — rama `heroui-spec-updates`. **La suite E2E no se corrió.**

Cada entrada era una aserción que iba a fallar por un cambio de contrato de DOM
ya mergeado. Este documento ya no es una lista de trabajo pendiente: registra
qué se cambió, qué se dejó como estaba y por qué, para el que finalmente corra
la suite.

Recordá que **ni `just ci` ni `just check` corren Playwright**. Estas fallas
solo aparecen en CI, en 6 shards, o corriendo `pnpm test:e2e:smoke` a mano.

### Estado

| Grupo | Inventariadas | Aplicadas | Sin aplicar |
|---|---|---|---|
| A — `toBeChecked()` sobre el testid | 28 | 27 | 1 *(no rompía)* |
| B — atributo de estado | 3 | 3 | — |
| C — `.click()` sobre `getByRole("switch")` | 5 | 5 *(sin verificar)* | — |
| D — riesgo a vigilar | — | — | no es un cambio |
| E — hallazgo fuera del inventario | 3 | 3 | — |

---

## Cómo verificar esto sin Playwright

Renderizar el control y mirar el HTML. Es lo más barato que hay y contesta casi
todas las preguntas de esta página en un segundo:

```bash
cd desktop && node --input-type=module -e '
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Switch } from "@heroui/react";
console.log(renderToStaticMarkup(React.createElement(Switch.Root,
  { "aria-label": "x", "data-testid": "t", isSelected: true },
  React.createElement(Switch.Content, null,
    React.createElement(Switch.Control, null)))));
'
```

Salida (reformateada), que es el contrato entero de un vistazo:

```html
<div data-slot="switch" data-testid="t" data-selected="true">
  <label data-slot="switch-content" data-selected="true">
    <span style="clip-path:inset(50%);height:1px;width:1px;position:absolute">
      <input aria-label="x" type="checkbox" role="switch" checked>
    </span>
    <span data-slot="switch-control"><span data-slot="switch-thumb"></span></span>
  </label>
</div>
```

---

## Lote C — controles de formulario

### El cambio de contrato

La anatomía de `Switch` y `Checkbox` en HeroUI es un `div` (el *field*) que
envuelve un `label` que contiene un `input` visualmente oculto:

| | Antes (Radix) | Después (HeroUI) |
|---|---|---|
| Nodo con `data-testid` | `<button role="switch">` | `<div data-slot="switch">` |
| Estado | `data-state="checked"\|"unchecked"` | `data-selected="true"` *(ausente si no)* |
| Nodo con `role` | el mismo botón | el `input` oculto |
| Nodo con `aria-label` | el mismo botón | **el `input` oculto** |
| Deshabilitado | `disabled` en el botón | `data-disabled="true"` en el field, `disabled` en el input |

`Toggle` es la excepción: sigue siendo `<button>`, conserva `aria-pressed`, y
solo cambia `data-state="on"` por `data-selected="true"`.

`Input` y `Textarea` **no cambian de nodo**: el testid sigue en el `<input>` /
`<textarea>` real.

Los cinco puntos anteriores están fijados por
`desktop/src/shared/ui/heroControls.test.mjs`, que corre en `pnpm test`. Si
alguno deja de valer, ese test falla antes que la suite E2E.

> Las dos filas nuevas de la tabla (`aria-label`, deshabilitado) no estaban en
> el inventario original y **cambian dos conclusiones**: la de A-2030 y la de
> `toBeEnabled()`. Ver abajo.

### A — 28 `toBeChecked()` sobre el testid de un Switch/Checkbox — 27 aplicadas

El nodo es ahora un `<div>`; Playwright falla con *"Not a checkbox or radio
button"*, tanto en la forma afirmativa como en la negada.

```
toBeChecked()      →  toHaveAttribute("data-selected", "true")
not.toBeChecked()  →  not.toHaveAttribute("data-selected", "true")
```

| Spec | Líneas | Testid | Estado |
|---|---|---|---|
| `agents.spec.ts` | 109, 111, 1546, 1548, 1638, 1640 | `persona-share-catalog-access` | aplicado |
| `agents.spec.ts` | 2030 | — | **no aplicado, ver abajo** |
| `buzz-theme-screenshots.spec.ts` | 553, 1249, 1266 | `prominent-active-tab-toggle` | aplicado |
| `buzz-theme-screenshots.spec.ts` | 1553, 1570 | `glass-background-toggle` | aplicado |
| `huddle-transcription.spec.ts` | 824, 834 | `huddle-agent-tts-toggle` | aplicado |
| `local-archive-screenshots.spec.ts` | 74 | `local-archive-observer-toggle` | aplicado |
| `mesh-compute.spec.ts` | 52, 75, 125, 136 | `mesh-share-compute-toggle` | aplicado |
| `observer-archive-policy.spec.ts` | 37, 54, 58, 62, 90, 108, 112, 116 | `local-archive-observer-toggle` | aplicado |
| `signout-confirmation.spec.ts` | 94 | `signout-backup-confirm` | aplicado |

Los 7 testids fueron confirmados en `src/` como `Switch`/`Checkbox` de
`@/shared/ui`, no solo por el nombre.

> **`agents.spec.ts:2030` no se tocó — el inventario se equivocaba.** Ese
> `catalogAccess` no es el mismo de las líneas 1546-1640: se define en la 2018
> como `shareDialog.getByLabel("Share to catalog")`, no por testid. HeroUI
> manda el `aria-label` **al input oculto y no al field**, así que ese locator
> resuelve a un checkbox nativo y `toBeChecked()` sigue siendo correcto.
> Cambiarlo lo habría roto.

### B — 3 aserciones de atributo de estado — 3 aplicadas

Mismo reemplazo que A. Para el estado apagado, la negación:
`not.toHaveAttribute("data-selected", "true")` — el atributo no existe cuando
no está seleccionado, no vale `"false"`.

| Spec:línea | Aserción anterior |
|---|---|
| `profile.spec.ts:1687` | `toHaveAttribute("data-state", "checked")` |
| `profile.spec.ts:1690` | `toHaveAttribute("data-state", "unchecked")` |
| `voice-settings.spec.ts:42` | `toHaveAttribute("aria-checked", "false")` |

> **No se tocaron** `profile.spec.ts:1686` y `:1689`. Confirmado en
> `UserProfilePanelTabs.tsx:815-835`: `user-profile-start-on-launch` es un
> `<div role="switch" aria-checked>` propio de la app — la fila entera, con su
> `onClick` — y el `Switch` de HeroUI que tiene al lado es un
> `aria-hidden` decorativo con su propio testid (`…-toggle`, ese sí en B).
> `toBeChecked()` lee el `aria-checked` de la fila y sigue válido.

### C — 5 `.click()` sobre `getByRole("switch")` — aplicadas, **sin verificar**

**El razonamiento no está comprobado.** El `input` vive dentro del
`VisuallyHidden` de React Aria (`clip-path: inset(50%)`, 1×1px), y el clip
debería sacarlo del hit-testing, con lo cual el chequeo de *receives pointer
events* de Playwright nunca se satisface y el `.click()` timeoutea. Eso es
plausible pero **no se observó**: la suite no se corrió. Puede que estos cinco
sitios anduvieran sin tocarlos.

En cualquier caso los locators nuevos son correctos — apuntan al field, que es
lo que un usuario clickea. Si la premisa era falsa, el cambio es innecesario,
no incorrecto.

| Spec | Línea original | Cómo quedó |
|---|---|---|
| `channels.spec.ts` | 3424 | `getByTestId("inbox-unread-only-toggle")` |
| `workflows.spec.ts` | 377, 382, 440, 480 | helper `workflowSwitchField` |

`channels.spec.ts` salió gratis: el `Switch` de `InboxListPane` **ya tenía**
testid (`inbox-unread-only-toggle`) y está sobre el field. El del
`WorkflowCard` sigue sin testid, así que `workflowSwitchField` scopea
`[data-slot="switch"]` filtrando por el `role`+nombre de adentro; se resuelve
por nombre accesible y no por atributo, igual que las aserciones vecinas.

Los `getByRole("switch", …)` que solo asertan **no se tocaron** y siguen
válidos — resuelven al input, que es un checkbox nativo:
`workflows.spec.ts:379, 397, 402, 413, 511` ·
`workflow-local-controls.spec.ts:102, 144, 859`.

### D — riesgos a vigilar (no son cambios)

Ninguno de estos se tocó. Si aparecen fallas raras, empezá por acá.

1. **`profile.spec.ts:96-120`** (`readVisibleProfileSurface`) enumera
   `[role="switch"]` filtrando por `rect.width > 0 && rect.height > 0`. El
   input oculto mide 1×1, así que **pasa** ese filtro y entra a
   `visibleControls` con `testId: null` — el testid quedó en el field, que ya
   no tiene role. La lista cambia de forma. Como la aserción compara dos
   contratos que cambian igual, puede seguir pasando.
2. **`agents.spec.ts:2031`** — `toHaveCSS("cursor", "default")` sobre el mismo
   locator `getByLabel` de A-2030. Antes medía el `<button>` de Radix; ahora
   mide el input escondido dentro del `VisuallyHidden`. El valor computado de
   `cursor` ahí no es el mismo y no se puede predecir sin un browser. **Es el
   candidato más probable a falla residual del lote.**
3. **`toBeEnabled()` sobre un field quedó vacío de contenido.** Deshabilitado
   se renderiza como `data-disabled="true"` sobre un `div`, y Playwright solo
   considera deshabilitado un control nativo con `disabled` o algo con
   `aria-disabled`. Así que `toBeEnabled()` sobre estos testids ahora **pasa
   siempre**: `mesh-compute:36, 129` · `observer-archive-policy:36, 89` ·
   `buzz-theme-screenshots:1552` · `signout-confirmation:37, 115`. No rompen,
   pero dejaron de asertar. Un `toBeDisabled()` sobre un field, en cambio,
   fallaría siempre — se buscó y **no hay ninguno** en la suite.

### E — fuera del inventario: `video-attachment.spec.ts` — 3 aplicadas

El inventario no lo tenía. `video-review-frame-toggle` es un `Checkbox` de
`@/shared/ui/checkbox` (`VideoPlayer.tsx:1985`), ya migrado, y sus tres
aserciones `data-state="checked"/"unchecked"` (líneas 747, 749, 761) rompen por
exactamente la misma razón que el grupo B. Se aplicó el mismo reemplazo, en un
commit aparte.

Los dos `frameToggle.click()` de ese bloque no necesitaron cambio: ya apuntaban
al field.

### Lo que NO rompe

Verificado, para que nadie lo re-investigue:

- Las cuatro `toHaveClass` de `global-agent-config-screenshots.spec.ts:502-505`
  (`/h-11/`, `/rounded-xl/`, `/bg-muted\/40/`, `/shadow-none/`) y la de `:512`.
  Vienen de `PERSONA_SELECT_TRIGGER_CLASS` sobre un `<button>` propio de
  `AgentDropdownSelect`; no pasan por `Input`.
- Cualquier `toHaveClass(/regex/)` sobre campos: `composeTwRenderProps` de
  HeroUI antepone su clase BEM y deja la nuestra después, así que el match
  sigue. Un `toHaveClass("string exacto")` sí rompería — hay **cero** en la
  suite.
- Los ~68 selectores `[data-testid]` de `theme.css`: cero superposición con los
  18 testids de estos controles.
- Los 4 `querySelector` de runtime: ninguno apunta a un control de este lote.
- `workflow-title-stability.spec.ts:224-232` — `aria-checked` sobre
  `getByRole("menuitemcheckbox")`. Es un ítem de menú (lote B, menús), no un
  control de formulario; el rol conserva su `aria-checked`.
- `workflow-local-controls.spec.ts:206, 219, 247, 258` — `toBeChecked()` sobre
  `getByRole("radio")`. Resuelve al input nativo.
- Los `data-state` que quedan en la suite y **no** son de este lote: pestañas
  (`profile:167, 1599` · `workflow-local-controls:849` ·
  `projects-v3-screenshots:310` · `agent-readiness-screenshots:145`), sidebar
  (`smoke:688-713`), popovers y adjuntos (`messaging:1446`), indicadores de
  paso (`onboarding:402, 458` · `mobile-pairing-qr`).

---

## Trampas de entorno que cuestan horas

**El harness de tests unitarios no define `SVGElement`.** React Aria hace
`target instanceof SVGElement` al desmontar sus press handlers, así que sin ese
global explota un `ReferenceError` **desde dentro del `cleanup` de
testing-library**, no desde una aserción — se lee como un test roto al azar. Le
va a pasar a cualquiera que renderice React Aria en JSDOM.

**`waitForAnimations` espera a que *todas* las animaciones terminen.** Un
componente que anima en loop cuelga screenshots y specs sin error visible.
Confirmado con el `Spinner` de HeroUI. El `Skeleton` de HeroUI tiene el mismo
problema y por eso no se migró.

**`reuseExistingServer` sirve el `dist/` viejo.** Matá el puerto 4173 y
reconstruí con `pnpm build:e2e` tras cada cambio, o los tests dan verde sobre
código anterior.

**`AgentSessionTranscriptList.tsx` está a 3 líneas del techo de 1000.**
Cualquier cosa que le agregue líneas rompe el trinquete diferencial.
