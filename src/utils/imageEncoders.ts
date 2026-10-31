/**
 * Professional in-browser image format encoders and decoders for FastPDFx.
 * Supports BMP, ICO, TIFF, SVG sanitization, and AVIF feature detection.
 */

import UTIF from 'utif';
import DOMPurify from 'dompurify';

/**
 * Checks whether the current browser canvas supports AVIF encoding.
 */
let avifSupportCache: boolean | null = null;
export async function isAvifSupported(): Promise<boolean> {
  if (avifSupportCache !== null) return avifSupportCache;
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const blob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/avif');
    });
    avifSupportCache = !!blob && blob.type === 'image/avif';
  } catch {
    avifSupportCache = false;
  }
  return avifSupportCache;
}

/**
 * Encodes an ImageData object into a genuine 24-bit/32-bit Windows Bitmap (BMP) file.
 */
export function encodeBmp(imageData: ImageData): Blob {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  // 24-bit BMP: 3 bytes per pixel (BGR). Each row must be padded to a multiple of 4 bytes.
  const bytesPerPixel = 3;
  const rowSize = Math.floor((bytesPerPixel * width + 3) / 4) * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // --- BITMAPFILEHEADER (14 bytes) ---
  view.setUint16(0, 0x424d, false); // 'BM' signature
  view.setUint32(2, fileSize, true); // File size
  view.setUint16(6, 0, true); // Reserved
  view.setUint16(8, 0, true); // Reserved
  view.setUint32(10, 54, true); // Data offset (14 + 40)

  // --- BITMAPINFOHEADER (40 bytes) ---
  view.setUint32(14, 40, true); // DIB header size
  view.setInt32(18, width, true); // Width
  view.setInt32(22, height, true); // Height (positive = bottom-to-top)
  view.setUint16(26, 1, true); // Color planes
  view.setUint16(28, 24, true); // Bits per pixel (24)
  view.setUint32(30, 0, true); // Compression (0 = BI_RGB, uncompressed)
  view.setUint32(34, imageSize, true); // Image data size
  view.setInt32(38, 2835, true); // Horizontal resolution (72 DPI)
  view.setInt32(42, 2835, true); // Vertical resolution (72 DPI)
  view.setUint32(46, 0, true); // Colors in palette
  view.setUint32(50, 0, true); // Important colors

  // --- Pixel Data (Bottom-to-Top, BGR order) ---
  const pixelArray = new Uint8Array(buffer, 54);
  for (let y = 0; y < height; y++) {
    const srcRow = height - 1 - y; // Bottom to top
    const rowOffset = y * rowSize;
    for (let x = 0; x < width; x++) {
      const srcIndex = (srcRow * width + x) * 4;
      const destIndex = rowOffset + x * bytesPerPixel;

      const r = data[srcIndex];
      const g = data[srcIndex + 1];
      const b = data[srcIndex + 2];
      const a = data[srcIndex + 3];

      // Alpha composite over white if alpha < 255
      const alphaFactor = a / 255;
      pixelArray[destIndex] = Math.round(b * alphaFactor + 255 * (1 - alphaFactor)); // Blue
      pixelArray[destIndex + 1] = Math.round(g * alphaFactor + 255 * (1 - alphaFactor)); // Green
      pixelArray[destIndex + 2] = Math.round(r * alphaFactor + 255 * (1 - alphaFactor)); // Red
    }
  }

  return new Blob([buffer], { type: 'image/bmp' });
}

/**
 * Encodes an image into a valid Windows ICO format using modern PNG-in-ICO container standard.
 * Icons are standardized to square sizes (e.g., 32x32, 64x64, 128x128, or 256x256).
 */
