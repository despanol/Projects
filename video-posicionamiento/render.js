// Uso: node render.js            -> video.mp4 (1920x1080, 30 fps, con subtítulos)
//      node render.js --no-cc    -> video-sin-subtitulos.mp4
//      node render.js --stills 2,8,16   -> PNG de esos segundos en ./stills
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');
(async () => {
  const args = process.argv.slice(2), noCC = args.includes('--no-cc');
  const si = args.indexOf('--stills');
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })).newPage();
  await page.goto('file://' + path.join(__dirname, 'index.html') + '?render=1' + (noCC ? '&cc=0' : ''));
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.all([...document.fonts].map(f => f.load())); });
  const { DURATION, FPS } = await page.evaluate(() => ({ DURATION, FPS }));
  if (si >= 0) {
    fs.mkdirSync(path.join(__dirname, 'stills'), { recursive: true });
    for (const t of args[si + 1].split(',')) {
      await page.evaluate(t => seek(t), +t);
      await page.screenshot({ path: path.join(__dirname, 'stills', `t${String(t).padStart(4, '0')}.png`) });
    }
    return b.close();
  }
  const out = path.join(__dirname, noCC ? 'video-sin-subtitulos.mp4' : 'video.mp4');
  const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const n = Math.round(DURATION * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate(t => seek(t), i / FPS);
    const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`${i}/${n}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
  console.log('listo:', out);
})();
