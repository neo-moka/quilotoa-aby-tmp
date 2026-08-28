Mapa de componentes — migración a HeroUI Pro
============================================

`draft` — vinculante. Complementa [theming-contract.md](theming-contract.md).

Define qué se reemplaza, qué se conserva, y cómo se reparte el trabajo entre
agentes en paralelo. Ningún agente elige por su cuenta un equivalente distinto
al de estas tablas.

---

## 1. La arquitectura hace el trabajo fácil

`desktop/` sigue el patrón shadcn/ui: cada primitiva de Radix está **envuelta
una sola vez** en `desktop/src/shared/ui/`, y el resto de la app consume el
wrapper. Verificado: de las 14 primitivas Radix declaradas, **cada una se
importa en exactamente un archivo**, salvo `dialog` (6) y `slot` (4).

Consecuencia para el reparto: **migrar una primitiva es editar un archivo.**
Los wrappers no dependen entre sí, así que son unidades de trabajo paralelas
casi perfectas.

Solo cuatro archivos de features importan Radix directo y necesitan atención
individual:

- `src/features/profile/ui/NostrBindConsentDialog.tsx`
- `src/features/channels/ui/ChannelManagementSheet.tsx`
- `src/features/messages/ui/ComposerAttachments.tsx`
- `src/features/workflows/ui/WorkflowFormBuilder.tsx`

## 2. Equivalencias Radix → HeroUI

| Wrapper (`shared/ui/`) | Radix hoy | HeroUI | Paquete |
|---|---|---|---|
| `tooltip.tsx` | `react-tooltip` | `Tooltip` | OSS |
| `popover.tsx` | `react-popover` | `Popover` | OSS |
| `dropdown-menu.tsx` | `react-dropdown-menu` | `Menu` / `Dropdown` | OSS |
| `dialog.tsx` | `react-dialog` | `Modal` | OSS |
| `alert-dialog.tsx` | `react-alert-dialog` | `AlertDialog` | OSS |
| `sheet.tsx` | `react-dialog` | `Drawer` | OSS |
| `context-menu.tsx` | `react-context-menu` | `ContextMenu` | **Pro** |
| `tabs.tsx` | `react-tabs` | `Tabs` | OSS |
| `switch.tsx` | `react-switch` | `Switch` | OSS |
| `checkbox.tsx` | `react-checkbox` | `Checkbox` | OSS |
| `avatar.tsx` | `react-avatar` | `Avatar` | OSS |
| `separator.tsx` | `react-separator` | `Separator` | OSS |
| `toggle.tsx` | `react-toggle` | `ToggleButton` | OSS |
| `button.tsx` | `react-slot` | `Button` | OSS |

### Sin equivalente directo

| Radix | Situación |
|---|---|
| `react-focus-scope` | No hace falta. `react-aria-components` maneja focus trap internamente en overlays. Se elimina al migrar los overlays, no se reemplaza. |
| `react-slot` (`asChild`) | **No es un componente, es un patrón.** Ver §4. |

## 3. Librerías no-Radix

| Librería | HeroUI | Decisión |
|---|---|---|
| `sonner` | `Toast` (OSS) | **Reemplazar** — equivalencia limpia |
| `embla-carousel-react` | `Carousel` (Pro) | **Reemplazar** |
| `tiptap` + `tiptap-markdown` | `RichTextEditor` (Pro) | **CONSERVAR.** El composer es superficie de producto central: menciones, markdown, atajos, caret. Un reemplazo acá es un proyecto propio, no parte de esta migración. |
| `virtua` | `ListView` (Pro) | **CONSERVAR.** Está parchado (`patchedDependencies: virtua@0.49.3`); reemplazarlo tira el parche a la basura. |
| `@dnd-kit/*` | — | **CONSERVAR.** `Kanban` de Pro trae su propio DnD pero no es un reemplazo general. |
| `react-diff-view` | — | **CONSERVAR.** Sin equivalente. |
| `lucide-react`, `cva`, `tailwind-merge` | — | Ortogonales. HeroUI trae `tailwind-variants`; conviven sin problema. |

## 4. Los dos cambios de API que obligan a reescribir

No alcanza con renombrar imports.

### `asChild` → composición

Radix usa `Slot` para fusionar props en un hijo arbitrario. HeroUI/react-aria
no tiene ese patrón. Hay **285 usos de `asChild`**, concentrados en:

