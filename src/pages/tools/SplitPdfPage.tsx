import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Download,
  RotateCcw,
  Check,
  AlertCircle,
  FileText,
  Scissors,
  CheckSquare,
  Square,
  Package,
  Layers,
  Eye,
  X,
  FileCheck,
  Sparkles,
  Info,
  ExternalLink
} from 'lucide-react';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
import { PageMeta } from '../../components/PageMeta';
import { PdfCanvasViewer } from '../../components/PdfCanvasViewer';
import { PdfPreviewModal } from '../../components/PdfPreviewModal';
import { formatBytes } from '../../utils/formatBytes';
import { downloadFile } from '../../utils/downloadFile';
import { parseCustomPageRanges, ParsedRangeChunk, ParseRangeResult } from '../../utils/pdfRangeParser';
import {
  clonePdfBytes,
  inspectPdfDocument,
  extractSelectedPages,
  splitEveryPage,
  splitByCustomRanges,
  SplitResultItem
} from '../../utils/pdfSplitter';

// Initialize PDF.js worker from reliable CDN
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

type SplitMode = 'extract' | 'all' | 'ranges';

interface PageThumbnail {
  pageNumber: number;
  dataUrl: string | null;
  width: number;
  height: number;
  loading: boolean;
}

interface SplitOutputFile {
  id: string;
  name: string;
  blob: Blob;
  size: number;
  pageCount: number;
  previewUrl: string;
  pagesDescription: string;
}

