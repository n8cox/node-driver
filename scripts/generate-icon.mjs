/**
 * Generates build/icon.png and build/icon.icns from an inline SVG.
 *
 * Rebuild on macOS (alternative to png2icons):
 *   mkdir -p build/icon.iconset
 *   sips -z 16 16     build/icon.png --out build/icon.iconset/icon_16x16.png
 *   sips -z 32 32     build/icon.png --out build/icon.iconset/icon_16x16@2x.png
 *   sips -z 32 32     build/icon.png --out build/icon.iconset/icon_32x32.png
 *   sips -z 64 64     build/icon.png --out build/icon.iconset/icon_32x32@2x.png
 *   sips -z 128 128   build/icon.png --out build/icon.iconset/icon_128x128.png
 *   sips -z 256 256   build/icon.png --out build/icon.iconset/icon_128x128@2x.png
 *   sips -z 256 256   build/icon.png --out build/icon.iconset/icon_256x256.png
 *   sips -z 512 512   build/icon.png --out build/icon.iconset/icon_256x256@2x.png
 *   sips -z 512 512   build/icon.png --out build/icon.iconset/icon_512x512.png
 *   sips -z 1024 1024 build/icon.png --out build/icon.iconset/icon_512x512@2x.png
 *   iconutil -c icns build/icon.iconset -o build/icon.icns
 *   rm -rf build/icon.iconset
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import png2icons from 'png2icons';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const buildDir = path.join(root, 'build');
const pngPath = path.join(buildDir, 'icon.png');
const icnsPath = path.join(buildDir, 'icon.icns');

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#111113"/>
      <stop offset="100%" stop-color="#0a0a0b"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="224" fill="url(#bg)"/>
  <rect x="96" y="96" width="832" height="832" rx="96" fill="none" stroke="#2a2a30" stroke-width="8"/>
  <g stroke="#52525b" stroke-width="10" stroke-linecap="round">
    <line x1="512" y1="280" x2="512" y2="420"/>
    <line x1="512" y1="604" x2="512" y2="744"/>
    <line x1="280" y1="512" x2="420" y2="512"/>
    <line x1="604" y1="512" x2="744" y2="512"/>
    <line x1="360" y1="360" x2="460" y2="460"/>
    <line x1="564" y1="564" x2="664" y2="664"/>
    <line x1="664" y1="360" x2="564" y2="460"/>
    <line x1="460" y1="564" x2="360" y2="664"/>
  </g>
  <g fill="#71717a">
    <rect x="248" y="248" width="72" height="72" rx="12"/>
    <rect x="704" y="248" width="72" height="72" rx="12"/>
    <rect x="248" y="704" width="72" height="72" rx="12"/>
    <rect x="704" y="704" width="72" height="72" rx="12"/>
    <rect x="476" y="248" width="72" height="72" rx="12"/>
    <rect x="476" y="704" width="72" height="72" rx="12"/>
    <rect x="248" y="476" width="72" height="72" rx="12"/>
    <rect x="704" y="476" width="72" height="72" rx="12"/>
  </g>
  <rect x="448" y="448" width="128" height="128" rx="20" fill="#3b82f6"/>
  <rect x="472" y="472" width="80" height="80" rx="12" fill="#60a5fa" opacity="0.35"/>
</svg>`;

fs.mkdirSync(buildDir, { recursive: true });

const pngBuffer = await sharp(Buffer.from(iconSvg)).png().toBuffer();
fs.writeFileSync(pngPath, pngBuffer);

const icnsBuffer = png2icons.createICNS(pngBuffer, png2icons.BICUBIC, 0);
if (!icnsBuffer) {
  throw new Error('Failed to generate icon.icns from icon.png');
}
fs.writeFileSync(icnsPath, icnsBuffer);

console.log(`Wrote ${pngPath}`);
console.log(`Wrote ${icnsPath}`);
