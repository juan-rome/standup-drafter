// Renders the tray icon as a monochrome "punch-cut" clipboard face — a
// rounded clipboard silhouette with two eyes and a smile cut out of it, so
// macOS's template-image tinting shows the face as negative space.
// Regenerate with: node scripts/generate-tray-icon.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function roundedRectSDF(x, y, rx, ry, rw, rh, radius) {
  const qx = Math.max(Math.abs(x - (rx + rw / 2)) - (rw / 2 - radius), 0);
  const qy = Math.max(Math.abs(y - (ry + rh / 2)) - (rh / 2 - radius), 0);
  return Math.hypot(qx, qy) - radius;
}

function circleSDF(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) - r;
}

function segmentSDF(x, y, x1, y1, x2, y2, width) {
  const vx = x2 - x1;
  const vy = y2 - y1;
  const wx = x - x1;
  const wy = y - y1;
  const len2 = vx * vx + vy * vy;
  let t = len2 > 0 ? (wx * vx + wy * vy) / len2 : 0;
  t = clamp(t, 0, 1);
  const px = x1 + t * vx;
  const py = y1 + t * vy;
  return Math.hypot(x - px, y - py) - width / 2;
}

// All coordinates are fractions of the canvas (0..1); scaled to pixels at render time.
function sceneSDF(u, v, size) {
  const x = u * size;
  const y = v * size;

  const body = roundedRectSDF(x, y, 0.22 * size, 0.16 * size, 0.56 * size, 0.70 * size, 0.09 * size);
  const clip = roundedRectSDF(x, y, 0.40 * size, 0.05 * size, 0.20 * size, 0.15 * size, 0.03 * size);
  const shell = Math.min(body, clip);

  const eyeL = circleSDF(x, y, 0.38 * size, 0.44 * size, 0.045 * size);
  const eyeR = circleSDF(x, y, 0.62 * size, 0.44 * size, 0.045 * size);
  const mouthL = segmentSDF(x, y, 0.36 * size, 0.60 * size, 0.50 * size, 0.70 * size, 0.045 * size);
  const mouthR = segmentSDF(x, y, 0.50 * size, 0.70 * size, 0.64 * size, 0.60 * size, 0.045 * size);
  const face = Math.min(eyeL, eyeR, mouthL, mouthR);

  return Math.max(shell, -face);
}

function renderPNG(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const d = sceneSDF((px + 0.5) / size, (py + 0.5) / size, size);
      const coverage = clamp(0.5 - d, 0, 1);
      const alpha = Math.round(coverage * 255);
      const i = (py * size + px) * 4;
      pixels[i] = 0;
      pixels[i + 1] = 0;
      pixels[i + 2] = 0;
      pixels[i + 3] = alpha;
    }
  }
  return encodePNG(size, size, pixels);
}

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })());
  c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);
    raw[rowStart] = 0; // filter: none
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.join(__dirname, '..', 'src', 'assets');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'tray-icon.png'), renderPNG(22));
fs.writeFileSync(path.join(outDir, 'tray-icon@2x.png'), renderPNG(44));
console.log('Wrote tray-icon.png (22x22) and tray-icon@2x.png (44x44) to src/assets/');
