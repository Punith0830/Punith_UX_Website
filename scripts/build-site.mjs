// Copy the current portfolio and referenced local assets into dist.
// Local audit tools, reports and project metadata are never included.
import fs from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const output = path.join(root, 'dist');
const pages = ['index.html', 'routiq.html', 'chotadhobi.html', 'myfuturejobs.html', 'esgplatform.html', 'orchestration.html'];
const pending = [...pages];
const copied = new Set();
await fs.mkdir(output, { recursive: true });
while (pending.length) {
  const relative = pending.shift();
  if (copied.has(relative)) continue;
  const source = path.resolve(root, relative);
  if (!source.startsWith(root + path.sep)) throw new Error(`Invalid source path: ${relative}`);
  const target = path.join(output, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  copied.add(relative);
  if (!/\.(html|css|js)$/.test(relative)) continue;
  const text = await fs.readFile(source, 'utf8');
  const refs = [
    ...Array.from(text.matchAll(/(?:src|href)="([^"]+)"/g), match => match[1]),
    ...Array.from(text.matchAll(/url\(["']?([^"')\s]+)["']?\)/g), match => match[1]),
  ];
  for (let reference of refs) {
    reference = reference.split('#')[0].split('?')[0];
    if (!reference || /^(https?:|data:|mailto:|tel:)/.test(reference)) continue;
    const local = path.posix.normalize(path.posix.join(path.posix.dirname(relative.replaceAll('\\', '/')), reference));
    if (local.startsWith('..') || path.isAbsolute(local)) throw new Error(`Invalid asset reference: ${reference}`);
    if (!copied.has(local)) pending.push(local);
  }
}
console.log(`Built dist: ${pages.length} pages and ${copied.size - pages.length} referenced assets.`);
