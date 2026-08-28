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
| `separator.tsx` | `react-separator` | `Separator` | OSS — migrado, ver §6quater |
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
| `embla-carousel-react` | `Carousel` (Pro) | ~~Reemplazar~~ → **CONSERVAR.** Ver §6quater. |
| `tiptap` + `tiptap-markdown` | `RichTextEditor` (Pro) | **CONSERVAR.** No es "tiptap contra Pro": el `RichTextEditor` de Pro **es tiptap** — declara `@tiptap/{core,react,pm,starter-kit,suggestion,extension-link,extension-underline,extensions}` como peers **opcionales** en `>=3.23.6`, o sea que usa nuestra instancia y no duplica ProseMirror. La competencia real es *nuestro wrapper contra el suyo*, y el suyo pierde por el modelo de valor: Pro es JSON-first controlado (`value: JSONContent`), el composer es markdown-first (`tiptap-markdown` con `transformPastedText`/`transformCopiedText` + `plainTextProjection.ts`). Sumado al bump desde `^3.22.3` y a tres paquetes que hoy no están instalados, adoptarlo agrega un wrapper sin sacar una línea de las nuestras. Ver §6quinquies. |
| `virtua` | ~~`ListView` (Pro)~~ | **CONSERVAR — y la comparación era falsa.** `ChatListView` de Pro **no es una lista virtualizada**: son filas de lista para sidebars y selectores de conversación (`Item/Icon/Title/Preview/Meta`), sin virtualización ni anclaje de scroll. Nunca hubo un reemplazo que evaluar. Aparte, virtua está parchado (`patchedDependencies: virtua@0.49.3`) y el parche son **cuatro extensiones de API**, no un hack: `itemSize` acepta `(data, index) => number`; el camino de shift/prepend usa alturas reales en vez del promedio (historial sin salto de viewport); una acción nueva `9` hace que la rueda retire el modo shift; y los `scrollTo` sucesivos acumulan desde el destino pendiente. `ui/virtuaWheelModePatch.test.mjs` asertea el texto del parche. Ver §6quinquies. |
| `@dnd-kit/*` | — | **CONSERVAR.** `Kanban` de Pro trae su propio DnD pero no es un reemplazo general. |
| `react-diff-view` | — | **CONSERVAR.** Sin equivalente. |
| `lucide-react`, `cva`, `tailwind-merge` | — | Ortogonales. HeroUI trae `tailwind-variants`; conviven sin problema. |

## 4. Los dos cambios de API que obligan a reescribir

No alcanza con renombrar imports.

### `asChild` → composición

Radix usa `Slot` para fusionar props en un hijo arbitrario. HeroUI/react-aria
no tiene ese patrón.

> **Corrección (resultado del Lote F).** Una versión anterior de este documento
> decía "285 usos de `asChild`" y los concentraba por archivo
> (`sidebar.tsx` 16, `ComposerAttachments.tsx` 11, `WorkflowDialog.tsx` 8, …).
> Ese conteo era de líneas con `grep`, no de sitios de llamada, y sobreestima el
> trabajo por un factor de diez.

Escaneando cada tag JSX de apertura completo (no líneas) y resolviendo el tag a
su import: **296 ocurrencias de la palabra, de las cuales 39 no son atributos
JSX** (declaraciones `asChild?: boolean`, destructuring, la línea
`const Comp = asChild ? Slot : …`, el `type={asChild ? … }` de
`attachment.tsx`, y comentarios). **Atributos JSX: 257**, de los cuales 256 son
sitios de llamada — el restante está dentro de un comentario en `markdown.tsx`.
Se reparten así:

| Grupo | n | Qué implica |
|---|---|---|
| Sobre Radix que **se queda en Radix** (§6ter) | 179 | No se tocan |
| Sobre wrappers **ya migrados**, que conservan `asChild` como API propia | 58 | Ya resueltos en los lotes B y D |
| Sobre nuestros propios wrappers con `Slot` | 19 | El alcance real del Lote F |

Desglose del primer grupo: `TooltipTrigger` 86, `PopoverTrigger` 29,
`AlertDialogCancel` 17, `AlertDialogAction` 16, `PopoverAnchor` 13,
`DialogClose` 9, `DialogTrigger` 3, `DialogPrimitive.*` 3 (Radix directo), y uno
cada uno de `AlertDialogTrigger`, `DialogDescription` y `FocusScope`.
**`tooltip.tsx` sigue en Radix** (el Lote D descartó el `Tooltip` de HeroUI por
`skipDelayDuration`), así que sus **86** usos son `Slot` de verdad, no API
propia.

