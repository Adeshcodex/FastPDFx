/**
 * FastPDFx — Core PDF to Word (DOCX) Converter Engine
 * 
 * Fully client-side processing using PDF.js, docx, and Tesseract.js.
 * 
 * Features:
 * - PDF integrity validation and password protection detection.
 * - Digital text geometry extraction (X, Y, font size, font style).
 * - Layout reconstruction: reading order sorting, line clustering, and paragraph grouping.
 * - Intelligent heading hierarchy detection (Title, Heading 1, Heading 2, Body).
 * - Text alignment detection (Left, Center, Right).
 * - Scanned page detection (< 40 text characters).
 * - In-browser Optical Character Recognition (OCR) using Tesseract.js (Multi-language).
 * - Standard Microsoft Word (.docx) generation with genuine formatting, page breaks, and styles.
 * - Zero third-party server uploads; 100% private in-browser memory.
 */

import * as pdfjsLib from 'pdfjs-dist';
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Packer,
  PageBreak,
  convertInchesToTwip,
} from 'docx';
import { createWorker } from 'tesseract.js';

// Setup PDF.js worker and interop helper
function getPdfjsInstance() {
  const anyLib = pdfjsLib as any;
  if (typeof anyLib.getDocument === 'function') return anyLib;
  if (anyLib.default && typeof anyLib.default.getDocument === 'function') return anyLib.default;
  return anyLib;
}

