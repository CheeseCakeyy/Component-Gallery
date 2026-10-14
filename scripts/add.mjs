// Imports a project into public/components/<slug>/ so the showcase can host it.
//
//   npm run add -- projects/<folder> [more folders...] [--slug name] [--rebuild]
//   npm run add -- --all            re-import every folder in projects/
//
// What it picks up, in order:
//   hyperframes.json / renders/*.mp4 -> wraps the rendered video in a small page
//   dist/index.html                   -> copies the existing build (skip with --rebuild)
//   vite in package.json              -> builds with `vite build --base ./`
//   index.html at the root            -> copies it as a plain static site
//
// Then it rewrites root-absolute paths ("/assets/x.js", url(/fonts/x.ttf), "/models/x.glb")
// to relative ones, because the page is served from /components/<slug>/ and not from "/".
// Your source project is never modified. Afterwards it makes the poster (npm run posters).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, COMPONENTS_DIR, THUMBS_DIR, readContent, writeContent, titleFromSlug, sync } from './sync.mjs';
import { makePosters, findBrowser } from './posters.mjs';

// Never copied: tooling, OS junk, launch scripts.
const SKIP_DIRS = new Set(['node_modules', '.git', '.vite', '.cache', '.claude', '.openai', '.hyperframes', '.thumbnails']);
const SKIP_FILE = /^(.*\.(cmd|bat|ps1|log|blend\d?)|\.gitignore|\.ds_store|thumbs\.db|desktop\.ini)$/i;
// Also skipped when copying a project root as a static site (a dist/ is already only the runtime files).
const SOURCE_DIRS = new Set(['tests', 'test', 'qa', 'verification', 'snapshots', 'renders', 'blender']);
const SOURCE_FILE = /^(.*\.md|package(-lock)?\.json|tsconfig.*\.json|vite\.config\..*|.*\.test\.[cm]?[jt]s|server\.mjs|preview[^/]*\.(png|jpe?g|webp))$/i;
const REWRITE_EXTS = new Set(['.html', '.htm', '.js', '.mjs', '.css', '.json', '.webmanifest', '.svg']);

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args.splice(i, 2)[1] ?? true; };
const slugArg = flag('--slug');
const rebuild = args.includes('--rebuild') && args.splice(args.indexOf('--rebuild'), 1);
const PROJECTS_DIR = path.join(ROOT, 'projects');
const sources = args.includes('--all')
  ? fs.readdirSync(PROJECTS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => path.join(PROJECTS_DIR, d.name))
  : args.filter((a) => !a.startsWith('--'));

if (!sources.length) {
  console.log('Usage: npm run add -- projects/<folder> [more folders...] [--slug name] [--rebuild]');
  console.log('       npm run add -- --all');
  process.exit(1);
}
if (slugArg && sources.length > 1) { console.error('--slug only works with a single folder.'); process.exit(1); }

let failures = 0;
const imported = [];
for (const src of sources) {
  try { imported.push({ src: path.resolve(src), slug: importProject(path.resolve(src), slugArg) }); }
  catch (err) { failures++; console.error(`✗ ${path.basename(src)}: ${err.message}`); }
}
console.log('');
await sync();
// Re-imports keep their artwork; `npm run posters -- <slug>` redoes one.
const fresh = imported.filter(({ slug }) => !fs.existsSync(path.join(THUMBS_DIR, `${slug}.json`)));
if (fresh.length) {
  if (findBrowser()) {
    console.log('\nMaking posters…');
    failures += await makePosters(fresh.map((i) => i.slug));
  } else {
    console.log("\nNo Chrome or Edge found, so the poster is the project's preview image (if it has one).");
    for (const { src, slug } of fresh) copyPreview(src, slug);
    await sync({ quiet: true });
  }
}
process.exit(failures ? 1 : 0);

function importProject(src, slugOverride) {
  if (!fs.existsSync(src)) throw new Error(`folder not found: ${src}`);
  const slug = (slugOverride || path.basename(src)).toLowerCase().replace(/[^a-z0-9-_]+/g, '-');
  const dest = path.join(COMPONENTS_DIR, slug);
  const has = (...p) => fs.existsSync(path.join(src, ...p));
  const pkg = has('package.json') ? JSON.parse(fs.readFileSync(path.join(src, 'package.json'), 'utf8')) : {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const video = findVideo(src);

  let how;
  fs.rmSync(dest, { recursive: true, force: true });
  if (has('hyperframes.json') || (video && !has('index.html') && !has('dist', 'index.html'))) {
    if (!video) throw new Error('looks like a video project but there is no rendered .mp4 in renders/. Render it first.');
    writeVideoPage(src, video, dest);
    how = 'video wrapper';
  } else if (has('dist', 'index.html') && !rebuild) {
    copyTree(path.join(src, 'dist'), dest);
    how = 'copied dist/';
  } else if (deps.vite) {
    if (!has('node_modules')) throw new Error('needs a build but node_modules is missing. Run npm install in it first.');
    const out = fs.mkdtempSync(path.join(os.tmpdir(), `showcase-${slug}-`));
    console.log(`… building ${slug} with vite`);
    const r = spawnSync('npx', ['vite', 'build', '--base', './', '--outDir', out, '--emptyOutDir'],
      { cwd: src, stdio: 'inherit', shell: process.platform === 'win32' });
    if (r.status !== 0 || !fs.existsSync(path.join(out, 'index.html'))) throw new Error('vite build failed');
    copyTree(out, dest);
    fs.rmSync(out, { recursive: true, force: true });
    how = 'built with vite';
  } else if (has('index.html')) {
    copyTree(src, dest, true);
    how = 'copied static files';
  } else {
    throw new Error('nothing to show: no dist/index.html, no index.html, no vite build, no rendered video.');
  }

  const rewrites = relativize(dest);
  addContentStub(src, slug, deps, !!video && how === 'video wrapper');
  console.log(`✓ ${slug}: ${how}${rewrites ? `, fixed ${rewrites} absolute path${rewrites > 1 ? 's' : ''}` : ''}`);
  return slug;
}

function copyTree(from, to, isSourceRoot = false) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name) && !(isSourceRoot && SOURCE_DIRS.has(entry.name))) copyTree(a, b);
    } else if (!SKIP_FILE.test(entry.name) && !(isSourceRoot && SOURCE_FILE.test(entry.name))) {
      fs.copyFileSync(a, b);
    }
  }
}