`shared/ui/sidebar.tsx` (16), `features/messages/ui/ComposerAttachments.tsx`
(11), `features/workflows/ui/WorkflowDialog.tsx` (8),
`features/sidebar/ui/CustomChannelSection.tsx` (6),
`features/messages/ui/MessageActionBar.tsx` (6),
`features/huddle/components/HuddleBar.tsx` (6), `shared/ui/attachment.tsx` (5),
`features/sidebar/ui/SidebarProjectsSection.tsx` (5), y el resto disperso.

Cada uno requiere decisión: o el componente de HeroUI acepta el rol
directamente, o se usa su render prop, o se conserva un wrapper propio.

### El estado de selección es de la colección, no del item

Verificado en `react-aria@3.51.0` (`private/menu/useMenu.mjs:45`,
`useMenuItem.mjs:60-64`), no en documentación.

**Los roles ARIA se preservan**: HeroUI emite `menu`, `menuitem`,
`menuitemradio` y `menuitemcheckbox`, igual que Radix — no `listbox`/`option`.
Las 236 aserciones de los specs sobre esos roles sobreviven.

Pero el rol **no se elige por item**: se deriva del `selectionMode` del
selection manager que el item tiene en contexto. Radix lo declara por item
(`RadioItem`, `CheckboxItem`); React Aria lo declara por colección.

Se resuelve porque `MenuSection` acepta su propio `selectionMode`
(`dist/types/src/Menu.d.ts:59`), y crea un `GroupSelectionManager` propio
(`dist/private/Menu.mjs:337`). Mapeo correcto:

| Radix | HeroUI |
|---|---|
| `DropdownMenuRadioGroup value onValueChange` | `Section selectionMode="single" selectedKeys onSelectionChange` |
| `DropdownMenuCheckboxItem checked` | `Section selectionMode="multiple"` |
| items sueltos | sin `selectionMode` → `menuitem` |

> **Trampa.** Poner `selectionMode` en el `Menu` raíz en vez de en la
> `Section` convierte **todos** los items en `menuitemradio`, incluidos los
> planos. En este repo hay 23 `RadioGroup` conviviendo con 110 items planos en
> los mismos menús. **Ni typecheck ni build lo detectan** — solo los specs, y
> los specs no corren en `just ci`.

El mismo principio aplica a cualquier componente de colección de React Aria
(`Tabs`, `ListBox`, `Select`, `CheckboxGroup`): el estado vive en la colección.
Antes de migrar uno, verificá dónde queda declarado.

### `onClick` → `onPress`

HeroUI v3 usa `onPress` (react-aria) en elementos interactivos. Hay **963
`onClick`** en `desktop/src`, pero **la mayoría está sobre elementos HTML
nativos y no se toca**. Solo migran los que queden sobre componentes de
HeroUI. No hagas un reemplazo global: rompe todo lo que no sea HeroUI.

`onPress` no es sinónimo de `onClick` — unifica mouse, touch y teclado, y su
evento no trae `preventDefault` con la misma semántica. Revisá caso por caso
los que dependan del objeto de evento.

## 5. La oportunidad que no es un reemplazo

`@heroui-pro/react` trae una suite pensada para exactamente este producto:

`chat-conversation`, `chat-message`, `chat-message-actions`, `chat-list-view`,
`chat-attachment`, `chat-loader`, `chat-source`, `chat-tool`, `prompt-input`,
`prompt-suggestion`, `chain-of-thought`, `emoji-picker`,
`emoji-reaction-button`, más `app-layout`, `sidebar`, `navbar`, `command`,
`file-tree`, `timeline`, `resizable`, `code-block`, `markdown`.

`chain-of-thought` y `chat-tool` son particularmente relevantes para la
superficie de agentes.

**Esto queda explícitamente FUERA del alcance de la migración actual.** Se
registra acá para que no se pierda, pero adoptar la suite de chat es rediseño
de producto, no migración de infraestructura de UI, y mezclarlos hace
imposible saber qué rompió qué. Primero paridad, después oportunidad.

## 6. Reparto en paralelo

Prerrequisito bloqueante: la conversión de formato de color
([theming-contract.md](theming-contract.md) §6) tiene que estar commiteada.
Hasta entonces nadie importa `@heroui/styles`.

Lotes independientes, un agente cada uno:

