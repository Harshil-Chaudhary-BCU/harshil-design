const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '..');

(async () => {
  // A single vector master supplies all browser and Apple touch sizes.
  const source = path.join(root, 'assets/favicon.svg');
  const frames = [];
  for (const size of [16, 32, 48]) {
    const png = await sharp(source, { density: 384 }).resize(size, size).png().toBuffer();
    frames.push({ size, png });
    await fs.promises.writeFile(path.join(root, `assets/hc-icon-${size}-v3.png`), png);
  }
  await sharp(source, { density: 384 }).resize(180, 180).png().toFile(path.join(root, 'assets/hc-touch-180-v3.png'));
  await fs.promises.copyFile(path.join(root, 'assets/hc-touch-180-v3.png'), path.join(root, 'apple-touch-icon.png'));
  const shareMark = await sharp(source, { density: 768 }).resize(560, 560).png().toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 3, background: '#090909' } })
    .composite([{ input: shareMark, gravity: 'centre' }])
    .png()
    .toFile(path.join(root, 'assets/hc-share-v3.png'));
  const header = Buffer.alloc(6 + frames.length * 16);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  frames.forEach(({ size, png }, i) => {
    const entry = 6 + i * 16;
    header[entry] = size;
    header[entry + 1] = size;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  await fs.promises.writeFile(path.join(root, 'favicon.ico'), Buffer.concat([header, ...frames.map(f => f.png)]));
  console.log('Generated HC favicons and root browser fallbacks from assets/favicon.svg.');
})().catch(error => { console.error(error); process.exitCode = 1; });
