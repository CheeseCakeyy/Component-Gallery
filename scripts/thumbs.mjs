// Screenshots components that have no thumbnail, using the Chrome or Edge already on this machine.
//
//   npm run thumbs                      -> only components missing a thumbnail
//   npm run thumbs -- koi-pond keyspace -> (re)capture just these
//   npm run thumbs -- --all             -> recapture everything
//
// Your own screenshot always beats this: drop public/thumbs/<slug>.png (or .webp / .jpg) in place.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { THUMBS_DIR, sync } from './sync.mjs';
import { createServer } from './serve.mjs';

const WIDTH = 1280, HEIGHT = 800, WAIT_MS = 6000;
const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
].filter(Boolean);

const browser = BROWSERS.find((p) => fs.existsSync(p));
if (!browser) { console.error('No Chrome or Edge found. Set CHROME_PATH to one.'); process.exit(1); }

const args = process.argv.slice(2);
const { items } = await sync({ quiet: true });
const targets = args.includes('--all') ? items
  : args.length ? items.filter((i) => args.includes(i.slug))
  : items.filter((i) => !i.thumb);
if (!targets.length) { console.log('Every component already has a thumbnail.'); process.exit(0); }

const server = createServer({ quiet: true }).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}/`;
fs.mkdirSync(THUMBS_DIR, { recursive: true });

for (const item of targets) {
  const out = path.join(THUMBS_DIR, `${item.slug}.png`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'showcase-thumb-'));
  process.stdout.write(`… ${item.slug} `);
  const ok = await capture(base + item.url, out, profile);
  fs.rmSync(profile, { recursive: true, force: true });
  if (ok) for (const ext of ['.webp', '.jpg', '.jpeg', '.avif']) fs.rmSync(path.join(THUMBS_DIR, item.slug + ext), { force: true });
  console.log(ok ? '✓' : '✗ (no screenshot, so it keeps the placeholder)');
}

server.close();
await sync();

function capture(url, out, profile) {
  fs.rmSync(out, { force: true });
  return new Promise((resolve) => {
    const child = spawn(browser, [
      '--headless=new', '--hide-scrollbars', '--mute-audio', '--no-first-run', '--no-default-browser-check',
      '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
      `--user-data-dir=${profile}`, `--window-size=${WIDTH},${HEIGHT}`,
      `--virtual-time-budget=${WAIT_MS}`, `--screenshot=${out}`, url,
    ], { stdio: 'ignore' });
    const timer = setTimeout(() => child.kill(), WAIT_MS + 30000);
    child.on('exit', () => { clearTimeout(timer); resolve(fs.existsSync(out)); });
  });
}
