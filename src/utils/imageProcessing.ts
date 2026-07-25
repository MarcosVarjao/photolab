/**
 * Image processing utilities using Canvas 2D.
 * All effects apply to a SOURCE image and return a new data URL,
 * so clicking different effects always replaces — never stacks.
 */

export type SketchStyle = 'classic' | 'rough' | 'detailed' | 'soft' | 'architectural';

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const createCanvas = (w: number, h: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return { canvas, ctx };
};

const toGray = (data: Uint8ClampedArray) => {
  const gray = new Float32Array(data.length / 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return gray;
};

// Separable Gaussian blur on a Float32Array (1 channel).
const gaussianBlur1C = (src: Float32Array, w: number, h: number, radius: number): Float32Array => {
  if (radius < 1) return src.slice();
  const kernel: number[] = [];
  const sigma = radius / 2;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v);
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  const tmp = new Float32Array(src.length);
  const out = new Float32Array(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        acc += src[y * w + xx] * kernel[k + radius];
      }
      tmp[y * w + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        acc += tmp[yy * w + x] * kernel[k + radius];
      }
      out[y * w + x] = acc;
    }
  }
  return out;
};

// Unsharp mask (sharpening) on RGBA.
const unsharpMask = (data: Uint8ClampedArray, w: number, h: number, amount: number, radius: number) => {
  const gray = toGray(data);
  const blurred = gaussianBlur1C(gray, w, h, radius);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const mask = gray[j] - blurred[j];
    const boost = mask * amount;
    data[i] = Math.max(0, Math.min(255, data[i] + boost));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + boost));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + boost));
  }
};

// Sobel edge magnitude (0-255), single channel.
const sobelEdges = (gray: Float32Array, w: number, h: number): Float32Array => {
  const out = new Float32Array(gray.length);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = gray[i - w - 1], tc = gray[i - w], tr = gray[i - w + 1];
      const ml = gray[i - 1], mr = gray[i + 1];
      const bl = gray[i + w - 1], bc = gray[i + w], br = gray[i + w + 1];
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      out[i] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
    }
  }
  return out;
};

// ---- Pencil sketch tone mapping ----
// Produces a graphite-gray palette: dark areas become near-black pencil,
// midtones become gray graphite strokes, highlights become light gray (not white).
// darkness 0-1 controls overall ink density. lineGain boosts edge darkness.
const pencilTone = (gray: Float32Array, darkness: number, lineGain: number): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const g = gray[i] / 255; // 0 dark .. 1 light
    let stroke = 1 - g;
    stroke = Math.pow(stroke, darkness);
    const darkVal = 38;
    const lightVal = 225;
    let val = lightVal - (lightVal - darkVal) * stroke;
    const grain = (Math.random() - 0.5) * 10;
    val = Math.max(20, Math.min(235, val + grain));
    out[i] = val;
  }
  return out;
};

// Combine pencil tone with edge lines for crisper definition.
const pencilWithEdges = (
  gray: Float32Array,
  w: number,
  h: number,
  darkness: number,
  edgeStrength: number,
  blurRadius: number,
): Uint8ClampedArray => {
  const smooth = blurRadius > 0 ? gaussianBlur1C(gray, w, h, blurRadius) : gray;
  const edges = sobelEdges(smooth, w, h);
  const tone = pencilTone(gray, darkness, edgeStrength);
  for (let i = 0; i < tone.length; i++) {
    const e = Math.min(1, edges[i] / 180);
    const darkening = e * edgeStrength * 60;
    tone[i] = Math.max(15, tone[i] - darkening);
  }
  return tone;
};

export interface ProcessOptions {
  onProgress?: (msg: string) => void;
}

// ---- Public API ----

// Downscale an image data URL to a max dimension to keep inference memory-safe.
const downscaleToBlob = async (src: string, maxDim: number): Promise<Blob> => {
  const img = await loadImage(src);
  let w = img.naturalWidth, h = img.naturalHeight;
  const longest = Math.max(w, h);
  if (longest <= maxDim) {
    const resp = await fetch(src);
    return await resp.blob();
  }
  const ratio = maxDim / longest;
  w = Math.round(w * ratio);
  h = Math.round(h * ratio);
  const { canvas } = createCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
};

