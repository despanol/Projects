# Video de montaje: una solución de datos, pieza por pieza

Animación 3D de 38,5 s (1920×1080, 30 fps, con efectos de sonido) que arma en seis pasos lo que hago:
fuentes de datos → conciliación bancaria → automatización → estadística → programación → tableros.

Videos finales: horizontal en [`out/montaje-datos.mp4`](out/montaje-datos.mp4) y vertical (1080×1920, para reels e historias) en [`out/montaje-datos-vertical.mp4`](out/montaje-datos-vertical.mp4).

## Cambiar textos (nombre, contacto, lema)

Editar `src/config.js` y volver a renderizar. Ahí están el lema, los servicios, la marca, el nombre, el rol, la web y el estilo del cierre (`escena` o `marca`).

## Comandos

```bash
npm install
npm run preview   # ver la animación en el navegador (http://127.0.0.1:5173)
npm run render    # genera out/montaje-datos.mp4 con efectos (necesita Playwright + Chromium y ffmpeg)
node render.mjs --formato vertical   # genera out/montaje-datos-vertical.mp4
bash audio/mezcla.sh   # solo rehace la pista de efectos sobre out/video-sin-audio.mp4
node render.mjs --stills 10.8,26.9   # cuadros sueltos para revisar, en out/stills/
```

## Estructura

- `src/main.js` — escena (Three.js), piezas, cámara, rótulos y línea de tiempo (`T` y `CAM`).
- `src/config.js` — textos editables.
- `render.mjs` — captura cuadro por cuadro en Chromium headless y codifica con ffmpeg.
- `audio/mezcla.sh` — tiempos y volumen de cada efecto; `audio/sfx/` son los mismos efectos del video de posicionamiento.
- `fonts/` — Inter y JetBrains Mono.

Los datos que aparecen (extracto, libro mayor, indicadores del tablero) son de ejemplo.
