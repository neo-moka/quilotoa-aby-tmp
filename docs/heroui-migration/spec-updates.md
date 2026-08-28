Actualizaciones de specs que exige la migración
==============================================

`draft` — inventario de trabajo, no de decisiones.

Cada entrada es una aserción que **va a fallar** cuando el lote correspondiente
se mergee, con su reemplazo ya determinado. Ninguna es una sorpresa esperando
en CI: son consecuencia conocida de un cambio de contrato de DOM.

Recordá que **ni `just ci` ni `just check` corren Playwright**. Estas fallas
solo aparecen en CI, en 6 shards, o corriendo `pnpm test:e2e:smoke` a mano.

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

`Toggle` es la excepción: sigue siendo `<button>`, conserva `aria-pressed`, y
solo cambia `data-state="on"` por `data-selected="true"`.

`Input` y `Textarea` **no cambian de nodo**: el testid sigue en el `<input>` /
`<textarea>` real.

Los cinco puntos anteriores están fijados por
`desktop/src/shared/ui/heroControls.test.mjs`, que corre en `pnpm test`. Si
alguno deja de valer, ese test falla antes que la suite E2E.

### A — 28 `toBeChecked()` sobre el testid de un Switch/Checkbox

El nodo es ahora un `<div>`; Playwright falla con *"Not a checkbox or radio
button"*.

```
toBeChecked()      →  toHaveAttribute("data-selected", "true")
not.toBeChecked()  →  not.toHaveAttribute("data-selected", "true")
```

| Spec | Líneas | Testid |
|---|---|---|
| `agents.spec.ts` | 109, 111, 1546, 1548, 1638, 1640, 2030 | `persona-share-catalog-access` |
| `buzz-theme-screenshots.spec.ts` | 553, 1249, 1266 | `prominent-active-tab-toggle` |
| `buzz-theme-screenshots.spec.ts` | 1553, 1570 | `glass-background-toggle` |
| `huddle-transcription.spec.ts` | 824, 834 | `huddle-agent-tts-toggle` |
| `local-archive-screenshots.spec.ts` | 74 | `local-archive-observer-toggle` |
| `mesh-compute.spec.ts` | 52, 75, 125, 136 | `mesh-share-compute-toggle` |
| `observer-archive-policy.spec.ts` | 37, 54, 58, 62, 90, 108, 112, 116 | `local-archive-observer-toggle` |
| `signout-confirmation.spec.ts` | 94 | `signout-backup-confirm` |

### B — 3 aserciones de atributo de estado

Mismo reemplazo que A.

| Spec:línea | Aserción actual |
|---|---|
| `profile.spec.ts:1687` | `toHaveAttribute("data-state", "checked")` |
| `profile.spec.ts:1690` | `toHaveAttribute("data-state", "unchecked")` |
| `voice-settings.spec.ts:42` | `toHaveAttribute("aria-checked", "false")` |

> **No tocar** `profile.spec.ts:1686` y `:1689`. Esos `toBeChecked()` son sobre
> `user-profile-start-on-launch`, que es la fila, no el switch. Siguen válidos.

### C — 5 `.click()` sobre `getByRole("switch")` *(sin confirmar)*

El `input` vive dentro del `VisuallyHidden` de React Aria (`clip-path:
inset(50%)`, 1×1px), y el clip afecta el hit-testing, así que el chequeo de
*receives pointer events* de Playwright probablemente falle con timeout. Los
`toBeChecked()` sobre esos mismos locators **sí siguen funcionando**: resuelven
al input, que es un checkbox nativo.

`channels.spec.ts:3424` · `workflows.spec.ts:377, 382, 440, 480`

Salida limpia: clickear el field (`[data-slot="switch"]` scopeado), o darle un
`data-testid` al `Switch` de `WorkflowCard`, que hoy no tiene.

Los `getByRole("switch", …)` que solo asertan no se tocan:
`workflows.spec.ts:355, 389, 487` · `workflow-local-controls:102, 144, 859`.

### D — riesgo menor a vigilar

`profile.spec.ts:96-120` (`readVisibleProfileSurface`) enumera `[role="switch"]`
filtrando por `rect.width > 0 && rect.height > 0`. El input oculto mide 1×1, así
que **pasa** ese filtro y entra a `visibleControls` con `testId: null` — el
testid quedó en el field, que ya no tiene role. La lista cambia de forma. Como
la aserción compara dos contratos que cambian igual, puede seguir pasando; si
aparecen diffs raros en el contrato de perfil, es esto.

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
