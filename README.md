# Coucho UI — referencia UX de Control

Mockup HTML/CSS/JavaScript de la experiencia **Control** de Coucho: Couchsets, pantallas, apps, atajos, ajustes y movimiento. **No es la app Windows ni el diseño de Hop.** Los estados de hardware, errores y persistencia son simulaciones.

## Documentación

**[Experiencia de Control](docs/experience.md)**: un solo documento para pantallas, flujos, borradores, persistencia de la demo, Morph/FLIP, microinteracciones, accesibilidad y pruebas.

## Ejecutar y probar

Requiere Node.js 22+, Python 3 y Chrome para las pruebas de navegador. Desde la raíz:

```sh
npm install --no-save playwright eslint globals
node --experimental-default-type=module --test tests/*.test.mjs
```

Para probar las interacciones, **mantén un servidor local abierto** en otra terminal:

```sh
python3 -m http.server 8123 --bind 127.0.0.1
```

Después ejecuta:

```sh
node tests/browser-smoke.mjs
node tests/control-journey.mjs
```

Ambas pruebas de navegador esperan `http://127.0.0.1:8123/`; sin servidor o Chrome fallarán por entorno, no necesariamente por lógica. Los pasos coinciden con [el workflow CI](.github/workflows/mockup-motion.yml).

El mockup no utiliza frameworks para la animación. La referencia visual real es el comportamiento de `main`; para comparar un cutover concreto, fijar el SHA de este repositorio.

## Relación con Coucho nativo

La integración ocurre en [coucho](https://github.com/Gariix1/coucho): WinUI 3 conserva la experiencia observable y reemplaza simulaciones por owners reales de Windows, configuración, displays, apps, sesiones y recuperación.

Adaptaciones permitidas por integridad: guardado explícito con CAS, un ContentDialog nativo de Apps y un único editor del atajo Hop en Atajos. Nunca copiar `localStorage`, un laboratorio ficticio ni el JSON demo como backend de producción.

Las animaciones deben seguir siendo **fluidas, satisfactorias y visualmente refinadas**. Mejorar el rendimiento significa optimizar su implementación, no degradar Morph, FLIP ni microinteracciones.
