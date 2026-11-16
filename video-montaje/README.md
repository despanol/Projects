# Video de montaje: una solución de datos, pieza por pieza

Animación 3D de 36 s (1920×1080, 30 fps) que arma en seis pasos lo que hago:
fuentes de datos → conciliación bancaria → automatización → estadística → programación → tableros.

El video final está en [`out/montaje-datos.mp4`](out/montaje-datos.mp4).

## Cambiar textos (nombre, contacto, lema)

Editar `src/config.js` y volver a renderizar. Si `nombre` y `contacto` quedan vacíos, el cierre muestra solo el lema y los servicios.

## Comandos

```bash
npm install
npm run preview   # ver la animación en el navegador (http://127.0.0.1:5173)
npm run render    # genera out/montaje-datos.mp4 (necesita Playwright + Chromium y ffmpeg)
node render.mjs --stills 10.8,26.9   # cuadros sueltos para revisar, en out/stills/
```

## Estructura

- `src/main.js` — escena (Three.js), piezas, cámara, rótulos y línea de tiempo (`T` y `CAM`).
- `src/config.js` — textos editables.
- `render.mjs` — captura cuadro por cuadro en Chromium headless y codifica con ffmpeg.

Los datos que aparecen (extracto, libro mayor, indicadores del tablero) son de ejemplo.
