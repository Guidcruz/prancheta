// Generates the PWA icons (192 and 512 PNG, maskable-safe) from app/public/icons/icon.svg.
import sharp from 'sharp';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'app/public/icons/icon.svg');
for (const size of [192, 512]) {
  await sharp(src)
    .resize(size, size)
    .png()
    .toFile(resolve(root, `app/public/icons/icon-${size}.png`));
}
console.log('icons: 192 and 512 written');