const resolvedPdfjs = getPdfjsInstance();
if (typeof window !== 'undefined' && resolvedPdfjs.GlobalWorkerOptions && !resolvedPdfjs.GlobalWorkerOptions.workerSrc) {
  resolvedPdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export type FormattingMode = 'preserve_formatting' | 'text_only';
export type PageSelectionMode = 'all' | 'custom';

export interface ConversionOptions {
  formattingMode: FormattingMode;
  pageSelectionMode: PageSelectionMode;
  customPageRange?: string; // e.g. "1-3, 5, 7-10"
  enableOcrForScanned: boolean;
  ocrLanguage: string; // 'eng' | 'spa' | 'fra' | 'deu' | 'ita' | 'por'
  onProgress?: (message: string, percent: number) => void;
}

export interface PageInspectionInfo {
  pageNum: number;
  charCount: number;
  wordCount: number;
  isScanned: boolean;
  previewSnippet: string;
  hasDevanagari?: boolean;
}

export interface DocumentInspection {
  pageCount: number;
  totalEstimatedWords: number;
  pages: PageInspectionInfo[];
  scannedPages: number[];
  hasScannedPages: boolean;
  isEncrypted: boolean;
  hasDevanagari?: boolean;
  devanagariSampleSnippet?: string;
}

export interface ConversionResult {
  docxBlob: Blob;
  fileName: string;
  pageCount: number;
  pagesProcessed: number[];
  totalWords: number;
  totalParagraphs: number;
  headingsDetected: number;
  scannedPagesFound: number[];
  ocrAppliedPages: number[];
  ocrLanguageUsed?: string;
  fileSizeBytes: number;
}

interface RawTextItem {
  str: string;
  x: number;
  y: number; // top-down coordinate
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
}

interface TextLine {
  items: RawTextItem[];
  text: string;
  y: number;
  height: number;
  fontSize: number;
  minX: number;
  maxX: number;
  isBold: boolean;
  isItalic: boolean;
}

interface StructuredParagraph {
  text: string;
  runs: Array<{
    text: string;
    bold?: boolean;
    italics?: boolean;
    fontSizePt?: number;
  }>;
  headingLevel?: typeof HeadingLevel[keyof typeof HeadingLevel];
  alignment: typeof AlignmentType[keyof typeof AlignmentType];
  isBullet?: boolean;
}

/**
 * Creates an independent Uint8Array copy to prevent detached ArrayBuffer exceptions.
 */
function clonePdfBuffer(source: Uint8Array): Uint8Array {
  const copy = new Uint8Array(source.length);
  copy.set(source);
  return copy;
}

/**
 * Unicode Range for Devanagari script:
 * - Basic Devanagari: U+0900 - U+097F
 * - Devanagari Extended: U+A8E0 - U+A8FF
 * - Vedic Extensions: U+1CD0 - U+1CFF
 */
export const DEVANAGARI_REGEX = /[\u0900-\u097F\uA8E0-\uA8FF\u1CD0-\u1CFF]/;

/**
 * Checks if a string contains any Devanagari / Hindi script characters.
 */
export function containsDevanagari(text: string): boolean {
  if (!text) return false;
  return DEVANAGARI_REGEX.test(text);
}

/**
 * Identifies if a character is a Devanagari combining mark, matra, nukta, virama, or accent.
 * Crucial: combining marks must never have whitespace artificially inserted before them.
 */
export function isDevanagariCombiningChar(char: string): boolean {
  if (!char) return false;
  const cp = char.codePointAt(0);
  if (cp === undefined) return false;
  return (
    (cp >= 0x0901 && cp <= 0x0903) || // chandrabindu, anusvara, visarga
    cp === 0x093c || // nukta (़)
    (cp >= 0x093e && cp <= 0x094f) || // dependent vowel signs (matras), virama (्)
    (cp >= 0x0951 && cp <= 0x0957) || // vedic stress / accents
    (cp >= 0x0962 && cp <= 0x0963) || // vocalic vowel signs
    (cp >= 0xa8e0 && cp <= 0xa8f1) // extended cantillation marks
  );
}

/**
 * Determines whether an inter-token space should be inserted.
 * Prevents splitting Devanagari syllables, matras, viramas (halants), or punctuation.
 */
function shouldInsertSpace(prevText: string, nextText: string, gap: number): boolean {
  if (gap <= 2) return false;
  if (!prevText || !nextText) return false;
  // Never insert space if next starts with a Devanagari combining mark or matra
  if (isDevanagariCombiningChar(nextText.charAt(0))) return false;
  // Never insert space if previous text ends with virama (्) forming a conjunct
  if (prevText.endsWith('\u094D')) return false;
  // Never insert space before punctuation or danda (।)
  if (/^[,.;:?!।॥\)\]\}]/.test(nextText)) return false;
  // Never insert space after opening parenthesis/brackets
  if (/[\(\[\{]$/.test(prevText)) return false;
  return true;
}

/**
 * Coalesces consecutive text runs with matching formatting to prevent Word from
 * fragmenting words or breaking complex script OpenType ligatures across <w:r> tags.
 */
function coalesceRuns(
  rawRuns: Array<{ text: string; bold?: boolean; italics?: boolean; fontSizePt?: number }>
): Array<{ text: string; bold?: boolean; italics?: boolean; fontSizePt?: number }> {
  if (rawRuns.length <= 1) return rawRuns;
  const merged: Array<{ text: string; bold?: boolean; italics?: boolean; fontSizePt?: number }> = [];

  for (const run of rawRuns) {
    if (!run.text) continue;
    if (merged.length === 0) {
      merged.push({ ...run });
      continue;
    }

    const prev = merged[merged.length - 1];
    const sameFormatting =
      prev.bold === run.bold &&
      prev.italics === run.italics &&
      (prev.fontSizePt === run.fontSizePt || (!prev.fontSizePt && !run.fontSizePt));

    // If both have matching formatting or if a Devanagari combining mark / virama must stay glued
    if (sameFormatting) {
      prev.text += run.text;
    } else if (isDevanagariCombiningChar(run.text.charAt(0)) || prev.text.endsWith('\u094D')) {
      prev.text += run.text;
    } else {
      merged.push({ ...run });
    }
  }

  return merged;
}

/**
 * Development diagnostic helper to inspect extracted Hindi / Devanagari text
 * and report Unicode code points, combining marks, and conjuncts.
 */
export function diagnoseDevanagariText(
  text: string,
  contextLabel = 'Text'
): {
  hasDevanagari: boolean;
  totalChars: number;
  devanagariChars: number;
  combiningMarksCount: number;
  viramaCount: number;
  sampleCodePoints: string[];
  summary: string;
} {
  const hasDev = containsDevanagari(text);
  let devCount = 0;
  let combiningCount = 0;
  let viramaCount = 0;
  const samplePoints: string[] = [];

  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp !== undefined) {
      const isDev =
        (cp >= 0x0900 && cp <= 0x097f) ||
        (cp >= 0xa8e0 && cp <= 0xa8ff) ||
        (cp >= 0x1cd0 && cp <= 0x1cff);
      if (isDev) {
        devCount++;
        if (cp === 0x094d) viramaCount++;
        if (isDevanagariCombiningChar(ch)) combiningCount++;
        if (samplePoints.length < 30) {
          samplePoints.push(`${ch} [U+${cp.toString(16).toUpperCase().padStart(4, '0')}]`);
        }
      }
    }
  }

  const summary = `[Hindi Diagnostic: ${contextLabel}] Devanagari: ${hasDev ? 'YES' : 'NO'}, Total: ${text.length}, Devanagari: ${devCount}, Viramas: ${viramaCount}, Combining Marks: ${combiningCount}`;

  if (hasDev) {
    console.log(summary);
    console.log(`[Hindi Diagnostic Sample] ${samplePoints.join(', ')}`);
  }

  return {
    hasDevanagari: hasDev,
    totalChars: text.length,
    devanagariChars: devCount,
    combiningMarksCount: combiningCount,
    viramaCount,
    sampleCodePoints: samplePoints,
    summary,
  };
}

