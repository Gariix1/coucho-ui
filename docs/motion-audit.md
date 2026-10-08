# Auditoría de interacciones y Motion — Coucho UI

Rama: `refactor/mockup-motion-cleanup-20261007`  
PR: https://github.com/Gariix1/coucho-ui/pull/1

## Causas raíz encontradas y corregidas

| Severidad | Problema real | Resolución arquitectónica |
| --- | --- | --- |
| Crítica | `#modeList` tenía `data-density` como estado, pero `target.closest('[data-density]')` interceptaba **todos los clics** del listado. Por eso no se abrían las tarjetas. | Separación estado/comando: el listado mantiene `data-density`, los botones usan `data-density-option`. Nuevo `closestWithin()` solo resuelve controles descendientes del contenedor. Pruebas de regresión de delegación. |
| Alta | `renderExpandedMode()` utilizaba `shortcutCardLabel` sin importarlo, y el flujo de prueba usaba `displayMarkup` sin importar. | Imports declarados y ESLint `no-undef` en CI para detectar futuros símbolos inexistentes. |
| Alta | El feedback de pulsación cambiaba el `transform` del propio botón, interfiriendo con `getBoundingClientRect()` al abrir «Escritorio actual». | Feedback compositado mediante filtro, sin cambiar la geometría que consume Morph/FLIP. |
| Alta | Los snapshots se insertaban en el contenedor `.main` con scroll, donde podían afectar área desplazable o recortarse. | Superficies fijas en coordenadas de viewport, fuera del scroll container. |
| Alta | La activación diferida podía rerenderizar durante un Morph en curso. | `createMotionScheduler()` retiene mutaciones hasta que la transacción libera el DOM; admite cancelación por clave. |
| Media | Cancelar feedback podía rechazar promesas `Animation.finished` sin manejar. | `startAnimation()` observa el ciclo de vida al crear cualquier microanimación y absorbe cancelaciones previstas. |
| Media | FLIP y Morph podían usar distintas curvas en la misma acción. | `runMotionTransaction()` define duración y easing compartidos por toda la coreografía. |
| Media | Morph concurrentes carecían de un orden de superposición explícito. | Prioridades de capa por superficie; la entrante se sitúa por encima de la saliente. |
| Media | Animaciones canceladas podían dejar el destino oculto o anclaje de scroll suspendido. | Limpieza idempotente por `finally`, `resize`, `visibilitychange` y `blur` en sus respectivos componentes. |
| Baja | Confirmation ring de color fijo, animación de sombra costosa y reglas antiguas de `hold`. | Tokens del tema, desplazamiento con transform/opacity y eliminación de reglas obsoletas. |

## Validación automatizada

En GitHub Actions se ejecuta `.github/workflows/mockup-motion.yml`:

1. ESLint con detección de variables no definidas y errores estructurales.
2. `node --experimental-default-type=module --test tests/*.test.mjs` — **17/17 casos correctos**.
3. `node tests/browser-smoke.mjs` sobre Chrome real en Linux — **sin errores**, con verificación de:
   - Pulsación sin modificar geometría
   - Abrir, cambiar y cerrar Couchsets
   - Editores rápidos de pantalla, app y atajo
   - Cancelación de eliminación
   - Densidad compacta y detallada
   - Crear un Couchset desde el escritorio
   - Activación diferida simultánea con Morph
   - Redimensionar durante Morph, movimiento reducido y ausencia final de snapshots/bloqueos

Ejecución validada: https://github.com/Gariix1/coucho-ui/actions/runs/37728934819

## Pendiente de aprobación visual

La automatización valida que las interacciones funcionan, pero **no demuestra que cada fotograma tenga la calidad visual deseada**. Antes de fusionar revisar a ojo:

- Curvas, desplazamiento de hermanos, sombras y crossfade a 60 Hz.
- Deformación temporal en cambios de densidad por FLIP.
- Temas claro/oscuro, resoluciones móviles, touch real, Safari y Firefox.
- Rendimiento de filtros Acrylic en dispositivos con GPU limitada.

**Estado:** resolución funcional verificada en Chrome y pruebas automáticas; revisión estética y multiplataforma pendiente. PR mantenido como borrador, `main` intacta.
