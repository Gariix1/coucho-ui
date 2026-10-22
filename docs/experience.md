# Coucho Control — experiencia y movimiento

**Alcance:** mockup de Control únicamente. Hop controller-first pertenece a la aplicación nativa y tiene diseño propio. Este documento describe lo observable del prototipo y la intención UX; no le atribuye acceso a Windows.

## Objetivo y principios

Control debe facilitar tareas comunes con pocos pasos, controles comprensibles, estados claros y transiciones visuales satisfactorias. Nunca esconder un fallo físico bajo una animación bonita.

- **Configuración guardada ≠ escritorio aplicado ≠ sesión verificada.**
- Crear, editar, guardar, probar, activar, cancelar y recuperar tienen resultados diferentes.
- Una opción imposible o peligrosa debe explicarse o bloquearse antes de ejecutar, no después.
- La sensación visual importa: fluidez, continuidad espacial, jerarquía, temas, foco y respuesta inmediata.
- El rendimiento se mejora sin eliminar las animaciones que hacen especial a Coucho.

## Secciones y recorridos

| Vista | Acciones visibles | Estados importantes |
| --- | --- | --- |
| Couchsets | Crear primer Couchset, elegir pantallas/apps/atajo, expandir, editar, probar, activar, eliminar. | Primer uso, vacío, listo, guardado no aplicado, aplicación parcial, recuperación. |
| Escritorio actual | Mostrar observación separada de Couchsets; usar como fuente para crear o editar. | Cambio externo, observación nueva, prueba pendiente. |
| Pantallas | Identificar, renombrar alias, configurar selección y principal, probar/Conservar/Restaurar. | No encontrada, sin identificar, desconectada, rollback incierto. |
| Apps | Encontradas, gestionadas, añadir, editar, visibilidad Hop, quitar con referencias. | Instalación ausente, app usada por Couchset, error de comprobación. |
| Atajos | Presets de Couchsets y manuales, resolver conflictos, acceso a Hop. | Duplicado, reservado, combinación no disponible. |
| Ajustes | General, apariencia, Hop, opciones avanzadas, restablecer. | Preferencias coherentes, diálogo de confirmación y resultado. |

### Flujos imprescindibles

1. **Primer uso:** sin Couchsets predefinidos → descubrir apps de ejemplo → crear Couchset → guardar → activar.
2. **Edición:** expandir una tarjeta → ajustar pantallas/app/atajo → comprobar el borrador → guardar o descartar.
3. **Probar borrador Couchset:** ensayo antes de guardar → observar cambios → Conservar o Restaurar; timeout restaura. En Windows debe funcionar también con sesión activa saludable.
4. **Pantallas:** escoger pantalla principal y disposición → probar → Conservar/Restaurar o vencer plazo.
5. **Errores:** app ausente, monitor perdido, pantalla sin identificar, fallo de aplicación, resultado parcial y restauración sin verificar. Informar el estado y ofrecer una acción segura.
6. **Cambios concurrentes y navegación:** no perder borradores silenciosamente ni activar vistas basadas en estados anteriores.

El mockup incluye un laboratorio de escenarios (primer uso, TV desconectada, nuevo monitor, apps ausentes, falla parcial y recovery), accesible en la UI. **Su función es simular resultados**, no controlar dispositivos reales.

## Persistencia del prototipo y adaptación nativa

Los datos HTML viven en `localStorage` o memoria del navegador. `js/data/session-store.js` separa escritorio aplicado y Couchsets; `js/features/apps.js` gestiona catálogo de ejemplo y referencias; `js/demo/scenarios.js` simula errores; `js/ui/modal.js` coordina foco y confirmación.

- En HTML, editar un Couchset existente puede auto-guardar. En **WinUI** el mismo recorrido usa **Guardar explícito** y revisión CAS, porque comparte perfiles y puede haber modificaciones concurrentes.
- El editor contextual de Apps puede materializarse como un **único ContentDialog WinUI** no light-dismiss, con borrador/picker/foco; no crear otro formulario ni pipeline de persistencia.
- Ajustes > Hop puede enlazar al editor autoritativo de **Atajos**, en vez de duplicarlo.
- El mockup exporta `coucho-control-demo.json`; Windows usa su formato `.coucho` y reconciliación real, no este JSON.
- Los presets de Couchset son `LB+RB+A/X/Y` en layout Xbox, es decir Shoulder izquierdo+derecho y cara South/West/North. No suponer Guide observable por dispositivo.

