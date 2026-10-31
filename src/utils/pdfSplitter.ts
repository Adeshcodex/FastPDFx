/**
 * FastPDFx — Core PDF Splitting Utility
 * Fully client-side using pdf-lib with strict ArrayBuffer memory safety.
 *
 * Guarantees:
 * - Fresh, independent Uint8Array byte slices on every call.
 * - No sharing of underlying ArrayBuffers with PDF.js or web workers.
 * - Graceful error handling for corrupt, empty, or password-protected documents.
 */

import { PDFDocument } from 'pdf-lib';
import { ParsedRangeChunk } from './pdfRangeParser';

/**
 * Creates a clean, detached-safe byte clone of a Uint8Array.
 */
export function clonePdfBytes(source: Uint8Array): Uint8Array {
  const clone = new Uint8Array(source.length);
  clone.set(source);
  return clone;
}

export interface SplitResultItem {
  id: string;
  name: string;
  bytes: Uint8Array;
  pageCount: number;
  pagesDescription: string;
}

/**
 * Validates a PDF's integrity and returns total page count.
 */
export async function inspectPdfDocument(bytes: Uint8Array): Promise<{ pageCount: number }> {
  try {
    const doc = await PDFDocument.load(clonePdfBytes(bytes), { ignoreEncryption: false });
    const pageCount = doc.getPageCount();
    return { pageCount };
  } catch (err: unknown) {
    const errStr = String(err);
    if (errStr.includes('encrypted') || errStr.includes('password')) {
      throw new Error('This PDF is password-protected. Password-protected PDFs cannot be split.');
    }
    throw new Error('Could not read PDF. The file may be corrupt or formatted improperly.');
  }
}

/**
 * Extract specific selected pages into a single new PDF.
 * Pages are kept in the order provided (or natural sorted order).
 */
export async function extractSelectedPages(
  sourceBytes: Uint8Array,
  baseName: string,
  selectedPages: number[]
): Promise<SplitResultItem> {
  if (selectedPages.length === 0) {
    throw new Error('No pages were selected for extraction.');
  }

  // Load a fresh document from clean byte clone
  const srcDoc = await PDFDocument.load(clonePdfBytes(sourceBytes), { ignoreEncryption: false });
  const newDoc = await PDFDocument.create();

  // 0-indexed page indices
  const pageIndices = selectedPages.map(p => p - 1);
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
  copiedPages.forEach(p => newDoc.addPage(p));

  const outputBytes = await newDoc.save();
  const fileName = `${baseName}-extracted-${selectedPages.length}pages.pdf`;

  return {
    id: `extract-${Date.now()}`,
    name: fileName,
    bytes: outputBytes,
    pageCount: selectedPages.length,
    pagesDescription: `Pages ${selectedPages.join(', ')}`
  };
}

/**
 * Split each page into its own standalone 1-page PDF document.
 */
export async function splitEveryPage(
  sourceBytes: Uint8Array,
  baseName: string,
  totalPages: number,
  onProgress?: (current: number, total: number) => void
): Promise<SplitResultItem[]> {
  if (totalPages < 1) {
    throw new Error('Document has no pages to split.');
  }

  // Load one fresh source document to copy from
  const srcDoc = await PDFDocument.load(clonePdfBytes(sourceBytes), { ignoreEncryption: false });
  const results: SplitResultItem[] = [];

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) {
      onProgress(i, totalPages);
    }

    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(srcDoc, [i - 1]);
    singleDoc.addPage(copiedPage);

    const outputBytes = await singleDoc.save();
    const fileName = `${baseName}-page-${i}.pdf`;

    results.push({
      id: `page-${i}-${Date.now()}`,
      name: fileName,
      bytes: outputBytes,
      pageCount: 1,
      pagesDescription: `Page ${i}`
    });
  }

  return results;
}

/**
 * Split by custom ranges either into individual files per range or 1 merged file.
 */
export async function splitByCustomRanges(
  sourceBytes: Uint8Array,
  baseName: string,
  chunks: ParsedRangeChunk[],
  combineMode: 'separate' | 'combine',
  allUniquePages: number[],
  rawRangeInput: string,
  onProgress?: (current: number, total: number) => void
): Promise<SplitResultItem[]> {
  if (chunks.length === 0) {
    throw new Error('No valid page ranges provided.');
  }

  const srcDoc = await PDFDocument.load(clonePdfBytes(sourceBytes), { ignoreEncryption: false });
  const results: SplitResultItem[] = [];

  if (combineMode === 'combine') {
    // Single combined document containing all unique requested pages
    const newDoc = await PDFDocument.create();
    const indicesToCopy = allUniquePages.map(p => p - 1);
    const copiedPages = await newDoc.copyPages(srcDoc, indicesToCopy);
    copiedPages.forEach(p => newDoc.addPage(p));

    const outputBytes = await newDoc.save();
    const sanitizedInput = rawRangeInput.replace(/[\s,]+/g, '_').slice(0, 30);
    const fileName = `${baseName}-ranges-${sanitizedInput}.pdf`;

    results.push({
      id: `range-combined-${Date.now()}`,
      name: fileName,
      bytes: outputBytes,
      pageCount: allUniquePages.length,
      pagesDescription: `Ranges: ${chunks.map(c => c.raw).join(', ')}`
    });
  } else {
    // Separate document for each chunk
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      if (onProgress) {
        onProgress(idx + 1, chunks.length);
      }

      const chunkDoc = await PDFDocument.create();
      const indicesToCopy = chunk.pages.map(p => p - 1);
      const copiedPages = await chunkDoc.copyPages(srcDoc, indicesToCopy);
      copiedPages.forEach(p => chunkDoc.addPage(p));

      const outputBytes = await chunkDoc.save();
      const fileName = chunk.start === chunk.end
        ? `${baseName}-page-${chunk.start}.pdf`
        : `${baseName}-pages-${chunk.start}-${chunk.end}.pdf`;

      results.push({
        id: `range-${idx}-${Date.now()}`,
        name: fileName,
        bytes: outputBytes,
        pageCount: chunk.pages.length,
        pagesDescription: chunk.start === chunk.end ? `Page ${chunk.start}` : `Pages ${chunk.start}–${chunk.end}`
      });
    }
  }

  return results;
}