| Lote | Archivos | Notas |
|---|---|---|
| **A — Overlays** | `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `popover.tsx` | **BLOQUEADO — se conserva Radix. Ver §6ter.** React Aria no puede expresar el control de foco del que dependen 34 sitios de llamada. |
| **B — Menús** | `dropdown-menu.tsx`, `context-menu.tsx` | `context-menu` viene de Pro, no de OSS. |
| **C — Controles de formulario** | `switch.tsx`, `checkbox.tsx`, `toggle.tsx`, `input.tsx`, `textarea.tsx` | |
| **D — Display** | `tooltip.tsx`, `avatar.tsx`, `separator.tsx`, `badge.tsx`, `card.tsx`, `skeleton.tsx` | El más mecánico. |
| **E — Navegación** | `tabs.tsx`, `segmented-control.tsx`, `step-progress.tsx`, `progress.tsx` | |
| **F — Botón + `asChild`** | `button.tsx` + los 285 `asChild` | **Toca todos los lotes.** Va secuencial, después de A–E, o se coordina explícitamente. |
| **G — Toasts** | `sonner.tsx` | Independiente. |

Los lotes A–E y G son paralelos entre sí. F depende de todos.

## 6ter. El control de foco no tiene equivalente en React Aria

Resultado del Lote A. **Los cuatro overlays se conservan en Radix.** No es una
preferencia: es una capacidad que la librería no expone.

### Lo que Radix da y React Aria no

`Dialog.Content` de Radix emite dos eventos cancelables — `onOpenAutoFocus` y
`onCloseAutoFocus` — que permiten decir "abrí este overlay **sin** mover el
foco" y "cerralo **sin** devolver el foco al trigger". React Aria no tiene
ninguno de los dos, y no por omisión de la API pública:

| Verificado en | Qué dice |
|---|---|
| `react-aria/dist/private/overlays/Overlay.mjs` | Todo overlay se envuelve en `FocusScope` con **`restoreFocus: true` hardcodeado**. El único escape es `disableFocusManagement`. |
| `react-aria-components/dist/private/Modal.mjs` | Llama a `Overlay` pasando solo `isExiting` y `portalContainer`. Nunca `disableFocusManagement`. |
| `react-aria-components/dist/private/Popover.mjs:206,228` | Igual: solo pasa `shouldContainFocus`. Nunca `disableFocusManagement`. |
| `react-aria-components/dist/private/Dialog.mjs` | Usa `useDialog`, que mueve el foco al montar. Sin prop de opt-out. |

HeroUI construye `Modal`, `AlertDialog`, `Drawer` y `Popover` sobre esos
componentes, así que hereda el hueco entero. No hay prop, contexto ni render
prop que lo puentee.

### Cuánto pesa

Sitios de llamada que hoy dependen de esos dos eventos, por wrapper:

| Wrapper | `onOpenAutoFocus` | `onCloseAutoFocus` | `onInteractOutside` | Consumidores |
|---|---|---|---|---|
| `popover.tsx` | 17 | 8 | 6 | 34 |
| `dialog.tsx` | 3 | 3 | — | 60 |
| `sheet.tsx` | — | 2 | — | 2 |
| `alert-dialog.tsx` | — | 1 | — | 30 |

**34 sitios sin traducción posible.** No son detalles cosméticos: el patrón
`onOpenAutoFocus={e => e.preventDefault()}` es lo que mantiene el foco y el
caret en el composer mientras se abre un popover. Si el foco se va, el emoji
picker, las menciones y los tres combobox de typeahead **dejan de aceptar
teclado** — no se degradan, se rompen.

`onInteractOutside` sí es mapeable a `shouldCloseOnInteractOutside(element) =>
boolean` (`AriaPopoverProps`), pero con otra forma: es un predicado sobre el
elemento, no un evento cancelable.

### Por qué esto no lo agarra ningún comando

Ni `just ci` ni `just check` corren Playwright, no hay `toHaveScreenshot`, y no
hay una sola aserción de foco en los 156 specs. Un overlay migrado que roba el
foco **pasa typecheck, lint, build y CI en verde** y se rompe recién en las
manos del usuario. Por eso la decisión se toma leyendo el upstream y no
esperando que falle algo.

### Lo que sí encaja, para cuando se destrabe

- `AlertDialog` de HeroUI **sí emite `role="alertdialog"`**
  (`@heroui/react/dist/components/alert-dialog/alert-dialog.js:154`), así que
  las 48 aserciones sobre ese rol sobrevivirían. Es el candidato más limpio:
  **29 de sus 30 consumidores no tocan el foco.** El único que lo hace es
  `AgentDefaultsDialog.tsx:122`, y no hace `preventDefault` a secas — redirige
  el foco a un botón concreto. Si algún día se resuelve el hueco de foco,
  empezar por acá.
- `ChannelManagementSheet.tsx` tiene un bloqueo aparte: en split layout
  renderiza su panel **sin portal y no-modal**, para quedar acoplado al flujo
  del layout. El `Overlay` de React Aria siempre hace `createPortal`.

### Migrar `AlertDialog` solo: evaluado y descartado

Se consideró migrar únicamente `alert-dialog.tsx`, por ser el de mejor encaje.
**Se decidió que no.** Queda registrado para que no se re-litigue:

1. Ese 1 de 30 no es un caso menor por ser minoría — es *más* peligroso,
   porque una regresión de teclado en un solo diálogo no la ve nadie.
2. **Mezclar los dos sistemas reinstala la trampa de la animación.** Si
   `alert-dialog.tsx` pasa a React Aria y `dialog.tsx` se queda en Radix,
   `modalMotion.ts` tendría que servir a dos vocabularios de atributos a la vez
   (`data-state` y `data-entering`/`data-exiting`). Es exactamente el desajuste
   que dejó todos los diálogos sin animación en silencio y que ningún gate
   detectó.
3. El beneficio es chico: se gana un archivo a cambio de una regresión y una
   superficie mixta, con el resto de los overlays igual en Radix.

**Corolario para cualquier migración parcial:** antes de mover un wrapper solo,
mirá qué módulos compartidos quedan sirviendo a dos vocabularios de atributos.
`modalMotion.ts` y `popoverSurface.ts` son los dos que hoy tienen ese riesgo.

### Consecuencia para el Lote B

Los menús viven sobre las mismas primitivas y usan el mismo patrón, con más
peso todavía: **20 `onCloseAutoFocus` sobre `DropdownMenuContent`, repartidos
en 20 archivos.** Devolver el foco al trigger después de elegir un item es
justamente lo que esos sitios cancelan. El veredicto del §6ter les aplica
igual; conviene resolverlo antes de invertir en la migración de menús.

## 6bis. `data-testid` NO es solo contrato de test

El riesgo más grande de toda la migración, y el más fácil de pasar por alto.

### Es contrato de estilo

`desktop/src/shared/styles/globals/theme.css` **estiliza la app a través de
~68 selectores `[data-testid]`** (`theme.css:393-884`). Entre otros:
`app-sidebar` (15 reglas), `sidebar-pinned-header`, `settings-sidebar`,
`community-rail`, `open-search`, `sidebar-profile-card`, `stream-list`,
`starred-list`, `dm-list`, `app-top-chrome`, `sidebar-primary-menu`.

Un componente de HeroUI que no re-emita el `data-testid` **en el mismo nodo que
hoy lleva la clase de superficie** deja el tema Buzz sin aplicar. Degrada a un
estilo neutro que sigue siendo "visible", así que **puede no romper ni un
test**.

### Es contrato de funcionalidad

Cuatro sitios hacen `querySelector` sobre testids en runtime. Borrarlos rompe
funcionalidad de usuario, no un test:

| `archivo:línea` | Uso |
|---|---|
| `features/projects/ui/ProjectsToolbar.tsx:115` | scroll a sección |
| `features/projects/ui/projectsSectionMeta.ts:31` | `open-search` |
| `shared/ui/VideoPlayer.tsx:1572` | devolver foco a `message-input` |
| `shared/ui/markdown/imageLightbox.ts:306` | `closest("[data-testid='message-row']")` |

### Tres patrones de emisión, dos invisibles a `grep`

1. **Literal** — `data-testid="app-sidebar"`. Sobrevive si se copia.
2. **Vía prop propia** — `testId=`, `dataTestId=`, `listTestId=`, y defaults de
   parámetro (`MessageThreadPanelSkeleton.tsx:169`). **El de mayor riesgo**: al
   sustituir el componente propio la prop desaparece con él y el testid se
   evapora en todos sus sitios de llamada a la vez.
3. **Template literal dinámico** — ~40 patrones. `SidebarSection.tsx:317`
   sostiene por sí solo `channel-general` y `channel-random`, los testids nº2 y
   nº8 del repo por tráfico, y **ningún grep de literales los encuentra**.

### La red de tests no te va a avisar

- **1121 testids, 7597 `getByTestId`, 156 specs** — y **ni `just ci` ni
  `just check` corren Playwright**. Solo CI, en 6 shards.
- **Casi no hay regresión visual de píxeles.** Cero `toHaveScreenshot` — pero
  eso no es lo mismo que cero comparación de píxeles: `workflow-local-controls.spec.ts:148`
  usa `toMatchSnapshot` sobre un Buffer PNG
  (`workflow-template-variable-autocomplete-smoke-darwin.png`), que sí compara
  imagen contra imagen. Es la única, y ya está desactualizada respecto de la
  base. Fuera de ella, espaciado, pesos, sombras y radios pueden cambiar en
  toda la app sin fallar nada.
- **153 `toHaveClass` sobre clases Tailwind literales** (`h-11`, `rounded-xl`,
  `-ml-5`, `bg-emerald-500`, `grid-flow-col`, `line-clamp-3`) y **142
  `.locator(".clase")`** (no 98), incluidos `.font-semibold`, `.truncate`,
  `.sr-only` y `.lucide-plus`. Caen aunque la funcionalidad se preserve —
  **pero no ante cualquier cambio, y la diferencia decide el riesgo de varios
  lotes.** Las **153 `toHaveClass` son regex; `toHaveClass` con string exacto
  aparece 0 veces.** Playwright trata esas dos formas distinto: con string
  compara el atributo `class` **completo** y falla al agregar una clase; con
  regex hace **match parcial**. Y un selector `.locator(".clase")` solo puede
  pasar a matchear *más* nodos cuando se agregan clases, nunca menos.

  **Consecuencia: agregar clases es seguro en toda la suite.** Un wrapper
  puede adoptar la base BEM de HeroUI —`skeleton`, `chip`, `avatar`— sin tocar
  ninguna de las 295 aserciones, siempre que conserve las clases que ya emite.
  Lo que rompe es **quitar o renombrar**, que es justo lo que hace adoptar la
  *apariencia* de HeroUI en vez de su base. Es otro argumento para el patrón
  "base de HeroUI, piel propia": además de preservar el diseño, no toca la red
  de tests.

  Una excepción acotada: **tres regex nombran dos clases en orden** separadas
  por `.*` — `tooltip-semantics.spec.ts:101`, `agents.spec.ts:1016` y
  `agents.spec.ts:2037`. Insertar clases entre medio las deja pasar (`.*`
  absorbe cualquier cosa); lo que las rompe es **reordenar** los tokens del
  `class`. Es un modo de falla real cuando un wrapper pasa a componer su
  `className` en otro orden.

  Verificado con `rg` sobre `desktop/tests/e2e/`: `toHaveClass\(` → 153,
  `toHaveClass\("` → 0, `\.locator\("\.[^"]+"\)` → 142, `toHaveClass\(\[` → 0
  (no hay forma array) y `toContainClass` → 0. Los conteos previos de este
  párrafo venían de una estimación, no del barrido.
- **236 aserciones sobre `menuitem`/`menuitemradio`/`menu`**: si un menú pasa a
  `Select`/`ListBox`, el rol cambia a `option` y rompen todas.
- **48 sobre `alertdialog`**: rol distinto de `dialog`; HeroUI puede unificarlos.

**Regla operativa:** después de migrar cualquier componente, correr
`cd desktop && pnpm test:e2e:smoke` — no alcanza con `just ci`. Y matar el
puerto 4173 antes, porque `reuseExistingServer` sirve el `dist/` viejo y los
tests dan verde sobre código previo.

### Zonas ciegas

`agents` tiene 154 testids de los cuales **94 no los toca ningún spec** (104
archivos `.tsx`). `pulse` y `terminal` no emiten ninguno. Ahí una regresión
pasa entera sin ser detectada — hay que verificar a mano.

## 7. Reglas duras para todo agente de este trabajo

1. **No se toca `crates/`, el relay, el CLI ni ningún contrato de API o de
   evento Nostr.** Esta migración es exclusivamente de la capa de UI del
   desktop.
2. **No se pierde funcionalidad.** Si un componente de HeroUI no cubre un
   comportamiento existente, se conserva el wrapper propio y se documenta el
   hueco — no se elimina la funcionalidad para que el reemplazo entre.
3. **Se preservan los `data-testid`.** Son contrato con la suite E2E.
4. **Se preserva el tema claro y oscuro** en cada componente migrado, y se
   verifica en ambos.
5. Guardas del repo: nada de tamaños de texto en px ni rem arbitrarios
   (`desktop/scripts/check-px-text.mjs`), máximo 1000 líneas por archivo,
   `git commit -s` obligatorio (DCO).
