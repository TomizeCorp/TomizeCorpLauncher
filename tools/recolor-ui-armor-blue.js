const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');

const packRoot = path.resolve('server-files/resourcepacks/TomizeCorpUI');
const guiRoot = path.join(packRoot, 'assets/minecraft/textures/gui');
const vanillaGuiRoot = path.resolve('.tmp-minecraft-client/extracted/assets/minecraft/textures/gui');

// Palette relevée sur l'armure de référence, du bleu nuit aux reflets glacés.
const palette = [
  [18, 29, 78],
  [27, 42, 112],
  [40, 59, 205],
  [67, 94, 232],
  [116, 137, 238],
  [174, 187, 247],
  [229, 234, 255]
];
const paletteKeys = new Set(palette.map(color => color.join(',')));

const vanillaInventoryPaths = [
  `${path.sep}container${path.sep}inventory.png`,
  `${path.sep}container${path.sep}creative_inventory${path.sep}`,
  `${path.sep}recipe_book.png`,
  `${path.sep}sprites${path.sep}container${path.sep}inventory${path.sep}`,
  `${path.sep}sprites${path.sep}container${path.sep}creative_inventory${path.sep}`,
  `${path.sep}sprites${path.sep}recipe_book${path.sep}`
];

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

function shouldKeepVanilla(file) {
  return vanillaInventoryPaths.some(fragment => file.includes(fragment));
}

function paletteColor(luma) {
  const index = Math.min(palette.length - 1, Math.floor(luma * palette.length / 256));
  return palette[index];
}

async function recolor(file) {
  const relative = path.relative(guiRoot, file);
  const vanillaFile = path.join(vanillaGuiRoot, relative);
  const image = sharp(vanillaFile).ensureAlpha();
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) continue;
    if (paletteKeys.has(`${data[offset]},${data[offset + 1]},${data[offset + 2]}`)) continue;
    const luma = Math.round(0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2]);
    const [red, green, blue] = paletteColor(luma);
    data[offset] = red;
    data[offset + 1] = green;
    data[offset + 2] = blue;
  }
  await sharp(data, { raw: info }).png().toFile(`${file}.tmp`);
  await fs.rename(`${file}.tmp`, file);
}

(async () => {
  const files = (await walk(guiRoot))
    .filter(file => !file.endsWith(`${path.sep}title${path.sep}edition.png`))
    .filter(file => !shouldKeepVanilla(file));
  for (const file of files) await recolor(file);
  console.log(`${files.length} textures recolorées avec la palette de l'armure.`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
