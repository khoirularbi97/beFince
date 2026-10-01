import { build } from '/home/claude/befince/client/node_modules/esbuild/lib/main.js';
import fs from 'node:fs';
import path from 'node:path';

const root = '/home/claude/befince';
// Penyesuaian khusus pratinjau: "hari ini" mengikuti tanggal pratinjau (30 Sep 2026), kode aplikasi asli tidak diubah
const patch = {
  name: 'patch-today',
  setup(b) {
    b.onLoad({ filter: /client\/src\/util\.js$/ }, (a) => {
      let s = fs.readFileSync(a.path, 'utf8');
      const rep = (x, y) => { if (!s.includes(x)) throw new Error('pola tidak ditemukan: ' + x); s = s.replace(x, y); };
      rep('export const today = () => fmt(new Date());', "export const today = () => (typeof window !== 'undefined' && window.__MOCK_TODAY__) || fmt(new Date());");
      rep('const y = new Date(); y.setDate(y.getDate() - 1);', "const y = new Date(today() + 'T00:00:00'); y.setDate(y.getDate() - 1);");
      return { contents: s, loader: 'js' };
    });
  },
};
const r = await build({
  entryPoints: { app: `${root}/mockup/entry.jsx` }, bundle: true, minify: true, format: 'iife', write: false, outdir: 'out',
  jsx: 'automatic', plugins: [patch], logLevel: 'error', loader: { '.json': 'json' },
  define: { 'import.meta.env.VITE_API_URL': '"http://mock"', 'process.env.NODE_ENV': '"production"' },
  nodePaths: [`${root}/client/node_modules`], absWorkingDir: `${root}/client`,
});
const js = r.outputFiles.find((f) => f.path.endsWith('.js')).text.replaceAll('</script', '<\\/script');
const css = r.outputFiles.find((f) => f.path.endsWith('.css')).text;
const extra = `
.mock-note{background:#0A2540;color:#dbe6f3;font:500 12px/1.4 system-ui,sans-serif;text-align:center;padding:8px 12px}
.mock-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom,0px));z-index:50;max-width:min(92vw,420px);background:#0A2540;color:#fff;border-radius:14px;padding:12px 16px;font-size:.88rem;box-shadow:0 14px 30px -10px rgba(0,0,0,.5)}`;
const html = `<!doctype html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>beFince</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;600;800&display=swap" rel="stylesheet">
<style>${css}${extra}</style>
</head>
<body>
<div class="mock-note">Pratinjau desain beFince dengan data contoh. Ketuk inisial A di pojok atas, lalu Keluar, untuk melihat layar masuk (email dan kata sandi apa saja diterima).</div>
<div id="root"></div>
<script>${js}</script>
</body>
</html>`;
fs.mkdirSync('/mnt/user-data/outputs', { recursive: true });
fs.writeFileSync('/mnt/user-data/outputs/befince-mockup.html', html);
console.log('OK', (html.length / 1024).toFixed(0) + ' KB');
