// Scans public/components/*, merges it with the hand-written text in components.json,
// and writes public/manifest.json, which is the only file the page reads.
//
// - A folder with no entry in components.json gets a stub entry (you fill in the text later).
// - An entry whose folder is gone is kept (so your text isn't lost) but is not shown.
// - "hidden": true keeps a component in the library but off the page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIR = path.join(ROOT, 'public');
export const COMPONENTS_DIR = path.join(PUBLIC_DIR, 'components');
export const THUMBS_DIR = path.join(PUBLIC_DIR, 'thumbs');
export const CONTENT_FILE = path.join(ROOT, 'components.json');
export const MANIFEST_FILE = path.join(PUBLIC_DIR, 'manifest.json');
const THUMB_EXTS = ['.webp', '.png', '.jpg', '.jpeg', '.avif'];

export const readContent = () =>
  fs.existsSync(CONTENT_FILE) ? JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8')) : {};
export const writeContent = (content) =>
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(content, null, 2) + '\n');

export const titleFromSlug = (slug) => slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const today = () => new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

export function listComponentFolders() {
  if (!fs.existsSync(COMPONENTS_DIR)) return [];
  return fs.readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(COMPONENTS_DIR, d.name, 'index.html')))
    .map((d) => d.name);
}

function stubFor(slug) {
  const html = fs.readFileSync(path.join(COMPONENTS_DIR, slug, 'index.html'), 'utf8');
  const pageTitle = /<title>([^<]*)<\/title>/i.exec(html)?.[1].trim();
  return { title: pageTitle || titleFromSlug(slug), description: '', tags: [], date: today() };
}

function findThumb(slug, override) {
  if (override && fs.existsSync(path.join(PUBLIC_DIR, override))) return override;
  for (const ext of THUMB_EXTS) {
    const file = path.join(THUMBS_DIR, slug + ext);
    if (fs.existsSync(file)) return `thumbs/${slug}${ext}?v=${Math.round(fs.statSync(file).mtimeMs)}`;
  }
  return null;
}

export async function sync({ quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;
  const content = readContent();
  const folders = listComponentFolders();

  const added = folders.filter((slug) => !content[slug]);
  for (const slug of added) content[slug] = stubFor(slug);
  if (added.length) writeContent(content);

  const missing = Object.keys(content).filter((slug) => !folders.includes(slug));

  const items = folders
    .filter((slug) => !content[slug].hidden)
    .map((slug) => {
      const c = content[slug];
      return {
        ...c,
        slug,
        title: c.title || titleFromSlug(slug),
        description: c.description || '',
        tags: c.tags || [],
        date: c.date || '',
        kind: c.kind || 'interactive',
        url: `components/${slug}/`,
        thumb: findThumb(slug, c.thumb),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title));

  const manifest = JSON.stringify({ count: items.length, items }, null, 2) + '\n';
  const previous = fs.existsSync(MANIFEST_FILE) ? fs.readFileSync(MANIFEST_FILE, 'utf8') : '';
  if (manifest !== previous) fs.writeFileSync(MANIFEST_FILE, manifest);

  log(`${items.length} component${items.length === 1 ? '' : 's'} on the page.`);
  for (const slug of added) console.log(`  + new: ${slug} (stub added to components.json, so add its text there)`);
  for (const slug of missing) console.log(`  ! ${slug} is in components.json but public/components/${slug}/ has no index.html`);
  const noThumb = items.filter((i) => !i.thumb).map((i) => i.slug);
  if (noThumb.length) log(`  · no thumbnail yet: ${noThumb.join(', ')} (run npm run thumbs)`);
  const noText = items.filter((i) => !i.description).map((i) => i.slug);
  if (noText.length) log(`  · no description yet: ${noText.join(', ')}`);
  return { items, added, missing };
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) await sync();
