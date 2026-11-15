// Uso: node render.js [--no-cc] [--v] [--segs "0-10,76.5-91"] [--out nombre.mp4] [--stills 2,8,16]
//   --v     vertical 1080x1920        --segs  tramos del video original; "h0.3@24.6" congela 0,3 s en el segundo 24,6
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
(async () => {
  const args = process.argv.slice(2), has = f => args.includes(f), val = f => args.indexOf(f) >= 0 ? args[args.indexOf(f) + 1] : null;
  const noCC = has('--no-cc'), V = has('--v');
  const vp = V ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: vp, deviceScaleFactor: 1 })).newPage();
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?render=1' + (noCC ? '&cc=0' : '') + (V ? '&v=1' : ''));
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.fonts].map(f => f.load())); });
  const { DURATION, FPS } = await page.evaluate(() => ({ DURATION, FPS }));
  if (val('--stills')) {
    fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true });
    for (const t of val('--stills').split(',')) {
      await page.evaluate(t => seek(t), +t);
      await page.screenshot({ path: path.join(__dirname, 'stills', `t${String(t).padStart(4, '0')}.png`) });
    }
    return b.close();
  }
  const times = [];
  for (const seg of (val('--segs') || `0-${DURATION}`).split(',')) {
    const h = seg.match(/^h([\d.]+)@([\d.]+)$/);
    if (h) { for (let i = 0; i < Math.round(h[1] * FPS); i++) times.push(+h[2]); continue; }
    const [a, z] = seg.split('-').map(Number);
    for (let i = 0; i < Math.round((z - a) * FPS); i++) times.push(a + i / FPS);
  }
  const out = path.join(__dirname, val('--out') || (noCC ? 'video-sin-subtitulos.mp4' : 'video.mp4'));
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  for (let i = 0; i < times.length; i++) {
    await page.evaluate(t => seek(t), times[i]);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
  console.log('listo:', out, (times.length / FPS).toFixed(1) + ' s');
})();
