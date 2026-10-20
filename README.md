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


## Relación con Coucho nativo

Este repositorio es la **referencia UX/visual** de Coucho Control, no la implementación de producción. El baseline utilizado por el cutover nativo está congelado en `main@25462f64698c56f8cf0229e4d753c30294b668af`.

La aplicación real se implementa en WinUI y sustituye el estado simulado del navegador por servicios nativos de configuración, displays, apps, shortcuts, recovery y Host. Cuando una diferencia sea necesaria para conservar integridad o semántica nativa —por ejemplo, guardado transaccional frente a autosave— debe registrarse como una decisión explícita, no copiarse el comportamiento web a ciegas.

El estado de la integración se mantiene únicamente en el tracker temporal del repositorio nativo de Coucho; este mockup conserva el contrato de experiencia y su documentación de diseño.
