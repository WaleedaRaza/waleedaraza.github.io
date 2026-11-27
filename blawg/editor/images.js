// Picture prep before commit: JPG/PNG only, <=1600px wide, <=400KB, plain lowercase filename.
import { slug } from './model.js';

export const MAX_W = 1600;
export const MAX_BYTES = 400 * 1024;

export function imageName(name, mime) {
  const ext = mime === 'image/png' ? 'png' : 'jpg';
  const base = slug(String(name || '').replace(/\.(jpe?g|png|webp|gif)$/i, '')) || 'image';
  return `${base}.${ext}`;
}

function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Could not read that picture.')); };
    img.src = url;
  });
}
const toBlob = (canvas, type, q) => new Promise((res) => canvas.toBlob(res, type, q));

// Returns {bytes: Uint8Array, width, height, mime, ext}
export async function prepareImage(file) {
  const mime = file.type === 'image/png' ? 'image/png' : (file.type === 'image/jpeg' ? 'image/jpeg' : null);
  if (!mime) throw new Error('Only JPG or PNG pictures (no WebP).');
  const img = await loadImage(file);
  let w = Math.min(MAX_W, img.naturalWidth);
  let blob = null;
  for (let round = 0; round < 24; round++) {
    const h = Math.max(1, Math.round(img.naturalHeight * (w / img.naturalWidth)));
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    if (mime === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(img, 0, 0, w, h);
    if (mime === 'image/jpeg') {
      for (const q of [0.9, 0.82, 0.74, 0.66, 0.58, 0.5]) { blob = await toBlob(c, mime, q); if (blob.size <= MAX_BYTES) break; }
    } else blob = await toBlob(c, mime);
    if (blob.size <= MAX_BYTES) return { bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h, mime, ext: mime === 'image/png' ? 'png' : 'jpg' };
    w = Math.max(16, Math.floor(w * Math.min(0.9, Math.sqrt(MAX_BYTES / blob.size))));
  }
  throw new Error('Could not get that picture under 400KB.');
}