> **Cuidado con el conteo del tooltip.** Un `grep -A4 '<TooltipContent'` sugiere
> 3 `TooltipContent asChild` y 1 `Tooltip asChild`; **son falsos positivos.** Lo
> que matchean son líneas `<TooltipTrigger asChild>` de bloques vecinos. Ni
> `Tooltip`, ni `TooltipContent`, ni `TooltipProvider` llevan `asChild` en
> ningún sitio: el total de la familia es 86, todo en `TooltipTrigger`. Es el
> mismo error de proximidad que inflaba el "285" original — cualquier conteo por
> líneas de contexto lo repite.

Segundo grupo: `DropdownMenuTrigger` 51 (compone vía `Pressable`),
`ContextMenuTrigger` 7 (vía el `render` de Pro).

Tercer grupo: `Button` 6, `Card` 6, `SidebarGroupLabel` 5, `AttachmentTrigger`
2. **`sidebar.tsx` declara `asChild` en cinco componentes pero solo
`SidebarGroupLabel` tiene sitios de llamada** — los otros cuatro
(`SidebarGroupAction`, `SidebarMenuButton`, `SidebarMenuAction`,
`SidebarMenuSubButton`) tienen la prop muerta.

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
| **A — Overlays** | `dialog.tsx`, `alert-dialog.tsx`, `sheet.tsx`, `popover.tsx` | **BLOQUEADO — se conserva Radix. Ver §6ter.** El foco sí tiene salida; lo que no la tiene es el descarte del popover no-modal. La familia modal es el candidato para un próximo intento. |
| **B — Menús** | `dropdown-menu.tsx`, `context-menu.tsx` | `context-menu` viene de Pro, no de OSS. |
| **C — Controles de formulario** | `switch.tsx`, `checkbox.tsx`, `toggle.tsx`, `input.tsx`, `textarea.tsx` | |
| **D — Display** | `tooltip.tsx`, `avatar.tsx`, `separator.tsx`, `badge.tsx`, `card.tsx`, `skeleton.tsx` | El más mecánico. |
| **E — Navegación** | `tabs.tsx`, `segmented-control.tsx`, `step-progress.tsx`, `progress.tsx` | |
| **F — Botón + `asChild`** | `button.tsx` + los `asChild` | **HECHO. Ver §6quater.** Migrado vía la prop `render`, que mantiene abierto el contrato de props; los 523 sitios de llamada quedan sin tocar. `asChild` conserva `Slot` (6 sitios, envuelven un `<a>`). Los `asChild` reales del lote eran 19, no 285 (§4). |
| **G — Toasts** | `sonner.tsx` | Independiente. |

Los lotes A–E y G son paralelos entre sí. F depende de todos.

## 6ter. Los overlays se quedan en Radix — el motivo, re-auditado

Resultado del Lote A, verificado dos veces. La segunda pasada leyó el código
realmente instalado (`react-aria@3.51.0`, `react-aria-components@1.20.0`,
`@heroui/react@3.2.4`), no esta documentación. **La decisión se sostiene, pero
el motivo que estaba escrito acá era incorrecto**, y el motivo real es otro.

### Punto por punto contra lo instalado

| Afirmación del veredicto anterior | Verificado en | Resultado |
|---|---|---|
| `Overlay` envuelve todo en un `FocusScope` con `restoreFocus: true` hardcodeado | `react-aria/dist/private/overlays/Overlay.mjs:44-47` | **Confirmado.** |
| `Modal` nunca reenvía `disableFocusManagement` | `react-aria-components/dist/private/Modal.mjs:139-141` | **Confirmado** — pasa solo `isExiting` y `portalContainer`. |
| `Popover` tampoco lo reenvía | `react-aria-components/dist/private/Popover.mjs:206-210` y `227-231` | **Falso.** Hace `{...props}` sobre `Overlay`: cualquier prop puesta en el `Popover` llega. `PopoverContent` de HeroUI también hace `{...props}` (`@heroui/react/dist/components/popover/popover.js:38-60`). |
| `Dialog` usa `useDialog`, que mueve el foco al montar sin opt-out | `Dialog.mjs:91` → `react-aria/dist/private/dialog/useDialog.mjs:32-34` | **Confirmado.** |

