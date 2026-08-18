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

const colors = {
  panel: palette[5],
  darkest: palette[0],
  dark: palette[1],
  medium: palette[2],
  blue: palette[3],
  light: palette[4],
  pale: palette[5],
  white: palette[6]
};

function sameColor(data, offset, color) {
  return data[offset] === color[0]
    && data[offset + 1] === color[1]
    && data[offset + 2] === color[2]
    && data[offset + 3] !== 0;
}

function setPixel(data, width, x, y, color, alpha = 255) {
  const offset = (y * width + x) * 4;
  data[offset] = color[0];
  data[offset + 1] = color[1];
  data[offset + 2] = color[2];
  data[offset + 3] = alpha;
}

function isVanillaSlot(data, width, height, x, y) {
  if (x + 17 >= width || y + 17 >= height) return false;
  const at = (px, py) => (py * width + px) * 4;
  return sameColor(data, at(x, y), colors.dark)
    && sameColor(data, at(x + 1, y), colors.dark)
    && sameColor(data, at(x, y + 1), colors.dark)
    && sameColor(data, at(x + 17, y + 1), colors.white)
    && sameColor(data, at(x + 1, y + 17), colors.white)
    && sameColor(data, at(x + 8, y + 8), colors.blue);
}

function drawSeparatedRoundedSlot(data, width, x, y) {
  for (let py = 0; py < 18; py += 1) {
    for (let px = 0; px < 18; px += 1) setPixel(data, width, x + px, y + py, colors.panel);
  }
  for (let py = 1; py <= 16; py += 1) {
    for (let px = 1; px <= 16; px += 1) {
      const corner = (px === 1 || px === 16) && (py === 1 || py === 16);
      if (corner) continue;
      let color = colors.blue;
      if (py === 1 || px === 1) color = colors.dark;
      if (py === 16 || px === 16) color = colors.light;
      setPixel(data, width, x + px, y + py, color);
    }
  }
}

async function separateInventorySlots(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const slots = [];
  for (let y = 0; y <= info.height - 18; y += 1) {
    for (let x = 0; x <= info.width - 18; x += 1) {
      if (!isVanillaSlot(data, info.width, info.height, x, y)) continue;
      slots.push([x, y]);
      x += 17;
    }
  }
  if (slots.length === 0) return 0;
  for (const [x, y] of slots) drawSeparatedRoundedSlot(data, info.width, x, y);
  await sharp(data, { raw: info }).png().toFile(`${file}.tmp`);
  await fs.rename(`${file}.tmp`, file);
  return slots.length;
}

async function flattenButton(file, state) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const stateColors = {
    normal: { border: colors.dark, fill: colors.blue, shine: colors.light },
    highlighted: { border: colors.medium, fill: colors.light, shine: colors.pale },
    disabled: { border: colors.darkest, fill: colors.dark, shine: colors.medium }
  }[state];
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const offset = (y * info.width + x) * 4;
      if (data[offset + 3] === 0) continue;
      const corner = (x < 2 || x >= info.width - 2) && (y === 0 || y === info.height - 1);
      if (corner) {
        data[offset + 3] = 0;
        continue;
      }
      let color = stateColors.fill;
      if (x === 0 || x === info.width - 1 || y === 0 || y === info.height - 1) color = stateColors.border;
      else if (y === 1) color = stateColors.shine;
      setPixel(data, info.width, x, y, color);
    }
  }
  await sharp(data, { raw: info }).png().toFile(`${file}.tmp`);
  await fs.rename(`${file}.tmp`, file);
}

function clearImage(data) {
  data.fill(0);
}

function drawRoundedBox(data, width, x, y, boxWidth, boxHeight, border, fill, shine = null) {
  for (let py = 0; py < boxHeight; py += 1) {
    for (let px = 0; px < boxWidth; px += 1) {
      const corner = (px === 0 || px === boxWidth - 1) && (py === 0 || py === boxHeight - 1);
      if (corner) continue;
      let color = fill;
      if (px === 0 || px === boxWidth - 1 || py === 0 || py === boxHeight - 1) color = border;
      else if (shine && py === 1) color = shine;
      setPixel(data, width, x + px, y + py, color);
    }
  }
}

async function flattenHotbar(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  clearImage(data);
  for (let slot = 0; slot < 9; slot += 1) {
    drawRoundedBox(data, info.width, 1 + slot * 20, 1, 19, 20, colors.dark, colors.blue, colors.light);
  }
  await sharp(data, { raw: info }).png().toFile(`${file}.tmp`);
  await fs.rename(`${file}.tmp`, file);
}

async function flattenHotbarSelection(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  clearImage(data);
  // Le sprite reste en 24x23 pour Minecraft, mais le contour visible est
  // recentre en 20x20 afin de suivre la case au lieu de la depasser.
  drawRoundedBox(data, info.width, 2, 2, 20, 20, colors.white, [0, 0, 0]);
  for (let y = 3; y <= 20; y += 1) {
    for (let x = 3; x <= 20; x += 1) setPixel(data, info.width, x, y, [0, 0, 0], 0);
  }
  await sharp(data, { raw: info }).png().toFile(`${file}.tmp`);
  await fs.rename(`${file}.tmp`, file);
}

async function flattenOffhandSlot(file, side) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  clearImage(data);
  const x = side === 'left' ? 1 : info.width - 20;
  drawRoundedBox(data, info.width, x, 2, 19, 20, colors.dark, colors.blue, colors.light);
  await sharp(data, { raw: info }).png().toFile(`${file}.tmp`);
  await fs.rename(`${file}.tmp`, file);
}

(async () => {
  const files = (await walk(guiRoot))
    .filter(file => !file.endsWith(`${path.sep}title${path.sep}edition.png`));
  for (const file of files) await recolor(file);

  const widgetRoot = path.join(guiRoot, 'sprites/widget');
  await flattenButton(path.join(widgetRoot, 'button.png'), 'normal');
  await flattenButton(path.join(widgetRoot, 'button_highlighted.png'), 'highlighted');
  await flattenButton(path.join(widgetRoot, 'button_disabled.png'), 'disabled');

  const hudRoot = path.join(guiRoot, 'sprites/hud');
  await flattenHotbar(path.join(hudRoot, 'hotbar.png'));
  await flattenHotbarSelection(path.join(hudRoot, 'hotbar_selection.png'));
  await flattenOffhandSlot(path.join(hudRoot, 'hotbar_offhand_left.png'), 'left');
  await flattenOffhandSlot(path.join(hudRoot, 'hotbar_offhand_right.png'), 'right');

  let separatedSlots = 0;
  for (const file of files.filter(file => file.includes(`${path.sep}container${path.sep}`))) {
    separatedSlots += await separateInventorySlots(file);
  }
  console.log(`Boutons unis sans motif et ${separatedSlots} cases separees avec coins arrondis.`);
  console.log(`${files.length} textures recolorées avec la palette de l'armure.`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
