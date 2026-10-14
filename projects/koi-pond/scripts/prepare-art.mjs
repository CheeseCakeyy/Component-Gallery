import sharp from 'sharp';
import { mkdir, readdir, rename, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

// Preserve original generated PNGs; encode web delivery assets without changing their dimensions or alpha.
const source = resolve('artwork/source');
const output = resolve('public/art');
await mkdir(source, { recursive: true });
for (const name of await readdir(output)) {
  if (!name.endsWith('.png')) continue;
  const from = resolve(output, name), to = resolve(source, name);
  if (!from.startsWith(output) || !to.startsWith(source)) throw new Error('Unexpected asset path');
  try { await stat(to); } catch { await rename(from, to); }
}
for (const name of await readdir(source)) {
  if (!name.endsWith('.png')) continue;
  const info = await sharp(resolve(source, name)).webp({ quality: 91, alphaQuality: 100, effort: 6 })
    .toFile(resolve(output, name.replace('.png', '.webp')));
  console.log(`${name}: ${(info.size / 1024).toFixed(0)} KB`);
}