Y `disableFocusManagement` no es un resquicio privado: está documentado en
`OverlayProps` (`react-aria/dist/types/src/overlays/Overlay.d.ts:16`) y la
propia React Aria lo compone dentro de `popoverProps` para los submenús
(`react-aria/dist/types/src/menu/useSubmenuTrigger.d.ts:46`). Es el camino
previsto.

**O sea: el hueco de foco del popover sí tiene salida, y funciona.** Se
implementó completo: un `popover.tsx` sobre `PopoverContent` de HeroUI que pasa
`disableFocusManagement`, no renderiza un `Dialog` de React Aria adentro (para
que su `isDialog` quede en falso y `Popover.mjs:133` no llame a `focusSafely`),
y reimplementa el contrato de Radix a mano. Con eso los 18
`onOpenAutoFocus={e => e.preventDefault()}` siguen funcionando y el caret se
queda en el composer — comprobado, no supuesto.

### El bloqueo real: el popover no-modal de React Aria no se descarta

Destrabado el foco aparece lo que el intento anterior no llegó a ver.
`usePopover` **deriva** la capacidad de descarte del modo, no la recibe:

```
react-aria/dist/private/overlays/usePopover.mjs:31
  isDismissable: !isNonModal || isSubmenu
```

- **Con `isNonModal`** — que es el equivalente al default de Radix y lo que usan
  los 34 sitios — `isDismissable` queda en falso, así que `useInteractOutside`
  no se cablea y **un click afuera no cierra el popover**. Y el Escape de
  `useOverlay` viaja en `keyboardProps` sobre el elemento del overlay
  (`useOverlay.mjs:60-70`), o sea que **solo dispara con el foco adentro** —
  exactamente lo que los 18 sitios del composer evitan. Verificado en jsdom: ni
  un `pointerdown` afuera ni un Escape desde el composer producen un solo
  `onOpenChange`.
- **Sin `isNonModal`**, `usePopover` aplica `usePreventScroll` y
  `ariaHideOutside([...], { shouldUseInert: true })` (`usePopover.mjs:43-52`):
  **el composer queda inerte** mientras el emoji picker está abierto. Peor.

No hay tercera opción; `isDismissable` no es una prop.

### Y una diferencia que no se tapa desde afuera

Un popover no-modal de React Aria **se cierra al scrollear cualquier ancestro
del trigger** (`useCloseOnScroll.mjs:23-36`, cableado desde `usePopover.mjs:41`).
Radix reposiciona y lo deja abierto. En un cliente de chat eso significa que el
picker de reacciones se cierra solo cuando llega un mensaje y el timeline hace
auto-scroll.

### Por qué eso decide

Para conservar el comportamiento habría que dejar a React Aria solo como motor
de posicionamiento y que el wrapper se hiciera cargo de: el foco de apertura y
de cierre, el Escape con su pila de capas, el descarte por pointer afuera con
su predicado, el descarte por foco afuera, y encima suprimir el cierre por
scroll que React Aria hace por su cuenta. Eso es reimplementar
`DismissableLayer` y `FocusScope` de Radix arriba de un posicionador: **más**
código de interacción propio que el wrapper que reemplaza, sobre la superficie
más usada de la app, sin browser para validarlo.

**Los cuatro overlays se quedan en Radix.**

### Cuánto pesa el contrato que hay que conservar

| Wrapper | `onOpenAutoFocus` | `onCloseAutoFocus` | `onInteractOutside` | Consumidores |
|---|---|---|---|---|
| `popover.tsx` | 18 | 8 | 6 | 34 |
| `dialog.tsx` | 5 (3 directos + 2 vía `ChooserDialogContent`) | 3 | — | 59 |
| `alert-dialog.tsx` | — | 1 | — | 30 |
| `sheet.tsx` | — | 1 (reenviada desde `ProjectsView`) | — | 2 |
| `DialogPrimitive` directo | — | — | 3 | 3 |

`onInteractOutside` **sí** es mapeable a `shouldCloseOnInteractOutside(element)
=> boolean` (`AriaPopoverProps`), con otra forma: un predicado sobre el
elemento en vez de un evento cancelable. Los 9 sitios lo permiten — todos son
predicados puros sobre el target.

### La red que faltaba ya existe

