/**
 * FastPDFx — Core PDF Compression Engine
 * Fully client-side using pdf-lib and Browser Canvas API.
 * 
 * Features:
 * - PDF integrity validation and password protection detection.
 * - Selective embedded image stream downsampling & JPEG recompression.
 * - Redundant metadata and XML catalog stream stripping.
 * - Object stream compaction (useObjectStreams: true).
 * - Scanned document / bitmap page optimization mode.
 * - 100% honesty: handles documents that are already optimal or vector-only without false savings.
 * - Zero external server uploads; completely private in browser memory.
 */

import { PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Ensure PDF.js worker is registered
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export type CompressionLevel = 'low' | 'medium' | 'high';

export interface CompressionOptions {
  level: CompressionLevel;
  optimizeScannedMode?: boolean;
  onProgress?: (message: string, percent: number) => void;
}

export interface CompressionInspection {
  pageCount: number;
  originalSize: number;
  imageCount: number;
  dctImageCount: number;
  hasImages: boolean;
  estimatedType: 'image_heavy' | 'text_heavy' | 'balanced';
}

export interface CompressionResult {
  compressedBytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  percentReduction: number;
  isLarger: boolean;
  imagesOptimized: number;
  totalImagesFound: number;
  level: CompressionLevel;
  pageCount: number;
  details: {
    objectStreamsUsed: boolean;
    metadataStripped: boolean;
    scannedModeUsed: boolean;
    summaryMessage: string;
  };
}

/**
 * Creates an independent byte copy to prevent detached ArrayBuffer exceptions.
 */
export function clonePdfBytes(bytes: Uint8Array): Uint8Array {
  const clone = new Uint8Array(bytes.length);
  clone.set(bytes);
  return clone;
}

/**
 * Inspects a PDF's internal structure: page count, image count, and encryption status.
 */
export async function inspectPdfForCompression(bytes: Uint8Array): Promise<CompressionInspection> {
  try {
    const doc = await PDFDocument.load(clonePdfBytes(bytes), { ignoreEncryption: false });
    const pageCount = doc.getPageCount();
    let imageCount = 0;
    let dctImageCount = 0;

    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (obj instanceof PDFRawStream) {
        const subtype = obj.dict.get(PDFName.of('Subtype'));
        if (subtype && subtype.toString() === '/Image') {
          imageCount++;
          const filter = obj.dict.get(PDFName.of('Filter'));
          const filterStr = filter ? filter.toString() : '';
          if (filterStr.includes('DCTDecode')) {
            dctImageCount++;
          }
        }
      }
    }

    let estimatedType: 'image_heavy' | 'text_heavy' | 'balanced' = 'text_heavy';
    if (imageCount >= pageCount && imageCount > 0) {
      estimatedType = 'image_heavy';
    } else if (imageCount > 0) {
      estimatedType = 'balanced';
    }

    return {
      pageCount,
      originalSize: bytes.length,
      imageCount,
      dctImageCount,
      hasImages: imageCount > 0,
      estimatedType,
    };
  } catch (err: unknown) {
    const errStr = String(err);
    if (errStr.includes('encrypted') || errStr.includes('password') || errStr.includes('EncryptedPDFError')) {
      throw new Error('This PDF is password-protected. FastPDFx cannot compress encrypted PDFs. Please unlock or decrypt it first.');
    }
    throw new Error('Invalid or corrupted PDF file. Please ensure the file is a standard PDF.');
  }
}

/**
 * Helper to compress a JPEG buffer using browser HTML Image and Canvas.
 */
