import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Download,
  RotateCcw,
  Check,
  AlertCircle,
  FileText,
  ScanText,
  Settings,
  Layers,
  Sparkles,
  Info,
  Sliders,
  ShieldCheck,
  HelpCircle,
  AlertTriangle,
  Languages,
  BookOpen,
} from 'lucide-react';
import { PageMeta } from '../../components/PageMeta';
import { formatBytes } from '../../utils/formatBytes';
import { downloadFile } from '../../utils/downloadFile';
import {
  inspectPdfForWord,
  convertPdfToDocx,
  parsePageRange,
  DocumentInspection,
  ConversionResult,
  FormattingMode,
  PageSelectionMode,
} from '../../utils/pdfToWordConverter';

const SUPPORTED_OCR_LANGUAGES = [
  { code: 'eng', name: 'English' },
  { code: 'hin', name: 'Hindi (हिन्दी)' },
  { code: 'hin+eng', name: 'Hindi + English (हिन्दी + English)' },
  { code: 'spa', name: 'Spanish (Español)' },
  { code: 'fra', name: 'French (Français)' },
  { code: 'deu', name: 'German (Deutsch)' },
  { code: 'ita', name: 'Italian (Italiano)' },
  { code: 'por', name: 'Portuguese (Português)' },
];

export const PdfToWordPage: React.FC = () => {
  // Document state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [inspection, setInspection] = useState<DocumentInspection | null>(null);
  const [isInspecting, setIsInspecting] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Conversion options state
  const [formattingMode, setFormattingMode] = useState<FormattingMode>('preserve_formatting');
  const [pageSelectionMode, setPageSelectionMode] = useState<PageSelectionMode>('all');
  const [customPageRange, setCustomPageRange] = useState<string>('');
  const [enableOcr, setEnableOcr] = useState<boolean>(false);
  const [ocrLanguage, setOcrLanguage] = useState<string>('eng');

  // Conversion execution state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);

  // Drag and drop state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (file: File) => {
    setUploadError(null);
    setConversionResult(null);
    setConversionError(null);

    const isPdfExt = file.name.toLowerCase().endsWith('.pdf');
    const isPdfMime = file.type === 'application/pdf' || file.type === '';

    if (!isPdfExt && !isPdfMime) {
      setUploadError('Invalid file type. Please upload a valid PDF document (.pdf).');
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

      // Inspect document
      const insp = await inspectPdfForWord(bytes);

      setSelectedFile(file);
      setFileBytes(bytes);
      setInspection(insp);
      setCustomPageRange(`1-${insp.pageCount}`);

      // If document is purely scanned, automatically recommend OCR
      if (insp.hasScannedPages) {
        setEnableOcr(true);
        if (insp.hasDevanagari) {
          setOcrLanguage('hin+eng');
        }
      } else if (insp.hasDevanagari) {
        setOcrLanguage('hin+eng');
      }
    } catch (err: any) {
      console.error('Inspection error:', err);
      setUploadError(err.message || 'Failed to inspect PDF. The file may be corrupt or encrypted.');
      setSelectedFile(null);
      setFileBytes(null);
      setInspection(null);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setFileBytes(null);
    setInspection(null);
    setConversionResult(null);
    setConversionError(null);
    setUploadError(null);
    setProgressPercent(0);
    setProgressMessage('');
    setFormattingMode('preserve_formatting');
    setPageSelectionMode('all');
    setCustomPageRange('');
    setEnableOcr(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConvert = async () => {
    if (!fileBytes || !selectedFile || !inspection) return;

    setIsProcessing(true);
    setConversionError(null);
    setProgressPercent(5);
    setProgressMessage('Initializing PDF to Word conversion engine...');

    try {
      const result = await convertPdfToDocx(fileBytes, selectedFile.name, {
        formattingMode,
        pageSelectionMode,
        customPageRange: pageSelectionMode === 'custom' ? customPageRange : undefined,
        enableOcrForScanned: enableOcr,
        ocrLanguage,
        onProgress: (msg, pct) => {
          setProgressMessage(msg);
          setProgressPercent(pct);
        },
      });

      setConversionResult(result);
    } catch (err: any) {
      console.error('Conversion failed:', err);
      setConversionError(err.message || 'An error occurred during Word document conversion.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Compute parsed page count for custom page range
  const parsedCustomPages =
    inspection && pageSelectionMode === 'custom' && customPageRange
      ? parsePageRange(customPageRange, inspection.pageCount)
      : [];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <PageMeta
        title="PDF to Word Converter — Free In-Browser PDF to DOCX"
        description="Convert PDF documents into fully editable Microsoft Word (.docx) files. Reconstructs text headings, paragraphs, and reading order with optional scanned-page OCR."
      />

      {/* Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 text-xs font-mono tracking-wider uppercase text-[#605E57]">
        <Link to="/" className="hover:text-[#20201D] transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link to="/" className="hover:text-[#20201D] transition-colors">
          PDF Tools
        </Link>
        <span>/</span>
        <span className="text-[#20201D] font-bold">PDF to Word</span>
      </div>

      {/* Header Section */}
      <div className="border-b border-[#E5E0D8] pb-6">
        <div className="flex items-center space-x-3 mb-2">
          <Link
            to="/"
            className="p-1.5 text-[#605E57] hover:text-[#20201D] hover:bg-[#EAE6DE] rounded transition-colors"
            title="Return to all tools"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-mono font-medium tracking-wide bg-[#20201D] text-[#F5F3ED] rounded-none">
            GENUINE DOCX • EDITABLE TEXT • 100% PRIVATE
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-[#20201D] tracking-tight">
          PDF to Word Converter
        </h1>
        <p className="mt-2 text-[#605E57] text-base leading-relaxed max-w-3xl">
          Transform PDF documents into genuine, editable Microsoft Word (<code className="font-mono text-xs bg-[#EAE6DE] px-1 py-0.5 text-[#20201D]">.docx</code>) files. Reconstructs reading order, headings, paragraphs, and styles directly in your browser without third-party servers.
        </p>
      </div>

      {/* Step 1: Upload Zone (Visible if no file selected) */}
      {!selectedFile && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all duration-200 ${
              isDragging
                ? 'border-[#20201D] bg-[#EAE6DE]'
                : 'border-[#D5D0C5] bg-[#FBF9F4] hover:border-[#20201D] hover:bg-[#F5F3ED]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelected(e.target.files[0]);
                }
              }}
            />

            <div className="flex flex-col items-center max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 rounded-none bg-[#EAE6DE] border border-[#D5D0C5] flex items-center justify-center text-[#20201D]">
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-serif font-semibold text-[#20201D]">
                  Drop your PDF here, or <span className="underline decoration-1 underline-offset-4">browse files</span>
                </p>
                <p className="text-xs text-[#605E57] font-mono">
                  Accepts standard PDF documents. Processed locally in memory.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[11px] font-mono text-[#605E57]">
                <span className="inline-flex items-center px-2 py-0.5 bg-[#EAE6DE] border border-[#D5D0C5]">
                  <FileText className="w-3 h-3 mr-1" /> Reconstructs Headings
                </span>
                <span className="inline-flex items-center px-2 py-0.5 bg-[#EAE6DE] border border-[#D5D0C5]">
                  <ScanText className="w-3 h-3 mr-1" /> Scanned OCR Support
                </span>
                <span className="inline-flex items-center px-2 py-0.5 bg-[#EAE6DE] border border-[#D5D0C5]">
                  <ShieldCheck className="w-3 h-3 mr-1" /> 100% Client-Side
                </span>
              </div>
            </div>
          </div>

          {/* Upload Error Banner */}
          {uploadError && (
            <div className="p-4 bg-[#FBEBEB] border border-[#F0B2B2] text-[#842029] flex items-start space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load PDF</p>
                <p className="text-xs mt-0.5">{uploadError}</p>
              </div>
            </div>
          )}

          {/* Inspecting Spinner */}
          {isInspecting && (
            <div className="p-6 bg-white border border-[#D5D0C5] text-center space-y-2">
              <div className="animate-spin inline-block w-6 h-6 border-2 border-[#20201D] border-t-transparent rounded-full" />
              <p className="text-sm font-medium text-[#20201D]">Inspecting document structure and page density...</p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: File Details & Options Workspace (Visible when file is loaded) */}
      {selectedFile && inspection && !conversionResult && (
        <div className="space-y-6">
          {/* Document Summary Card */}
          <div className="bg-white border border-[#D5D0C5] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#EAE6DE]">
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 bg-[#20201D] text-[#F5F3ED] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-[#20201D] break-all">
                    {selectedFile.name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs font-mono text-[#605E57]">
                    <span>Size: <strong className="text-[#20201D]">{formatBytes(selectedFile.size)}</strong></span>
                    <span>•</span>
                    <span>Pages: <strong className="text-[#20201D]">{inspection.pageCount}</strong></span>
                    <span>•</span>
                    <span>Estimated Words: <strong className="text-[#20201D]">{inspection.totalEstimatedWords.toLocaleString()}</strong></span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-mono border border-[#D5D0C5] hover:bg-[#F5F3ED] text-[#20201D] transition-colors"
                >
                  Replace PDF
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-mono text-[#842029] hover:bg-[#FBEBEB] border border-transparent transition-colors"
                >
                  Remove
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>

            {/* Scanned Pages Notice Banner if detected */}
            {inspection.hasScannedPages && (
              <div className="mt-4 p-3.5 bg-[#FFFBEB] border border-[#FDE68A] text-[#92400E] text-xs flex items-start space-x-3">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#B45309]" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-[#92400E]">
                    Scanned or Image-Based Content Detected
                  </p>
                  <p className="leading-relaxed">
                    Page{inspection.scannedPages.length > 1 ? 's' : ''}{' '}
                    <strong>{inspection.scannedPages.join(', ')}</strong> contain fewer than 40 selectable text characters and appear to be flattened scans or bitmaps.
                    Turn on <strong>In-Browser OCR</strong> in the settings below to transcribe them into editable Word paragraphs.
                  </p>
                </div>
              </div>
            )}

            {/* Hindi / Devanagari Detected Banner */}
            {inspection.hasDevanagari && (
              <div className="mt-4 p-3.5 bg-[#F0FDF4] border border-[#BBF7D0] text-[#166534] text-xs flex items-start space-x-3">
                <Languages className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#15803D]" />
                <div className="space-y-1">
                  <p className="font-semibold text-sm text-[#166534]">
                    Hindi (Devanagari) Text Detected & Supported
                  </p>
                  <p className="leading-relaxed text-[#14532D]">
                    FastPDFx automatically configures <strong>Nirmala UI</strong> complex-script styling with Calibri Latin fallback in the exported Word (.docx) document. Combining matras, viramas (्), and conjuncts will render smoothly in Microsoft Word without missing glyph boxes (<code className="bg-[#DCFCE7] px-1 py-0.5 border border-[#BBF7D0]">□</code>).
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Conversion Configuration Settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Setting 1: Page Range */}
            <div className="bg-white border border-[#D5D0C5] p-5 space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-[#EAE6DE]">
                <Layers className="w-4 h-4 text-[#605E57]" />
                <h3 className="font-serif font-bold text-base text-[#20201D]">Page Selection</h3>
              </div>

              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pageSelection"
                    checked={pageSelectionMode === 'all'}
                    onChange={() => setPageSelectionMode('all')}
                    className="mt-1 text-[#20201D] focus:ring-[#20201D]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-[#20201D]">Convert entire PDF</span>
                    <p className="text-xs text-[#605E57]">
                      Process all {inspection.pageCount} page{inspection.pageCount > 1 ? 's' : ''} in sequential reading order.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="pageSelection"
                    checked={pageSelectionMode === 'custom'}
                    onChange={() => setPageSelectionMode('custom')}
                    className="mt-1 text-[#20201D] focus:ring-[#20201D]"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-semibold text-[#20201D]">Convert specific page ranges</span>
                    <p className="text-xs text-[#605E57] mb-2">
                      Extract only desired chapters or pages (e.g. 1-3, 5, 8-10).
                    </p>

                    {pageSelectionMode === 'custom' && (
                      <div className="space-y-1.5 mt-2">
                        <input
                          type="text"
                          value={customPageRange}
                          onChange={(e) => setCustomPageRange(e.target.value)}
                          placeholder={`e.g. 1-${Math.min(3, inspection.pageCount)}, ${Math.min(5, inspection.pageCount)}`}
                          className="w-full px-3 py-1.5 text-xs font-mono border border-[#D5D0C5] focus:border-[#20201D] focus:outline-none"
                        />
                        <div className="flex items-center justify-between text-[11px] font-mono text-[#605E57]">
                          <span>Valid pages: 1 to {inspection.pageCount}</span>
                          <span>
                            Selected: <strong className="text-[#20201D]">{parsedCustomPages.length} pages</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Setting 2: Formatting Mode */}
            <div className="bg-white border border-[#D5D0C5] p-5 space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-[#EAE6DE]">
                <Sliders className="w-4 h-4 text-[#605E57]" />
                <h3 className="font-serif font-bold text-base text-[#20201D]">Formatting Engine</h3>
              </div>

              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="formattingMode"
                    checked={formattingMode === 'preserve_formatting'}
                    onChange={() => setFormattingMode('preserve_formatting')}
                    className="mt-1 text-[#20201D] focus:ring-[#20201D]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-[#20201D]">
                      Preserve Formatting <span className="text-[10px] font-mono bg-[#EAE6DE] px-1.5 py-0.5 ml-1">RECOMMENDED</span>
                    </span>
                    <p className="text-xs text-[#605E57] leading-relaxed">
                      Reconstructs heading levels (Title, H1, H2), paragraph spacing, line alignments (Center, Right, Left), and inline bold/italic weights.
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="formattingMode"
                    checked={formattingMode === 'text_only'}
                    onChange={() => setFormattingMode('text_only')}
                    className="mt-1 text-[#20201D] focus:ring-[#20201D]"
                  />
                  <div>
                    <span className="text-sm font-semibold text-[#20201D]">Extract Text Only</span>
                    <p className="text-xs text-[#605E57] leading-relaxed">
                      Extracts plain, uniform text paragraphs in standard 11pt typography. Ideal for pasting into editorial documents or notes.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Setting 3: Scanned Document & OCR Engine */}
          <div className="bg-white border border-[#D5D0C5] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#EAE6DE]">
              <div className="flex items-center space-x-2">
                <ScanText className="w-4 h-4 text-[#605E57]" />
                <h3 className="font-serif font-bold text-base text-[#20201D]">
                  Optical Character Recognition (OCR) for Scanned Pages
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#605E57]">TESSERACT.JS WEBASSEMBLY</span>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <input
                  id="enableOcrCheckbox"
                  type="checkbox"
                  checked={enableOcr}
                  onChange={(e) => setEnableOcr(e.target.checked)}
                  className="mt-1 h-4 w-4 text-[#20201D] rounded-none border-[#D5D0C5] focus:ring-[#20201D]"
                />
                <label htmlFor="enableOcrCheckbox" className="cursor-pointer">
                  <span className="text-sm font-semibold text-[#20201D]">
                    Transcribe scanned, photo, or bitmap pages using client-side OCR
                  </span>
                  <p className="text-xs text-[#605E57] leading-relaxed mt-0.5">
                    When enabled, any page with little or no digital text will be rendered into high-resolution canvas tiles and processed by in-browser OCR.
                  </p>
                </label>
              </div>

              {enableOcr && (
                <div className="p-4 bg-[#FBF9F4] border border-[#EAE6DE] space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <label className="text-xs font-mono font-medium text-[#20201D] flex items-center space-x-1.5">
                      <Languages className="w-3.5 h-3.5 text-[#605E57]" />
                      <span>OCR Document Language:</span>
                    </label>
                    <select
                      value={ocrLanguage}
                      onChange={(e) => setOcrLanguage(e.target.value)}
                      className="px-3 py-1.5 text-xs font-mono bg-white border border-[#D5D0C5] focus:border-[#20201D] focus:outline-none"
                    >
                      {SUPPORTED_OCR_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <p className="text-[11px] text-[#605E57] leading-relaxed">
                    Note: In-browser OCR runs via WebAssembly directly on your machine. Multi-page scanned documents may take a few moments depending on your processor.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Layout Preservation Disclaimer */}
          <div className="p-4 bg-[#F5F3ED] border border-[#D5D0C5] text-xs text-[#605E57] space-y-1">
            <div className="flex items-center space-x-2 text-[#20201D] font-serif font-bold">
              <Info className="w-4 h-4 text-[#605E57]" />
              <span>Layout & Flowable Geometry Notice</span>
            </div>
            <p className="leading-relaxed">
              PDF files use absolute 2D point coordinates, whereas Microsoft Word uses fluid paragraph reflow. FastPDFx reconstructs lines, paragraphs, and heading hierarchies with high accuracy. Documents with overlapping vector art, complex multi-column flyers, or multi-nested tables may require minor typographic adjustments in Word.
            </p>
          </div>

          {/* Processing Progress or Conversion Action */}
          {isProcessing ? (
            <div className="bg-white border border-[#20201D] p-6 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#20201D] font-medium">{progressMessage || 'Converting PDF to Word...'}</span>
                <span className="font-bold text-[#20201D]">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 bg-[#EAE6DE] overflow-hidden">
                <div
                  className="h-full bg-[#20201D] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-[11px] font-mono text-[#605E57] text-center">
                Generating genuine Office OpenXML (<code className="text-[#20201D]">.docx</code>) binary in browser memory...
              </p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleConvert}
                disabled={pageSelectionMode === 'custom' && parsedCustomPages.length === 0}
                className="w-full sm:w-auto px-8 py-3.5 bg-[#20201D] hover:bg-[#333330] text-[#F5F3ED] text-sm font-serif font-semibold tracking-wide transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Convert to Word (.docx)</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto px-5 py-3.5 border border-[#D5D0C5] hover:bg-[#EAE6DE] text-[#20201D] text-xs font-mono transition-colors"
              >
                Cancel & Reset
              </button>
            </div>
          )}

          {/* Error Message if Conversion Failed */}
          {conversionError && (
            <div className="p-4 bg-[#FBEBEB] border border-[#F0B2B2] text-[#842029] flex items-start space-x-3 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Conversion Error</p>
                <p className="text-xs mt-0.5">{conversionError}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Result & Download Screen */}
      {conversionResult && (
        <div className="space-y-6">
          {/* Success Banner */}
          <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#10B981] text-white flex items-center justify-center flex-shrink-0">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-serif font-bold text-base text-[#065F46]">
                Conversion Completed Successfully!
              </h3>
              <p className="text-xs text-[#047857]">
                Your document has been compiled into an editable Microsoft Word document.
              </p>
            </div>
          </div>

          {/* Download Action Card */}
          <div className="bg-white border border-[#D5D0C5] p-6 sm:p-8 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[#EAE6DE]">
              <div className="flex items-start space-x-4">
                <div className="w-14 h-14 bg-[#20201D] text-[#F5F3ED] flex items-center justify-center flex-shrink-0">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-mono tracking-wider uppercase text-[#605E57] bg-[#EAE6DE] px-2 py-0.5">
                    MICROSOFT WORD DOCUMENT (.DOCX)
                  </span>
                  <h2 className="text-2xl font-serif font-bold text-[#20201D] mt-1 break-all">
                    {conversionResult.fileName}
                  </h2>
                  <p className="text-xs font-mono text-[#605E57] mt-1">
                    File Size: <strong>{formatBytes(conversionResult.fileSizeBytes)}</strong> • Compatible with Word 2007+, Microsoft 365, Google Docs, Apple Pages
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => downloadFile(conversionResult.docxBlob, conversionResult.fileName)}
                className="px-8 py-4 bg-[#20201D] hover:bg-[#333330] text-[#F5F3ED] text-base font-serif font-semibold tracking-wide transition-colors flex items-center justify-center space-x-3 shadow-sm cursor-pointer"
              >
                <Download className="w-5 h-5" />
                <span>Download Word (.docx)</span>
              </button>
            </div>

            {/* Sponsored Offer - Adsterra Smartlink */}
            <div className="mt-2 p-5 bg-[#FBF9F4] border border-[#EAE6DE] text-center space-y-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-[#605E57]">
                Sponsored Offer
              </p>

              <h3 className="font-serif font-bold text-lg text-[#20201D]">
                Explore a Special Offer
              </h3>

              <p className="text-xs text-[#605E57]">
                Support FastPDFx by checking out this optional sponsored offer.
              </p>

              <a
                href="https://asiafilm.org/4/efcf8ccc681b58be49d8dbd1634844cc"
                target="_blank"
                rel="nofollow sponsored noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-3 bg-[#20201D] hover:bg-[#333330] text-[#F5F3ED] text-sm font-serif font-semibold transition-colors"
              >
                Visit Sponsored Offer
              </a>
            </div>
            {/* Statistics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div className="p-4 bg-[#FBF9F4] border border-[#EAE6DE]">
                <p className="text-[11px] font-mono uppercase text-[#605E57]">Pages Converted</p>
                <p className="text-xl font-serif font-bold text-[#20201D] mt-1">
                  {conversionResult.pagesProcessed.length}
                </p>
                <p className="text-[10px] font-mono text-[#605E57] mt-0.5">
                  of {conversionResult.pageCount} total
                </p>
              </div>

              <div className="p-4 bg-[#FBF9F4] border border-[#EAE6DE]">
                <p className="text-[11px] font-mono uppercase text-[#605E57]">Words Extracted</p>
                <p className="text-xl font-serif font-bold text-[#20201D] mt-1">
                  {conversionResult.totalWords.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-[#605E57] mt-0.5">
                  clean reading order
                </p>
              </div>

              <div className="p-4 bg-[#FBF9F4] border border-[#EAE6DE]">
                <p className="text-[11px] font-mono uppercase text-[#605E57]">Paragraphs Created</p>
                <p className="text-xl font-serif font-bold text-[#20201D] mt-1">
                  {conversionResult.totalParagraphs.toLocaleString()}
                </p>
                <p className="text-[10px] font-mono text-[#605E57] mt-0.5">
                  {conversionResult.headingsDetected} headings detected
                </p>
              </div>

              <div className="p-4 bg-[#FBF9F4] border border-[#EAE6DE]">
                <p className="text-[11px] font-mono uppercase text-[#605E57]">OCR Transcription</p>
                <p className="text-xl font-serif font-bold text-[#20201D] mt-1">
                  {conversionResult.ocrAppliedPages.length > 0
                    ? `${conversionResult.ocrAppliedPages.length} page(s)`
                    : 'Digital text'}
                </p>
                <p className="text-[10px] font-mono text-[#605E57] mt-0.5">
                  {conversionResult.ocrLanguageUsed ? `Lang: ${conversionResult.ocrLanguageUsed.toUpperCase()}` : 'Native PDF streams'}
                </p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#EAE6DE]">
              <button
                type="button"
                onClick={handleReset}
                className="px-5 py-2.5 border border-[#D5D0C5] hover:bg-[#F5F3ED] text-[#20201D] text-xs font-mono transition-colors flex items-center space-x-2"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Convert Another PDF</span>
              </button>

              <div className="flex items-center space-x-3 text-xs font-mono text-[#605E57]">
                <Link to="/tool/pdf-compressor" className="hover:text-[#20201D] underline">
                  Compress PDF
                </Link>
                <span>•</span>
                <Link to="/tool/split-pdf" className="hover:text-[#20201D] underline">
                  Split PDF
                </Link>
                <span>•</span>
                <Link to="/tool/merge-pdf" className="hover:text-[#20201D] underline">
                  Merge PDF
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Educational & FAQ Section */}
      <div className="border-t border-[#E5E0D8] pt-10 space-y-8">
        <div>
          <h2 className="text-2xl font-serif font-bold text-[#20201D]">
            How FastPDFx Converts PDF to Word
          </h2>
          <p className="mt-1 text-sm text-[#605E57]">
            Technical transparency into our client-side extraction and document synthesis pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-5 bg-white border border-[#D5D0C5] space-y-2">
            <div className="w-8 h-8 bg-[#EAE6DE] text-[#20201D] flex items-center justify-center font-mono font-bold text-sm">
              01
            </div>
            <h4 className="font-serif font-bold text-base text-[#20201D]">Geometry & Coordinate Analysis</h4>
            <p className="text-xs text-[#605E57] leading-relaxed">
              PDF documents place words at fixed (X, Y) canvas coordinates. FastPDFx groups horizontal words into lines, detects baseline alignment, and sorts paragraphs in natural reading sequence.
            </p>
          </div>

          <div className="p-5 bg-white border border-[#D5D0C5] space-y-2">
            <div className="w-8 h-8 bg-[#EAE6DE] text-[#20201D] flex items-center justify-center font-mono font-bold text-sm">
              02
            </div>
            <h4 className="font-serif font-bold text-base text-[#20201D]">Typographic Hierarchy</h4>
            <p className="text-xs text-[#605E57] leading-relaxed">
              By analyzing relative font scale, bold weight hints, and line breaks, FastPDFx distinguishes titles and Section 1/2 headings from body text, mapping them to native Word styles.
            </p>
          </div>

          <div className="p-5 bg-white border border-[#D5D0C5] space-y-2">
            <div className="w-8 h-8 bg-[#EAE6DE] text-[#20201D] flex items-center justify-center font-mono font-bold text-sm">
              03
            </div>
            <h4 className="font-serif font-bold text-base text-[#20201D]">Scanned Page OCR & DOCX Binary</h4>
            <p className="text-xs text-[#605E57] leading-relaxed">
              When documents are flat photographic scans, WebAssembly OCR transcribes letters locally. The completed document is compiled directly into standard Office OpenXML (.docx) format.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#D5D0C5] p-6 space-y-4">
          <h3 className="font-serif font-bold text-lg text-[#20201D] flex items-center space-x-2">
            <HelpCircle className="w-5 h-5 text-[#605E57]" />
            <span>Frequently Asked Questions</span>
          </h3>

          <div className="space-y-4 text-xs divide-y divide-[#EAE6DE]">
            <div className="pt-3 first:pt-0 space-y-1">
              <p className="font-bold text-[#20201D]">Can I open and edit the output in Google Docs or Apple Pages?</p>
              <p className="text-[#605E57] leading-relaxed">
                Yes. FastPDFx outputs authentic Office OpenXML (.docx) files adhering to ISO/IEC 29500 standards, making them fully compatible with Microsoft Word, Google Docs, Apple Pages, and LibreOffice Writer.
              </p>
            </div>

            <div className="pt-3 space-y-1">
              <p className="font-bold text-[#20201D]">Are my confidential documents uploaded to any cloud server?</p>
              <p className="text-[#605E57] leading-relaxed">
                Never. FastPDFx runs 100% inside your browser’s local JavaScript sandbox. No pages, text, or files are ever sent across the network. It works even without an internet connection once loaded.
              </p>
            </div>

            <div className="pt-3 space-y-1">
              <p className="font-bold text-[#20201D]">What languages does the scanned document OCR engine support?</p>
              <p className="text-[#605E57] leading-relaxed">
                FastPDFx supports Hindi (हिन्दी), Hindi + English, English, Spanish, French, German, Italian, and Portuguese through client-side Tesseract.js WebAssembly models.
              </p>
            </div>

            <div className="pt-3 space-y-1">
              <p className="font-bold text-[#20201D]">Why did Hindi characters previously appear as square boxes (□) in Word, and how is it resolved?</p>
              <p className="text-[#605E57] leading-relaxed">
                In Microsoft Word, Devanagari script requires specific Complex Script (<code className="bg-[#EAE6DE] px-1 py-0.5">w:cs</code>) font declarations. Standard Western fonts like Calibri lack Devanagari glyphs, causing Word to display missing-glyph boxes. FastPDFx explicitly configures <strong className="text-[#20201D]">Nirmala UI</strong> as the complex script font with Latin fallback, normalizes Unicode sequences (NFC), and prevents artificial spacing across matras and virama conjuncts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