/**
 * Parses page range string (e.g. "1-3, 5, 7-10") into a sorted list of unique 1-based page numbers.
 */
export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  if (!rangeStr || !rangeStr.trim()) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const selected = new Set<number>();
  const tokens = rangeStr.split(',').map((t) => t.trim()).filter(Boolean);

  for (const token of tokens) {
    if (token.includes('-')) {
      const [startStr, endStr] = token.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const from = Math.max(1, Math.min(start, end));
        const to = Math.min(totalPages, Math.max(start, end));
        for (let p = from; p <= to; p++) {
          selected.add(p);
        }
      }
    } else {
      const page = parseInt(token, 10);
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        selected.add(page);
      }
    }
  }

  const result = Array.from(selected).sort((a, b) => a - b);
  return result.length > 0 ? result : Array.from({ length: totalPages }, (_, i) => i + 1);
}

/**
 * Inspects a PDF document to count pages, measure text density, and detect scanned/image-only pages.
 */
export async function inspectPdfForWord(pdfBytes: Uint8Array): Promise<DocumentInspection> {
  const bytesCopy = clonePdfBuffer(pdfBytes);
  const pdfjs = getPdfjsInstance();
  const loadingTask = pdfjs.getDocument({ data: bytesCopy });

  try {
    const pdfDoc = await loadingTask.promise;
    const pageCount = pdfDoc.numPages;
    const pagesInfo: PageInspectionInfo[] = [];
    const scannedPages: number[] = [];
    let totalEstimatedWords = 0;

    let docHasDevanagari = false;
    let devanagariSampleSnippet = '';

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      
      let textStr = '';
      for (const item of textContent.items) {
        if ('str' in item && typeof item.str === 'string') {
          textStr += item.str + ' ';
        }
      }

      const trimmed = textStr.trim().normalize('NFC');
      const charCount = trimmed.length;
      const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
      const wordCount = words.length;
      totalEstimatedWords += wordCount;

      const pageHasDevanagari = containsDevanagari(trimmed);
      if (pageHasDevanagari) {
        docHasDevanagari = true;
        if (!devanagariSampleSnippet) {
          devanagariSampleSnippet = trimmed.slice(0, 100);
        }
        diagnoseDevanagariText(trimmed, `Page ${i} Inspection`);
      }

      // Pages with fewer than 40 characters are very likely scanned or image-based
      const isScanned = charCount < 40;
      if (isScanned) {
        scannedPages.push(i);
      }

      pagesInfo.push({
        pageNum: i,
        charCount,
        wordCount,
        isScanned,
        previewSnippet: trimmed.slice(0, 160) || '(No selectable text detected on this page)',
        hasDevanagari: pageHasDevanagari,
      });
    }

    return {
      pageCount,
      totalEstimatedWords,
      pages: pagesInfo,
      scannedPages,
      hasScannedPages: scannedPages.length > 0,
      isEncrypted: false,
      hasDevanagari: docHasDevanagari,
      devanagariSampleSnippet: docHasDevanagari ? devanagariSampleSnippet : undefined,
    };
  } catch (err: any) {
    if (err?.name === 'PasswordException' || err?.message?.toLowerCase().includes('password')) {
      throw new Error('This PDF is password protected. Please unlock or decrypt it first.');
    }
    throw new Error(`Failed to inspect PDF structure: ${err?.message || 'Unknown error'}`);
  }
}