El veredicto anterior decía, con razón, que ningún comando agarra esto: `just
ci` no corre Playwright y no había una sola aserción de foco en los specs. Eso
ya no es cierto: `desktop/src/shared/ui/popoverFocusContract.test.mjs` corre en
`pnpm test` (jsdom) y pinea las cinco piezas del contrato — abrir con el evento
cancelado deja el caret donde estaba, abrir sin cancelarlo enfoca el primer
control de adentro, cerrar devuelve el foco al trigger, cancelar el cierre no lo
mueve, y un popover que nunca tomó el foco igual se cierra con Escape y con un
click afuera. **Cualquier port futuro que rompa el composer o deje un popover
sin descartar ahora falla en `pnpm test`.** Ese archivo es el punto de partida
del próximo intento, no esta sección.

(Detalle del arnés, porque cuesta media hora encontrarlo: Node trae sus propios
globals `CustomEvent`/`Event`, el loop que espeja `dom.window` sobre
`globalThis` saltea lo que ya existe, y jsdom rechaza como ajenos los eventos
que Radix construye. Hay que asignar los dos explícitamente.)

### La familia modal es otra historia, y mejor

Vale la pena registrarlo porque contradice lo que decía la versión anterior de
esta sección. Los overrides de foco de `dialog.tsx`, `alert-dialog.tsx` y
`sheet.tsx` son nueve, y **los nueve redirigen el foco; ninguno lo suprime**:

- Apertura (`ChannelBrowserDialog.tsx:423`, `MembersSidebar.tsx:716`,
  `TopbarSearch.tsx:970`, `PersonaCatalogDialog.tsx:202`,
  `HarnessCatalogDialog.tsx:133`) — todos hacen `preventDefault()` y después
  enfocan un ref de adentro del diálogo. React Aria lo expresa: `useDialog`
  **no** mueve el foco si ya hay foco adentro (`useDialog.mjs:33`), así que un
  hijo con `autoFocus` gana. La única rama sin redirección es
  `ChannelBrowserDialog.tsx:423` en modo `create`; ahí React Aria enfocaría el
  contenedor del diálogo, que es el default correcto de accesibilidad y no
  rompe el teclado.
- Cierre (`AgentDefaultsDialog.tsx:83` y `:122`,
  `CommunityOnboardingFlow.tsx:638`, `TopbarSearch.tsx:974`,
  `ProjectsView.tsx:968` vía `ProjectsOverviewContextSheet`) — todos enfocan un
  elemento concreto en vez del trigger. Eso es el mismo shim que el Lote B ya
  tiene funcionando en `dropdown-menu.tsx:88-103`: parkear el foco fuera del
  scope antes del desmontaje hace que `FocusScope` saltee su restore.

Además, a diferencia del popover, acá los modos coinciden: un diálogo de Radix
es modal, y `ModalOverlay` de React Aria es modal, con descarte por click
afuera y Escape que funcionan porque el foco está contenido adentro. Si alguien
retoma el Lote A, **el candidato es la familia modal, no el popover** — lo
contrario de lo que decía esta sección.

Dos cosas a resolver ahí antes de empezar:

1. **`modalMotion.ts` no puede servir dos vocabularios.** Sus dos constantes
   tienen exactamente dos consumidores, `dialog.tsx` y `alert-dialog.tsx`: hay
   que mover los dos juntos y reescribir `data-state` a
   `data-entering`/`data-exiting` en el mismo cambio, o los diálogos se quedan
   sin animación en silencio. (`popoverSurface.ts` tiene el mismo riesgo: sus
   dos constantes `POPOVER_RADIX_*` solo las usa `popover.tsx`.) El Lote B ya
   resolvió esto bien: dejó las clases de menú en `menuCollection.ts` con el
   vocabulario de React Aria y no tocó las de Radix.
2. **`ChannelManagementSheet.tsx`** no pasa por ningún wrapper: importa
   `@radix-ui/react-dialog` directo y en split layout renderiza su panel **sin
   portal y no-modal**, para quedar acoplado al flujo del layout. El `Overlay`
   de React Aria siempre hace `createPortal`; lo más cerca es
   `UNSTABLE_portalContainer` apuntando al padre del anchor. Los otros dos
   consumidores directos de `DialogPrimitive` (`ComposerAttachments.tsx:386`,
   `SimpleImageLightbox.tsx:31`) solo usan `onInteractOutside`, que sí es
   mapeable.

`AlertDialog` de HeroUI **sí emite `role="alertdialog"`**
(`@heroui/react/dist/components/alert-dialog/alert-dialog.js:154`), así que las
48 aserciones sobre ese rol sobreviven. Sus 33 `asChild` sobre
`AlertDialogAction`/`AlertDialogCancel` se absorben dentro del wrapper con
`Pressable`, igual que hizo el Lote B, sin tocar los sitios de llamada.

