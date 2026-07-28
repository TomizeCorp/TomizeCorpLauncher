const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(process.argv[2] || 'server-files');
const output = path.resolve(process.argv[3] || path.join(root, 'manifest.json'));
// Les shaders sont personnels et ne doivent jamais entrer dans la vérification automatique.
const allowed = new Set(['mods', 'resourcepacks', 'config', 'defaultconfigs']);

async function walk(dir) {
  let files = [];
  for (const entry of await fsp.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const target = path.join(dir, entry.name);
    files = entry.isDirectory() ? files.concat(await walk(target)) : files.concat(target);
  }
  return files;
}

function hash(file) {
  return new Promise((resolve, reject) => {
    const digest = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('error', reject);
    stream.on('data', data => digest.update(data));
    stream.on('end', () => resolve(digest.digest('hex')));
  });
}

async function validateResourcePacks() {
  const packsDir = path.join(root, 'resourcepacks');
  if (!fs.existsSync(packsDir)) return;
  for (const entry of await fsp.readdir(packsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const metadataPath = path.join(packsDir, entry.name, 'pack.mcmeta');
    if (!fs.existsSync(metadataPath)) throw new Error(`Pack sans pack.mcmeta : ${entry.name}`);
    const metadata = JSON.parse(await fsp.readFile(metadataPath, 'utf8'));
    const pack = metadata?.pack;
    if (!pack) throw new Error(`Métadonnées invalides : ${entry.name}`);
    if (Number(pack.pack_format) >= 65 && (pack.min_format === undefined || pack.max_format === undefined)) {
      throw new Error(`Le pack ${entry.name} doit définir min_format et max_format.`);
    }
  }
}

(async () => {
  await fsp.mkdir(root, { recursive: true });
  await validateResourcePacks();
  let files = [];
  for (const folder of allowed) {
    const directory = path.join(root, folder);
    if (fs.existsSync(directory)) files.push(...await walk(directory));
  }
  const entries = [];
  for (const file of files) {
    const relative = path.relative(root, file).replace(/\\/g, '/');
    entries.push({
      path: relative,
      sha256: await hash(file),
      size: (await fsp.stat(file)).size,
      url: `../server-files/${relative}`
    });
  }
  const manifest = { version: new Date().toISOString(), files: entries };
  await fsp.writeFile(output, JSON.stringify(manifest, null, 2));
  console.log(`${entries.length} fichier(s) indexé(s) dans ${output}`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