/**
 * Extracts and reconstructs text lines and paragraphs from a single digital PDF page.
 */
async function extractPageStructure(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  formattingMode: FormattingMode
): Promise<{ paragraphs: StructuredParagraph[]; wordCount: number; headingsFound: number }> {
  const page = await pdfDoc.getPage(pageIndex);
  const viewport = page.getViewport({ scale: 1.0 });
  const textContent = await page.getTextContent();

  const rawItems: RawTextItem[] = [];

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str) continue;
    const str = item.str;
    if (!str.trim()) continue; // skip pure whitespace items

    const transform = item.transform; // [sx, ky, kx, sy, tx, ty]
    const fontSize = Math.max(7, Math.round(Math.hypot(transform[0], transform[1])));
    const x = transform[4];
    // In PDF, Y is measured from bottom up; convert to top-down
    const y = viewport.height - transform[5];
    const width = item.width || (str.length * fontSize * 0.5);
    const height = item.height || fontSize;
    const fontName = (item.fontName || '').toLowerCase();

    const isBold =
      fontName.includes('bold') ||
      fontName.includes('black') ||
      fontName.includes('heavy') ||
      fontName.includes('w7') ||
      fontName.includes('w8') ||
      fontName.includes('medium') ||
      fontName.includes('demi');

    const isItalic =
      fontName.includes('italic') ||
      fontName.includes('oblique') ||
      fontName.includes('slanted');

    rawItems.push({
      str,
      x,
      y,
      width,
      height,
      fontSize,
      fontName,
      isBold,
      isItalic,
    });
  }

  if (rawItems.length === 0) {
    return { paragraphs: [], wordCount: 0, headingsFound: 0 };
  }

  // 1. Sort items top to bottom (Y ascending), then left to right (X ascending)
  rawItems.sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 3) return yDiff;
    return a.x - b.x;
  });

  // Calculate median font size for relative heading thresholds
  const fontSizes = rawItems.map((i) => i.fontSize).sort((a, b) => a - b);
  const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] || 11;

  // 2. Group items into distinct lines
  const lines: TextLine[] = [];
  let currentLineItems: RawTextItem[] = [];

  for (const item of rawItems) {
    if (currentLineItems.length === 0) {
      currentLineItems.push(item);
      continue;
    }

    const prevItem = currentLineItems[currentLineItems.length - 1];
    // Line grouping tolerance: within 35% of font size or 4px
    const yTolerance = Math.max(4, prevItem.fontSize * 0.35);

    if (Math.abs(item.y - prevItem.y) <= yTolerance) {
      currentLineItems.push(item);
    } else {
      lines.push(buildLineFromItems(currentLineItems));
      currentLineItems = [item];
    }
  }

  if (currentLineItems.length > 0) {
    lines.push(buildLineFromItems(currentLineItems));
  }

  // 3. Cluster lines into structured paragraphs
  const structuredParagraphs: StructuredParagraph[] = [];
  let currentParaLines: TextLine[] = [];
  let headingsFound = 0;
  let totalWordCount = 0;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const prevLine = l > 0 ? lines[l - 1] : null;

    // Determine line formatting
    const isHeading =
      formattingMode === 'preserve_formatting' &&
      (line.fontSize >= medianFontSize * 1.5 ||
        (line.fontSize >= medianFontSize * 1.25 && line.isBold)) &&
      line.text.length < 140;

    // Calculate line spacing gap
    const lineGap = prevLine ? line.y - (prevLine.y + prevLine.height) : 0;
    const isBigGap = prevLine ? lineGap > Math.max(prevLine.height, 12) * 1.35 : false;

    // Alignment detection
    const lineCenter = (line.minX + line.maxX) / 2;
    const pageCenter = viewport.width / 2;
    const isCenter =
      Math.abs(lineCenter - pageCenter) < 35 && line.maxX - line.minX < viewport.width * 0.75;
    const isRight =
      line.maxX > viewport.width - 55 && line.minX > viewport.width * 0.35;
    const alignment = isCenter
      ? AlignmentType.CENTER
      : isRight
      ? AlignmentType.RIGHT
      : AlignmentType.LEFT;

    // Check if line starts with a list bullet
    const trimmed = line.text.trim();
    const isBullet = /^[•\-\*▪\u2022\u2023\u25E6]\s+/.test(trimmed);

    // Should we start a new paragraph?
    const shouldBreak =
      currentParaLines.length > 0 &&
      (isHeading ||
        isBigGap ||
        isBullet ||
        (prevLine && isHeadingCandidate(prevLine, medianFontSize)) ||
        prevLineAlignment(currentParaLines, viewport.width) !== alignment);

    if (shouldBreak) {
      const para = finalizeParagraph(currentParaLines, medianFontSize, formattingMode, viewport.width);
      if (para) {
        if (para.headingLevel) headingsFound++;
        structuredParagraphs.push(para);
        totalWordCount += para.text.split(/\s+/).filter(Boolean).length;
      }
      currentParaLines = [line];
    } else {
      currentParaLines.push(line);
    }
  }

  if (currentParaLines.length > 0) {
    const para = finalizeParagraph(currentParaLines, medianFontSize, formattingMode, viewport.width);
    if (para) {
      if (para.headingLevel) headingsFound++;
      structuredParagraphs.push(para);
      totalWordCount += para.text.split(/\s+/).filter(Boolean).length;
    }
  }

  return { paragraphs: structuredParagraphs, wordCount: totalWordCount, headingsFound };
}

