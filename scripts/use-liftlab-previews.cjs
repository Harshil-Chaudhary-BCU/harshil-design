const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'liftlab.html');
const originalPattern = /^\.\/assets\/liftlab\/(?!previews\/)([^?#]+)\.(png|jpe?g)(?:[?#].*)?$/i;
let html = fs.readFileSync(htmlPath, 'utf8');
let changed = 0;

html = html.replace(/<img\b[^>]*>/gi, tag => {
  const sourceMatch = tag.match(/\bsrc="([^"]+)"/i);
  if (!sourceMatch) return tag;
  const originalSource = sourceMatch[1];
  const pathMatch = originalSource.match(originalPattern);
  if (!pathMatch) return tag;
  const previewSource = `./assets/liftlab/previews/${pathMatch[1]}.webp`;
  let updated = tag.replace(sourceMatch[0], `src="${previewSource}" data-full-src="${originalSource}"`);
  if (!/\bdecoding=/i.test(updated)) updated = updated.replace(/>$/, ' decoding="async">');
  changed += 1;
  return updated;
});

fs.writeFileSync(htmlPath, html);
console.log(`Updated ${changed} LiftLab image references.`);
