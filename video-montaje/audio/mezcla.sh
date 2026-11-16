#!/bin/bash
# Arma la pista de efectos y la monta sobre el video: out/video-sin-audio.mp4 -> out/montaje-datos.mp4
# Los efectos de audio/sfx son los mismos del video de posicionamiento (librería @remotion/sfx, remotion.media).
# Los tiempos (en segundos) siguen la línea de tiempo `T` de src/main.js.
set -e
cd "$(dirname "$0")/.."
S=audio/sfx; IN=(); F=""; MIX=""; N=0
sfx() { # archivo volumen_dB tiempos...
  local f=$1 v=$2; shift 2
  for t in "$@"; do
    IN+=(-i "$S/$f.wav"); F+="[$N:a]aresample=48000,volume=${v}dB,adelay=$(awk "BEGIN{printf \"%d\", $t*1000}"):all=1[s$N];"; MIX+="[s$N]"; N=$((N+1))
  done; }
sfx whoosh -14 1.0                                   # base
sfx whoosh -17 3.2 3.62 4.04;  sfx switch -8 4.0 4.42 4.84          # 01 discos: entran y encajan
sfx whoosh -16 6.6 7.1;        sfx page-turn -12 7.35 7.85          # 02 hojas
sfx mouse-click -8 8.3 8.72 9.56 9.98 10.4; sfx ding -19 9.14       #    partidas conciliadas + diferencia
sfx whoosh -16 11.6;           sfx switch -8 12.4 12.8 13.2         # 03 engranajes
sfx whoosh -16 15.1;           sfx mouse-click -19 15.7 15.82 15.94 16.06 16.18 16.3 16.42 16.54 16.66  # 04 barras
sfx whoosh -21 17.1                                                 #    curva
sfx whoosh -16 19.2                                                 # 05 terminal
sfx mouse-click -23 20.2 20.36 20.52 20.68 20.84 21.0 21.16 21.32 21.48 21.64 21.8 21.96 22.12  # tipeo
sfx ding -21 22.35
sfx whoosh -16 23.2 23.9;      sfx switch -8 24.0 25.0              # 06 tablero
sfx whoosh -14 27.2;           sfx mouse-click -16 28.8 28.92 29.04 29.16 29.28 29.4   # flujo y etiquetas
sfx whoosh -14 31.2 33.7;      sfx ding -13 34.5                    # lema y marca
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/video-sin-audio.mp4)
ffmpeg -y -loglevel error "${IN[@]}" -filter_complex "${F}${MIX}amix=inputs=${N}:normalize=0,alimiter=limit=0.89,apad[out]" \
  -map "[out]" -t "$DUR" -ac 2 -c:a pcm_s16le out/efectos.wav
ffmpeg -y -loglevel error -i out/video-sin-audio.mp4 -i out/efectos.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -movflags +faststart out/montaje-datos.mp4
rm -f out/efectos.wav
echo "Listo: out/montaje-datos.mp4"
