#!/bin/bash
# Arma los tres recortes verticales (1080x1920) con voz, efectos y música F.
# Uso: bash audio/recortes.sh   (desde la carpeta video-posicionamiento)
set -e
cd "$(dirname "$0")/.."
S=audio/sfx
sfx() { # archivo segundos volumen_dB
  IN+=(-i "$S/$1.wav"); F+="[$IDX:a]volume=$3dB,adelay=$(python3 -c "print(int($2*1000))"):all=1[s$IDX];"; MIXIN+="[s$IDX]"; IDX=$((IDX+1)); }
IN=(-i locucion.mp3); IDX=1; F=""; MIXIN=""
for t in 0.5 1.9 3.3; do sfx mouse-click $t -14; done
for t in 9.9 24.9 36.9 56.9 76.4 81.7; do sfx whoosh $t -15; done
for t in 27.0 27.9 28.8; do sfx page-turn $t -18; done
for t in 39.0 44.0 47.0 52.5; do sfx switch $t -9; done
sfx ding 66.6 -20
sfx mouse-click 88.0 -8
NS=$((IDX-1))
ffmpeg -y -loglevel error "${IN[@]}" -filter_complex "[0:a]aresample=48000[v];${F}${MIXIN}amix=inputs=${NS}:normalize=0[fx];[v][fx]amix=inputs=2:normalize=0[out]" -map "[out]" -t 91 -c:a pcm_s16le audio/stem.wav

corte() { # nombre  tramos_video  tramos_audio  duracion  golpe_final  niveles
  node render.js --v --segs "$2" --out "tmp-$1.mp4"
  local f="" n=0 ins=""
  for seg in ${3//,/ }; do a=${seg%-*}; z=${seg#*-}; f+="[0:a]atrim=$a:$z,asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st=$(python3 -c "print($z-$a-0.05)"):d=0.05[c$n];"; ins+="[c$n]"; n=$((n+1)); done
  MUS_DUR=$4 MUS_END=$5 MUS_LVL=$6 MUS_TAG=-$1 python3 audio/musica.py F >/dev/null
  ffmpeg -y -loglevel error -i audio/stem.wav -i "audio/musica-F-$1.wav" -filter_complex "
${f}${ins}concat=n=$n:v=0:a=1,asplit=2[v][key];
[1:a]aresample=48000,lowpass=f=7000,aecho=0.8:0.5:90|180:0.25|0.15,volume=-8dB[m];
[m][key]sidechaincompress=threshold=0.03:ratio=3:attack=40:release=700[md];
[v][md]amix=inputs=2:normalize=0,alimiter=limit=0.89[out]" -map "[out]" -t $4 -c:a pcm_s16le "audio/tmp-$1.wav"
  ffmpeg -y -loglevel error -i "tmp-$1.mp4" -i "audio/tmp-$1.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$1.mp4"
  rm "tmp-$1.mp4" "audio/tmp-$1.wav" "audio/musica-F-$1.wav"
}
corte recorte-1-gancho   "0-10,76.5-91"                  "0-10,76.5-91"     24.5 21.7 "0:1,2.4:2,9.6:3"
corte recorte-2-quien-soy "10-24.6,h0.3@24.6,24.6-25,81.7-91" "10-25.3,81.7-91" 24.6 21.7 "0:2,4.8:3"
corte recorte-3-metodo   "37-57,81.7-91"                 "37-57,81.7-91"    29.3 26.5 "0:2,2.4:3"
rm audio/stem.wav
echo listo
