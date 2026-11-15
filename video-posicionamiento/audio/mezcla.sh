#!/bin/bash
# Mezcla voz + música (bajando cuando hay voz) + efectos, y la monta en los dos videos.
# Uso: python3 audio/musica.py && bash audio/mezcla.sh   (desde la carpeta video-posicionamiento)
# Los efectos de audio/sfx vienen de la librería @remotion/sfx (remotion.media).
set -e
cd "$(dirname "$0")/.."
S=audio/sfx
sfx() { # archivo segundos volumen_dB
  IN+=(-i "$S/$1.wav"); F+="[$IDX:a]volume=$3dB,adelay=$(python3 -c "print(int($2*1000))"):all=1[s$IDX];"; MIXIN+="[s$IDX]"; IDX=$((IDX+1)); }
IN=(-i locucion.mp3 -i audio/musica.wav); IDX=2; F=""; MIXIN=""
for t in 0.5 1.9 3.3; do sfx mouse-click $t -14; done
for t in 9.9 24.9 36.9 56.9 76.4 81.7; do sfx whoosh $t -15; done
for t in 27.0 27.9 28.8; do sfx page-turn $t -18; done
for t in 39.0 44.0 47.0 52.5; do sfx switch $t -9; done
sfx ding 66.6 -20
sfx mouse-click 88.0 -8
NS=$((IDX-2))
ffmpeg -y -loglevel error "${IN[@]}" -filter_complex "
[0:a]aresample=48000,asplit=2[v][key];
[1:a]aresample=48000,lowpass=f=7000,aecho=0.8:0.5:90|180:0.25|0.15,volume=-10dB[m];
[m][key]sidechaincompress=threshold=0.03:ratio=3:attack=40:release=700[md];
${F}${MIXIN}amix=inputs=${NS}:normalize=0[fx];
[v][md][fx]amix=inputs=3:normalize=0,alimiter=limit=0.89[out]" -map "[out]" -t 91 -c:a pcm_s16le audio/mezcla.wav
for v in video-voz video-sin-subtitulos-voz; do
  ffmpeg -y -loglevel error -i $v.mp4 -i audio/mezcla.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart tmp-$v.mp4 && mv tmp-$v.mp4 $v.mp4
done
echo listo
