// Extract embedded bitmap images into cacheable assets; PNG conversion is lossless.
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const sharp = require('C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const pages = ['index.html', 'routiq.html', 'chotadhobi.html', 'myfuturejobs.html', 'esgplatform.html', 'orchestration.html'];
(async () => {
  fs.mkdirSync('assets/portfolio', { recursive: true });
  const converted = new Map();
  const report = [];
  for (const page of pages) {
    let html = fs.readFileSync(page, 'utf8');
    const before = Buffer.byteLength(html);
    for (const match of [...html.matchAll(/data:image\/(png|jpeg|jpg|webp);base64,([^"'\s)]+)/g)]) {
      const source = Buffer.from(match[2], 'base64');
      const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16);
      let record = converted.get(hash);
      if (!record) {
        const metadata = await sharp(source).metadata();
        let image = source;
        let extension = match[1] === 'jpeg' ? 'jpg' : match[1];
        if (match[1] === 'png') {
          const webp = await sharp(source).webp({ lossless: true, effort: 4 }).toBuffer();
          if (webp.length < source.length) { image = webp; extension = 'webp'; }
        }
        const file = `assets/portfolio/${hash}.${extension}`;
        fs.writeFileSync(file, image);
        record = { file, originalBytes: source.length, bytes: image.length, width: metadata.width, height: metadata.height, lossless: true };
        converted.set(hash, record);
      }
      html = html.replaceAll(match[0], record.file);
    }
    fs.writeFileSync(page, html);
    report.push({ page, htmlBefore: before, htmlAfter: Buffer.byteLength(html) });
  }
  fs.mkdirSync('audit', { recursive: true });
  if (converted.size) fs.writeFileSync('audit/image-optimization.json', JSON.stringify({ pages: report, images: [...converted.values()] }, null, 2));
  report.forEach(row => console.log(`${row.page}: HTML ${row.htmlBefore} → ${row.htmlAfter} bytes`));
  console.log(`Extracted ${converted.size} unique images. Pixel dimensions preserved; PNG conversions are lossless.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
