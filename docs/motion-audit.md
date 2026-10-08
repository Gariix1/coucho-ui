# Auditoría técnica de Motion — Coucho UI
Fecha: 2026-10-07  
Rama: `refactor/mockup-motion-cleanup-20261007`  
Objetivo: verificar conflictos y riesgos **antes** de las pruebas manuales del mockup.

## Hallazgos corregidos

| Gravedad | Hallazgo | Resolución |
| --- | --- | --- |
| Alta | Pulsación mantenida si se suelta el puntero fuera del documento | La liberación ahora escucha en `window`, identifica `pointerId` y responde también a `blur`/pestaña oculta |
| Alta | Dos Morph de cambio entre Couchsets podían solaparse sin prioridad explícita | Cada superficie recibe una capa; el modo entrante queda por encima del saliente |
| Alta | FLIP y Morph usaban curvas de easing distintas en el mismo cambio | Cada transacción comparte duración/easing para todos los desplazamientos |
| Media | El destino podía quedar oculto o los snapshots huérfanos si se ocultaba la pestaña | Cancelación idempotente y limpieza por `visibilitychange`, `resize` y `finally` |
| Media | El color de confirmación era cyan fijo | Se utiliza `var(--selected-border)`, dependiente del tema |
| Media | El Morph animaba `boxShadow` además de transformaciones | Trayectoria principal ahora anima `transform` y `opacity`, evitando repintados innecesarios por sombra |
| Baja | CSS residual de snapshots `hold` y `will-change` de propiedades no animadas | Reglas y pistas obsoletas eliminadas |
| Baja | Guardar después de prueba no tenía la misma confirmación visual | Unificado el pulso de confirmación de guardar/activar/crear |

## Comprobaciones superadas

- Sintaxis de **18 módulos JS y archivos de prueba**, y resolución de sus imports relativos: sin errores en la revisión estática.
- **10 hojas CSS** vinculadas, bloques equilibrados, sin IDs duplicados en `index.html`.
- Los **5 recorridos de UI** (densidad, abrir, cambiar, cerrar, crear) invocan `runMotionTransaction`, sin manejadores de Morph/FLIP separados en `app.js`.
- **8 casos de regresión** comprobados en el motor JavaScript, incluidos cancelación, capas, geometría y sincronización de movimiento.
- `main` no se modifica; cambios solo en la rama de refactorización/PR borrador.

## Pendiente — bloqueo de aprobación final

**No se ha ejecutado la aplicación completa en Chromium, Safari o Firefox.** El entorno de análisis no pudo descargar el repositorio para correr la interfaz en un navegador real. El análisis estático y las simulaciones no validan rendimiento GPU, estilo final o comportamiento visual en dispositivos.

Antes de fusionar:

1. Abrir/cerrar y cambiar rápidamente entre Couchsets; observar que contenido y contenedor recorren la misma trayectoria.
2. Alternar repetidamente entre densidad compacta y detallada; revisar deformación temporal de texto/bordes por escalado FLIP.
3. Crear modo, guardar desde prueba y activar; comprobar consistencia de pulso sin parpadeos.
4. Abrir/cerrar popovers, probar teclado, puntero y touch (incluida cancelación o salida de la ventana).
5. Cambiar tamaño de ventana y ocultar/regresar a la pestaña durante una transición; comprobar que no queda `inert` ni destinos invisibles.
6. Probar temas claro/oscuro y `prefers-reduced-motion`.
7. Revisar frame rate en dispositivo móvil: los snapshots con `backdrop-filter` y el escalado de tarjetas todavía requieren validación visual/performance.

## Ejecución local

```sh
node --experimental-default-type=module --test tests/*.test.mjs
```

**Resultado de esta auditoría:** aprobada la revisión estática y las pruebas simuladas; **pendiente aprobación visual/browser real**. Mantener el PR como borrador.