export async function removeBackgroundFromImage(
  src: string,
  opts?: ProcessOptions,
): Promise<string> {
  opts?.onProgress?.('Carregando modelo de IA…');
  const { removeBackground } = await import('@imgly/background-removal');

  // Downscale to 1024px max to keep WASM memory usage safe.
  // The library internally resizes to 1024x1024 for inference anyway.
  opts?.onProgress?.('Preparando imagem…');
  const blob = await downscaleToBlob(src, 1024);

  opts?.onProgress?.('Removendo o fundo…');
  const result = await removeBackground(blob, {
    model: 'isnet_fp16',
    output: { format: 'image/png' },
    progress: (key: string, current: number, total: number) => {
      if (key === 'compute:inference') {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        opts?.onProgress?.(`Removendo o fundo… ${pct}%`);
      }
    },
  });
  return await blobToDataURL(result);
}

export async function enhanceImage(src: string, _opts?: ProcessOptions): Promise<string> {
  const img = await loadImage(src);
  const { canvas, ctx } = createCanvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const w = canvas.width, h = canvas.height;

  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const avg = 0.299 * r + 0.587 * g + 0.114 * b;
    const c = 1.18;
    let nr = avg + (r - avg) * c;
    let ng = avg + (g - avg) * c;
    let nb = avg + (b - avg) * c;
    const savg = 0.299 * nr + 0.587 * ng + 0.114 * nb;
    const s = 1.28;
    nr = savg + (nr - savg) * s;
    ng = savg + (ng - savg) * s;
    nb = savg + (nb - savg) * s;
    d[i] = Math.max(0, Math.min(255, nr + 8));
    d[i + 1] = Math.max(0, Math.min(255, ng + 8));
    d[i + 2] = Math.max(0, Math.min(255, nb + 8));
  }
  unsharpMask(d, w, h, 1.4, 2);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

// Ultra-realistic professional wide-angle photograph simulation.
// Subtle barrel distortion (16-24mm lens), HDR tone mapping, realistic
// color grading, gentle vignette, fine-detail sharpening.
export async function wideAngleEffect(src: string, _opts?: ProcessOptions): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.drawImage(img, 0, 0);
  const srcData = ctx.getImageData(0, 0, w, h);

  const out = ctx.createImageData(w, h);
  const sd = srcData.data, od = out.data;
  const cx = w / 2, cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  // Subtle pincushion-to-barrel distortion typical of a quality 16-24mm lens.
  const k1 = -0.12;
  const k2 = 0.04;
  const norm = maxR > 0 ? 1 / maxR : 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const r2 = dx * dx + dy * dy;
      const rN = Math.sqrt(r2) * norm;
      const distort = 1 + k1 * rN * rN + k2 * rN * rN * rN * rN;
      const sx = Math.round(cx + dx * distort);
      const sy = Math.round(cy + dy * distort);
      const di = (y * w + x) * 4;
      if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
        const si = (sy * w + sx) * 4;
        od[di] = sd[si];
        od[di + 1] = sd[si + 1];
        od[di + 2] = sd[si + 2];
        od[di + 3] = 255;
      } else {
        od[di] = od[di + 1] = od[di + 2] = od[di + 3] = 255;
      }
    }
  }

  // HDR-style local tone mapping: lift shadows, recover highlights, keep midtones natural.
  for (let i = 0; i < od.length; i += 4) {
    const r = od[i] / 255, g = od[i + 1] / 255, b = od[i + 2] / 255;
    const lr = Math.pow(r, 0.72);
    const lg = Math.pow(g, 0.72);
    const lb = Math.pow(b, 0.72);
    const hr = 1 - Math.pow(1 - r, 1.6);
    const hg = 1 - Math.pow(1 - g, 1.6);
    const hb = 1 - Math.pow(1 - b, 1.6);
    const tm = (v: number, lo: number, hi: number) => {
      if (v < 0.5) return lo * (0.5 - v) * 0.6 + v * (1 - (0.5 - v) * 0.6);
      return v * (1 - (v - 0.5) * 0.6) + hi * (v - 0.5) * 0.6;
    };
    let nr = tm(r, lr, hr);
    let ng = tm(g, lg, hg);
    let nb = tm(b, lb, hb);

    // Realistic color grading: slight warmth in highlights, cool in shadows
    const luma = 0.299 * nr + 0.587 * ng + 0.114 * nb;
    if (luma > 0.55) {
      nr += 0.012;
      nb -= 0.01;
    } else {
      nr -= 0.006;
      nb += 0.008;
    }
    const savg = 0.299 * nr + 0.587 * ng + 0.114 * nb;
    const sat = 1.12;
    nr = savg + (nr - savg) * sat;
    ng = savg + (ng - savg) * sat;
    nb = savg + (nb - savg) * sat;

    od[i] = Math.max(0, Math.min(255, nr * 255));
    od[i + 1] = Math.max(0, Math.min(255, ng * 255));
    od[i + 2] = Math.max(0, Math.min(255, nb * 255));
  }

  // Gentle, realistic vignette
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxR;
      const vig = 1 - Math.pow(dist, 3) * 0.22;
      const di = (y * w + x) * 4;
      od[di] = Math.max(0, od[di] * vig);
      od[di + 1] = Math.max(0, od[di + 1] * vig);
      od[di + 2] = Math.max(0, od[di + 2] * vig);
    }
  }

  ctx.putImageData(out, 0, 0);

  // Fine-detail sharpening pass (razor-sharp focus)
  const sharpData = ctx.getImageData(0, 0, w, h);
  unsharpMask(sharpData.data, w, h, 0.8, 1);
  ctx.putImageData(sharpData, 0, 0);

  return canvas.toDataURL('image/png');
}

