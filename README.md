# Coucho UI

Mockup interactivo de Coucho Control: modos (Couchsets), pantallas, apps y atajos.

## Movimiento reutilizable

El mockup usa un sistema de transiciones conectadas, FLIP para el layout y microinteracciones para botones y confirmaciones. Las animaciones de abrir, cambiar, cerrar y crear modos comparten el mismo coordinador y los mismos parámetros.

- [Guía de motion design y API de los componentes](docs/motion-system.md)
- [Pruebas del sistema de movimiento](tests/motion.test.mjs)

Para ejecutar las pruebas, con Node.js 22+:

```sh
node --experimental-default-type=module --test tests/*.test.mjs
```

Se mantiene como HTML, CSS y JavaScript nativo, sin dependencia de frameworks para las animaciones.
