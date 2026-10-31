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
  Layers,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  GripVertical,
  Info,
  Sparkles
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { PageMeta } from '../../components/PageMeta';
import { formatBytes } from '../../utils/formatBytes';
import { downloadFile } from '../../utils/downloadFile';

interface PdfFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  isEncrypted?: boolean;
}

interface MergeSuccessResult {
  blob: Blob;
  size: number;
  totalPages: number;
  fileCount: number;
  previewUrl: string;
}

export const MergePdfPage: React.FC = () => {
  const [pdfItems, setPdfItems] = useState<PdfFileItem[]>([]);
  const [isMerging, setIsMerging] = useState<boolean>(false);
  const [mergeResult, setMergeResult] = useState<MergeSuccessResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (mergeResult?.previewUrl) {
        URL.revokeObjectURL(mergeResult.previewUrl);
      }
    };
  }, [mergeResult]);

  // Handle PDF files selection
  const handleFiles = async (fileList: FileList) => {
    setErrorMessage(null);
    const newItems: PdfFileItem[] = [];

    for (const file of Array.from(fileList)) {
      const isPdfMime = file.type === 'application/pdf';
      const isPdfExt = /\.pdf$/i.test(file.name);

      if (!isPdfMime && !isPdfExt) {
        setErrorMessage(`"${file.name}" was skipped: only valid PDF documents (.pdf) are accepted.`);
        continue;
      }

      try {
        const buffer = await file.arrayBuffer();
        // Inspect with pdf-lib to count pages and check for encryption
        let pageCount = 1;
        let isEncrypted = false;

        try {
          const doc = await PDFDocument.load(buffer, { ignoreEncryption: false });
          pageCount = doc.getPageCount();
        } catch (loadErr: unknown) {
          const errStr = String(loadErr);
          if (errStr.includes('encrypted') || errStr.includes('password')) {
            isEncrypted = true;
            // Try loading ignoring encryption to inspect page count
            try {
              const unencDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
              pageCount = unencDoc.getPageCount();
            } catch {
              pageCount = 1;
            }
          } else {
            throw loadErr;
          }
        }

        newItems.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          pageCount,
          isEncrypted
        });
      } catch (err: unknown) {
        console.error('PDF parsing error:', err);
        setErrorMessage(`Could not read "${file.name}". The file appears corrupt or is an invalid PDF.`);
      }
    }

    if (newItems.length > 0) {
      setPdfItems(prev => [...prev, ...newItems]);
      setMergeResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Reorder functions
  const moveUp = (index: number) => {
    if (index <= 0) return;
    setPdfItems(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
    setMergeResult(null);
  };

  const moveDown = (index: number) => {
    if (index >= pdfItems.length - 1) return;
    setPdfItems(prev => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
    setMergeResult(null);
  };

  // Drag and Drop list reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDropItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setPdfItems(prev => {
      const list = [...prev];
      const [draggedItem] = list.splice(draggedIndex, 1);
      list.splice(targetIndex, 0, draggedItem);
      return list;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
    setMergeResult(null);
  };

  const removeItem = (id: string) => {
    setPdfItems(prev => prev.filter(item => item.id !== id));
    setMergeResult(null);
  };

  const handleClearAll = () => {
    if (mergeResult?.previewUrl) {
      URL.revokeObjectURL(mergeResult.previewUrl);
    }
    setPdfItems([]);
    setMergeResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (addMoreInputRef.current) addMoreInputRef.current.value = '';
  };

  // Perform PDF Merge using pdf-lib
  const handleMerge = async () => {
    if (pdfItems.length < 2) {
      setErrorMessage('Please add at least 2 PDF documents to merge.');
      return;
    }

    setIsMerging(true);
    setErrorMessage(null);

    try {
      const mergedPdf = await PDFDocument.create();

      for (let i = 0; i < pdfItems.length; i++) {
        const item = pdfItems[i];
        const buffer = await item.file.arrayBuffer();

        let sourceDoc: PDFDocument;
        try {
          sourceDoc = await PDFDocument.load(buffer, { ignoreEncryption: false });
        } catch (loadErr: unknown) {
          const errStr = String(loadErr);
          if (errStr.includes('encrypted') || errStr.includes('password')) {
            throw new Error(
              `"${item.name}" is password-protected. Please decrypt or unlock it before merging.`
            );
          }
          throw new Error(
            `"${item.name}" could not be parsed. The file may be damaged or invalid.`
          );
        }

        const indices = sourceDoc.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(sourceDoc, indices);
        copiedPages.forEach(page => mergedPdf.addPage(page));
      }

      const mergedBytes = await mergedPdf.save();
      const mergedBlob = new Blob([mergedBytes as BlobPart], { type: 'application/pdf' });
      const previewUrl = URL.createObjectURL(mergedBlob);

      if (mergeResult?.previewUrl) {
        URL.revokeObjectURL(mergeResult.previewUrl);
      }

      setMergeResult({
        blob: mergedBlob,
        size: mergedBlob.size,
        totalPages: mergedPdf.getPageCount(),
        fileCount: pdfItems.length,
        previewUrl
      });
    } catch (err: unknown) {
      console.error('Merge error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An error occurred while merging your PDF documents.'
      );
    } finally {
      setIsMerging(false);
    }
  };

  const handleDownload = () => {
    if (!mergeResult) return;
    downloadFile(mergeResult.blob, 'fastpdfx-merged.pdf');
  };

  const totalPagesInQueue = pdfItems.reduce((acc, curr) => acc + curr.pageCount, 0);
  const totalBytesInQueue = pdfItems.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <PageMeta
        title="Merge PDF - FastPDFx"
        description="Combine multiple PDF documents into one organized file in your browser memory."
      />

      {/* Breadcrumb Navigation */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-[#77766F] hover:text-[#20201D] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Directory
        </Link>
      </div>

      {/* Tool Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DEDCD3]">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#68735B] font-semibold">
            PDF TOOLS · BROWSER ENGINE
          </span>
          <h1 className="text-2xl font-semibold text-[#20201D] tracking-tight mt-0.5">
            Merge PDF
          </h1>
          <p className="text-xs text-[#77766F] mt-1">
            Combine multiple PDF files in your preferred sequence. Runs 100% locally in browser memory.
          </p>
        </div>

        {pdfItems.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#20201D] bg-white border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#77766F]" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 bg-white border border-[#20201D] rounded-[2px] text-xs text-[#20201D] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#68735B] shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Error: </strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Success Result Banner */}
      {mergeResult && (
        <div className="bg-white border border-[#68735B] rounded-[2px] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F5F3ED]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-[2px] bg-[#F5F3ED] text-[#68735B] flex items-center justify-center border border-[#DEDCD3]">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-[#20201D]">
                  PDFs Successfully Merged
                </h3>
                <p className="text-xs text-[#77766F] font-mono mt-0.5">
                  Combined {mergeResult.fileCount} files · {mergeResult.totalPages} total pages · {formatBytes(mergeResult.size)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#20201D] text-[#F5F3ED] text-xs font-semibold rounded-[2px] hover:bg-[#33322E] transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download Merged PDF</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-[#77766F]">
            <span>File ready: fastpdfx-merged.pdf</span>
            <button
              type="button"
              onClick={() => {
                setMergeResult(null);
                setPdfItems([]);
              }}
              className="text-[#20201D] underline hover:text-[#68735B]"
            >
              Start new merge
            </button>
          </div>
        </div>
      )}

      {/* Upload Dropzone (When Empty) */}
      {pdfItems.length === 0 && (
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer p-10 sm:p-14 text-center border transition-colors rounded-[2px] bg-white ${
            isDragging
              ? 'border-[#20201D] bg-[#F5F3ED]'
              : 'border-[#DEDCD3] border-dashed hover:border-[#20201D]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
              }
            }}
          />

          <div className="w-12 h-12 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center mx-auto mb-3.5 border border-[#DEDCD3]">
            <Layers className="w-5 h-5 text-[#68735B]" />
          </div>

          <h3 className="text-sm font-semibold text-[#20201D]">
            Select multiple PDF documents or drag & drop here
          </h3>
          <p className="text-xs text-[#77766F] mt-1">
            Choose 2 or more PDF files to combine into a single document
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#20201D] text-[#F5F3ED] text-xs font-medium rounded-[2px]">
            <span>Browse PDF Files</span>
          </div>

          <p className="text-[11px] font-mono text-[#A6A49B] mt-4">
            Processed 100% locally in browser memory · Zero remote server uploads
          </p>
        </div>
      )}

      {/* Order Management & Merge Interface */}
      {pdfItems.length > 0 && (
        <div className="space-y-5">
          {/* Action Toolbar */}
          <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="font-mono text-xs text-[#77766F]">
              <span>Queue: </span>
              <strong className="text-[#20201D]">{pdfItems.length} documents</strong>
              <span> ({totalPagesInQueue} pages · {formatBytes(totalBytesInQueue)})</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => addMoreInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#20201D] bg-white border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More PDFs</span>
              </button>
              <input
                ref={addMoreInputRef}
                type="file"
                multiple
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(e.target.files);
                  }
                }}
              />

              <button
                type="button"
                onClick={handleMerge}
                disabled={isMerging || pdfItems.length < 2}
                className="inline-flex items-center gap-2 px-5 py-2 bg-[#20201D] text-[#F5F3ED] text-xs font-semibold rounded-[2px] hover:bg-[#33322E] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Layers className={`w-3.5 h-3.5 ${isMerging ? 'animate-spin' : ''}`} />
                <span>
                  {isMerging
                    ? 'Merging Documents...'
                    : pdfItems.length < 2
                    ? 'Add at least 2 PDFs'
                    : 'Merge PDFs'}
                </span>
              </button>
            </div>
          </div>

          {/* Reorderable PDF List */}
          <div className="space-y-2">
            <div className="text-[11px] font-mono text-[#77766F] px-1 flex items-center justify-between">
              <span>Drag handle to reorder, or use arrow buttons:</span>
              <span>Sequence top-to-bottom</span>
            </div>

            {pdfItems.map((item, index) => {
              const isFirst = index === 0;
              const isLast = index === pdfItems.length - 1;
              const isHovered = dragOverIndex === index;

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={e => handleDragOverItem(e, index)}
                  onDrop={e => handleDropItem(e, index)}
                  className={`bg-white rounded-[2px] border p-3.5 sm:p-4 flex items-center justify-between gap-3 transition-all ${
                    isHovered
                      ? 'border-[#20201D] bg-[#F5F3ED]'
                      : 'border-[#DEDCD3] hover:border-[#20201D]'
                  }`}
                >
                  {/* Left: Drag Handle, Number & File Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="cursor-grab text-[#A6A49B] hover:text-[#20201D] p-1"
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-4 h-4" />
                    </div>

                    <span className="font-mono text-xs text-[#77766F] w-5 text-right shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <div className="w-9 h-9 rounded-[2px] bg-[#F5F3ED] text-[#68735B] flex items-center justify-center shrink-0 border border-[#DEDCD3]">
                      <FileText className="w-4.5 h-4.5" />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-[#20201D] truncate max-w-[200px] sm:max-w-md">
                        {item.name}
                      </h4>
                      <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] font-mono text-[#77766F]">
                        <span>{item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}</span>
                        <span>·</span>
                        <span>{formatBytes(item.size)}</span>
                        {item.isEncrypted && (
                          <>
                            <span>·</span>
                            <span className="text-amber-700 font-bold">Encrypted Document</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Accessible Move Up, Move Down & Delete Buttons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => moveUp(index)}
                      title="Move Up"
                      className="p-1.5 text-[#77766F] hover:text-[#20201D] rounded-[2px] border border-transparent hover:border-[#DEDCD3] hover:bg-[#F5F3ED] disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => moveDown(index)}
                      title="Move Down"
                      className="p-1.5 text-[#77766F] hover:text-[#20201D] rounded-[2px] border border-transparent hover:border-[#DEDCD3] hover:bg-[#F5F3ED] disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      title="Remove from merge list"
                      className="p-1.5 text-[#A6A49B] hover:text-[#20201D] rounded-[2px] hover:bg-[#F5F3ED] transition-colors ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Architectural & Privacy Explanations */}
      <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 sm:p-6 space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#68735B]" />
          In-Browser PDF Merge Architecture
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#77766F] leading-relaxed">
          <div>
            <strong className="text-[#20201D] block mb-1">pdf-lib Stream Assembly</strong>
            PDF dictionaries, font references, vector graphics, and embedded images are extracted and unified in client memory using WebAssembly and TypedArrays.
          </div>
          <div>
            <strong className="text-[#20201D] block mb-1">Zero Quality Loss</strong>
            Text vectors, original resolution photography, bookmarks, and layout dimensions are preserved exactly as defined in the source files.
          </div>
          <div>
            <strong className="text-[#20201D] block mb-1">Strict Confidentiality</strong>
            Your tax documents, bank statements, contracts, and records never leave your machine or transit over external network ports.
          </div>
        </div>
      </div>
    </div>
  );
};