### Nota sobre el Lote B

La versión anterior de esta sección decía que el veredicto le aplicaba igual a
los menús y que convenía no invertir ahí. **Eso quedó desmentido por los
hechos**: el Lote B migró `dropdown-menu.tsx` y `context-menu.tsx` y está en
`heroui-integration` (`0aab9963d`). Los 20 `onCloseAutoFocus` se conservan con
el shim de `applyCloseAutoFocus`. Los menús no tenían el problema de descarte
del popover porque son modales por default, que es la rama donde React Aria sí
cablea `isDismissable`.

## 6quater. Cierre de wrappers: `separator` y `carousel`

Los dos huecos que ningún lote cerró. Resultados opuestos, por la misma regla
del §7.2.

### `separator.tsx` — migrado, con el `render` como muleta

HeroUI **no tiene `decorative`**, y React Aria tampoco acepta que el rol venga
del caller: `filterDOMProps` descarta `aria-hidden`, y el `role="separator"` de
`useSeparator` gana el merge de `mergeProps`. Los 8 sitios de llamada usan el
default `decorative` del wrapper, así que una migración literal metía 8
divisores decorativos en el árbol de accesibilidad — y sumaba nodos a las dos
aserciones `getByRole("separator")).toHaveCount(1)` de
`community-rail.spec.ts`.

La prop `render` sí sirve. Con `elementType="div"` fijando el elemento que
HeroUI espera (si no, renderiza `<hr>` en horizontal y advierte en cada render
que el `render` devolvió otra cosa), el DOM emitido queda idéntico al de Radix.
Verificado renderizando todas las combinaciones, no leyendo documentación, y
fijado en `separator.test.mjs` porque ningún spec E2E mira estos nodos.

### `carousel.tsx` — conservado

**El `Carousel` de Pro es este mismo carousel.** Importa `embla-carousel-react`
y declara los dos paquetes de embla como peers obligatorios, con el mismo
`role="region"`, `aria-roledescription` y captura de ArrowLeft/ArrowRight.
Adoptarlo no saca una dependencia: agrega una, porque `embla-carousel` hoy es
transitiva y pasaría a directa. **`embla-carousel-react` no es una dependencia
muerta y no se saca.**

Y cuesta. `Carousel.Content` de Pro renderiza tres divs anidados y solo expone
`className` en el más interno; `.carousel__viewport-wrapper` y
`.carousel__viewport` no llevan ningún sizing. Su único consumidor
(`UserProfilePanelTabs.tsx`) es una tarjeta `h-56` cuyos slides la llenan, y eso
funciona porque el viewport propio es `h-full`. Con Pro esa cadena de altura se
corta en dos divs inalcanzables, recuperables solo apuntando variantes
arbitrarias a los `data-slot` privados de Pro. Pro tampoco tiene `orientation`,
pone `tabIndex={0}` en la raíz, y no exporta el tipo `CarouselApi`.

Revisar si la tarjeta de actividad deja de depender de una altura fija llena, o
si Pro expone su viewport. Adoptar dots/thumbnails/flechas de Pro es otra
pregunta: el consumidor no usa ninguno.

## 6quater. El botón migra vía `render`, no vía props

Resultado del Lote F. **`button.tsx` pasa al `Button` de HeroUI.** Los 523
sitios de llamada quedan sin tocar. Pinneado en
`desktop/src/shared/ui/buttonHeroUiGap.test.mjs`, que asserta las dos mitades:
el hueco de HeroUI crudo y el wrapper cerrándolo.

> **Corrección.** Una primera versión de esta sección declaraba el botón
> *conservado*, con el argumento de que el contrato de props se angosta a una
> allowlist. El hueco es real —está medido abajo— pero la conclusión era falsa:
> **`Button` tiene una prop `render`** que reemplaza el elemento emitido, y ahí
> se pueden poner los atributos que `filterDOMProps` descarta. El error salió de
> leer el `.d.ts` compilado de `ButtonRoot` (que tipa `...rest` contra
> `react-aria-components`, donde `render` no aparece) en vez de la
> documentación. **Antes de conservar un componente por falta de escape hatch,
> mirá los docs además del `.d.ts`.**

### El hueco que había que cerrar

