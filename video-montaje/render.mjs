// Renderiza el video cuadro por cuadro con Chromium headless y lo codifica con ffmpeg.
//   node render.mjs                 -> out/montaje-datos.mp4 (1920x1080, 30 fps)
//   node render.mjs --stills 5,9.5  -> out/stills/*.jpg en esos segundos (para revisar)
//   node render.mjs --serve         -> solo levanta el servidor para ver la animación en el navegador
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1] ?? true; };
const FPS = 30, WORKERS = Number(opt('--workers') || 4);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const p = path.normalize(path.join(ROOT, decodeURIComponent(req.url.split('?')[0])));
  const file = p.endsWith(path.sep) || p === ROOT ? path.join(p, 'index.html') : p;
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
const port = Number(opt('--port') || 0);
await new Promise((r) => server.listen(port || (opt('--serve') ? 5173 : 0), '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}/index.html`;

if (opt('--serve')) { console.log(`Vista previa: ${url}`); await new Promise(() => {}); }

const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const newPage = async () => {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('Error en la página:', e.message); process.exitCode = 1; });
  await page.goto(`${url}?capture=1`);
  await page.waitForFunction('window.READY === true', null, { timeout: 60000 });
  return page;
};
const shot = async (page, t, file) => {
  await page.evaluate((tt) => window.renderFrame(tt), t);
  await page.screenshot({ path: file, type: 'jpeg', quality: 96 });
};

const stills = opt('--stills');
if (stills) {
  const dir = path.join(ROOT, 'out', 'stills'); fs.mkdirSync(dir, { recursive: true });
  const page = await newPage();
  for (const s of String(stills).split(',')) { await shot(page, Number(s), path.join(dir, `t${Number(s).toFixed(1).padStart(4, '0')}.jpg`)); console.log('still', s); }
  await browser.close(); server.close(); process.exit();
}

const frames = path.join(ROOT, 'out', 'frames');
fs.rmSync(frames, { recursive: true, force: true }); fs.mkdirSync(frames, { recursive: true });
const pages = await Promise.all(Array.from({ length: WORKERS }, newPage));
const total = Math.round((await pages[0].evaluate('window.DURATION')) * FPS);
let next = 0, done = 0; const started = Date.now();
await Promise.all(pages.map(async (page) => {
  while (next < total) {
    const f = next++;
    await shot(page, f / FPS, path.join(frames, `f${String(f).padStart(5, '0')}.jpg`));
    if (++done % 60 === 0) console.log(`${done}/${total} cuadros · ${((Date.now() - started) / 1000).toFixed(0)} s`);
  }
}));
await browser.close(); server.close();

const out = path.join(ROOT, 'out', 'montaje-datos.mp4');
const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frames, 'f%05d.jpg'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(1);
fs.rmSync(frames, { recursive: true, force: true });
console.log(`Listo: ${out}`);