export async function encodeIco(canvas: HTMLCanvasElement): Promise<Blob> {
  // Scale or fit image into standard icon canvas (max 256x256 as per ICO specification)
  const targetSize = Math.min(256, Math.max(32, Math.min(canvas.width, canvas.height)));
  const iconCanvas = document.createElement('canvas');
  iconCanvas.width = targetSize;
  iconCanvas.height = targetSize;
  const ctx = iconCanvas.getContext('2d')!;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(canvas, 0, 0, targetSize, targetSize);

  // Export PNG payload
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    iconCanvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to create icon PNG payload.'));
    }, 'image/png');
  });

  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());
  const icoFileSize = 6 + 16 + pngBytes.length;

  const icoBuffer = new ArrayBuffer(icoFileSize);
  const view = new DataView(icoBuffer);

  // --- ICONDIR (6 bytes) ---
  view.setUint16(0, 0, true); // Reserved (must be 0)
  view.setUint16(2, 1, true); // Resource type (1 for icon)
  view.setUint16(4, 1, true); // Number of images in directory

  // --- ICONDIRENTRY (16 bytes) ---
  view.setUint8(6, targetSize === 256 ? 0 : targetSize); // Width (0 means 256)
  view.setUint8(7, targetSize === 256 ? 0 : targetSize); // Height (0 means 256)
  view.setUint8(8, 0); // Palette colors
  view.setUint8(9, 0); // Reserved
  view.setUint16(10, 1, true); // Color planes
  view.setUint16(12, 32, true); // Bits per pixel
  view.setUint32(14, pngBytes.length, true); // Size of PNG payload
  view.setUint32(18, 22, true); // Offset of PNG data (6 + 16 = 22)

  // Copy PNG payload
  const targetArray = new Uint8Array(icoBuffer, 22);
  targetArray.set(pngBytes);

  return new Blob([icoBuffer], { type: 'image/x-icon' });
}

/**
 * Decodes a TIFF file into an ImageData structure via UTIF.
 */
export async function decodeTiff(buffer: ArrayBuffer): Promise<{
  imageData: ImageData;
  width: number;
  height: number;
  pageCount: number;
}> {
  const ifds = UTIF.decode(buffer);
  if (!ifds || ifds.length === 0) {
    throw new Error('Invalid or unreadable TIFF file.');
  }

  const firstPage = ifds[0];
  UTIF.decodeImage(buffer, firstPage);
  const rgba = UTIF.toRGBA8(firstPage);
  const width = firstPage.width;
  const height = firstPage.height;

  // Create standard ImageData
  const dummyCanvas = document.createElement('canvas');
  const ctx = dummyCanvas.getContext('2d')!;
  const imageData = ctx.createImageData(width, height);
  imageData.data.set(rgba);

  return {
    imageData,
    width,
    height,
    pageCount: ifds.length
  };
}

/**
 * Encodes an ImageData object into a TIFF file via UTIF.
 */
export function encodeTiff(imageData: ImageData): Blob {
  const rgba = new Uint8Array(imageData.data.buffer);
  const tiffBuffer = UTIF.encodeImage(rgba, imageData.width, imageData.height);
  return new Blob([tiffBuffer], { type: 'image/tiff' });
}

/**
 * Sanitizes and loads SVG text safely using DOMPurify, returning an HTMLImageElement and dimensions.
 */
export async function sanitizeAndLoadSvg(svgText: string): Promise<{
  img: HTMLImageElement;
  width: number;
  height: number;
  sanitizedSvg: string;
}> {
  const cleanSvg = DOMPurify.sanitize(svgText, {
    USE_PROFILES: { svg: true, svgFilters: true }
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanSvg, 'image/svg+xml');
  const svgElem = doc.querySelector('svg');

  if (!svgElem) {
    throw new Error('Invalid SVG: no <svg> root element found.');
  }

  // Determine width and height
  let width = parseFloat(svgElem.getAttribute('width') || '');
  let height = parseFloat(svgElem.getAttribute('height') || '');

  if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
    const viewBox = svgElem.getAttribute('viewBox');
    if (viewBox) {
      const parts = viewBox.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        width = parts[2];
        height = parts[3];
      }
    }
  }

  width = width > 0 ? Math.round(width) : 800;
  height = height > 0 ? Math.round(height) : 600;

  // Load into Image element
  const blob = new Blob([cleanSvg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to render sanitized SVG into canvas.'));
    img.src = url;
  });

  URL.revokeObjectURL(url);
  return { img, width, height, sanitizedSvg: cleanSvg };
}

/**
 * Creates an SVG document wrapping an image for raster-to-SVG conversion.
 */
export function wrapRasterInSvg(dataUrl: string, width: number, height: number): Blob {
  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <desc>FastPDFx Image Container: Embedded high-resolution raster graphic</desc>
  <image width="${width}" height="${height}" xlink:href="${dataUrl}" />
</svg>`;
  return new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
}