`ButtonProps` extiende `ButtonHTMLAttributes`, así que los **523 sitios de
llamada** se escribieron contra un pass-through abierto. `filterDOMProps` de
React Aria admite una allowlist fija: `id`, `data-*`,
`dir/lang/hidden/inert/translate`, eventos globales de mouse/pointer/touch y un
conjunto cerrado de `aria-*`. Todo lo demás se descarta sin error.

Medido contra los sitios de llamada actuales:

| Prop | n | Qué pasa |
|---|---|---|
| `disabled` | 269 | **Se ignora** — React Aria lee `isDisabled`. El botón queda habilitado **y `onClick` igual dispara**. |
| `title` | 35 | Se descarta. `toggle.tsx` lo resolvió con un `<span>` envolvente; sirve para un puñado, no para 35 botones dentro de filas flex. |
| `role` + `aria-selected` | 6 | Se descartan. Los seis son `PulseTabBar.tsx`: un tablist queda como seis botones sueltos, y `pulse` no emite testids (§6bis). |
| `aria-busy` | 2 | Se descarta. |
| `aria-hidden` | 1 | Se descarta. |
| `tabIndex` | 3 | **Se sobrescribe a `0`** — un botón deliberadamente fuera del orden de tabulación se vuelve tabulable. La forma soportada es `excludeFromTabOrder`. |

### Cómo se cierra

`render` reemplaza el elemento que HeroUI emitiría, así que el wrapper spreadea
el resto de los atributos HTML del caller **sobre el mismo nodo y después** de
los de React Aria. El contrato queda abierto en vez de angostarse: no hay una
lista de props que haya que enumerar, y una prop futura fuera de la allowlist
llega igual. `disabled` se traduce a `isDisabled` en el wrapper.

Tres decisiones deliberadas, todas verificadas en los tests:

- **`onClick` sigue siendo handler del DOM**, encadenado después del de React
  Aria en vez de traducido a `onPress`. Ver el relevamiento de abajo.
- **`asChild` conserva `Slot`.** `render` solo devuelve legítimamente un
  `<button>`: con un `<a>` HeroUI avisa *"Unexpected DOM element returned by
  custom `render` function"*, porque el comportamiento de press y foco que
  instala asume semántica de botón. Los seis sitios `asChild` envuelven un `<a>`.
- **Las variantes de Buzz se quedan; las de HeroUI se neutralizan.** Como
  `@heroui/styles/components/index.css` se importa para toda la app, `.button`
  aplica se opte o no. La base del `cva` cancela lo que asomaría: `static` e
  `isolation-auto` (`.button` es `relative isolate`, que reancla hijos
  posicionados y abre un stacking context), `[--button-bg:transparent]` y
  `[--button-fg:inherit]` (`.button` pinta desde esos tokens y teñiría `ghost`,
  `outline` y `link`, que a propósito no declaran fondo ni color),
  `[&_svg]:m-0` (`.button` da `-mx-0.5 my-0.5` a los íconos) y `scale-100` en
  press (`.button:active` aplica `scale(0.97)`).

Lo que **no** se adopta: las variantes de color de HeroUI resuelven de
`--accent`, deliberadamente sin mapear ([theming-contract §4](theming-contract.md),
trampa 2), y `variant="link"`, `xs` e `icon-xs` no tienen análogo. Paridad
primero, como en los controles de formulario.

### `onClick`: 15 sitios de 418, y por eso no va a `onPress`

Relevado caso por caso porque §4 lo marca como trampa. De los **418 `onClick`
sobre `<Button>`**, **403 no declaran parámetro de evento** (`() => hacerAlgo()`).
Los 15 que sí tocan el objeto son la razón por la que el wrapper **deja `onClick`
como handler del DOM en vez de traducirlo**: `usePress` igual lo llamaría, pero
en el camino de teclado sintetiza un `MouseEvent`, que **pierde `currentTarget` y
deja `detail` en 0**. Encadenarlo detrás del handler de React Aria mantiene los
418 idénticos y conserva el bookkeeping de press.

| Qué usan | n | Sitios |
|---|---|---|
| `preventDefault` | 6 | `ChannelManagementModerationActions:134`, `JoinPolicyNotice:72` y `:86`, `MergePullRequestButton:215`, `ProjectCards:421`, `SidebarProjectsSection:422` |
| `stopPropagation` | 4 | `AddMemberSearchResultRow:78`, `ChannelBrowserDialog:819`, `UserProfilePanelTabs:638`, `ProjectListRowMenu:21` |
| ambos | 1 | `DraftsPanel:174` |
| `currentTarget` | 1 | `AgentsView:140` |
| lo reciben y lo pasan | 3 | `ThreadViewModeToggle:66` (`event.detail`), `HuddleProfileControl:160`, `sidebar.tsx:402` |

