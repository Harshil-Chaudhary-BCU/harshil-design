const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'liftlab.html');
const previewRoot = path.join(root, 'assets/liftlab/previews');
const originalPattern = /\.\/assets\/liftlab\/(?!previews\/)([^"?#]+\.(?:png|jpe?g))/gi;
const html = fs.readFileSync(htmlPath, 'utf8');
const relativeSources = [...new Set([...html.matchAll(originalPattern)].map(match => match[1]))];

const previewPathFor = relativeSource => {
  const parsed = path.parse(relativeSource);
  return path.join(previewRoot, parsed.dir, `${parsed.name}.webp`);
};

const buildPreview = async relativeSource => {
  const source = path.join(root, 'assets/liftlab', relativeSource);
  const output = previewPathFor(relativeSource);
  const metadata = await sharp(source).metadata();
  const ratio = (metadata.width || 1) / (metadata.height || 1);
  const maxWidth = ratio >= 1.7 ? 1600 : ratio <= 0.72 ? 900 : 1200;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(source)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 80, smartSubsample: true, alphaQuality: 90, effort: 6 })
    .toFile(output);
  const preview = await sharp(output).metadata();
  return {
    relativeSource,
    output,
    width: preview.width,
    height: preview.height,
    originalBytes: fs.statSync(source).size,
    previewBytes: fs.statSync(output).size
  };
};

(async () => {
  const results = [];
  for (const source of relativeSources) results.push(await buildPreview(source));
  const originalBytes = results.reduce((sum, item) => sum + item.originalBytes, 0);
  const previewBytes = results.reduce((sum, item) => sum + item.previewBytes, 0);
  console.log(JSON.stringify({
    count: results.length,
    originalBytes,
    previewBytes,
    reductionPercent: Number((100 - previewBytes / originalBytes * 100).toFixed(1)),
    results
  }, null, 2));
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