export const SKETCH_STYLES: { id: SketchStyle; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic Pencil', description: 'Lápis suave sombreado, tons de grafite nítidos' },
  { id: 'rough', label: 'Rough Sketch', description: 'Traços marcados de lápis com textura' },
  { id: 'detailed', label: 'Fine Line', description: 'Linhas finas e detalhadas, precisa' },
  { id: 'soft', label: 'Soft Pencil', description: 'Lápis de pressão leve, gradientes suaves' },
  { id: 'architectural', label: 'Architectural', description: 'Linhas técnicas limpas, sem sombreado' },
];

export async function applySketch(src: string, style: SketchStyle, _opts?: ProcessOptions): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const gray = toGray(imgData.data);

  const base = Math.max(w, h);
  const scale = base / 1000;

  let sketch: Uint8ClampedArray;

  switch (style) {
    case 'classic':
      sketch = pencilWithEdges(gray, w, h, 1.35, 1.0, Math.round(2 * scale));
      break;
    case 'rough': {
      sketch = pencilWithEdges(gray, w, h, 1.6, 1.4, Math.round(2 * scale));
      for (let i = 0; i < sketch.length; i++) {
        const n = (Math.random() - 0.5) * 26;
        sketch[i] = Math.max(18, Math.min(238, sketch[i] + n));
      }
      break;
    }
    case 'detailed':
      sketch = pencilWithEdges(gray, w, h, 1.15, 1.7, Math.round(1 * scale));
      break;
    case 'soft':
      sketch = pencilWithEdges(gray, w, h, 0.9, 0.5, Math.round(4 * scale));
      break;
    case 'architectural': {
      const smooth = gaussianBlur1C(gray, w, h, Math.round(1 * scale));
      const edges = sobelEdges(smooth, w, h);
      sketch = new Uint8ClampedArray(gray.length);
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        const lineDark = Math.min(255, e * 1.8);
        const v = 210 - lineDark * 0.82;
        sketch[i] = Math.max(25, Math.min(220, v));
      }
      break;
    }
    default:
      sketch = pencilWithEdges(gray, w, h, 1.35, 1.0, Math.round(2 * scale));
  }

  const out = ctx.createImageData(w, h);
  const od = out.data;
  for (let i = 0, j = 0; i < od.length; i += 4, j++) {
    od[i] = od[i + 1] = od[i + 2] = sketch[j];
    od[i + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