async function compressJpegBytes(
  jpegBytes: Uint8Array,
  maxDimension: number,
  quality: number
): Promise<{ newBytes: Uint8Array; width: number; height: number } | null> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([jpegBytes as BlobPart], { type: 'image/jpeg' });
      const blobUrl = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        try {
          const origW = img.naturalWidth || img.width;
          const origH = img.naturalHeight || img.height;

          if (!origW || !origH) {
            URL.revokeObjectURL(blobUrl);
            return resolve(null);
          }

          let targetW = origW;
          let targetH = origH;

          if (origW > maxDimension || origH > maxDimension) {
            const ratio = Math.min(maxDimension / origW, maxDimension / origH);
            targetW = Math.max(1, Math.round(origW * ratio));
            targetH = Math.max(1, Math.round(origH * ratio));
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            URL.revokeObjectURL(blobUrl);
            return resolve(null);
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          canvas.toBlob(
            async (resultBlob) => {
              URL.revokeObjectURL(blobUrl);
              if (!resultBlob) {
                return resolve(null);
              }
              const buffer = await resultBlob.arrayBuffer();
              const newBytes = new Uint8Array(buffer);
              resolve({
                newBytes,
                width: targetW,
                height: targetH,
              });
            },
            'image/jpeg',
            quality
          );
        } catch {
          URL.revokeObjectURL(blobUrl);
          resolve(null);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(null);
      };

      img.src = blobUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Renders pages of a scanned PDF to canvas and builds an optimized JPEG-based PDF.
 * Ideal for scanned documents and contracts where each page is an uncompressed raster.
 */
async function compressScannedPdfWithPdfJs(
  sourceBytes: Uint8Array,
  options: CompressionOptions
): Promise<Uint8Array> {
  const { level, onProgress } = options;
  const loadingTask = pdfjsLib.getDocument({ data: clonePdfBytes(sourceBytes) });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;

  let scale = 1.3;
  let quality = 0.72;
  if (level === 'low') {
    scale = 1.6;
    quality = 0.85;
  } else if (level === 'high') {
    scale = 1.0;
    quality = 0.52;
  }

  const outDoc = await PDFDocument.create();

  for (let i = 1; i <= numPages; i++) {
    onProgress?.(`Rendering & compressing page ${i} of ${numPages}...`, Math.round((i / numPages) * 85));
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });

    if (!ctx) {
      throw new Error(`Failed to create 2D canvas context for page ${i}`);
    }

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      intent: 'print',
    }).promise;

    const jpegBlob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, 'image/jpeg', quality)
    );

    if (!jpegBlob) {
      throw new Error(`Failed to encode compressed JPEG for page ${i}`);
    }

    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const embeddedImg = await outDoc.embedJpg(jpegBytes);

    // Keep standard PDF page dimensions in points (72 DPI points)
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    const outPage = outDoc.addPage([unscaledViewport.width, unscaledViewport.height]);
    outPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: unscaledViewport.width,
      height: unscaledViewport.height,
    });
  }

  onProgress?.('Packing object streams and finalizing...', 95);
  const compressedBytes = await outDoc.save({ useObjectStreams: true });
  return compressedBytes;
}

/**
 * Main PDF Compression function.
 */
