# Coucho UI — sistema de movimiento

El sistema debe mantener continuidad espacial sin deformar texto, iconos o controles. Cada animación tiene **una propiedad de la que es responsable**, un ciclo de vida identificable y una limpieza propia.

## Contrato de propiedad

| Responsable | Propiedades / efectos que controla | Lo que NO debe hacer |
| --- | --- | --- |
| `js/motion.js` — *shell* | Un único rectángulo animado: `left`, `top`, `width`, `height` y `border-radius`. Recorta las capas internas. | Escalar el contenido o sus elementos descendientes. |
| `js/motion.js` — *content layers* | Opacidad de origen y destino. Ambos conservan sus dimensiones reales; el shell los va revelando. | Animar `transform`, tamaño, posición o clips independientes de la superficie. |
| `js/motion.js` — *portal* | Solo `translate3d` para seguir scroll de `.main` y ventana, con listeners propios. | Cambiar la animación geométrica ni bloquear el scroll de usuario. |
| `js/layout-motion.js` (FLIP) | Solo traducción de **elementos vecinos** mediante `transform` mientras cambia el layout. | Animar `scale` o cambiar la geometría interna de tarjetas. La tarjeta expandida está excluida. |
| `js/ui/interaction-motion.js` | Feedback de pulsación sin `transform`, feedback de éxito, entrada del toast. | Tocar el `transform` de una tarjeta o botón usado por Morph; interceptar el layout. |
| CSS de componentes | Estados `hover`/`focus`: colores, bordes y sombras. Microtransiciones visuales del propio control. | Animar la geometría que Morph/FLIP ya controla. |
| `js/motion-transaction.js` | Ordenar captura -> render -> FLIP y Morph simultáneos -> limpiar -> liberar bloqueo. | Lanzar segundas coreografías mientras existe una activa. |
| `js/motion-scheduler.js` | Retener renders diferidos que destruirían nodos animados. | Sobrescribir un DOM actualmente usado por otra transición. |

**Regla importante:** un efecto secundario visual puede ser deseable (el recorte natural del contenido mientras crece la superficie). No añadir otra animación para «corregirlo» sin revisar primero cuál de los componentes produce ese efecto.

## Estructura del Morph

```text
Portal fijo (sigue el scroll; no altera el layout)
└── Shell (posición + tamaño + radio; overflow:hidden)
    ├── Origen (tamaño original, opacity 1 → 0)
    └── Destino (tamaño final, opacity 0 → 1)
```

- El shell crece o se contrae físicamente; no utiliza `scaleX/scaleY`.
- Los elementos internos siempre se renderizan con su tamaño original o final, **sin escala intermedia**.
- `overflow:hidden` en el shell es responsable del recorte; no hay clips animados redundantes en sus hijos.
- El scroll cambia solo la posición global del portal. La geometría del shell sigue exactamente su línea de tiempo; al terminar coincide con el destino real.
- Al terminar, cambiar de pestaña o redimensionar, se cancelan los efectos y se elimina el portal, restituyendo la visibilidad del destino.
- El número de efectos por superficie es deliberado: **1 trayectoria geométrica y 2 opacidades**. El seguimiento del scroll es un ajuste de posición, no otra animación.
- `prefers-reduced-motion` evita la trayectoria sin impedir el render del estado final.

## Componentes reutilizables

| Módulo | Función |
| --- | --- |
| `js/motion-settings.js` | Duraciones, curvas, motion reducido, terminación y cancelación segura de WAAPI, tokens CSS |
| `js/motion-transaction.js` | Coordinación de Morph + FLIP |
| `js/motion.js` | Superficie conectada con shell y contenido sin distorsión |
| `js/layout-motion.js` | Recolocación (solo translate) de hermanos y anclaje de scroll |
| `js/motion-scheduler.js` | Evita renders tardíos dentro de una transición |
| `js/ui/interaction-motion.js` | Feedback de controles, éxito y avisos |
| `js/core/dom.js` | Eventos delegados acotados con `closestWithin()` |
| `css/ui/motion.css` | Apariencia, recorte y jerarquía de las capas temporales |

## Cómo conectar una transición

```js
await runMotionTransaction({
  root:document.querySelector('#modeList'),
  surfaces:[{
    source:elementoOriginal,
    destination:()=>document.querySelector('#destino'),
    direction:'open'
  }],
  layout:{
    anchorKey:'mode:1',
    excludeKeys:['mode:1'],
    scrollElement:document.querySelector('.main'),
    duration:MOTION_DURATION.open
  },
  onBusy:setModeTransitioning,
  mutate:()=>renderWorkbench()
});
```

- `source` debe existir antes de la mutación. Se mide antes del rerender.
- `destination` se resuelve después del render, y se mide una sola vez.
- Para cambios de densidad, el CSS calcula los tamaños finales y FLIP desplaza a los hermanos. **No añadir `animateSize` o `scale()`**.
- Los cambios de estado del contenedor (`data-density`) no son comandos de clic (`data-density-option`).
- Los cambios retrasados se coordinan mediante `createMotionScheduler()` si pueden coincidir con Morph.
- Para nuevos efectos, definir claramente qué capa posee la propiedad y comprobar que no pertenece a otra animación.

## Pruebas

```sh
node --experimental-default-type=module --test tests/*.test.mjs
```

`.github/workflows/mockup-motion.yml` ejecuta en cada cambio a `main`:
- ESLint para detectar referencias no definidas y conflictos estructurales.
- Pruebas unitarias de geometría, delegación, cancelación y coordinación.
- `tests/browser-smoke.mjs` en Chrome: abrir/cambiar/cerrar, densidad, editores, creación, activaciones concurrentes, scroll **durante** Morph, resize y movimiento reducido.
- Una aserción específica comprueba que la traslación del portal coincide con el scroll real y que los fotogramas internos no contienen `transform`.

## Alcance

La lógica de interacción y la nueva coreografía han sido validadas en Chrome automatizado. Sigue siendo necesaria la revisión visual subjetiva de las transiciones en hardware real, Safari, Firefox, pantallas móviles y tema claro. Se trabaja directamente en `main`, sin ramas nuevas.
