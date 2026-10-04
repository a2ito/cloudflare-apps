/**
 * PWA 用のアイコン PNG を生成する。
 *
 * 画像ライブラリを足さずに済ませたいので、4 倍の解像度で単純に塗ってから
 * 縮小して滑らかにし、zlib で PNG を書き出している（apps/tabilog と同じ作り）。
 * 図柄は src/app/icon.svg（緑の角丸に白い W）に合わせている。
 * デザインを変えたら `node scripts/gen-icons.mjs` で作り直す。
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const ICONS_DIR = join(process.cwd(), "public", "icons");
const APP_DIR = join(process.cwd(), "src", "app");

const BG = [16, 185, 129, 255]; // emerald-500
const FG = [255, 255, 255, 255];
const SS = 4; // スーパーサンプリング倍率

/* ── 画素バッファ ───────────────────────────────────────────── */

function createCanvas(size) {
  return { size, data: new Uint8Array(size * size * 4) };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.size || y >= canvas.size) return;
  const i = (y * canvas.size + x) * 4;
  canvas.data[i] = color[0];
  canvas.data[i + 1] = color[1];
  canvas.data[i + 2] = color[2];
  canvas.data[i + 3] = color[3];
}

/** 角丸の内側かどうか。r=0 なら普通の矩形 */
function insideRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || y < y0 || x > x1 || y > y1) return false;
  if (r <= 0) return true;
  const cx = x < x0 + r ? x0 + r : x > x1 - r ? x1 - r : x;
  const cy = y < y0 + r ? y0 + r : y > y1 - r ? y1 - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function fillRoundRect(canvas, x0, y0, x1, y1, r, color) {
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
      if (insideRoundRect(x + 0.5, y + 0.5, x0, y0, x1, y1, r)) setPixel(canvas, x, y, color);
    }
  }
}

/** 点 (px, py) から線分 a-b までの距離 */
function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 折れ線を太さ width で塗る。端と角は丸くなる */
function strokePolyline(canvas, points, width, color) {
  const half = width / 2;
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys) - half); y <= Math.ceil(Math.max(...ys) + half); y++) {
    for (let x = Math.floor(Math.min(...xs) - half); x <= Math.ceil(Math.max(...xs) + half); x++) {
      const near = points
        .slice(1)
        .some((b, i) => distanceToSegment(x + 0.5, y + 0.5, points[i], b) <= half);
      if (near) setPixel(canvas, x, y, color);
    }
  }
}

/** 4x4 の平均を取って縮小する（縁を滑らかにするため） */
function downsample(canvas, factor) {
  const size = canvas.size / factor;
  const out = createCanvas(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0, 0];
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const i = ((y * factor + dy) * canvas.size + (x * factor + dx)) * 4;
          for (let c = 0; c < 4; c++) sum[c] += canvas.data[i + c];
        }
      }
      setPixel(out, x, y, sum.map((v) => Math.round(v / (factor * factor))));
    }
  }
  return out;
}

/* ── アイコンの図柄 ─────────────────────────────────────────── */

/**
 * 緑の地に白い W を描く。
 * maskable は端が切り落とされるため、地の色を全面に敷いて図柄を内側に寄せる。
 */
function drawIcon(size, { maskable }) {
  const canvas = createCanvas(size);
  const bgRadius = maskable ? 0 : size * 0.25; // icon.svg の rx=8/32 に合わせる
  fillRoundRect(canvas, 0, 0, size - 1, size - 1, bgRadius, BG);

  // 図柄を置く正方形（maskable は安全領域に収める）
  const box = size * (maskable ? 0.5 : 0.62);
  const o = (size - box) / 2;
  const at = ([x, y]) => [o + box * x, o + box * y];

  const w = [
    [0.04, 0.12],
    [0.27, 0.88],
    [0.5, 0.36],
    [0.73, 0.88],
    [0.96, 0.12],
  ].map(at);
  strokePolyline(canvas, w, box * 0.17, FG);

  return canvas;
}

/* ── PNG 出力 ──────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const body = Buffer.concat([typeBytes, data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(canvas) {
  const { size, data } = canvas;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // 10..12 は圧縮方式・フィルタ方式・インターレースで、いずれも 0

  // 各行の先頭にフィルタ種別のバイトを置く（0 = フィルタなし）
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    Buffer.from(data.buffer, y * size * 4, size * 4).copy(raw, rowStart + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function write(file, size, opts = {}) {
  const canvas = downsample(drawIcon(size * SS, { maskable: false, ...opts }), SS);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePng(canvas));
  console.log(`${file} (${size}x${size})`);
}

write(join(ICONS_DIR, "icon-192.png"), 192);
write(join(ICONS_DIR, "icon-512.png"), 512);
write(join(ICONS_DIR, "icon-maskable-512.png"), 512, { maskable: true });
// iOS のホーム画面用。Next.js が app/apple-icon.png から <link> を足す。
// 角丸は OS 側が付けるので四角いまま出す
write(join(APP_DIR, "apple-icon.png"), 180, { maskable: true });
