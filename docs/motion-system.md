# Coucho UI — sistema de movimiento

Este mockup debe sentirse como **un espacio continuo**, no como varias pantallas que se reemplazan. El movimiento tiene una función: revelar causalidad, mantener la posición mental del usuario y confirmar acciones.

## Componentes reutilizables

| Pieza | Archivo | Responsabilidad |
| --- | --- | --- |
| Parámetros compartidos | `js/motion-settings.js` | Duraciones, curvas, movimiento reducido y tokens CSS. |
| Transición conectada | `js/motion.js` | Dos snapshots que viajan por el mismo rectángulo y se cruzan visualmente durante el recorrido. |
| Ajuste de layout (FLIP) | `js/layout-motion.js` | Mover hermanos cuando un Couchset se expande o cuando cambia la densidad; tamaño animado opcional. |
| Coordinador | `js/motion-transaction.js` | Capturar -> mutar -> acomodar layout -> ejecutar las superficies -> limpiar siempre. |
| Microinteracciones | `js/ui/interaction-motion.js` | Feedback de puntero/teclado, confirmación sutil y aparición de avisos. |
| Estilos de transición | `css/ui/motion.css` | Snapshots y ocultación del destino real mientras se ejecuta la transición. |

## Principios

1. **Una transformación, un recorrido.** No animar primero una copia vacía y pegar la vista nueva después. Origen y destino comparten trayectoria, duración y easing.
2. **El entorno responde a la causa.** Capturar posiciones *antes* de rerenderizar y aplicar FLIP *después*. Los hermanos se recolocan con la superficie activa.
3. **Una curva compartida.** FLIP y Morph utilizan una duración y un easing común por transacción, incluyendo cambios entre dos Couchsets abiertos.
4. **Reacción inmediata.** Los botones responden al contacto y se liberan al soltar o cancelar. La pulsación nunca cambia el layout.
5. **Celebración proporcional.** Crear o activar un modo puede generar un pulso sutil. Ninguna celebración bloquea la siguiente acción.
6. **Un único dueño de cada recurso.** El coordinador cancela snapshots, animaciones y scroll anchoring en `finally`; no añadir timers sueltos por pantalla.
7. **Accesible.** `prefers-reduced-motion` omite trayectorias y efectos; el estado final sigue siendo funcional.

## Cómo conectar una nueva transición

```js
await runMotionTransaction({
  root:document.querySelector('#modeList'),
  surfaces:[{
    source:elementoOriginal,
    destination:()=>document.querySelector('#destino'),
    direction:'open' // o 'close'
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

- `source` se captura **antes** de `mutate`.
- `destination` se resuelve **después** del render (por eso conviene pasar una función).
- Para cambios de grid que alteran tamaños: `layout.animateSize = true`.
- Si solo cambian hermanos, omitir `surfaces`.
- Si no hay desplazamiento de hermanos, omitir `layout`.
- No crear copias nuevas de Morph/FLIP en `app.js`. Reutilizar el coordinador.

## Tiempos

Los valores se modifican en `js/motion-settings.js`. `installMotionTokens()` los comparte con CSS. Se pueden afinar en conjunto después de evaluar el recorrido completo: contacto -> apertura -> edición -> guardar -> cierre. Evitar constantes de duración dispersas.

## Verificaciones

Pruebas unitarias de geometría, transacciones, capas y pulsaciones sin dependencias externas:

```sh
node --experimental-default-type=module --test tests/*.test.mjs
```

Pruebas visuales manuales necesarias antes de fusionar:

- Abrir/cerrar un Couchset, y pasar entre Couchsets expandidos.
- Crear desde el escritorio y observar que la tarjeta nueva nace de la superficie expandida.
- Alternar densidad compacta/detallada y comprobar que los hermanos cambian de tamaño sin aparecer de golpe.
- Probar tema claro/oscuro, puntero, teclado y táctil.
- Cambiar de tamaño la ventana durante el Morph: ningún snapshot debe quedar huérfano ni el destino oculto.
- Activar `prefers-reduced-motion: reduce`: controles y navegación deben funcionar sin movimientos.
- Crear/activar un modo: feedback breve, sin bloqueos ni destellos finales.

## Alcance

Esta fase prioriza continuidad y arquitectura. No se agrega una biblioteca de animación externa ni se modifica `main` automáticamente.