## Sistema de movimiento

**Objetivo:** Morph, FLIP y microinteracciones suaves, satisfactorias y consistentes. No sacrificar calidad por simplificar código; simplificar propiedad, ciclo de vida y uso de recursos.

| Componente | Propiedad |
| --- | --- |
| `js/motion.js` | Un shell temporal: posición, tamaño, border-radius y recorte. |
| Capas internas Morph | Opacidad cruzada; contenido con su tamaño real, **sin scale**. |
| `js/layout-motion.js` | FLIP: solo traslación de tarjetas vecinas; excluir la tarjeta expandida. |
| `js/motion-transaction.js` | Coordinar captura, mutación, Motion y limpieza como **una** transacción. |
| `js/motion-scheduler.js` | Diferir renders que desmontarían los nodos durante una transición. |
| `js/ui/interaction-motion.js` | Feedback visual de pulsación, foco, éxito, avisos, sin alterar la geometría de Morph. |
| CSS | Hover, foco, temas y microtransiciones de componentes que no compitan con otra coreografía. |

### Morph

Estructura conceptual:

```text
portal en viewport (sigue scroll)
└── shell: left/top/width/height/radius, overflow hidden
    ├── contenido origen: tamaño real, opacidad hacia 0
    └── contenido destino: tamaño real, opacidad hacia 1
```

El shell cambia tamaño y radio, **no escala** descendientes. El portal corrige posición al desplazar el scroll; no crea otra animación geométrica. Origen y destino conservan sus medidas reales. Al acabar o cancelar, se quita la capa temporal y se devuelve opacidad/foco. Reducir movimiento debe mostrar el estado final completo sin trayectoria.

### FLIP y feedback

Las tarjetas vecinas traducen desde su ubicación previa hasta la nueva. No animar `scale`, tamaño de contenido o nuevas geometrías independientes para corregir defectos de Morph. La curva y duración de la coreografía son compartidas. Hover/pulsación no deben alterar el `transform` de elementos cuyos rectángulos serán medidos para conectar superficies.

### Rendimiento y accesibilidad

- Una sola operación dueña de cada propiedad animada; evitar dos Morph simultáneos sobre la misma vista.
- No recrear nodos usados por Motion; cancelar y limpiar al navegar, redimensionar, perder foco o terminar.
- Respetar `prefers-reduced-motion` en HTML y las preferencias equivalentes del sistema en WinUI.
- Probar scroll durante Morph, cambio de densidad, entrada/salida, cancelación y teclados.
- En WinUI priorizar composición cuando reproduzca la misma estética, reducir trabajo de layout por frame y comprobar fluidez real con distintos DPI/equipos.

**No aprobar paridad visual solo por tests de JavaScript.** Se necesita revisión subjetiva del movimiento nativo, además de medir rendimiento y comprobar recuperación.

## Comprobación del mockup

```sh
node --experimental-default-type=module --test tests/*.test.mjs
node tests/browser-smoke.mjs
node tests/control-journey.mjs
```

Estos comandos corresponden al proyecto HTML; no prueban Windows. El navegador automatizado puede detectar errores de lógica, regresiones de DOM, scroll/Morph y limpieza. Revisar visualmente en los navegadores y tamaños admitidos cuando se modifique diseño.

## Fuente vigente y finalización

Código en `js/`, `css/`, `index.html` y tests define el comportamiento actual. Este documento ofrece navegación y criterio UX, **no prevalece automáticamente sobre el código si se descubre un texto obsoleto**. La implementación nativa debe comparar recorridos, preservar el diseño y sustituir solo las simulaciones por servicios reales. Su aceptación final se gestiona en el PR de cutover del repositorio coucho.