function buildLineFromItems(items: RawTextItem[]): TextLine {
  // Sort horizontally left to right
  items.sort((a, b) => a.x - b.x);

  let text = '';
  let prevRight = 0;
  let prevStr = '';

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemStr = (item.str || '').normalize('NFC');
    if (i > 0) {
      // Add a space only if gap is noticeable and not inside a Devanagari cluster or ligature
      const gap = item.x - prevRight;
      if (shouldInsertSpace(prevStr, itemStr, gap)) {
        text += ' ';
      }
    }
    text += itemStr;
    prevStr = itemStr;
    prevRight = item.x + item.width;
  }

  const y = items[0].y;
  const height = Math.max(...items.map((i) => i.height));
  const fontSize = Math.max(...items.map((i) => i.fontSize));
  const minX = items[0].x;
  const maxX = items[items.length - 1].x + items[items.length - 1].width;
  const isBold = items.some((i) => i.isBold);
  const isItalic = items.some((i) => i.isItalic);

  return {
    items,
    text: text.trim(),
    y,
    height,
    fontSize,
    minX,
    maxX,
    isBold,
    isItalic,
  };
}

function isHeadingCandidate(line: TextLine, medianFontSize: number): boolean {
  return (
    line.fontSize >= medianFontSize * 1.4 ||
    (line.fontSize >= medianFontSize * 1.2 && line.isBold && line.text.length < 100)
  );
}

function prevLineAlignment(lines: TextLine[], pageWidth: number): typeof AlignmentType[keyof typeof AlignmentType] {
  if (lines.length === 0) return AlignmentType.LEFT;
  const line = lines[lines.length - 1];
  const center = (line.minX + line.maxX) / 2;
  if (Math.abs(center - pageWidth / 2) < 35 && line.maxX - line.minX < pageWidth * 0.75) {
    return AlignmentType.CENTER;
  }
  if (line.maxX > pageWidth - 55 && line.minX > pageWidth * 0.35) {
    return AlignmentType.RIGHT;
  }
  return AlignmentType.LEFT;
}

