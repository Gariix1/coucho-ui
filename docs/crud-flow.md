# Coucho UI — CRUD y persistencia de la demo

Regla: **guardar un Couchset no equivale a aplicar su configuración al escritorio**.

## Estados y fuente de verdad

| Datos | Fuente | Compromiso |
| --- | --- | --- |
| Couchsets (nombre, app, pantallas, atajo, activo) | `coucho-test-sets` | Guardado inmediatamente en el navegador |
| Escritorio aplicado | `coucho-applied-session-v1` | Independiente del modo; persiste cuando el usuario conserva cambios |
| Apps gestionadas y visibilidad en Hop | `coucho-apps-demo-v1` | Guardado inmediato; catálogo usado también en el selector de Modos |
| Preferencias y tema | `coucho-settings-preview-v1`, `coucho-theme` | Guardado automático |
| Densidad de tarjetas | `coucho-card-density` | Guardado automático |
| Borrador de nuevo modo | Memoria | No se crea hasta Guardar; pedir confirmación si se descarta |
| Prueba provisional de pantallas | Memoria | Conservar o restaurar, también al vencer el plazo |

**Los datos son simulados:** ninguna operación de este prototipo modifica pantallas de Windows, aplicaciones instaladas ni el Hop nativo.

## Contrato de interacción

- **Crear Couchset:** editar borrador → Guardar. Si intenta cerrarse, cambiarse de tarjeta o navegar con cambios, ofrecer Cancelar / Descartar. Al recargar con borrador, usar la advertencia nativa del navegador.
- **Editar Couchset existente:** auto-guardar los campos; la tarjeta muestra `Pendiente` cuando el Couchset activo difiere del escritorio aplicado. El botón `Aplicar` permite volver a aplicarlo.
- **Eliminar Couchset:** modal para no activos. El activo no puede eliminarse sin activar primero otro, evitando elegir un modo sustituto de manera silenciosa.
- **Editar escritorio:** elegir pantallas/primaria → Probar → Conservar/Restaurar. Guardar la sesión aplicada sin modificar el Couchset. Validar la sesión almacenada al cargar y rechazar identificadores inválidos u obsoletos.
- **Apps:** añadir/quitar ejemplos y alternar visibilidad inmediatamente. No quitar apps referenciadas por un Couchset. El selector de Modos muestra únicamente apps gestionadas más cualquier selección legada existente.
- **Ajustes:** preferencias inmediatas; Restablecer pide confirmación y no borra modos, apps ni escritorio.
- **Vaciar/Restaurar modos de ejemplo:** modal antes de mutar; limpiar tareas de activación pendientes; no alterar biblioteca ni ajustes.

## Pruebas automáticas

- `tests/session-store.test.mjs`: persistencia independiente, datos inválidos, modo retirado.
- `tests/apps.test.mjs`: biblioteca, visibilidad, dependencias y normalización.
- `tests/settings.test.mjs`: preferencias y restricciones de Hop.
- `tests/browser-smoke.mjs`: todo lo anterior en Chrome, incluida recarga, confirmaciones destructivas, borradores, restauración, integración Apps/Modos y estados Pendiente/Activo.

`docs/motion-system.md` es la referencia de transiciones. CRUD no debe crear animaciones nuevas; reutiliza el coordinador existente.
