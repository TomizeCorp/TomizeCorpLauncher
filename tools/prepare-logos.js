const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

async function main() {
  const root = path.resolve(__dirname, '..');
  const assets = path.join(root, 'src', 'renderer', 'assets');
  const build = path.join(root, 'build');
  await fs.mkdir(assets, { recursive: true });
  await fs.mkdir(build, { recursive: true });

  const blueSource = 'C:\\Users\\Tom Desor\\Downloads\\2973 (1).jpg';
  const epsilonSource = 'C:\\Users\\Tom Desor\\Downloads\\10306.png';
  const bluePng = path.join(assets, 'tomizecorp-logo.png');
  const epsilonPng = path.join(assets, 'epsilon-logo.png');

  await sharp(blueSource).resize(512, 512, { fit: 'cover' }).png().toFile(bluePng);
  await sharp(epsilonSource).resize(512, 512, { fit: 'contain', background: '#000000' }).png().toFile(epsilonPng);

  const pngToIco = (await import('png-to-ico')).default;
  await fs.writeFile(path.join(build, 'icon.ico'), await pngToIco(bluePng));
  await fs.writeFile(path.join(build, 'epsilon.ico'), await pngToIco(epsilonPng));
  const png2icons = require('png2icons');
  const icns = png2icons.createICNS(await fs.readFile(bluePng), png2icons.BICUBIC, 0);
  if (!icns) throw new Error('Impossible de générer l’icône macOS.');
  await fs.writeFile(path.join(build, 'icon.icns'), icns);
  console.log('Logos TomizeCorp et EPSILON préparés.');
}

main().catch(error => { console.error(error); process.exit(1); });
