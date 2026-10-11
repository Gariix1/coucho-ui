# Coucho Control — referencia de experiencia (mockup HTML)

**Alcance**: **Control** únicamente. La pantalla controller-first de Hop NO forma parte de este mockup. Desde Control pueden configurarse preferencias relacionadas con Hop, pero esto no constituye un diseño de Hop.

**Objetivo**: validar en el navegador los flujos visibles del usuario antes de reproducirlos en WinUI 3. Mantener el motor nativo de Coucho (detección, identidades de hardware, perfiles, aplicación/verificación, recuperación, localización y almacenamiento) y portar **interacción y aspecto**, no simulaciones web o `localStorage`.

## Reglas de experiencia

- Una tarea frecuente debe resolverse en uno o pocos clics, con nombres cortos y controles convencionales.
- No usar explicaciones permanentes para compensar controles confusos.
- El comportamiento inseguro se evita antes de ejecutarse; solo confirmar si puede haber pérdida o sorpresa real.
- Una configuración **guardada** no está necesariamente **aplicada**. Nunca declarar «Activo» antes de verificar.
- La pantalla principal de cada tarea tiene una responsabilidad: **Modos** crea/aplica Couchsets; **Pantallas** consulta y modifica el escritorio actual; **Apps** administra aplicaciones y su visibilidad en Hop; **Ajustes** contiene preferencias de Control.
- No copiar las capas simuladas de detección/aplicación del mockup a la app nativa. En Windows sustituirlas por los contratos existentes de Orchestration.
- Modales comparten `js/ui/modal.js`; el editor contextual de pantallas/apps es un popover, no un nuevo modal de confirmación.
- El sistema de movimiento de `docs/motion-system.md` posee geometría y transiciones, sin animaciones superpuestas por característica.

## Estado y decisiones por vista

| Vista | Tarea directa | Estado vacío | Error principal | Recuperación |
| --- | --- | --- | --- | --- |
| Modos | Crear, editar, activar, probar, eliminar | «Crear tu primer Couchset» | Pantalla/app no disponible; prueba de aplicación fallida | Reintentar sin declarar éxito; conservar escritorio anterior |
| Pantallas | Identificar, editar selección y principal, probar | Ningún monitor detectado | Monitor requerido no disponible | Comprobar de nuevo; volver a aplicar el modo si corresponde |
| Apps | Añadir app gestionada, mostrar en Hop, quitar si no hay referencias | Biblioteca vacía; «Añadir app» | App no encontrada | Comprobar de nuevo; no prometer lanzamiento |
| Atajos Couchset | Elegir Guide + A/X/Y o Manual | Manual | Tecla ya asignada a otro Couchset | Mostrar propietario y exigir una tecla libre |
| Ajustes | Tema, idioma, comportamiento Control/Hop, restablecer | Valores predeterminados | Combinaciones inconsistentes (bandeja y segundo plano) | Normalizar valores; confirmar restablecimiento |
| Prueba segura | Probar cambios de pantallas y Couchsets | — | Fallo al aplicar o confirmación vencida | Restaurar automáticamente; «Reintentar» en simulación |

## Entorno de pruebas reproducible

En **Modos**, usa el icono de laboratorio de la barra lateral (no forma parte de la navegación de lanzamiento). Selecciona un escenario y pulsa **Probar**. La sesión de prueba conserva una copia temporal de Couchsets, biblioteca Apps y escritorio aplicado. **Salir de prueba** restaura esos datos, incluso tras recargar.

| Escenario | Qué probar |
| --- | --- |
| Normal | CRUD habitual, guardado vs aplicado |
| Primer uso | Sin Couchsets ni apps → añadir app → crear Couchset → activar |
| Sin pantallas | Estado vacío → comprobar de nuevo |
| TV desconectada | Pantalla «No detectada» → activar Películas → error → reintentar |
| App no encontrada | Steam «No encontrada» en Apps → comprobar |
| Error al aplicar | Activar Películas → no confirmar éxito → reintentar |

Los escenarios simulan las **respuestas que podría dar el motor**, no el estado físico del PC. Los números de identificación se muestran **solo en la página**. Ninguna acción del mockup configura Windows ni detecta instalaciones reales.

## Contrato de validación y persistencia

- `js/features/shortcut-validation.js` controla duplicados de atajos y configuraciones de pantallas válidas.
- `js/data/session-store.js` almacena el escritorio aplicado separadamente de los Couchsets.
- `js/demo/scenarios.js` es el proveedor intercambiable de errores de demostración y estados sin hardware.
- `js/ui/modal.js` posee focos, teclado y exclusión del fondo durante confirmaciones y pruebas.
- `js/features/apps.js` administra el catálogo y detecta apps referenciadas; `js/app.js` conecta las operaciones de Modos/Pantallas.
- Un borrador nuevo sin guardar pide decisión al cerrar; eliminar/restablecer exige confirmación; cancelar no cambia los datos.

## Pruebas antes de considerar la maqueta cerrada

- `node --experimental-default-type=module --test tests/*.test.mjs`
- `node tests/browser-smoke.mjs` — CRUD, cambios de pantalla, modales, motion, ajustes y recarga.
- `node tests/control-journey.mjs` — primer uso, simulación de desconexión, app ausente, recuperación, fallo y conflicto de atajos.
- Revisar visualmente en Chrome, Safari y Firefox, teclado, toque, DPI, movimiento reducido y modo claro. GitHub CI actualmente usa Chrome; **no equivale a validación multiplataforma/nativa**.

## Antes de portar a Coucho WinUI

- Confirmar aquí cada estado que se enseña con datos reales del motor: detectado/no detectado, app disponible, aplicado/pendiente y restaurado.
- Mapear los controles a sus servicios existentes y verificar que los efectos secundarios (lanzar app, recuperar escritorio) respeten el contrato real del repositorio.
- Copiar comportamiento de Modos, Apps, Pantallas, Ajustes, primeros usos y errores desde la especificación, sustituyendo estados simulados por resultados verdaderos.
- Conservar documentación de diferencias inevitables entre DOM/CSS y WinUI/Composition; no reinterpretar el diseño sin aprobarlo.