export const SplitPdfPage: React.FC = () => {
  // Document state
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceBytes, setSourceBytes] = useState<Uint8Array | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);

  // Split mode state
  const [splitMode, setSplitMode] = useState<SplitMode>('extract');
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [rangeInput, setRangeInput] = useState<string>('');
  const [rangeCombineMode, setRangeCombineMode] = useState<'separate' | 'combine'>('separate');

  // Processing & results state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [outputFiles, setOutputFiles] = useState<SplitOutputFile[]>([]);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [previewModalFile, setPreviewModalFile] = useState<SplitOutputFile | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount or reset
  useEffect(() => {
    return () => {
      outputFiles.forEach(file => {
        if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      });
    };
  }, [outputFiles]);

  // Clean up previous URLs when outputFiles changes
  const clearOutputFiles = () => {
    outputFiles.forEach(file => {
      if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
    });
    setOutputFiles([]);
  };

  // Reset entire state
  const handleReset = () => {
    clearOutputFiles();
    setSourceFile(null);
    setSourceBytes(null);
    setTotalPages(0);
    setThumbnails([]);
    setSelectedPages(new Set());
    setRangeInput('');
    setErrorMessage(null);
    setPreviewModalFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle uploaded file
  const handleFile = async (file: File) => {
    setErrorMessage(null);
    clearOutputFiles();

    const isPdfMime = file.type === 'application/pdf';
    const isPdfExt = /\.pdf$/i.test(file.name);

    if (!isPdfMime && !isPdfExt) {
      setErrorMessage(`"${file.name}" is not a valid PDF file. Please upload a document with the .pdf extension.`);
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      // Store pristine Uint8Array
      const masterBytes = new Uint8Array(buffer);

      // Inspect with pdf-lib to count pages and check for encryption
      let pageCount = 0;
      try {
        const inspected = await inspectPdfDocument(masterBytes);
        pageCount = inspected.pageCount;
      } catch (loadErr: unknown) {
        setErrorMessage(loadErr instanceof Error ? loadErr.message : 'Could not read PDF.');
        return;
      }

      if (pageCount < 1) {
        setErrorMessage(`"${file.name}" contains no pages.`);
        return;
      }

      setSourceFile(file);
      setSourceBytes(masterBytes);
      setTotalPages(pageCount);

      // Default selection: select all pages initially
      const initialSelected = new Set<number>();
      for (let i = 1; i <= pageCount; i++) {
        initialSelected.add(i);
      }
      setSelectedPages(initialSelected);

      // Default range input placeholder suggestion
      if (pageCount === 1) {
        setRangeInput('1');
      } else if (pageCount <= 3) {
        setRangeInput(`1-${pageCount}`);
      } else {
        setRangeInput(`1-${Math.min(3, pageCount)}, ${Math.min(4, pageCount)}`);
      }

      // Initialize thumbnail placeholders
      const placeholderThumbs: PageThumbnail[] = Array.from({ length: pageCount }, (_, idx) => ({
        pageNumber: idx + 1,
        dataUrl: null,
        width: 160,
        height: 226,
        loading: true
      }));
      setThumbnails(placeholderThumbs);

      // Asynchronously render thumbnails with PDF.js using an isolated cloned buffer
      renderThumbnails(masterBytes, pageCount);

    } catch (err: unknown) {
      console.error('Error reading PDF:', err);
      setErrorMessage(`Could not read "${file.name}". The file appears corrupt or is an unsupported PDF.`);
    }
  };

  // Render thumbnails using PDF.js with independent buffer clone
  const renderThumbnails = async (bytes: Uint8Array, count: number) => {
    try {
      // Allocate independent clone so PDF.js worker transfer does NOT detach masterBytes
      const isolatedBuffer = clonePdfBytes(bytes).buffer;
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(isolatedBuffer),
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });
      const pdfJsDoc = await loadingTask.promise;

      for (let pageNum = 1; pageNum <= count; pageNum++) {
        try {
          const page = await pdfJsDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 0.35 });

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const ctx = canvas.getContext('2d');

          if (ctx) {
            await page.render({
              canvasContext: ctx,
              viewport: viewport
            }).promise;

            const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

            setThumbnails(prev =>
              prev.map(t =>
                t.pageNumber === pageNum
                  ? { ...t, dataUrl, width: viewport.width, height: viewport.height, loading: false }
                  : t
              )
            );
          }
        } catch (pageErr) {
          console.warn(`Could not render thumbnail for page ${pageNum}:`, pageErr);
          setThumbnails(prev =>
            prev.map(t =>
              t.pageNumber === pageNum ? { ...t, loading: false } : t
            )
          );
        }
      }
    } catch (err) {
      console.warn('PDF.js thumbnail renderer error:', err);
      // Fallback: stop loading spinners
      setThumbnails(prev => prev.map(t => ({ ...t, loading: false })));
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Toggle single page selection
  const togglePageSelection = (pageNum: number) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  // Quick selection helpers
  const selectAllPages = () => {
    const all = new Set<number>();
    for (let i = 1; i <= totalPages; i++) all.add(i);
    setSelectedPages(all);
  };

  const deselectAllPages = () => {
    setSelectedPages(new Set());
  };

  const selectOddPages = () => {
    const odds = new Set<number>();
    for (let i = 1; i <= totalPages; i += 2) odds.add(i);
    setSelectedPages(odds);
  };

  const selectEvenPages = () => {
    const evens = new Set<number>();
    for (let i = 2; i <= totalPages; i += 2) evens.add(i);
    setSelectedPages(evens);
  };

  // Range validation helper for UI
  const rangeValidation = rangeInput.trim() ? parseCustomPageRanges(rangeInput, totalPages || 1) : null;

  // Perform PDF split with memory isolation and error resilience
  const handleSplitPdf = async () => {
    if (!sourceFile || !sourceBytes || totalPages === 0) return;

    setErrorMessage(null);
    setIsProcessing(true);
    setProcessingProgress('Preparing document...');

    try {
      // Ensure we have active non-detached bytes; if ever detached, re-read from sourceFile
      let activeBytes = sourceBytes;
      if (activeBytes.buffer.byteLength === 0) {
        const freshBuffer = await sourceFile.arrayBuffer();
        activeBytes = new Uint8Array(freshBuffer);
        setSourceBytes(activeBytes);
      }

      const baseName = sourceFile.name.replace(/\.pdf$/i, '') || 'fastpdfx';
      let items: SplitResultItem[] = [];

      if (splitMode === 'extract') {
        // Mode 1: Extract selected pages into one PDF
        const selectedList = Array.from(selectedPages).sort((a, b) => a - b);
        if (selectedList.length === 0) {
          setErrorMessage('No pages were selected for extraction. Please select at least one page.');
          setIsProcessing(false);
          return;
        }

        setProcessingProgress(`Extracting ${selectedList.length} pages...`);
        const resultItem = await extractSelectedPages(activeBytes, baseName, selectedList);
        items = [resultItem];

      } else if (splitMode === 'all') {
        // Mode 2: Split every page into separate individual PDFs
        setProcessingProgress(`Splitting all ${totalPages} pages into individual files...`);
        items = await splitEveryPage(
          activeBytes,
          baseName,
          totalPages,
          (curr, total) => setProcessingProgress(`Processing page ${curr} of ${total}...`)
        );

      } else if (splitMode === 'ranges') {
        // Mode 3: Split by custom ranges
        const validation = parseCustomPageRanges(rangeInput, totalPages);
        if (!validation.isValid || validation.error) {
          setErrorMessage(validation.error || 'Please enter valid page ranges.');
          setIsProcessing(false);
          return;
        }

        setProcessingProgress('Generating range documents...');
        items = await splitByCustomRanges(
          activeBytes,
          baseName,
          validation.chunks,
          rangeCombineMode,
          validation.allUniquePages,
          rangeInput,
          (curr, total) => setProcessingProgress(`Processing range ${curr} of ${total}...`)
        );
      }

      // Convert generated SplitResultItem entries to SplitOutputFile with Blob and ObjectURL
      const results: SplitOutputFile[] = items.map(item => {
        const blob = new Blob([item.bytes as BlobPart], { type: 'application/pdf' });
        const previewUrl = URL.createObjectURL(blob);
        return {
          id: item.id,
          name: item.name,
          blob,
          size: blob.size,
          pageCount: item.pageCount,
          previewUrl,
          pagesDescription: item.pagesDescription
        };
      });

      setOutputFiles(results);
    } catch (err: unknown) {
      console.error('Split error:', err);
      setErrorMessage(`Splitting failed: ${err instanceof Error ? err.message : 'Unknown error occurred while processing PDF.'}`);
    } finally {
      setIsProcessing(false);
      setProcessingProgress('');
    }
  };

  // Download all as ZIP
  const handleDownloadAllZip = async () => {
    if (outputFiles.length === 0) return;
    setIsZipping(true);

    try {
      const zip = new JSZip();
      const baseName = sourceFile ? sourceFile.name.replace(/\.pdf$/i, '') : 'fastpdfx-split';

      outputFiles.forEach(file => {
        zip.file(file.name, file.blob);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipBlob, `${baseName}-split-documents.zip`);
    } catch (err) {
      console.error('ZIP generation error:', err);
      setErrorMessage('Could not generate ZIP package. Please download files individually.');
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <PageMeta
        title="Split PDF Online Free — FastPDFx"
        description="Extract specific pages, page ranges, or separate every page of a PDF document into individual files right in your browser. 100% private, client-side, and free."
      />

      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-[#57564F] hover:text-[#20201D] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Tools Directory</span>
        </Link>
        <span className="text-xs uppercase tracking-wider text-[#57564F] border border-[#DEDCD3] px-2.5 py-1 rounded-[2px] bg-[#EBE8DF]">
          Client-Side In-Memory Engine
        </span>
      </div>

      {/* Header Banner */}
      <div className="border border-[#DEDCD3] bg-white p-6 sm:p-8 rounded-[2px]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-[#68735B]">
              <Scissors className="w-3.5 h-3.5" />
              PDF Tools
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#20201D]">
              Split PDF Document
            </h1>
            <p className="text-sm text-[#57564F] max-w-2xl leading-relaxed">
              Extract chosen pages, split every page into separate documents, or split by custom ranges (e.g., 1-3, 5, 7-9).
              Everything processes locally in your browser with zero server uploads.
            </p>
          </div>
          {sourceFile && (
            <button
              onClick={handleReset}
              className="self-start sm:self-center inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium border border-[#DEDCD3] text-[#57564F] hover:text-[#20201D] hover:bg-[#F5F3ED] transition-colors rounded-[2px]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Start New Split
            </button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 border border-red-300 bg-red-50 text-red-800 text-sm flex items-start gap-3 rounded-[2px]">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
          <div className="flex-1">
            <p className="font-medium">Notice</p>
            <p className="text-xs text-red-700 mt-0.5">{errorMessage}</p>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-500 hover:text-red-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Step 1: Upload Dropzone (shown when no source file) */}
      {!sourceFile && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-[2px] p-10 sm:p-14 text-center cursor-pointer transition-all bg-white ${
            isDragging
              ? 'border-[#68735B] bg-[#F5F3ED]'
              : 'border-[#DEDCD3] hover:border-[#68735B]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
            className="hidden"
          />
          <div className="max-w-md mx-auto space-y-3 pointer-events-none">
            <div className="w-12 h-12 mx-auto border border-[#DEDCD3] bg-[#F5F3ED] flex items-center justify-center rounded-[2px] text-[#20201D]">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium text-[#20201D]">
                Choose a PDF file to split
              </p>
              <p className="text-xs text-[#57564F]">
                Drag and drop your PDF here, or click to browse files
              </p>
            </div>
            <div className="pt-2 text-[11px] text-[#57564F] flex items-center justify-center gap-4">
              <span>Standard PDF documents</span>
              <span>•</span>
              <span>100% In-Browser</span>
              <span>•</span>
              <span>Instant preview</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Configure & Split Workspace (when source file is loaded and no results yet) */}
      {sourceFile && outputFiles.length === 0 && (
        <div className="space-y-6">
          {/* File Overview Card */}
          <div className="border border-[#DEDCD3] bg-white p-5 rounded-[2px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 border border-[#DEDCD3] bg-[#F5F3ED] flex items-center justify-center rounded-[2px] flex-shrink-0 text-[#20201D]">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#20201D] truncate" title={sourceFile.name}>
                  {sourceFile.name}
                </p>
                <p className="text-xs text-[#57564F] mt-0.5">
                  {formatBytes(sourceFile.size)} • <span className="font-medium text-[#20201D]">{totalPages}</span> {totalPages === 1 ? 'page' : 'pages'} detected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 text-xs font-medium border border-[#DEDCD3] text-[#57564F] hover:text-[#20201D] hover:bg-[#F5F3ED] transition-colors rounded-[2px]"
              >
                Change PDF
              </button>
              <button
                onClick={handleReset}
                className="px-3 py-1.5 text-xs font-medium border border-[#DEDCD3] text-red-700 hover:bg-red-50 transition-colors rounded-[2px]"
              >
                Remove
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
            </div>
          </div>

          {/* Mode Selector Tabs */}
          <div className="border border-[#DEDCD3] bg-white p-5 rounded-[2px] space-y-4">
            <div className="border-b border-[#DEDCD3] pb-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-[#20201D]">
                Choose Split Mode
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Option 1: Extract Selected Pages */}
              <button
                type="button"
                onClick={() => setSplitMode('extract')}
                className={`p-4 text-left border rounded-[2px] transition-all relative ${
                  splitMode === 'extract'
                    ? 'border-[#20201D] bg-[#F5F3ED] shadow-xs'
                    : 'border-[#DEDCD3] hover:border-[#57564F] bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#20201D]">
                      Extract Selected Pages
                    </p>
                    <p className="text-xs text-[#57564F] leading-relaxed">
                      Pick specific pages visually from the preview grid and combine them into one new PDF document.
                    </p>
                  </div>
                  {splitMode === 'extract' && (
                    <span className="w-2 h-2 rounded-full bg-[#68735B] mt-1"></span>
                  )}
                </div>
              </button>

              {/* Option 2: Split Every Page */}
              <button
                type="button"
                onClick={() => setSplitMode('all')}
                className={`p-4 text-left border rounded-[2px] transition-all relative ${
                  splitMode === 'all'
                    ? 'border-[#20201D] bg-[#F5F3ED] shadow-xs'
                    : 'border-[#DEDCD3] hover:border-[#57564F] bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#20201D]">
                      Split Every Page
                    </p>
                    <p className="text-xs text-[#57564F] leading-relaxed">
                      Extract each page into its own standalone 1-page PDF file ({totalPages} separate documents).
                    </p>
                  </div>
                  {splitMode === 'all' && (
                    <span className="w-2 h-2 rounded-full bg-[#68735B] mt-1"></span>
                  )}
                </div>
              </button>

              {/* Option 3: Custom Ranges */}
              <button
                type="button"
                onClick={() => setSplitMode('ranges')}
                className={`p-4 text-left border rounded-[2px] transition-all relative ${
                  splitMode === 'ranges'
                    ? 'border-[#20201D] bg-[#F5F3ED] shadow-xs'
                    : 'border-[#DEDCD3] hover:border-[#57564F] bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-[#20201D]">
                      Split by Custom Ranges
                    </p>
                    <p className="text-xs text-[#57564F] leading-relaxed">
                      Specify exact page ranges like 1-3, 5, 7-9 to extract specific chapters or sections.
                    </p>
                  </div>
                  {splitMode === 'ranges' && (
                    <span className="w-2 h-2 rounded-full bg-[#68735B] mt-1"></span>
                  )}
                </div>
              </button>
            </div>

            {/* Custom Ranges Input Configuration */}
            {splitMode === 'ranges' && (
              <div className="pt-3 border-t border-[#DEDCD3] space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[#20201D]">
                      Enter Page Ranges
                    </label>
                    <span className="text-xs text-[#57564F]">
                      Document has {totalPages} {totalPages === 1 ? 'page' : 'pages'} (1–{totalPages})
                    </span>
                  </div>
                  <input
                    type="text"
                    value={rangeInput}
                    onChange={e => setRangeInput(e.target.value)}
                    placeholder="e.g. 1-3, 5, 7-9"
                    className="w-full px-3.5 py-2.5 text-sm border border-[#DEDCD3] rounded-[2px] bg-white focus:outline-none focus:border-[#20201D] font-mono text-[#20201D]"
                  />
                  <p className="text-xs text-[#57564F]">
                    Separate page numbers and intervals with commas. Example: <code className="bg-[#EBE8DF] px-1 py-0.5 rounded-[2px] text-[#20201D]">1-3, 5, 8-{totalPages}</code>
                  </p>
                </div>

                {/* Range presets buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs text-[#57564F]">Quick Presets:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const odds: number[] = [];
                      for (let i = 1; i <= totalPages; i += 2) odds.push(i);
                      setRangeInput(odds.join(', '));
                    }}
                    className="px-2.5 py-1 text-xs border border-[#DEDCD3] bg-[#F5F3ED] hover:bg-[#EBE8DF] text-[#20201D] rounded-[2px]"
                  >
                    Odd Pages
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const evens: number[] = [];
                      for (let i = 2; i <= totalPages; i += 2) evens.push(i);
                      setRangeInput(evens.join(', '));
                    }}
                    className="px-2.5 py-1 text-xs border border-[#DEDCD3] bg-[#F5F3ED] hover:bg-[#EBE8DF] text-[#20201D] rounded-[2px]"
                  >
                    Even Pages
                  </button>
                  {totalPages > 2 && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const mid = Math.ceil(totalPages / 2);
                          setRangeInput(`1-${mid}, ${mid + 1}-${totalPages}`);
                        }}
                        className="px-2.5 py-1 text-xs border border-[#DEDCD3] bg-[#F5F3ED] hover:bg-[#EBE8DF] text-[#20201D] rounded-[2px]"
                      >
                        Split in Halves
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRangeInput(`1, 2-${totalPages}`);
                        }}
                        className="px-2.5 py-1 text-xs border border-[#DEDCD3] bg-[#F5F3ED] hover:bg-[#EBE8DF] text-[#20201D] rounded-[2px]"
                      >
                        Separate Cover Page (1, 2-{totalPages})
                      </button>
                    </>
                  )}
                </div>

                {/* Range Output Structure Option */}
                <div className="p-3 bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-medium text-[#20201D]">Output Result:</span>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rangeMode"
                        checked={rangeCombineMode === 'separate'}
                        onChange={() => setRangeCombineMode('separate')}
                        className="accent-[#20201D]"
                      />
                      <span className="text-[#20201D]">Separate PDF for each range chunk</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rangeMode"
                        checked={rangeCombineMode === 'combine'}
                        onChange={() => setRangeCombineMode('combine')}
                        className="accent-[#20201D]"
                      />
                      <span className="text-[#20201D]">Merge ranges into 1 combined PDF</span>
                    </label>
                  </div>
                </div>

                {/* Live Syntax Validation Feedback */}
                {rangeValidation && (
                  <div className="text-xs">
                    {rangeValidation.error ? (
                      <p className="text-red-700 bg-red-50 p-2.5 border border-red-200 rounded-[2px] flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{rangeValidation.error}</span>
                      </p>
                    ) : (
                      <div className="p-3 border border-[#DEDCD3] bg-[#F5F3ED] rounded-[2px] space-y-2">
                        <p className="font-semibold text-[#20201D] flex items-center gap-1.5">
                          <Check className="w-4 h-4 text-[#68735B]" />
                          Validated Plan: {rangeValidation.chunks.length} range {rangeValidation.chunks.length === 1 ? 'definition' : 'definitions'}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {rangeValidation.chunks.map((chunk, idx) => (
                            <span
                              key={idx}
                              className="px-2.5 py-1 border border-[#DEDCD3] bg-white rounded-[2px] text-[#20201D] font-mono text-xs inline-flex items-center gap-1"
                            >
                              <span className="text-[#68735B] font-bold">#{idx + 1}:</span>
                              {chunk.start === chunk.end ? `Page ${chunk.start}` : `Pages ${chunk.start}–${chunk.end}`}
                              <span className="text-[#57564F] text-[11px]">({chunk.pages.length}p)</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Step 3: Interactive Page Preview Grid */}
          <div className="border border-[#DEDCD3] bg-white p-5 rounded-[2px] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#DEDCD3] pb-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[#20201D]">
                  Page Preview & Selection
                </h2>
                <p className="text-xs text-[#57564F] mt-0.5">
                  {splitMode === 'extract'
                    ? `Click individual pages to toggle selection (${selectedPages.size} of ${totalPages} selected)`
                    : splitMode === 'all'
                    ? `All ${totalPages} pages will be extracted individually`
                    : `Visual overview of all ${totalPages} pages`}
                </p>
              </div>

              {/* Selection Controls (most relevant for 'extract' mode, but handy in general) */}
              {splitMode === 'extract' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllPages}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-[#DEDCD3] hover:bg-[#F5F3ED] text-[#20201D] rounded-[2px]"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-[#68735B]" />
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllPages}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border border-[#DEDCD3] hover:bg-[#F5F3ED] text-[#20201D] rounded-[2px]"
                  >
                    <Square className="w-3.5 h-3.5 text-[#57564F]" />
                    Deselect All
                  </button>
                  <button
                    type="button"
                    onClick={selectOddPages}
                    className="px-2.5 py-1 text-xs font-medium border border-[#DEDCD3] hover:bg-[#F5F3ED] text-[#20201D] rounded-[2px]"
                  >
                    Odds
                  </button>
                  <button
                    type="button"
                    onClick={selectEvenPages}
                    className="px-2.5 py-1 text-xs font-medium border border-[#DEDCD3] hover:bg-[#F5F3ED] text-[#20201D] rounded-[2px]"
                  >
                    Evens
                  </button>
                </div>
              )}
            </div>

            {/* Grid of Pages */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 max-h-[520px] overflow-y-auto p-1">
              {thumbnails.map(thumb => {
                const isSelected = selectedPages.has(thumb.pageNumber);
                const isExtractMode = splitMode === 'extract';

                return (
                  <div
                    key={thumb.pageNumber}
                    onClick={() => {
                      if (isExtractMode) togglePageSelection(thumb.pageNumber);
                    }}
                    className={`group relative border rounded-[2px] p-2 flex flex-col items-center justify-between transition-all bg-[#F5F3ED] ${
                      isExtractMode ? 'cursor-pointer select-none' : ''
                    } ${
                      isExtractMode && isSelected
                        ? 'border-[#20201D] ring-2 ring-[#68735B]/60 bg-white shadow-xs'
                        : isExtractMode && !isSelected
                        ? 'border-[#DEDCD3] opacity-60 hover:opacity-100 hover:border-[#57564F]'
                        : 'border-[#DEDCD3] bg-white'
                    }`}
                  >
                    {/* Header badge with page number & checkbox */}
                    <div className="w-full flex items-center justify-between pb-1.5 border-b border-[#DEDCD3]/60 mb-2">
                      <span className="text-[11px] font-semibold text-[#20201D] font-mono">
                        p.{thumb.pageNumber}
                      </span>
                      {isExtractMode && (
                        <div
                          className={`w-4 h-4 rounded-[2px] flex items-center justify-center text-[10px] transition-colors ${
                            isSelected
                              ? 'bg-[#20201D] text-white'
                              : 'border border-[#DEDCD3] bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 text-[#EBE8DF]" />}
                        </div>
                      )}
                    </div>

                    {/* Thumbnail Image or Fallback Schematic */}
                    <div className="w-full aspect-[1/1.414] bg-white border border-[#DEDCD3] rounded-[1px] flex items-center justify-center overflow-hidden relative shadow-2xs">
                      {thumb.loading && !thumb.dataUrl && (
                        <div className="text-center p-2 space-y-1">
                          <div className="w-4 h-4 border-2 border-[#20201D] border-t-transparent rounded-full animate-spin mx-auto"></div>
                          <span className="text-[10px] text-[#57564F]">Rendering...</span>
                        </div>
                      )}

                      {!thumb.loading && !thumb.dataUrl && (
                        <div className="text-center p-2 text-[#57564F]">
                          <FileText className="w-6 h-6 mx-auto mb-1 text-[#57564F]/50" />
                          <span className="text-[10px] font-mono">Page {thumb.pageNumber}</span>
                        </div>
                      )}

                      {thumb.dataUrl && (
                        <img
                          src={thumb.dataUrl}
                          alt={`Page ${thumb.pageNumber}`}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      )}
                    </div>

                    {/* Footer text */}
                    <div className="w-full text-center pt-1.5">
                      <span className="text-[10px] text-[#57564F] truncate block">
                        Page {thumb.pageNumber}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Footer */}
          <div className="border border-[#DEDCD3] bg-white p-5 rounded-[2px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs text-[#57564F] space-y-0.5">
              <p className="font-medium text-[#20201D]">Ready to generate files</p>
              <p>
                {splitMode === 'extract'
                  ? `Extracting ${selectedPages.size} selected ${selectedPages.size === 1 ? 'page' : 'pages'} into a single PDF document.`
                  : splitMode === 'all'
                  ? `Separating all ${totalPages} pages into ${totalPages} independent single-page PDF files.`
                  : rangeValidation && !rangeValidation.error
                  ? `Splitting into ${rangeCombineMode === 'combine' ? '1 combined document' : `${rangeValidation.chunks.length} documents`} based on your custom range input.`
                  : 'Please check your range syntax above.'}
              </p>
            </div>

            <button
              onClick={handleSplitPdf}
              disabled={
                isProcessing ||
                (splitMode === 'extract' && selectedPages.size === 0) ||
                (splitMode === 'ranges' && (!rangeValidation || !!rangeValidation.error))
              }
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#20201D] text-[#F5F3ED] hover:bg-[#68735B] transition-colors rounded-[2px] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#F5F3ED] border-t-transparent rounded-full animate-spin"></div>
                  <span>{processingProgress || 'Splitting PDF...'}</span>
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  <span>
                    {splitMode === 'extract'
                      ? `Extract ${selectedPages.size} ${selectedPages.size === 1 ? 'Page' : 'Pages'}`
                      : splitMode === 'all'
                      ? `Split into ${totalPages} PDFs`
                      : 'Split by Ranges'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Results Dashboard (shown when output files are generated) */}
      {outputFiles.length > 0 && (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="border border-[#DEDCD3] bg-white p-6 rounded-[2px] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#DEDCD3] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 border border-[#68735B] bg-[#68735B]/10 text-[#68735B] flex items-center justify-center rounded-[2px] flex-shrink-0">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[#20201D]">
                    PDF Split Complete
                  </h2>
                  <p className="text-xs text-[#57564F] mt-0.5">
                    Generated {outputFiles.length} {outputFiles.length === 1 ? 'document' : 'documents'} successfully in memory.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                {outputFiles.length > 1 && (
                  <button
                    onClick={handleDownloadAllZip}
                    disabled={isZipping}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#20201D] text-[#F5F3ED] hover:bg-[#68735B] transition-colors text-xs font-medium rounded-[2px] shadow-xs disabled:opacity-50"
                  >
                    {isZipping ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Packaging ZIP...</span>
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4" />
                        <span>Download All as ZIP</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#DEDCD3] text-xs font-medium text-[#57564F] hover:text-[#20201D] hover:bg-[#F5F3ED] transition-colors rounded-[2px]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Split Another Document
                </button>
              </div>
            </div>

            {/* Overview Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 border border-[#DEDCD3] bg-[#F5F3ED] rounded-[2px]">
                <span className="text-[11px] uppercase tracking-wider text-[#57564F] block">Source Document</span>
                <span className="text-sm font-semibold text-[#20201D] truncate block mt-0.5" title={sourceFile?.name}>
                  {sourceFile?.name}
                </span>
              </div>
              <div className="p-3 border border-[#DEDCD3] bg-[#F5F3ED] rounded-[2px]">
                <span className="text-[11px] uppercase tracking-wider text-[#57564F] block">Files Created</span>
                <span className="text-sm font-semibold text-[#20201D] block mt-0.5 font-mono">
                  {outputFiles.length}
                </span>
              </div>
              <div className="p-3 border border-[#DEDCD3] bg-[#F5F3ED] rounded-[2px]">
                <span className="text-[11px] uppercase tracking-wider text-[#57564F] block">Total Pages</span>
                <span className="text-sm font-semibold text-[#20201D] block mt-0.5 font-mono">
                  {outputFiles.reduce((acc, f) => acc + f.pageCount, 0)}
                </span>
              </div>
              <div className="p-3 border border-[#DEDCD3] bg-[#F5F3ED] rounded-[2px]">
                <span className="text-[11px] uppercase tracking-wider text-[#57564F] block">Total Output Size</span>
                <span className="text-sm font-semibold text-[#20201D] block mt-0.5 font-mono">
                  {formatBytes(outputFiles.reduce((acc, f) => acc + f.size, 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Single File Result: Direct Download & Embedded Viewer */}
          {outputFiles.length === 1 && (
            <div className="border border-[#DEDCD3] bg-white p-6 rounded-[2px] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-[#20201D]">
                    {outputFiles[0].name}
                  </h3>
                  <p className="text-xs text-[#57564F]">
                    {formatBytes(outputFiles[0].size)} • {outputFiles[0].pageCount} {outputFiles[0].pageCount === 1 ? 'page' : 'pages'} ({outputFiles[0].pagesDescription})
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewModalFile(outputFiles[0])}
                    className="inline-flex items-center gap-2 px-4 py-2.5 border border-[#DEDCD3] bg-[#F5F3ED] hover:bg-[#EBE8DF] text-[#20201D] transition-colors rounded-[2px] text-xs font-semibold shadow-2xs"
                  >
                    <Eye className="w-4 h-4 text-[#57564F]" />
                    <span>Fullscreen Preview</span>
                  </button>
                  <button
                    onClick={() => downloadFile(outputFiles[0].blob, outputFiles[0].name)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#20201D] text-[#F5F3ED] hover:bg-[#68735B] transition-colors rounded-[2px] text-xs font-semibold shadow-xs"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Extracted PDF</span>
                  </button>
                </div>
              </div>

              {/* In-app PDF.js Canvas Preview */}
              <div className="mt-4">
                <PdfCanvasViewer
                  file={outputFiles[0]}
                  inline={true}
                  onExpand={() => setPreviewModalFile(outputFiles[0])}
                  onDownload={() => downloadFile(outputFiles[0].blob, outputFiles[0].name)}
                />
              </div>
            </div>
          )}

          {/* Multiple Files Result: Interactive Table & Downloads */}
          {outputFiles.length > 1 && (
            <div className="border border-[#DEDCD3] bg-white rounded-[2px] overflow-hidden">
              <div className="p-4 border-b border-[#DEDCD3] bg-[#F5F3ED] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-[#20201D]">
                    Split Output Documents ({outputFiles.length})
                  </h3>
                  <p className="text-xs text-[#57564F] mt-0.5">
                    Download files one-by-one or use the "Download All as ZIP" button above.
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[#DEDCD3] max-h-[500px] overflow-y-auto">
                {outputFiles.map((file, idx) => (
                  <div
                    key={file.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F5F3ED]/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 border border-[#DEDCD3] bg-[#F5F3ED] flex items-center justify-center rounded-[2px] flex-shrink-0 text-[#20201D] font-mono text-xs">
                        #{idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#20201D] truncate" title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs text-[#57564F] mt-0.5">
                          {formatBytes(file.size)} • {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'} ({file.pagesDescription})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={() => setPreviewModalFile(file)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#DEDCD3] hover:bg-[#F5F3ED] text-[#20201D] text-xs font-medium rounded-[2px] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#57564F]" />
                        <span>Preview</span>
                      </button>
                      <button
                        onClick={() => downloadFile(file.blob, file.name)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#20201D] text-[#F5F3ED] hover:bg-[#68735B] text-xs font-medium rounded-[2px] transition-colors shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PDF.js Canvas Preview Modal */}
      {previewModalFile && (
        <PdfPreviewModal
          file={previewModalFile}
          onClose={() => setPreviewModalFile(null)}
          onDownload={() => downloadFile(previewModalFile.blob, previewModalFile.name)}
        />
      )}

      {/* Feature & Privacy Assurance Details */}
      <div className="border border-[#DEDCD3] bg-white p-6 sm:p-8 rounded-[2px] space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[#20201D]">
          How FastPDFx Splits Your PDF Documents
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-[#57564F] leading-relaxed">
          <div className="space-y-1.5">
            <h4 className="font-semibold text-[#20201D] text-sm">100% In-Browser Engine</h4>
            <p>
              Your PDF is processed strictly inside your browser memory using WebAssembly and canvas rendering. Files are never uploaded to any remote server or cloud bucket.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-semibold text-[#20201D] text-sm">Flexible Extraction Modes</h4>
            <p>
              Choose between interactive visual page picking, one-click separation of all pages, or powerful custom page interval syntax (e.g., 1-4, 7, 9-12).
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-semibold text-[#20201D] text-sm">Bulk ZIP Bundling</h4>
            <p>
              Splitting large documents generates multiple individual PDFs. Download them one by one or click a single button to get a convenient bundled ZIP archive.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