Los dos que fuerzan la decisión:

- **`AgentsView:140` hace `openAiDefaults(event.currentTarget)`** — ancla un
  popover al botón. Con el evento sintético `currentTarget` viene `undefined`.
- **`ThreadViewModeToggle:66` lee `event.detail`** para distinguir activación por
  teclado (`detail === 0`) de click, que es justo la distinción que el evento
  sintético borra.

Y los `preventDefault` dentro de `AlertDialogAction`/`AlertDialogCancel` no son
cosméticos: cancelan el cierre automático del diálogo, y solo funcionan mientras
el handler del caller y el de Radix compartan el mismo objeto de evento.

Nada de esto lo ve typecheck ni build. Está cubierto por un test que dispara un
`MouseEvent` real y assertea `currentTarget`, `detail`, `preventDefault` y
`stopPropagation`.

### Lo que queda afuera

`isPending` — la única capacidad nueva que trae HeroUI — no se expone todavía:
ningún sitio la usa, y agregar API sin consumidores es lo mismo que se objetó de
las props `asChild` muertas de `sidebar.tsx`. Está a una prop de distancia
cuando haga falta.

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

## 6quinquies. Los componentes de chat de Pro — auditados contra `dist`

Resultado de la evaluación del núcleo del chat (`features/messages`,
`features/chat`). Nueve componentes de Pro evaluados, **cero adoptados**. Los
motivos no son de esfuerzo: son estructurales y cada uno se verificó contra el
paquete instalado (`@heroui-pro/react@1.0.0-beta.8`), no contra la doc.

### La causa raíz, que se repite componente por componente

Dos cosas, y las dos ya estaban dichas en otras partes de este documento:

1. **La categoría "AI" de Pro modela un transcript de asistente; esto es un chat
   de equipo entre humanos.** `ChatMessage` solo tiene `--user` (burbuja a la
   derecha) y `--assistant` (avatar + cuerpo): un modelo de **dos partes**, sin
   concepto de tercer participante, agrupación de mensajes consecutivos, hilos
   ni filas de sistema.
2. **El modelo de foco de esta app es el que §6ter ya documentó**: el caret se
   queda en un input mientras el overlay se abre, y la navegación va por
   `aria-activedescendant`. Los componentes de colección y de overlay de React
   Aria no pueden expresar eso. Todo lo de Pro que sea colección (`ListBox`,
   `Select`) o popover hereda el mismo bloqueo.

### Componente por componente

