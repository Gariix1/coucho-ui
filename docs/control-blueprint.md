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
- En el prototipo, modales comparten `js/ui/modal.js` y el editor contextual de pantallas/apps es un popover. En Control WinUI, **Apps** puede usar un único `ContentDialog` no-light-dismiss cuando sea necesario para coordinar borrador, foco y picker nativo; esa adaptación no autoriza un segundo editor ni otra ruta de persistencia.
- El sistema de movimiento de `docs/motion-system.md` posee geometría y transiciones, sin animaciones superpuestas por característica.

## Estado y decisiones por vista

| Vista | Tarea directa | Estado vacío | Error principal | Recuperación |
| --- | --- | --- | --- | --- |
| Modos | Crear, editar, activar, probar, eliminar | «Crear tu primer Couchset» | Pantalla/app no disponible; prueba de aplicación fallida | Reintentar sin declarar éxito; conservar escritorio anterior |
| Pantallas | Identificar, editar selección y principal, probar | Ningún monitor detectado | Monitor requerido no disponible | Comprobar de nuevo; volver a aplicar el modo si corresponde |
| Apps | Añadir app gestionada, mostrar en Hop, quitar si no hay referencias | Biblioteca vacía; «Añadir app» | App no encontrada | Comprobar de nuevo; no prometer lanzamiento |
| Atajos Couchset | Elegir LB + RB + A/X/Y o Manual | Manual | Combinación ya asignada a otro Couchset | Mostrar propietario y exigir una combinación libre |
| Ajustes | Tema, idioma, comportamiento Control/Hop, restablecer | Valores predeterminados | Combinaciones inconsistentes (bandeja y segundo plano) | Normalizar valores; confirmar restablecimiento |
| Prueba segura | Probar cambios de pantallas y Couchsets | — | Fallo al aplicar o confirmación vencida | Restaurar automáticamente; «Reintentar» en simulación |

## Entorno de pruebas reproducible

El laboratorio se abre desde la barra lateral de Control y permanece accesible en cualquier sección. Selecciona un escenario y pulsa **Probar**. Sus cambios viven exclusivamente en el almacenamiento de esa pestaña: los Couchsets, apps, preferencias, tema y escritorio normales no se modifican. **Salir de prueba** vuelve a los datos originales. Cerrar una pestaña de prueba tampoco altera los datos normales.

| Escenario | Qué probar |
| --- | --- |
| Normal | CRUD habitual, guardado vs aplicado |
| Instalación limpia | Sin datos iniciales, creación del primer Couchset y apps detectadas disponibles para añadir |
| Primer uso | Sin Couchsets ni apps → añadir app → crear Couchset → activar |
| Sin pantallas | Estado vacío → comprobar de nuevo |
| Pantalla nueva | Nuevo monitor detectado → seleccionar/identificar → probar → conservar/descartar |
| Cambio externo de pantallas | Observación distinta del Couchset aplicado → estado de escritorio observado → reaplicar sin sobrescribir el Couchset |
| Pantalla sin identificar | Bloquear aplicación insegura → identificar/comprobar → reintentar |
| TV desconectada | Pantalla «No detectada» → activar Películas → error → reintentar |
| App no encontrada | Steam «No encontrada» en Apps → comprobar |
| Error al aplicar | Activar Películas → no confirmar éxito → reintentar |
| Aplicación parcial | No declarar completado, pedir comprobación |
| Restauración fallida | Advertencia de resultado sin verificar, acceso a Pantallas; no marcar rollback exitoso al pulsar «Revisar» |

Los escenarios simulan las **respuestas que podría dar el motor**, no el estado físico del PC. Los números de identificación se muestran **solo en la página**. Ninguna acción del mockup configura Windows ni detecta instalaciones reales.

## Flujos cerrados de Control

- **Primer arranque real**: sin Couchsets ni apps gestionadas precargadas. Aparecen «Crear tu primer Couchset» y apps **Encontradas** (datos de ejemplo, no detección de Windows).
- **Apps**: apps detectadas de demostración, gestionadas y añadidas manualmente. Un Couchset muestra el nombre real de la app propia, no su identificador. Las apps referenciadas no se pueden quitar silenciosamente.
- **Pantallas**: nueva pantalla y pantalla sin identificar, selección de pantalla principal, pruebas reversibles, mensajes «No detectada», «Nueva» o «Sin seleccionar», sin confundir esto con monitor físicamente apagado. Alias local persistente con modelo y resolución/Hz visibles; el alias no modifica la identidad ni los datos físicos.
- **Escritorio actual**: proyección de una observación simulada aun sin Couchset activo. El laboratorio permite distinguir un cambio externo de una modificación guardada del Couchset. En la aplicación Windows se utilizarán observaciones frescas del subsistema Displays.
- **Creación**: «Crear Couchset» permanece visible junto a «Escritorio actual», y comparte el editor existente con la expansión contextual.
- **Recuperación**: éxito, error, aplicación parcial y restauración sin verificar son estados distintos. Un resultado incierto muestra «Estado sin verificar» y lleva a Pantallas para revisar antes de cualquier reintento; nunca se convierte en éxito por pulsar «Comprobar». Ningún resultado de demostración sustituye el contrato nativo de journals/rollback.
- **Ajustes**: español e inglés como **vista previa de localización HTML**. El resto de idiomas siguen siendo responsabilidad de la implementación real; no presentar opciones inertes en el mockup.
- **Configuración portable**: importar/exportar y confirmar el reemplazo de contenido mediante `coucho-control-demo.json`, formato exclusivo del prototipo; **no es** el `.coucho` nativo (format version 2).

## Contrato de validación y persistencia

- `js/features/shortcut-validation.js` controla duplicados de atajos y configuraciones de pantallas válidas. Los presets Couchset usan `LB + RB + A/X/Y`: conservan la intención de «modificador + face button» del diseño original usando únicamente estado de gamepad observable de forma fiable por el runtime nativo. `Guide` queda fuera de estos presets mientras la capa administrada actual no exponga identidad y estado press/release suficientes para varios mandos.
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

## Relación con perfiles nativos

Control nativo utiliza Display Profiles y App Profiles reutilizables. El mockup mantiene la selección sencilla de pantallas y apps por Couchset como flujo visible. Antes de integrar cada editor WinUI, mapear su intención a perfiles existentes o a la creación de un perfil propio sin alterar silenciosamente otro Couchset que comparte ese perfil. En el HTML no se simulan identidades físicas, reconciliación de perfiles ni archivos `.coucho` nativos.

## Antes de portar a Coucho WinUI

- Confirmar aquí cada estado que se enseña con datos reales del motor: detectado/no detectado, app disponible, aplicado/pendiente y restaurado.
- Mapear los controles a sus servicios existentes y verificar que los efectos secundarios (lanzar app, recuperar escritorio) respeten el contrato real del repositorio.
- Reproducir la experiencia de Modos, Apps, Pantallas, Ajustes, primeros usos y errores sustituyendo estados simulados por resultados verdaderos. Las diferencias nativas deliberadas —como Guardar transaccional en Couchsets existentes, el `ContentDialog` único de Apps y mantener la activación/combinación del shortcut global de Hop en el único editor de **Atajos** mientras `Ajustes > Hop` enlaza a él— conservan la intención del flujo y deben usar los owners reales de CAS/picker/foco/policy.
- Conservar documentación de diferencias inevitables entre DOM/CSS y WinUI/Composition; no reinterpretar el diseño sin aprobarlo.