// "/assets/x" -> "./assets/x" (HTML, JS) or "../assets/x" (a CSS file one folder down).
// Only paths whose first segment really exists in the build are touched.
function relativize(dir) {
  const tops = fs.readdirSync(dir).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!tops.length) return 0;
  const re = new RegExp(`(["'\`(])/(?=(?:${tops.join('|')})(?:[/"'\`)?#]))`, 'g');
  let count = 0;
  (function walk(d, depth) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const file = path.join(d, entry.name);
      if (entry.isDirectory()) { walk(file, depth + 1); continue; }
      const ext = path.extname(entry.name).toLowerCase();
      if (!REWRITE_EXTS.has(ext)) continue;
      // CSS url() resolves against the stylesheet; everything else resolves against the page.
      const prefix = ext === '.css' && depth > 0 ? '../'.repeat(depth) : './';
      const before = fs.readFileSync(file, 'utf8');
      let after = before.replace(re, (_, q) => { count++; return q + prefix; });
      // Vite's preload helper for code-split chunks built with base "/".
      after = after.replace(/return\s*"\/"\s*\+/g, () => { count++; return 'return"./"+'; });
      if (after !== before) fs.writeFileSync(file, after);
    }
  })(dir, 0);
  return count;
}

function findVideo(src) {
  for (const dir of ['renders', 'dist', '.']) {
    const d = path.join(src, dir);
    if (!fs.existsSync(d)) continue;
    const mp4 = fs.readdirSync(d).find((f) => /\.(mp4|webm)$/i.test(f));
    if (mp4) return path.join(d, mp4);
  }
  return null;
}

function writeVideoPage(src, video, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const name = path.basename(video);
  fs.copyFileSync(video, path.join(dest, name));
  const title = readmeInfo(src).title || titleFromSlug(path.basename(src));
  fs.writeFileSync(path.join(dest, 'index.html'), `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title.replace(/</g, '&lt;')}</title>
<style>
  html, body { margin: 0; height: 100%; background: transparent; }
  body { display: grid; place-items: center; }
  video { max-width: 100%; max-height: 100%; display: block; }
</style>
</head>
<body>
<video src="./${encodeURI(name)}" autoplay loop muted playsinline></video>
</body>
</html>
`);
}

function copyPreview(src, slug) {
  if (fs.existsSync(THUMBS_DIR) && fs.readdirSync(THUMBS_DIR).some((f) => f.startsWith(slug + '.'))) return null;
  const candidates = [];
  for (const dir of ['.', 'verification', 'qa', 'renders', 'snapshots']) {
    const d = path.join(src, dir);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d)) {
      if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
      if (dir === '.' && !/^preview/i.test(f)) continue;
      const score = /^preview\.\w+$/i.test(f) ? 0 : /desktop|three-quarter|verified/i.test(f) ? 1 : dir === '.' ? 2 : 3;
      candidates.push({ file: path.join(d, f), score });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  if (!candidates.length) return null;
  const pick = candidates[0].file;
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
  fs.copyFileSync(pick, path.join(THUMBS_DIR, slug + path.extname(pick).toLowerCase()));
  return path.relative(src, pick);
}

function readmeInfo(src) {
  const file = ['README.md', 'readme.md'].map((f) => path.join(src, f)).find(fs.existsSync);
  if (!file) return {};
  const md = fs.readFileSync(file, 'utf8');
  const title = /^#\s+(.+)$/m.exec(md)?.[1].trim();
  const para = md.split(/\r?\n\s*\r?\n/).map((p) => p.trim())
    .find((p) => p && !/^(#|!\[|```|[-*] |\d+\. |<)/.test(p));
  let description = para?.replace(/\s*\r?\n\s*/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').trim();
  if (description && description.length > 240) {
    const cut = description.slice(0, 240);
    description = cut.slice(0, Math.max(cut.lastIndexOf('. ') + 1, 0)) || cut.replace(/\s+\S*$/, '') + '…';
  }
  return { title, description };
}

function addContentStub(src, slug, deps, isVideo) {
  const content = readContent();
  if (content[slug]) return; // never overwrite text you've written
  const { title, description } = readmeInfo(src);
  const tags = [];
  if (isVideo) tags.push('video');
  if (deps.three) tags.push('three.js');
  if (deps['pixi.js']) tags.push('pixi');
  if (deps.react) tags.push('react');
  if (!tags.length) tags.push(fs.readdirSync(src).some((f) => /^three\./.test(f)) ? 'three.js' : 'vanilla js');
  content[slug] = { title: title || titleFromSlug(slug), description: description || '', tags, date: lastModified(src) };
  writeContent(content);
}

// Newest file date in the project root, ignoring generated folders.
function lastModified(src) {
  let latest = 0;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (['node_modules', 'dist'].includes(entry.name) || entry.name.startsWith('.')) continue;
    latest = Math.max(latest, fs.statSync(path.join(src, entry.name)).mtimeMs);
  }
  return new Date(latest || Date.now()).toLocaleDateString('en-CA');
}