function finalizeParagraph(
  lines: TextLine[],
  medianFontSize: number,
  formattingMode: FormattingMode,
  pageWidth: number
): StructuredParagraph | null {
  if (lines.length === 0) return null;

  const fullText = lines.map((l) => l.text).join(' ').trim().normalize('NFC');
  if (!fullText) return null;

  const maxFontSize = Math.max(...lines.map((l) => l.fontSize));
  const isAllBold = lines.every((l) => l.isBold);
  const firstLine = lines[0];

  // Alignment
  const lineCenter = (firstLine.minX + firstLine.maxX) / 2;
  const isCenter =
    Math.abs(lineCenter - pageWidth / 2) < 35 && firstLine.maxX - firstLine.minX < pageWidth * 0.75;
  const isRight =
    firstLine.maxX > pageWidth - 55 && firstLine.minX > pageWidth * 0.35;
  const alignment = isCenter
    ? AlignmentType.CENTER
    : isRight
    ? AlignmentType.RIGHT
    : AlignmentType.LEFT;

  // Heading calculation
  let headingLevel: typeof HeadingLevel[keyof typeof HeadingLevel] | undefined = undefined;
  if (formattingMode === 'preserve_formatting' && lines.length <= 2 && fullText.length < 140) {
    if (maxFontSize >= medianFontSize * 1.6) {
      headingLevel = HeadingLevel.TITLE;
    } else if (maxFontSize >= medianFontSize * 1.35) {
      headingLevel = HeadingLevel.HEADING_1;
    } else if (maxFontSize >= medianFontSize * 1.18 && isAllBold) {
      headingLevel = HeadingLevel.HEADING_2;
    }
  }

  // Check bullet
  const isBullet = /^[•\-\*▪\u2022\u2023\u25E6]\s+/.test(fullText);
  const cleanText = isBullet ? fullText.replace(/^[•\-\*▪\u2022\u2023\u25E6]\s+/, '') : fullText;

  // Build TextRuns from items if preserving formatting
  const runs: Array<{ text: string; bold?: boolean; italics?: boolean; fontSizePt?: number }> = [];

  if (formattingMode === 'preserve_formatting' && !headingLevel) {
    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      if (l > 0) {
        runs.push({ text: ' ' });
      }
      for (let i = 0; i < line.items.length; i++) {
        const item = line.items[i];
        const itemStr = (item.str || '').normalize('NFC');
        if (i > 0) {
          const gap = item.x - (line.items[i - 1].x + line.items[i - 1].width);
          if (shouldInsertSpace(line.items[i - 1].str, itemStr, gap)) {
            runs.push({ text: ' ' });
          }
        }
        runs.push({
          text: itemStr,
          bold: item.isBold,
          italics: item.isItalic,
          fontSizePt: item.fontSize,
        });
      }
    }
  } else {
    // Text-only or Heading
    runs.push({
      text: cleanText,
      bold: headingLevel ? true : undefined,
      fontSizePt: headingLevel ? (headingLevel === HeadingLevel.TITLE ? 20 : 16) : 11,
    });
  }

  const finalRuns = coalesceRuns(runs);

  return {
    text: cleanText,
    runs: finalRuns,
    headingLevel,
    alignment,
    isBullet,
  };
}

/**
 * Executes OCR on a single scanned PDF page using Tesseract.js.
 */