export async function compressPdfDocument(
  sourceBytes: Uint8Array,
  options: CompressionOptions
): Promise<CompressionResult> {
  const { level, optimizeScannedMode = false, onProgress } = options;
  const originalSize = sourceBytes.length;

  onProgress?.('Analyzing document structure and security...', 10);

  // If scanned mode was explicitly selected, execute scanned raster compressor
  if (optimizeScannedMode) {
    onProgress?.('Processing scanned pages at target compression...', 25);
    const scannedBytes = await compressScannedPdfWithPdfJs(sourceBytes, options);
    const savedBytes = originalSize - scannedBytes.length;
    const isLarger = savedBytes <= 0;
    const percentReduction = isLarger
      ? 0
      : parseFloat(((savedBytes / originalSize) * 100).toFixed(1));

    const insp = await inspectPdfForCompression(sourceBytes);

    return {
      compressedBytes: scannedBytes,
      originalSize,
      compressedSize: scannedBytes.length,
      savedBytes: Math.max(0, savedBytes),
      percentReduction,
      isLarger,
      imagesOptimized: insp.pageCount,
      totalImagesFound: insp.pageCount,
      level,
      pageCount: insp.pageCount,
      details: {
        objectStreamsUsed: true,
        metadataStripped: true,
        scannedModeUsed: true,
        summaryMessage: isLarger
          ? 'Scanned page optimization completed. The file was already very compact.'
          : `Scanned document pages re-encoded with ${level} compression.`,
      },
    };
  }

  // Standard non-destructive PDF compression
  const doc = await PDFDocument.load(clonePdfBytes(sourceBytes), { ignoreEncryption: false });
  const pageCount = doc.getPageCount();

  // Compression parameters
  let maxDimension = 1400;
  let jpegQuality = 0.70;

  if (level === 'low') {
    maxDimension = 1800;
    jpegQuality = 0.85;
  } else if (level === 'high') {
    maxDimension = 900;
    jpegQuality = 0.50;
  }

  onProgress?.('Scanning embedded image streams...', 25);

  let totalImagesFound = 0;
  let imagesOptimized = 0;

  // Find all raw image streams in indirect objects
  const imageEntries: { ref: PDFRef; stream: PDFRawStream }[] = [];
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      const subtype = obj.dict.get(PDFName.of('Subtype'));
      if (subtype && subtype.toString() === '/Image') {
        totalImagesFound++;
        imageEntries.push({ ref: ref as PDFRef, stream: obj });
      }
    }
  }

  // Optimize embedded JPEG streams
  for (let idx = 0; idx < imageEntries.length; idx++) {
    const { ref, stream } = imageEntries[idx];
    const filter = stream.dict.get(PDFName.of('Filter'));
    const filterStr = filter ? filter.toString() : '';

    const progressPct = 30 + Math.round(((idx + 1) / Math.max(1, imageEntries.length)) * 45);
    onProgress?.(`Optimizing image ${idx + 1} of ${imageEntries.length}...`, progressPct);

    // If it's a DCTDecode (JPEG) stream
    if (filterStr.includes('DCTDecode') && stream.contents && stream.contents.length > 512) {
      const originalContentsLen = stream.contents.length;
      const optimized = await compressJpegBytes(stream.contents, maxDimension, jpegQuality);

      if (optimized && optimized.newBytes.length < originalContentsLen) {
        const newDict = stream.dict.clone();
        newDict.set(PDFName.of('Length'), PDFNumber.of(optimized.newBytes.length));
        newDict.set(PDFName.of('Width'), PDFNumber.of(optimized.width));
        newDict.set(PDFName.of('Height'), PDFNumber.of(optimized.height));
        newDict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        newDict.delete(PDFName.of('DecodeParms'));

        const newStream = PDFRawStream.of(newDict, optimized.newBytes);
        doc.context.assign(ref, newStream);
        imagesOptimized++;
      }
    }
  }

  onProgress?.('Stripping redundant metadata & cleaning headers...', 80);

  // Strip catalog metadata streams
  try {
    const catalog = doc.catalog;
    catalog.delete(PDFName.of('Metadata'));
    catalog.delete(PDFName.of('PieceInfo'));
  } catch {
    // Ignore if not present
  }

  // Clear standard info dictionary
  try {
    doc.setTitle('');
    doc.setAuthor('');
    doc.setSubject('');
    doc.setKeywords([]);
    doc.setProducer('FastPDFx (fastpdfx.com)');
    doc.setCreator('FastPDFx Compressor');
  } catch {
    // Ignore if info dict is missing or immutable
  }

  onProgress?.('Packing object streams and finalizing PDF...', 90);

  // Save with compressed object streams
  const compressedBytes = await doc.save({ useObjectStreams: true });

  const savedBytes = originalSize - compressedBytes.length;
  const isLarger = savedBytes <= 0;
  const percentReduction = isLarger
    ? 0
    : parseFloat(((savedBytes / originalSize) * 100).toFixed(1));

  onProgress?.('Compression complete!', 100);

  let summaryMessage = '';
  if (isLarger) {
    summaryMessage =
      'This PDF is already highly optimized. Because text and vector paths are already stored in compressed streams and contain no compressible images, further reduction without rasterization is not possible.';
  } else if (imagesOptimized > 0) {
    summaryMessage = `Successfully optimized ${imagesOptimized} embedded image stream${imagesOptimized === 1 ? '' : 's'} and packed object streams.`;
  } else {
    summaryMessage = 'Cleaned metadata, stripped redundant streams, and packed object streams.';
  }

  return {
    compressedBytes,
    originalSize,
    compressedSize: compressedBytes.length,
    savedBytes: Math.max(0, savedBytes),
    percentReduction,
    isLarger,
    imagesOptimized,
    totalImagesFound,
    level,
    pageCount,
    details: {
      objectStreamsUsed: true,
      metadataStripped: true,
      scannedModeUsed: false,
      summaryMessage,
    },
  };
}
