const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const pack = path.resolve('server-files/resourcepacks/TomizeCorpUI');
const source = path.join(pack, 'assets/tomizecorp/textures/gui/medieval-panel-source.png');
const roots = [path.join(pack, 'assets/minecraft/textures/gui')];

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (entry.name.endsWith('.png')) files.push(target);
  }
  return files;
}

async function theme(file, medieval) {
  const input = await fs.readFile(file);
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) return;
  const texture = await sharp(medieval)
    .resize(metadata.width, metadata.height, { fit: 'fill' })
    .modulate({ brightness: 0.72, saturation: 0.82 })
    .png()
    .toBuffer();
  const output = await sharp(input)
    .ensureAlpha()
    .composite([{ input: texture, blend: 'soft-light' }])
    .modulate({ saturation: 1.18, hue: 18 })
    .png()
    .toBuffer();
  await fs.writeFile(file, output);
}

(async () => {
  const medieval = await fs.readFile(source);
  const files = (await Promise.all(roots.map(walk))).flat()
    .filter(file => !file.endsWith(path.join('title', 'edition.png')));
  for (const file of files) await theme(file, medieval);
  console.log(`${files.length} textures d'interface médiévale/nature générées.`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
