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
  // Horizontal
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
  // Vertical
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

// Color-dodge pencil sketch core. Returns grayscale sketch in 0-255.
const pencilDodge = (
  gray: Float32Array,
  w: number,
  h: number,
  blurRadius: number,
  contrast: number,
  pressure: number,
): Uint8ClampedArray => {
  const inv = new Float32Array(gray.length);
  for (let i = 0; i < gray.length; i++) inv[i] = 255 - gray[i];
  const blurredInv = gaussianBlur1C(inv, w, h, blurRadius);

  const out = new Uint8ClampedArray(gray.length);
  for (let i = 0; i < gray.length; i++) {
    // color dodge: base / (1 - blend)
    const base = gray[i] / 255;
    const blend = blurredInv[i] / 255;
    let v = blend >= 1 ? 1 : base / (1 - blend);
    v = Math.pow(v, pressure); // pressure curve
    v = ((v - 0.5) * contrast + 0.5); // contrast
    out[i] = Math.max(0, Math.min(255, v * 255));
  }
  return out;
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

export interface ProcessOptions {
  onProgress?: (msg: string) => void;
}

// ---- Public API ----

export async function removeBackgroundFromImage(
  src: string,
  opts?: ProcessOptions,
): Promise<string> {
  opts?.onProgress?.('Loading AI model…');
  const { removeBackground } = await import('@imgly/background-removal');
  opts?.onProgress?.('Removing background…');
  const blob = await removeBackground(src, {
    progress: (key: string, current: number, total: number) => {
      if (key === 'compute:inference') {
        opts?.onProgress?.(`Removing background… ${Math.round((current / total) * 100)}%`);
      }
    },
  });
  return await blobToDataURL(blob);
}

export async function enhanceImage(src: string, _opts?: ProcessOptions): Promise<string> {
  const img = await loadImage(src);
  const { canvas, ctx } = createCanvas(img.naturalWidth, img.naturalHeight);
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const w = canvas.width, h = canvas.height;

  // Boost saturation + contrast
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const avg = 0.299 * r + 0.587 * g + 0.114 * b;
    // contrast 1.18
    const c = 1.18;
    let nr = avg + (r - avg) * c;
    let ng = avg + (g - avg) * c;
    let nb = avg + (b - avg) * c;
    // saturation 1.28
    const savg = 0.299 * nr + 0.587 * ng + 0.114 * nb;
    const s = 1.28;
    nr = savg + (nr - savg) * s;
    ng = savg + (ng - savg) * s;
    nb = savg + (nb - savg) * s;
    // slight brightness
    d[i] = Math.max(0, Math.min(255, nr + 8));
    d[i + 1] = Math.max(0, Math.min(255, ng + 8));
    d[i + 2] = Math.max(0, Math.min(255, nb + 8));
  }
  // sharpen
  unsharpMask(d, w, h, 1.4, 2);
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}

// Barrel distortion + pro-camera color grading + vignette.
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
  const k = 0.0009 * (maxR / 400); // barrel strength scales with image size

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const r2 = dx * dx + dy * dy;
      const f = 1 + k * r2;
      const sx = Math.round(cx + dx * f);
      const sy = Math.round(cy + dy * f);
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

  // Pro-camera color grading: punchy saturation + contrast + vignette
  for (let i = 0; i < od.length; i += 4) {
    const r = od[i], g = od[i + 1], b = od[i + 2];
    const avg = 0.299 * r + 0.587 * g + 0.114 * b;
    const c = 1.22;
    let nr = avg + (r - avg) * c;
    let ng = avg + (g - avg) * c;
    let nb = avg + (b - avg) * c;
    const savg = 0.299 * nr + 0.587 * ng + 0.114 * nb;
    const s = 1.35;
    nr = savg + (nr - savg) * s;
    ng = savg + (ng - savg) * s;
    nb = savg + (nb - savg) * s;
    od[i] = Math.max(0, Math.min(255, nr));
    od[i + 1] = Math.max(0, Math.min(255, ng));
    od[i + 2] = Math.max(0, Math.min(255, nb));
  }

  // vignette
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxR;
      const vig = 1 - Math.pow(dist, 2.4) * 0.35;
      const di = (y * w + x) * 4;
      od[di] *= vig;
      od[di + 1] *= vig;
      od[di + 2] *= vig;
    }
  }

  ctx.putImageData(out, 0, 0);
  return canvas.toDataURL('image/png');
}

export const SKETCH_STYLES: { id: SketchStyle; label: string; description: string }[] = [
  { id: 'classic', label: 'Classic Pencil', description: 'Soft shaded pencil drawing with clear tones' },
  { id: 'rough', label: 'Rough Sketch', description: 'Textured pencil strokes with bold lines' },
  { id: 'detailed', label: 'Fine Line', description: 'Crisp detailed lines with precise detail' },
  { id: 'soft', label: 'Soft Pencil', description: 'Light-pressure pencil with smooth gradients' },
  { id: 'architectural', label: 'Architectural', description: 'Clean technical lines, minimal shading' },
];

export async function applySketch(src: string, style: SketchStyle, _opts?: ProcessOptions): Promise<string> {
  const img = await loadImage(src);
  const w = img.naturalWidth, h = img.naturalHeight;
  const { canvas, ctx } = createCanvas(w, h);
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const gray = toGray(imgData.data);

  // Scale blur radius relative to image size so it looks consistent
  const base = Math.max(w, h);
  const scale = base / 1000;

  let sketch: Uint8ClampedArray;

  switch (style) {
    case 'classic':
      sketch = pencilDodge(gray, w, h, Math.round(18 * scale), 1.25, 1.0);
      break;
    case 'rough': {
      sketch = pencilDodge(gray, w, h, Math.round(10 * scale), 1.6, 0.92);
      // add paper-grain noise for rough texture
      for (let i = 0; i < sketch.length; i++) {
        const n = (Math.random() - 0.5) * 22;
        sketch[i] = Math.max(0, Math.min(255, sketch[i] + n));
      }
      break;
    }
    case 'detailed':
      sketch = pencilDodge(gray, w, h, Math.round(8 * scale), 1.45, 1.05);
      break;
    case 'soft':
      sketch = pencilDodge(gray, w, h, Math.round(26 * scale), 1.05, 1.15);
      break;
    case 'architectural': {
      // Edge-only clean technical line drawing
      const edges = sobelEdges(gray, w, h);
      sketch = new Uint8ClampedArray(gray.length);
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i];
        // threshold for clean lines, invert (dark lines on white)
        const v = e > 28 ? 255 - Math.min(255, e * 1.6) : 255;
        sketch[i] = Math.max(0, Math.min(255, v));
      }
      break;
    }
    default:
      sketch = pencilDodge(gray, w, h, Math.round(18 * scale), 1.25, 1.0);
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