| Componente | Veredicto | Motivo verificado |
|---|---|---|
| `chat-list-view` | **Descartado** | No es una lista virtualizada — ver la fila de `virtua` en §3. Para las filas de picker (`NewMessageScreen`, `DraftsPanel`) tampoco entra: `NewMessageScreen` navega con `aria-activedescendant` y el foco **dentro del input** de búsqueda (`role="listbox"` en el contenedor, `role="option"` + `tabIndex={-1}` en las filas), y una colección de RAC quiere el foco adentro; las filas de `DraftsPanel` anidan botones de acción (editar/borrar/enviar) que un item de colección no puede hospedar. |
| `prompt-input` | **Descartado** | Es un `TextArea` de HeroUI con cáscara (`value: string`). Adoptarlo borra menciones, emoji custom, spoilers, code blocks, ida y vuelta a markdown y nodos de link a mensajes. |
| `chat-message` / `chat-conversation` | **Descartado** | `ChatMessage` es el modelo de dos partes de arriba. `ChatConversation` es un `div` con `overflow-y-auto`, un ancla de scroll y una máscara de degradado: **sin virtualización**, y pelearía con `useAnchoredScroll`. |
| `chat-message-actions` | **Descartado** | Su CSS completo es una regla: `@apply flex items-start`. `MessageActionBar` son 552 líneas de menú con permisos y manejo de foco. |
| `chat-attachment` | **Descartado** | Miniatura de 64px + tarjeta de archivo + quitar. `ComposerAttachments` (831 líneas) tiene anotación de imágenes, spoilers, revert, spoilers de video, progreso de subida y tarjetas de snapshot. |
| `chat-loader` | **Descartado** | `ChatLoader.Dots` dice *que* algo carga; `TypingIndicatorRow` dice **quién** (avatares apilados + nombres). Y `ChatLoader.Skeleton` es un bloque fijo, mientras `TimelineSkeleton` cachea la forma de las filas en `localStorage` (`buzz-timeline-skeleton-shape.v1`) para imitar la conversación real. |
| `chat-source` | **Descartado** | Trae favicons desde `google.com/s2/favicons`: **pedido externo bajo el CSP de Tauri, y le filtra a un tercero qué links ve el usuario.** Eso solo ya lo saca, sin evaluar el resto. |
| `emoji-reaction-button` | **Descartado** | Era el mejor calce y se falsificó empíricamente. `filterDOMProps` **descarta `title`** (el nombre del emoji) y el componente no tiene prop `render` como escotilla. Su CSS trae `[data-readonly=true]{pointer-events:none}`, o sea que `isReadOnly` **recrea** el hack del `<span>` que se quería eliminar. Su estado seleccionado resuelve de `--accent` (necesita `HERO_ACCENT_SCOPE`) y su geometría `--md` hay que pisarla. Ganancia neta después de todo eso: una animación de press. |
| `hover-card` | **Descartado**, y es el que más dolía | Hay **seis** implementaciones a mano del mismo patrón (`DEFAULT_POPOVER_HOVER_OPEN_DELAY_MS` + timer de cierre): `MessageReactions`, `ChannelActivityPopover`, `UserProfilePopover`, `BotActivityBar`, `PubKey`, `InlineEmojiPopover`. Pro lo trae con `openDelay`/`closeDelay` y hasta resuelve el Escape de §6ter con un listener a nivel `document`. Pero pasa `isNonModal: true` a `Popover` de RAC, y con eso `usePopover` le da `onClose: state.close` a `useOverlayPosition`, que **sí** importa `useCloseOnScroll`. O sea: el hover card se cierra cuando scrollea cualquier ancestro del trigger — y casi todos estos sitios viven dentro del timeline, que auto-scrollea al llegar un mensaje. |
| `emoji-picker` | **Descartado** | Es un `Select` + `ListBox` + `Popover` de RAC: **es dueño del foco y del teclado**, contra el contrato del composer (`ComposerEmojiPicker` hace `onOpenAutoFocus={e => e.preventDefault()}` y un `MutationObserver` que le da el foco al input de búsqueda en shadow DOM). Además habría que reconstruir la capa de datos de emoji-mart: `buildCustomEmojiCategory(useCustomEmoji())` mete los **emoji custom del relay**, y la selección se normaliza para que resuelvan a `emojiUrl`. |
| `drop-zone` | **Descartado** | `DropZone` de RAC está construido sobre el sistema de drag-and-drop de React Aria; el composer necesita `File` crudos de un drag del sistema operativo y usa un contador de profundidad (`dragDepthRef` en `useMediaUpload`) para el problema clásico de `dragenter`/`dragleave` anidados. Es reescribir algo que funciona por equivalente. |
| `text-shimmer` | **Descartado** | `shared/ui/Shimmer` son 26 líneas y hace lo mismo. |

### Correcciones a datos que circularon durante este trabajo

- **§6ter sigue en pie, con una atribución corregida.** El cierre por scroll del
  popover no-modal es real en `react-aria@3.51.0`, pero **no** está cableado en
  `usePopover.mjs` como decía el texto: `usePopover` le pasa
  `onClose: isNonModal && !isSubmenu ? state.close : null` a
  `useOverlayPosition`, y es **ese** el que importa `useCloseOnScroll`. La otra
  mitad (`isDismissable: !isNonModal || isSubmenu`) está donde decía.
- **Todos estos componentes se exportan desde la raíz del paquete.** Se verificó
  con resolución real y con `tsc --noEmit`, no por `grep` de nombres:
  `dist/index.d.ts` es un barrel de tres líneas (`export * from "./components"`),
  así que buscar el nombre ahí da cero y **es un falso negativo**. Aplica a
  `ChatListView`, `DropZone`, `EmojiPicker`, `EmojiReactionButton`, `EmptyState`,
  `HoverCard` y `TextShimmer`. Solo son subpath-only las entradas que el MCP
  lista **con** una ruta (`rich-text-editor`, `code-block`, `markdown`, …).

### Lo que sí queda como trabajo

El hueco de los seis hover cards a mano es real y sigue abierto — pero el motor
correcto es Radix, no Pro, por el cierre-por-scroll. Un wrapper propio en
`shared/ui/` que encapsule el par de timers valdría la pena; no es parte de esta
migración.

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
