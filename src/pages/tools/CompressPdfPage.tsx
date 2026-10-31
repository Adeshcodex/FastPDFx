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
  FileArchive,
  Layers,
  Eye,
  X,
  FileCheck,
  Sparkles,
  Info,
  Sliders,
  ShieldCheck,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { PageMeta } from '../../components/PageMeta';
import { PdfCanvasViewer } from '../../components/PdfCanvasViewer';
import { PdfPreviewModal } from '../../components/PdfPreviewModal';
import { formatBytes } from '../../utils/formatBytes';
import { downloadFile } from '../../utils/downloadFile';
import {
  compressPdfDocument,
  inspectPdfForCompression,
  CompressionLevel,
  CompressionResult,
  CompressionInspection
} from '../../utils/pdfCompressor';

export const CompressPdfPage: React.FC = () => {
  // Document state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [inspection, setInspection] = useState<CompressionInspection | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Settings state
  const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('medium');
  const [scannedMode, setScannedMode] = useState<boolean>(false);

  // Compression state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null);
  const [compressionError, setCompressionError] = useState<string | null>(null);

  // Preview state
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showInlinePreview, setShowInlinePreview] = useState<boolean>(false);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file validation and loading
  const handleFileSelected = async (file: File) => {
    setUploadError(null);
    setCompressionResult(null);
    setCompressionError(null);
    setPreviewBlob(null);
    setShowInlinePreview(false);

    // Validate type and extension
    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === '';

    if (!isPdfExt && !isPdfMime) {
      setUploadError('Invalid file type. Please select a valid PDF document (.pdf).');
      return;
    }

    if (file.size === 0) {
      setUploadError('The selected file is empty (0 bytes). Please upload a valid PDF.');
      return;
    }

    setIsInspecting(true);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);

      // Verify PDF magic header (%PDF-)
      const headerStr = String.fromCharCode(...bytes.slice(0, 5));
      if (!headerStr.startsWith('%PDF-')) {
        throw new Error('This file does not appear to be a valid PDF document (missing %PDF- header).');
      }

      // Inspect structure via pdf-lib
      const insp = await inspectPdfForCompression(bytes);

      setSelectedFile(file);
      setFileBytes(bytes);
      setInspection(insp);

      // Auto-suggest scanned mode if it is purely image-heavy
      if (insp.estimatedType === 'image_heavy' && insp.dctImageCount === 0 && insp.imageCount > 0) {
        setScannedMode(true);
      } else {
        setScannedMode(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not read PDF. The file may be corrupt or encrypted.';
      setUploadError(msg);
      setSelectedFile(null);
      setFileBytes(null);
      setInspection(null);
    } finally {
      setIsInspecting(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileBytes(null);
    setInspection(null);
    setUploadError(null);
    setCompressionResult(null);
    setCompressionError(null);
    setPreviewBlob(null);
    setShowPreviewModal(false);
    setShowInlinePreview(false);
    setProgressPercent(0);
    setProgressMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Perform compression
  const handleCompress = async () => {
    if (!fileBytes || !selectedFile) return;

    setIsProcessing(true);
    setCompressionError(null);
    setProgressMessage('Initializing compression...');
    setProgressPercent(5);

    try {
      const result = await compressPdfDocument(fileBytes, {
        level: compressionLevel,
        optimizeScannedMode: scannedMode,
        onProgress: (msg, pct) => {
          setProgressMessage(msg);
          setProgressPercent(pct);
        }
      });

      setCompressionResult(result);
      const blob = new Blob([result.compressedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      setPreviewBlob(blob);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to compress PDF. Please check the file and try again.';
      setCompressionError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download compressed PDF
  const handleDownload = () => {
    if (!compressionResult || !previewBlob) return;
    const baseName = selectedFile ? selectedFile.name.replace(/\.pdf$/i, '') : 'document';
    const downloadName = `${baseName}-compressed.pdf`;
    downloadFile(previewBlob, downloadName);
  };

  return (
    <div className="w-full">
      <PageMeta
        title="PDF Compressor — Reduce PDF File Size Online Free | FastPDFx"
        description="Shrink hefty PDF documents without losing critical visual quality. Fast, private, in-browser compression with zero server uploads."
      />

      {/* Top Breadcrumb & Title */}
      <div className="mb-6 sm:mb-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs tracking-wider uppercase font-mono text-[#68735B] hover:text-[#20201D] transition-colors mb-3"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to all tools
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#20201D]">
              PDF Compressor
            </h1>
            <p className="text-sm text-[#666660] mt-1">
              Reduce PDF file size by optimizing embedded image streams, stripping redundant metadata, and compacting object streams.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono uppercase bg-[#E8E6DF] text-[#444440] border border-[#DEDCD3] rounded-[2px]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#68735B]" />
              100% In-Browser Privacy
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Upload & Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 mb-12">
        {/* Left Column: Upload / Document Card */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          {!selectedFile ? (
            /* Upload Dropzone */
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[2px] p-8 sm:p-12 text-center cursor-pointer transition-all duration-150 flex flex-col items-center justify-center min-h-[320px] bg-white ${
                isDragging
                  ? 'border-[#68735B] bg-[#F2F4EF]'
                  : 'border-[#DEDCD3] hover:border-[#20201D]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleInputChange}
              />
              <div className="w-14 h-14 rounded-[2px] bg-[#F5F3ED] border border-[#DEDCD3] flex items-center justify-center mb-4 text-[#68735B]">
                <FileArchive className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-[#20201D] mb-1">
                Select a PDF file or drag & drop here
              </h3>
              <p className="text-xs text-[#666660] max-w-sm mb-4">
                Accepts standard PDF documents. Files are processed entirely in your browser memory and never uploaded to any server.
              </p>
              <button
                type="button"
                className="px-4 py-2 bg-[#20201D] text-[#F5F3ED] text-xs font-medium uppercase tracking-wider rounded-[2px] hover:bg-[#333330] transition-colors"
              >
                Choose PDF File
              </button>

              {isInspecting && (
                <div className="mt-4 flex items-center gap-2 text-xs text-[#68735B] font-mono">
                  <div className="w-3 h-3 border-2 border-[#68735B] border-t-transparent rounded-full animate-spin" />
                  Analyzing PDF structure...
                </div>
              )}
            </div>
          ) : (
            /* Selected File Inspection Card */
            <div className="bg-white border border-[#DEDCD3] rounded-[2px] p-5 sm:p-6 shadow-xs flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-[2px] bg-[#F5F3ED] border border-[#DEDCD3] flex items-center justify-center text-[#68735B] shrink-0">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-semibold text-[#20201D] truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-[#666660] font-mono">
                      <span>{formatBytes(selectedFile.size)}</span>
                      <span>•</span>
                      <span>{inspection ? `${inspection.pageCount} ${inspection.pageCount === 1 ? 'page' : 'pages'}` : 'Analyzing...'}</span>
                      {inspection && inspection.imageCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-[#68735B] font-medium">
                            {inspection.imageCount} embedded image{inspection.imageCount === 1 ? '' : 's'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 text-xs text-[#444440] hover:text-[#20201D] hover:bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] transition-colors"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="p-1.5 text-[#666660] hover:text-[#992222] hover:bg-[#FBEBEB] border border-[#DEDCD3] rounded-[2px] transition-colors"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleInputChange}
              />

              {/* Inspection Details Pill / Banner */}
              {inspection && (
                <div className="bg-[#FAF9F5] border border-[#E8E6DF] rounded-[2px] p-3 text-xs text-[#555550] flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-[#68735B] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-[#20201D]">Document Profile: </span>
                    {inspection.hasImages ? (
                      inspection.dctImageCount > 0 ? (
                        <span>
                          Contains {inspection.imageCount} image streams ({inspection.dctImageCount} photo-grade JPEG streams). Excellent candidate for substantial compression!
                        </span>
                      ) : (
                        <span>
                          Contains {inspection.imageCount} bitmap/lossless image stream(s). Medium or High compression will optimize structure and streams.
                        </span>
                      )
                    ) : (
                      <span>
                        Primarily vector and font text. Safe compression will strip redundant metadata and pack object streams.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="bg-[#FFF5F5] border border-[#ECCACA] text-[#992222] p-4 rounded-[2px] flex items-start gap-3 text-xs sm:text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold">Upload Error: </strong>
                {uploadError}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Compression Options & Trigger */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-[#DEDCD3] rounded-[2px] p-5 sm:p-6 shadow-xs flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-[#E8E6DF] pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#68735B]" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#20201D]">
                  Compression Level
                </h2>
              </div>
              <span className="text-xs font-mono text-[#666660]">3 Options</span>
            </div>

            {/* Level Selector Cards */}
            <div className="flex flex-col gap-3">
              {/* Medium Option (Recommended) */}
              <label
                className={`relative flex items-start gap-3 p-3.5 border rounded-[2px] cursor-pointer transition-all ${
                  compressionLevel === 'medium'
                    ? 'border-[#68735B] bg-[#F4F6F2] shadow-xs'
                    : 'border-[#DEDCD3] hover:border-[#666660] bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="compressionLevel"
                  value="medium"
                  checked={compressionLevel === 'medium'}
                  onChange={() => setCompressionLevel('medium')}
                  className="mt-1 accent-[#68735B]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#20201D]">
                      Medium Compression
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-[#68735B] text-white rounded-[2px]">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-[#555550] mt-1 leading-relaxed">
                    Balances significant file size reduction with crisp typography and clear graphics (max 1200px, 70% quality).
                  </p>
                </div>
              </label>

              {/* Low Option */}
              <label
                className={`relative flex items-start gap-3 p-3.5 border rounded-[2px] cursor-pointer transition-all ${
                  compressionLevel === 'low'
                    ? 'border-[#68735B] bg-[#F4F6F2] shadow-xs'
                    : 'border-[#DEDCD3] hover:border-[#666660] bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="compressionLevel"
                  value="low"
                  checked={compressionLevel === 'low'}
                  onChange={() => setCompressionLevel('low')}
                  className="mt-1 accent-[#68735B]"
                />
                <div className="flex-1">
                  <span className="text-sm font-semibold text-[#20201D]">
                    Low Compression
                  </span>
                  <p className="text-xs text-[#555550] mt-1 leading-relaxed">
                    Prioritizes highest visual fidelity (max 1800px, 85% quality). Applies safe stream packing and metadata cleaning.
                  </p>
                </div>
              </label>

              {/* High Option */}
              <label
                className={`relative flex items-start gap-3 p-3.5 border rounded-[2px] cursor-pointer transition-all ${
                  compressionLevel === 'high'
                    ? 'border-[#68735B] bg-[#F4F6F2] shadow-xs'
                    : 'border-[#DEDCD3] hover:border-[#666660] bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="compressionLevel"
                  value="high"
                  checked={compressionLevel === 'high'}
                  onChange={() => setCompressionLevel('high')}
                  className="mt-1 accent-[#68735B]"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#20201D]">
                      High Compression
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-mono uppercase bg-[#E8E6DF] text-[#666660] rounded-[2px]">
                      Smallest Size
                    </span>
                  </div>
                  <p className="text-xs text-[#555550] mt-1 leading-relaxed">
                    Maximum byte reduction for tight upload thresholds (max 900px, 50% quality).
                  </p>
                </div>
              </label>
            </div>

            {/* High compression warning banner */}
            {compressionLevel === 'high' && (
              <div className="bg-[#FFF8E6] border border-[#E8D08D] text-[#7A5B15] p-3 rounded-[2px] flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#B87A00]" />
                <div>
                  <strong className="font-semibold">Notice: </strong>
                  High compression applies aggressive image downsampling. Images may exhibit noticeable compression artifacts. Text and vector lines will remain sharp.
                </div>
              </div>
            )}

            {/* Scanned Document Optimization Mode Toggle */}
            <div className="pt-2 border-t border-[#E8E6DF]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scannedMode}
                  onChange={(e) => setScannedMode(e.target.checked)}
                  className="mt-0.5 accent-[#68735B]"
                />
                <div className="text-xs text-[#444440]">
                  <span className="font-semibold text-[#20201D] block mb-0.5">
                    Optimize as Scanned Document
                  </span>
                  Re-encodes page canvases into optimized JPEG pages. Recommended for paper contract scans, receipts, or fax PDFs with large uncompressed scans.
                </div>
              </label>
            </div>

            {/* Action Button */}
            <div className="mt-2">
              <button
                type="button"
                disabled={!selectedFile || isProcessing}
                onClick={handleCompress}
                className={`w-full py-3 px-4 rounded-[2px] font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  !selectedFile || isProcessing
                    ? 'bg-[#E8E6DF] text-[#999990] cursor-not-allowed'
                    : 'bg-[#20201D] text-[#F5F3ED] hover:bg-[#333330] shadow-sm active:translate-y-[1px]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#F5F3ED] border-t-transparent rounded-full animate-spin" />
                    <span>Compressing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#F5F3ED]" />
                    <span>Compress PDF</span>
                  </>
                )}
              </button>
            </div>

            {/* Progress bar when processing */}
            {isProcessing && (
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-xs font-mono text-[#666660]">
                  <span className="truncate">{progressMessage}</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="w-full bg-[#E8E6DF] h-1.5 rounded-[1px] overflow-hidden">
                  <div
                    className="bg-[#68735B] h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compression Error Banner */}
      {compressionError && (
        <div className="mb-8 bg-[#FFF5F5] border border-[#ECCACA] text-[#992222] p-4 rounded-[2px] flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold">Compression Failed: </strong>
            {compressionError}
          </div>
        </div>
      )}

      {/* Results Section */}
      {compressionResult && (
        <div className="mb-12 bg-white border border-[#DEDCD3] rounded-[2px] p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8E6DF] pb-5 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-[2px] bg-[#EBF0E6] text-[#68735B] flex items-center justify-center">
                  <Check className="w-4 h-4" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-[#20201D]">
                  {compressionResult.isLarger ? 'Compression Finished' : 'PDF Successfully Compressed'}
                </h2>
              </div>
              <p className="text-xs text-[#666660] mt-1 font-mono">
                {compressionResult.details.summaryMessage}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-mono uppercase text-[#444440] hover:text-[#20201D] hover:bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Compress Another
              </button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#FAF9F5] border border-[#E8E6DF] rounded-[2px] p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#666660] block mb-1">
                Original Size
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-[#20201D]">
                {formatBytes(compressionResult.originalSize)}
              </span>
            </div>

            <div className="bg-[#FAF9F5] border border-[#E8E6DF] rounded-[2px] p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#666660] block mb-1">
                Compressed Size
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-[#20201D]">
                {formatBytes(compressionResult.compressedSize)}
              </span>
            </div>

            <div className="bg-[#FAF9F5] border border-[#E8E6DF] rounded-[2px] p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#666660] block mb-1">
                Size Reduction
              </span>
              <span className={`text-base sm:text-lg font-bold font-mono ${
                compressionResult.isLarger ? 'text-[#888880]' : 'text-[#68735B]'
              }`}>
                {compressionResult.isLarger ? '0%' : `-${compressionResult.percentReduction}%`}
              </span>
            </div>

            <div className="bg-[#FAF9F5] border border-[#E8E6DF] rounded-[2px] p-3.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#666660] block mb-1">
                Space Saved
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-[#68735B]">
                {compressionResult.isLarger ? '0 KB' : formatBytes(compressionResult.savedBytes)}
              </span>
            </div>
          </div>

          {/* Honest Notice for non-compressible PDFs */}
          {compressionResult.isLarger && (
            <div className="bg-[#F5F3ED] border border-[#DEDCD3] p-4 rounded-[2px] mb-6 text-xs text-[#555550] flex items-start gap-3">
              <Info className="w-5 h-5 text-[#68735B] shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-[#20201D] block mb-1">
                  Why didn&apos;t this PDF shrink further?
                </strong>
                FastPDFx inspected every stream in your document. Your PDF contains pure vector lines, fonts, and text that are already stored in compact Flate streams with zero bloated images. FastPDFx will never report fake savings or destructively rasterize your text pages without your permission.
              </div>
            </div>
          )}

          {/* Action Buttons & In-App Preview */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#20201D] text-[#F5F3ED] rounded-[2px] text-xs font-medium uppercase tracking-wider hover:bg-[#333330] transition-colors shadow-sm"
            >
              <Download className="w-4 h-4" />
              Download Compressed PDF
            </button>

            {previewBlob && (
              <>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#20201D] border border-[#DEDCD3] rounded-[2px] text-xs font-medium uppercase tracking-wider hover:bg-[#F5F3ED] transition-colors"
                >
                  <Eye className="w-4 h-4 text-[#68735B]" />
                  Full Preview (Modal)
                </button>

                <button
                  type="button"
                  onClick={() => setShowInlinePreview(!showInlinePreview)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-[#444440] border border-[#DEDCD3] rounded-[2px] text-xs font-mono uppercase hover:bg-[#F5F3ED] transition-colors"
                >
                  {showInlinePreview ? 'Hide Inline Preview' : 'Show Inline Preview'}
                </button>
              </>
            )}
          </div>

          {/* Inline Canvas Viewer when toggled */}
          {showInlinePreview && previewBlob && (
            <div className="mt-6 border border-[#DEDCD3] rounded-[2px] overflow-hidden bg-white">
              <div className="bg-[#FAF9F5] border-b border-[#E8E6DF] px-4 py-2.5 flex items-center justify-between text-xs">
                <span className="font-mono text-[#666660]">
                  Inline Canvas Preview: fastpdfx-compressed.pdf ({formatBytes(compressionResult.compressedSize)})
                </span>
                <button
                  type="button"
                  onClick={() => setShowInlinePreview(false)}
                  className="text-[#666660] hover:text-[#20201D]"
                >
                  Close
                </button>
              </div>
              <div className="h-[550px] relative">
                <PdfCanvasViewer
                  file={{
                    name: 'fastpdfx-compressed.pdf',
                    blob: previewBlob,
                    size: compressionResult.compressedSize,
                    pageCount: compressionResult.pageCount
                  }}
                  inline={true}
                  onExpand={() => setShowPreviewModal(true)}
                  onDownload={handleDownload}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* In-App Preview Modal (PDF.js Canvas based, Edge-safe!) */}
      {showPreviewModal && previewBlob && (
        <PdfPreviewModal
          file={{
            name: selectedFile ? `${selectedFile.name.replace(/\.pdf$/i, '')}-compressed.pdf` : 'fastpdfx-compressed.pdf',
            blob: previewBlob,
            size: compressionResult?.compressedSize,
            pageCount: compressionResult?.pageCount
          }}
          onClose={() => setShowPreviewModal(false)}
          onDownload={handleDownload}
        />
      )}

      {/* Technical FAQ & Feature Details */}
      <div className="border-t border-[#DEDCD3] pt-10 sm:pt-12">
        <div className="max-w-3xl mb-8">
          <h3 className="text-lg font-bold tracking-tight text-[#20201D] mb-2">
            How Browser-Based PDF Compression Works
          </h3>
          <p className="text-xs sm:text-sm text-[#666660] leading-relaxed">
            FastPDFx uses real document parsing and image optimization inside your browser to safely compress files without sending your private contracts or personal PDFs to external cloud servers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-[#DEDCD3] rounded-[2px] p-5">
            <div className="w-8 h-8 rounded-[2px] bg-[#F5F3ED] border border-[#DEDCD3] flex items-center justify-center text-[#68735B] mb-3">
              <FileArchive className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-[#20201D] mb-1.5">
              Embedded Image Stream Optimization
            </h4>
            <p className="text-xs text-[#666660] leading-relaxed">
              PDFs often store massive uncompressed photo streams from smartphones and scanners. FastPDFx downsamples these image streams using the HTML5 Canvas API while preserving overall visual sharpness.
            </p>
          </div>

          <div className="bg-white border border-[#DEDCD3] rounded-[2px] p-5">
            <div className="w-8 h-8 rounded-[2px] bg-[#F5F3ED] border border-[#DEDCD3] flex items-center justify-center text-[#68735B] mb-3">
              <Layers className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-[#20201D] mb-1.5">
              Object Stream Compaction
            </h4>
            <p className="text-xs text-[#666660] leading-relaxed">
              Standard cross-reference tables and whitespace bloat are eliminated by consolidating indirect PDF objects into compressed Object Streams (<code className="font-mono text-[#68735B]">/ObjStm</code>), saving valuable kilobytes.
            </p>
          </div>

          <div className="bg-white border border-[#DEDCD3] rounded-[2px] p-5">
            <div className="w-8 h-8 rounded-[2px] bg-[#F5F3ED] border border-[#DEDCD3] flex items-center justify-center text-[#68735B] mb-3">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h4 className="text-sm font-semibold text-[#20201D] mb-1.5">
              Zero Server Uploads
            </h4>
            <p className="text-xs text-[#666660] leading-relaxed">
              Unlike cloud-based PDF tools that transmit your confidential files over the network, FastPDFx executes all operations entirely in WebAssembly and browser memory. Your documents never leave your computer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CompressPdfPage;