async function performPageOcr(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageIndex: number,
  language: string,
  onProgress?: (progressText: string) => void
): Promise<{ text: string; paragraphs: StructuredParagraph[]; wordCount: number }> {
  const page = await pdfDoc.getPage(pageIndex);
  // Scale 2.0 provides sharp resolution for accurate character recognition
  const viewport = page.getViewport({ scale: 2.0 });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context is not available for OCR.');
  }

  // Render PDF page to canvas
  await page.render({
    canvasContext: ctx,
    viewport,
  }).promise;

  onProgress?.(`Starting OCR transcription with language: ${language.toUpperCase()}...`);

  // Initialize Tesseract Worker
  const worker = await createWorker(language);

  try {
    const result = await worker.recognize(canvas);
    const text = result.data.text.trim().normalize('NFC');
    const words = text ? text.split(/\s+/).filter(Boolean) : [];

    if (containsDevanagari(text)) {
      diagnoseDevanagariText(text, `Page ${pageIndex} OCR Result`);
    }

    // Break OCR text into paragraphs
    const rawParagraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    const structuredParagraphs: StructuredParagraph[] = rawParagraphs.map((paraText) => ({
      text: paraText.replace(/\n+/g, ' '),
      runs: [{ text: paraText.replace(/\n+/g, ' '), fontSizePt: 11 }],
      alignment: AlignmentType.LEFT,
    }));

    return {
      text,
      paragraphs: structuredParagraphs,
      wordCount: words.length,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Main PDF to Word conversion engine.
 */
export async function convertPdfToDocx(
  pdfBytes: Uint8Array,
  sourceFileName: string,
  options: ConversionOptions
): Promise<ConversionResult> {
  const {
    formattingMode = 'preserve_formatting',
    pageSelectionMode = 'all',
    customPageRange = '',
    enableOcrForScanned = false,
    ocrLanguage = 'eng',
    onProgress,
  } = options;

  onProgress?.('Preparing PDF for Word conversion...', 5);

  const bytesCopy = clonePdfBuffer(pdfBytes);
  const pdfjs = getPdfjsInstance();
  const loadingTask = pdfjs.getDocument({ data: bytesCopy });
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  // Determine pages to process
  let targetPages: number[] = [];
  if (pageSelectionMode === 'custom' && customPageRange) {
    targetPages = parsePageRange(customPageRange, totalPages);
  } else {
    targetPages = Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (targetPages.length === 0) {
    throw new Error('No valid pages selected for conversion.');
  }

  onProgress?.(`Analyzing ${targetPages.length} document pages...`, 15);

  const allPageParagraphs: Array<{ pageNum: number; paragraphs: StructuredParagraph[]; isOcr: boolean }> = [];
  const scannedPagesFound: number[] = [];
  const ocrAppliedPages: number[] = [];
  let totalWords = 0;
  let totalParagraphs = 0;
  let headingsDetected = 0;

  for (let idx = 0; idx < targetPages.length; idx++) {
    const pageNum = targetPages[idx];
    const pagePercentStart = 20 + Math.floor((idx / targetPages.length) * 65);
    onProgress?.(`Processing page ${pageNum} of ${totalPages}...`, pagePercentStart);

    // Extract text layout
    const extracted = await extractPageStructure(pdfDoc, pageNum, formattingMode);

    if (extracted.paragraphs.length > 0) {
      allPageParagraphs.push({
        pageNum,
        paragraphs: extracted.paragraphs,
        isOcr: false,
      });
      totalWords += extracted.wordCount;
      totalParagraphs += extracted.paragraphs.length;
      headingsDetected += extracted.headingsFound;
    } else {
      // Little or no digital text found -> Scanned/Image page
      scannedPagesFound.push(pageNum);

      if (enableOcrForScanned) {
        onProgress?.(`Running OCR on scanned page ${pageNum}...`, pagePercentStart + 2);
        try {
          const ocrResult = await performPageOcr(
            pdfDoc,
            pageNum,
            ocrLanguage,
            (status) => onProgress?.(`Page ${pageNum} OCR: ${status}`, pagePercentStart + 4)
          );

          if (ocrResult.paragraphs.length > 0) {
            allPageParagraphs.push({
              pageNum,
              paragraphs: ocrResult.paragraphs,
              isOcr: true,
            });
            ocrAppliedPages.push(pageNum);
            totalWords += ocrResult.wordCount;
            totalParagraphs += ocrResult.paragraphs.length;
          } else {
            // OCR found nothing
            allPageParagraphs.push({
              pageNum,
              paragraphs: [{
                text: `[Page ${pageNum}: Scanned image with no identifiable text]`,
                runs: [{ text: `[Page ${pageNum}: Scanned image with no identifiable text]`, italics: true }],
                alignment: AlignmentType.LEFT,
              }],
              isOcr: true,
            });
          }
        } catch (ocrErr: any) {
          console.error(`OCR failed on page ${pageNum}:`, ocrErr);
          allPageParagraphs.push({
            pageNum,
            paragraphs: [{
              text: `[Page ${pageNum}: Scanned image — OCR transcription could not be completed]`,
              runs: [{ text: `[Page ${pageNum}: Scanned image — OCR transcription could not be completed]`, italics: true }],
              alignment: AlignmentType.LEFT,
            }],
            isOcr: false,
          });
        }
      } else {
        // Scanned page without OCR enabled
        allPageParagraphs.push({
          pageNum,
          paragraphs: [{
            text: `[Page ${pageNum}: Scanned document or image page. To convert handwritten or scanned text to editable Word, enable OCR in FastPDFx.]`,
            runs: [{
              text: `[Page ${pageNum}: Scanned document or image page. To convert handwritten or scanned text to editable Word, enable OCR in FastPDFx.]`,
              italics: true,
              fontSizePt: 10,
            }],
            alignment: AlignmentType.LEFT,
          }],
          isOcr: false,
        });
      }
    }
  }

  onProgress?.('Generating Microsoft Word (.docx) document structure...', 90);

  // Build the docx Document
  const docChildren: Paragraph[] = [];

  for (let pIdx = 0; pIdx < allPageParagraphs.length; pIdx++) {
    const pageData = allPageParagraphs[pIdx];

    // If not the first page, insert a PageBreak to separate PDF pages
    if (pIdx > 0) {
      docChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }

    for (const p of pageData.paragraphs) {
      const runs = p.runs.map((r) => {
        const hasDev = containsDevanagari(r.text);
        return new TextRun({
          text: r.text,
          bold: r.bold,
          italics: r.italics,
          size: r.fontSizePt ? Math.round(r.fontSizePt * 2) : 22, // docx uses half-points (22 = 11pt)
          font: {
            name: hasDev ? 'Nirmala UI' : 'Calibri',
            ascii: 'Calibri',
            hAnsi: 'Calibri',
            cs: 'Nirmala UI',
            eastAsia: hasDev ? 'Nirmala UI' : undefined,
          },
        });
      });

      docChildren.push(
        new Paragraph({
          heading: p.headingLevel,
          alignment: p.alignment,
          children: runs,
          bullet: p.isBullet ? { level: 0 } : undefined,
          spacing: {
            before: p.headingLevel ? 180 : 0,
            after: p.headingLevel ? 120 : 120, // 6pt after
            line: 276, // 1.15 line spacing provides sufficient headroom for Devanagari matras
          },
        })
      );
    }
  }

  // If completely empty, add placeholder
  if (docChildren.length === 0) {
    docChildren.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'No text extracted from document.',
            italics: true,
            font: {
              ascii: 'Calibri',
              hAnsi: 'Calibri',
              cs: 'Nirmala UI',
            },
          }),
        ],
      })
    );
  }

  const doc = new Document({
    title: sourceFileName.replace(/\.pdf$/i, ''),
    description: 'Converted from PDF with FastPDFx',
    creator: 'FastPDFx — Free In-Browser PDF Suite',
    styles: {
      default: {
        document: {
          run: {
            font: {
              ascii: 'Calibri',
              hAnsi: 'Calibri',
              cs: 'Nirmala UI',
            },
          },
        },
        heading1: {
          run: {
            font: {
              ascii: 'Calibri',
              hAnsi: 'Calibri',
              cs: 'Nirmala UI',
            },
          },
        },
        heading2: {
          run: {
            font: {
              ascii: 'Calibri',
              hAnsi: 'Calibri',
              cs: 'Nirmala UI',
            },
          },
        },
        title: {
          run: {
            font: {
              ascii: 'Calibri',
              hAnsi: 'Calibri',
              cs: 'Nirmala UI',
            },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  onProgress?.('Packing Word (.docx) file binary...', 96);
  const docxBlob = await Packer.toBlob(doc);

  const baseName = sourceFileName.replace(/\.pdf$/i, '');
  const outFileName = `${baseName || 'fastpdfx-converted'}.docx`;

  onProgress?.('Conversion complete!', 100);

  return {
    docxBlob,
    fileName: outFileName,
    pageCount: totalPages,
    pagesProcessed: targetPages,
    totalWords,
    totalParagraphs,
    headingsDetected,
    scannedPagesFound,
    ocrAppliedPages,
    ocrLanguageUsed: enableOcrForScanned ? ocrLanguage : undefined,
    fileSizeBytes: docxBlob.size,
  };
}
