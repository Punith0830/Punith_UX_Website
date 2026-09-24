import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const sourceFile = path.join(projectRoot, "dist", "index.html");
const outputFile = path.join(projectRoot, "index.html");
const assetPattern = /assets\/[^"'\s)>]+/g;
const mimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

let html = await readFile(sourceFile, "utf8");
const assetReferences = [...new Set(html.match(assetPattern) ?? [])];

for (const reference of assetReferences) {
  const assetFile = path.join(projectRoot, "dist", ...reference.split("/"));
  const mimeType = mimeTypes[path.extname(assetFile).toLowerCase()];
  if (!mimeType) continue;

  const asset = await readFile(assetFile);
  const dataUri = `data:${mimeType};base64,${asset.toString("base64")}`;
  html = html.replaceAll(reference, dataUri);
}

await writeFile(outputFile, html, "utf8");
console.log(`Built standalone index.html with ${assetReferences.length} embedded assets.`);
