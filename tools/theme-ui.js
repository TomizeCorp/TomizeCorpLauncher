const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
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

function pristine(file) {
  if (process.argv.includes('--from-vanilla')) {
    const minecraftAssets = path.join(pack, 'assets/minecraft');
    const relative = path.relative(minecraftAssets, file);
    const vanilla = path.resolve('.tmp-minecraft-client/extracted/assets/minecraft', relative);
    if (fsSync.existsSync(vanilla) && fsSync.statSync(vanilla).isFile()) return fsSync.readFileSync(vanilla);
  }
  if (!process.argv.includes('--from-git')) return null;
  const relative = path.relative(process.cwd(), file).replaceAll('\\', '/');
  const refArgument = process.argv.find(argument => argument.startsWith('--git-ref='));
  const ref = refArgument ? refArgument.slice('--git-ref='.length) : 'HEAD';
  return execFileSync('git', ['show', `${ref}:${relative}`], { maxBuffer: 20 * 1024 * 1024 });
}

async function theme(file, medieval) {
  const input = pristine(file) || await fs.readFile(file);
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) return;
  const corner = await sharp(input).ensureAlpha()
    .extract({ left: metadata.width - 1, top: metadata.height - 1, width: 1, height: 1 })
    .raw().toBuffer();
  let trimInfo = { width: metadata.width, height: metadata.height, trimOffsetLeft: 0, trimOffsetTop: 0 };
  if (metadata.width >= 3 && metadata.height >= 3) {
    try {
      trimInfo = (await sharp(input).ensureAlpha().trim({
        background: { r: corner[0], g: corner[1], b: corner[2], alpha: corner[3] },
        threshold: 8
      }).png().toBuffer({ resolveWithObject: true })).info;
    } catch (_) {}
  }
  const themedWidth = trimInfo.width || metadata.width;
  const themedHeight = trimInfo.height || metadata.height;
  const themedLeft = Math.max(0, -(trimInfo.trimOffsetLeft || 0));
  const themedTop = Math.max(0, -(trimInfo.trimOffsetTop || 0));
  const texture = await sharp(medieval)
    .resize(themedWidth, themedHeight, { fit: 'fill' })
    .modulate({ brightness: 0.96, saturation: 1.15 })
    .png()
    .toBuffer();
  const output = await sharp({
    create: {
      width: metadata.width,
      height: metadata.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([
      { input: texture, blend: 'over', left: themedLeft, top: themedTop },
      { input, blend: 'multiply' },
      { input, blend: 'dest-in' }
    ])
    .modulate({ brightness: 1.12, saturation: 1.2, hue: 4 })
    .png()
    .toBuffer();
  await fs.writeFile(file, output);
}

(async () => {
  const medieval = await fs.readFile(source);
  const onlyArgument = process.argv.find(argument => argument.startsWith('--only='));
  const only = onlyArgument ? onlyArgument.slice('--only='.length).replaceAll('/', path.sep) : '';
  const files = (await Promise.all(roots.map(walk))).flat()
    .filter(file => !file.endsWith(path.join('title', 'edition.png')))
    .filter(file => !only || file.includes(only));
  for (const file of files) await theme(file, medieval);
  console.log(`${files.length} textures d'interface médiévale/nature générées.`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
