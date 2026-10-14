// Zero-dependency static server for public/.
// Rebuilds manifest.json on every request for it, so dropping a new folder into
// public/components/ or editing components.json shows up on a plain refresh.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_DIR, sync } from './sync.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.ktx2': 'image/ktx2', '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream',
  '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.txt': 'text/plain',
};

export function createServer({ quiet = false } = {}) {
  return http.createServer(async (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
    catch { res.writeHead(400).end(); return; }

    if (pathname === '/manifest.json') {
      try { await sync({ quiet: true }); }
      catch (err) { console.error('sync failed:', err.message); }
    }

    let file = path.resolve(PUBLIC_DIR, '.' + pathname);
    if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + path.sep)) { res.writeHead(403).end(); return; }

    let stat = fs.statSync(file, { throwIfNoEntry: false });
    if (stat?.isDirectory()) {
      // Directory URLs must end in "/" or the page's relative ./assets paths resolve one level too high.
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' }).end(); return; }
      file = path.join(file, 'index.html');
      stat = fs.statSync(file, { throwIfNoEntry: false });
    }
    if (!stat?.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }

    const headers = {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Accept-Ranges': 'bytes',
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
      const start = range[1] ? Number(range[1]) : stat.size - Number(range[2]);
      const end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
    } else {
      res.writeHead(200, { ...headers, 'Content-Length': stat.size });
      fs.createReadStream(file).pipe(res);
    }
    if (!quiet && pathname === '/') console.log(new Date().toLocaleTimeString(), 'GET /');
  });
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 5170;
  await sync();
  createServer().listen(port, '127.0.0.1', () => {
    console.log(`\n  Showcase running at http://127.0.0.1:${port}\n`);
  });
}
