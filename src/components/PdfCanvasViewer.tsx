import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Download,
  X,
  Loader2,
  FileText,
  AlertCircle
} from 'lucide-react';
import { formatBytes } from '../utils/formatBytes';
import { downloadFile } from '../utils/downloadFile';

// Ensure PDF.js worker is initialized
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

export interface PdfViewerFile {
  name: string;
  blob: Blob;
  size?: number;
  pageCount?: number;
  pagesDescription?: string;
}

interface PdfCanvasViewerProps {
  file: PdfViewerFile;
  inline?: boolean;
  onClose?: () => void;
  onExpand?: () => void;
  onDownload?: () => void;
}

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  file,
  inline = false,
  onClose,
  onExpand,
  onDownload
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(file.pageCount || 1);
  const [scale, setScale] = useState<number>(inline ? 0.9 : 1.15);
  const [isFitWidth, setIsFitWidth] = useState<boolean>(false);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(true);
  const [isRenderingPage, setIsRenderingPage] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Keep track of mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load PDF document from Blob
  const loadDocument = useCallback(async () => {
    setIsLoadingDoc(true);
    setErrorMessage(null);

    // Cancel existing render
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore cancellation error
      }
      renderTaskRef.current = null;
    }

    // Destroy existing PDFDoc
    if (pdfDocRef.current) {
      try {
        pdfDocRef.current.destroy();
      } catch {
        // ignore destroy error
      }
      pdfDocRef.current = null;
      setPdfDoc(null);
    }

    try {
      const arrayBuffer = await file.blob.arrayBuffer();
      if (!isMountedRef.current) return;

      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(arrayBuffer),
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      const loadedDoc = await loadingTask.promise;
      if (!isMountedRef.current) {
        loadedDoc.destroy();
        return;
      }

      pdfDocRef.current = loadedDoc;
      setPdfDoc(loadedDoc);
      setNumPages(loadedDoc.numPages);
      setCurrentPage(1);
    } catch (err: unknown) {
      console.error('Failed to load PDF document into viewer:', err);
      if (isMountedRef.current) {
        setErrorMessage('Unable to load PDF document for preview. The file may be password protected or corrupt.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingDoc(false);
      }
    }
  }, [file.blob]);

  // Initial load or file change
  useEffect(() => {
    loadDocument();

    return () => {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
        renderTaskRef.current = null;
      }
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          // ignore
        }
        pdfDocRef.current = null;
      }
    };
  }, [loadDocument]);

  // Render current page onto canvas
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !isMountedRef.current) return;

    // Cancel any previous active render task
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
      renderTaskRef.current = null;
    }

    setIsRenderingPage(true);

    try {
      const page = await pdfDoc.getPage(currentPage);
      if (!isMountedRef.current || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Determine active scale (either manual zoom or fit-to-width)
      let effectiveScale = scale;
      if (isFitWidth && containerRef.current) {
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const containerWidth = containerRef.current.clientWidth;
        const availableWidth = Math.max(containerWidth - 48, 200);
        effectiveScale = Math.min(Math.max(availableWidth / unscaledViewport.width, 0.35), 3.0);
      }

      const viewport = page.getViewport({ scale: effectiveScale });
      const pixelRatio = window.devicePixelRatio || 1;

      // High-DPI canvas sizing
      canvas.width = Math.floor(viewport.width * pixelRatio);
      canvas.height = Math.floor(viewport.height * pixelRatio);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      // Reset transform before drawing
      context.setTransform(1, 0, 0, 1, 0, 0);

      const renderContext = {
        canvasContext: context,
        transform: pixelRatio !== 1 ? [pixelRatio, 0, 0, pixelRatio, 0, 0] : undefined,
        viewport
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      renderTaskRef.current = null;
      if (isMountedRef.current) {
        setIsRenderingPage(false);
      }
    } catch (err: unknown) {
      const errObj = err as { name?: string; message?: string };
      if (errObj?.name === 'RenderingCancelledException' || errObj?.message?.includes('cancelled')) {
        // Normal when user navigates or zooms quickly
        return;
      }
      console.error('PDF page render error:', err);
      if (isMountedRef.current) {
        setIsRenderingPage(false);
      }
    }
  }, [pdfDoc, currentPage, scale, isFitWidth]);

  useEffect(() => {
    renderCurrentPage();
  }, [renderCurrentPage]);

  // Page navigation handlers
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < numPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Zoom handlers
  const handleZoomIn = () => {
    setIsFitWidth(false);
    setScale(prev => Math.min(Number((prev + 0.2).toFixed(2)), 3.0));
  };

  const handleZoomOut = () => {
    setIsFitWidth(false);
    setScale(prev => Math.max(Number((prev - 0.2).toFixed(2)), 0.4));
  };

  const handleResetZoom = () => {
    setIsFitWidth(false);
    setScale(1.0);
  };

  const handleToggleFitWidth = () => {
    setIsFitWidth(prev => !prev);
  };

  // Download trigger
  const handleDownloadClick = () => {
    if (onDownload) {
      onDownload();
    } else {
      downloadFile(file.blob, file.name);
    }
  };

  // Keyboard navigation when viewer is open
  useEffect(() => {
    if (inline) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (currentPage > 1) setCurrentPage(p => p - 1);
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (currentPage < numPages) setCurrentPage(p => p + 1);
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-') {
        handleZoomOut();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, numPages, inline, onClose]);

  return (
    <div className={`flex flex-col bg-white border border-[#DEDCD3] rounded-[2px] overflow-hidden ${inline ? 'w-full' : 'w-full h-full'}`}>
      {/* Top Header Bar */}
      <div className="p-3 sm:px-4 sm:py-3 border-b border-[#DEDCD3] bg-[#F5F3ED] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 border border-[#DEDCD3] bg-white flex items-center justify-center rounded-[2px] flex-shrink-0 text-[#20201D]">
            <FileText className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-[#20201D] truncate" title={file.name}>
              {file.name}
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-[#57564F]">
              {file.size !== undefined && <span>{formatBytes(file.size)}</span>}
              <span>•</span>
              <span>
                {numPages} {numPages === 1 ? 'page' : 'pages'}
              </span>
              {file.pagesDescription && (
                <>
                  <span>•</span>
                  <span className="truncate">{file.pagesDescription}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onExpand && (
            <button
              onClick={onExpand}
              title="Expand preview"
              className="p-1.5 border border-[#DEDCD3] bg-white hover:bg-[#EBE8DF] text-[#20201D] rounded-[2px] text-xs transition-colors hidden sm:inline-flex items-center gap-1"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fullscreen</span>
            </button>
          )}

          <button
            onClick={handleDownloadClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#20201D] text-[#F5F3ED] hover:bg-[#68735B] text-xs font-medium rounded-[2px] transition-colors shadow-2xs"
            title="Download this PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-[#57564F] hover:text-[#20201D] hover:bg-[#DEDCD3] rounded-[2px] transition-colors"
              title="Close Preview (Esc)"
              aria-label="Close Preview"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="px-3 py-2 border-b border-[#DEDCD3] bg-[#EBE8DF] flex flex-wrap items-center justify-between gap-2 text-xs text-[#20201D]">
        {/* Page Navigation */}
        <div className="flex items-center gap-1 bg-white border border-[#DEDCD3] rounded-[2px] px-1 py-0.5">
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isRenderingPage}
            className="p-1 hover:bg-[#F5F3ED] disabled:opacity-40 disabled:hover:bg-transparent rounded-[1px] transition-colors"
            title="Previous Page (Left Arrow)"
            aria-label="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-[#20201D]" />
          </button>

          <span className="px-2 font-mono text-[11px] font-medium text-[#20201D] select-none">
            Page {currentPage} of {numPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isRenderingPage}
            className="p-1 hover:bg-[#F5F3ED] disabled:opacity-40 disabled:hover:bg-transparent rounded-[1px] transition-colors"
            title="Next Page (Right Arrow)"
            aria-label="Next Page"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[#20201D]" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-white border border-[#DEDCD3] rounded-[2px] px-1 py-0.5">
            <button
              onClick={handleZoomOut}
              disabled={scale <= 0.4 || isRenderingPage}
              className="p-1 hover:bg-[#F5F3ED] disabled:opacity-40 disabled:hover:bg-transparent rounded-[1px] transition-colors"
              title="Zoom Out (-)"
              aria-label="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5 text-[#20201D]" />
            </button>

            <button
              onClick={handleResetZoom}
              className="px-2 py-0.5 font-mono text-[11px] hover:bg-[#F5F3ED] rounded-[1px] text-[#20201D] transition-colors select-none"
              title="Reset Zoom to 100%"
            >
              {Math.round(scale * 100)}%
            </button>

            <button
              onClick={handleZoomIn}
              disabled={scale >= 3.0 || isRenderingPage}
              className="p-1 hover:bg-[#F5F3ED] disabled:opacity-40 disabled:hover:bg-transparent rounded-[1px] transition-colors"
              title="Zoom In (+)"
              aria-label="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5 text-[#20201D]" />
            </button>
          </div>

          <button
            onClick={handleToggleFitWidth}
            className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] border rounded-[2px] transition-colors ${
              isFitWidth
                ? 'bg-[#20201D] text-white border-[#20201D]'
                : 'bg-white border-[#DEDCD3] text-[#20201D] hover:bg-[#F5F3ED]'
            }`}
            title="Fit to Container Width"
          >
            <Maximize2 className="w-3 h-3" />
            <span className="hidden sm:inline">Fit Width</span>
          </button>
        </div>
      </div>

      {/* PDF Canvas Viewport Area */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto bg-[#F5F3ED] p-4 sm:p-6 flex items-center justify-center relative select-none ${
          inline ? 'min-h-[460px] max-h-[580px]' : 'min-h-[450px]'
        }`}
      >
        {/* Loading Document State */}
        {isLoadingDoc && (
          <div className="flex flex-col items-center justify-center space-y-2 text-[#57564F] py-12">
            <Loader2 className="w-7 h-7 animate-spin text-[#20201D]" />
            <p className="text-xs font-medium">Loading PDF document...</p>
          </div>
        )}

        {/* Error State */}
        {!isLoadingDoc && errorMessage && (
          <div className="max-w-md p-5 bg-white border border-red-200 rounded-[2px] text-center space-y-3">
            <AlertCircle className="w-7 h-7 text-red-600 mx-auto" />
            <p className="text-xs text-red-700 font-medium">{errorMessage}</p>
            <button
              onClick={loadDocument}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#DEDCD3] hover:bg-[#F5F3ED] text-xs text-[#20201D] rounded-[2px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry Loading</span>
            </button>
          </div>
        )}

        {/* Canvas Display */}
        {!isLoadingDoc && !errorMessage && (
          <div className="relative border border-[#DEDCD3] bg-white shadow-md rounded-[1px] transition-shadow">
            {/* Transient Page Rendering Spinner Overlay */}
            {isRenderingPage && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-2xs flex items-center justify-center z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#20201D] text-[#F5F3ED] rounded-[2px] text-xs font-mono shadow-md">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Rendering...</span>
                </div>
              </div>
            )}
            <canvas ref={canvasRef} className="block mx-auto max-w-none" />
          </div>
        )}
      </div>

      {/* Footer bar with quick hint */}
      <div className="px-3 py-1.5 border-t border-[#DEDCD3] bg-[#F5F3ED] flex items-center justify-between text-[11px] text-[#57564F]">
        <span>In-Browser Canvas Preview (No Plugins)</span>
        <span className="hidden sm:inline font-mono">Use Arrow Keys or Buttons to Navigate</span>
      </div>
    </div>
  );
};
