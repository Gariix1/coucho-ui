# Coucho UI — referencia UX de Control

Mockup HTML/CSS/JavaScript de la experiencia **Control** de Coucho: Couchsets, pantallas, apps, atajos, ajustes y movimiento. **No es la app Windows ni el diseño de Hop.** Los estados de hardware, errores y persistencia son simulaciones.

## Documentación

**[Experiencia de Control](docs/experience.md)**: un solo documento para pantallas, flujos, borradores, persistencia de la demo, Morph/FLIP, microinteracciones, accesibilidad y pruebas.

## Ejecutar las pruebas

Node.js 22+:

```sh
node --experimental-default-type=module --test tests/*.test.mjs
node tests/browser-smoke.mjs
node tests/control-journey.mjs
```

El mockup no utiliza frameworks para la animación. La referencia visual real es el comportamiento de `main`; para comparar un cutover concreto, fijar el SHA de este repositorio.

## Relación con Coucho nativo

La integración ocurre en [coucho](https://github.com/Gariix1/coucho): WinUI 3 conserva la experiencia observable y reemplaza simulaciones por owners reales de Windows, configuración, displays, apps, sesiones y recuperación.

Adaptaciones permitidas por integridad: guardado explícito con CAS, un ContentDialog nativo de Apps y un único editor del atajo Hop en Atajos. Nunca copiar `localStorage`, un laboratorio ficticio ni el JSON demo como backend de producción.

Las animaciones deben seguir siendo **fluidas, satisfactorias y visualmente refinadas**. Mejorar el rendimiento significa optimizar su implementación, no degradar Morph, FLIP ni microinteracciones.
