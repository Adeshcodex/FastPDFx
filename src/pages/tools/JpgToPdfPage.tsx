import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Download,
  RotateCcw,
  Check,
  AlertCircle,
  FileImage,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  GripVertical,
  Info,
  Sparkles,
  Settings2,
  Eye,
  EyeOff
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { PageMeta } from '../../components/PageMeta';
import { formatBytes } from '../../utils/formatBytes';
import { downloadFile } from '../../utils/downloadFile';

interface ImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  format: 'JPEG' | 'PNG' | 'WebP' | string;
  width: number;
  height: number;
  previewUrl: string;
}

type PageSizeOption = 'a4' | 'letter' | 'fit_to_image';
type PageOrientationOption = 'auto' | 'portrait' | 'landscape';
type ImagePlacementOption = 'fit' | 'fill';
type MarginOption = 'none' | 'small' | 'large';

interface PdfResult {
  blob: Blob;
  size: number;
  pageCount: number;
  previewUrl: string;
}

// Standard dimensions in PDF points (72 points per inch)
const PAGE_DIMENSIONS = {
  a4: { width: 595.28, height: 841.89 },
  letter: { width: 612.0, height: 792.0 }
};

const MARGIN_POINTS: Record<MarginOption, number> = {
  none: 0,
  small: 20, // ~7mm
  large: 40  // ~14mm
};

export const JpgToPdfPage: React.FC = () => {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
  const [orientation, setOrientation] = useState<PageOrientationOption>('auto');
  const [placement, setPlacement] = useState<ImagePlacementOption>('fit');
  const [margin, setMargin] = useState<MarginOption>('small');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingProgress, setProcessingProgress] = useState<string>('');
  const [pdfResult, setPdfResult] = useState<PdfResult | null>(null);
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
      if (pdfResult?.previewUrl) {
        URL.revokeObjectURL(pdfResult.previewUrl);
      }
    };
  }, []);

  // Helper to load image metadata (width and height)
  const loadImageMetadata = (file: File, objectUrl: string): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        reject(new Error(`Failed to load image "${file.name}"`));
      };
      img.src = objectUrl;
    });
  };

  // Process incoming files
  const handleFiles = async (fileList: FileList) => {
    setErrorMessage(null);
    const validFiles: File[] = [];

    for (const file of Array.from(fileList)) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      const validExts = /\.(jpe?g|png|webp)$/i;

      if (!validTypes.includes(file.type) && !validExts.test(file.name)) {
        setErrorMessage(`"${file.name}" was skipped. Only JPG, PNG, and WebP images are supported.`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    const newItems: ImageItem[] = [];

    for (const file of validFiles) {
      const objectUrl = URL.createObjectURL(file);
      try {
        const { width, height } = await loadImageMetadata(file, objectUrl);
        let format = 'JPEG';
        if (file.type === 'image/png' || /\.png$/i.test(file.name)) format = 'PNG';
        else if (file.type === 'image/webp' || /\.webp$/i.test(file.name)) format = 'WebP';

        newItems.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          format,
          width,
          height,
          previewUrl: objectUrl
        });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        console.error('Image inspection error:', err);
        setErrorMessage(`Could not read "${file.name}". File may be corrupted or unreadable.`);
      }
    }

    if (newItems.length > 0) {
      setImages(prev => [...prev, ...newItems]);
      if (pdfResult?.previewUrl) {
        URL.revokeObjectURL(pdfResult.previewUrl);
      }
      setPdfResult(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // List Reordering
  const moveUp = (index: number) => {
    if (index <= 0) return;
    setImages(prev => {
      const updated = [...prev];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
    setPdfResult(null);
  };

  const moveDown = (index: number) => {
    if (index >= images.length - 1) return;
    setImages(prev => {
      const updated = [...prev];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      return updated;
    });
    setPdfResult(null);
  };

  // Drag and drop list item reorder
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

    setImages(prev => {
      const list = [...prev];
      const [draggedItem] = list.splice(draggedIndex, 1);
      list.splice(targetIndex, 0, draggedItem);
      return list;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
    setPdfResult(null);
  };

  const removeImage = (id: string) => {
    setImages(prev => {
      const item = prev.find(i => i.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(i => i.id !== id);
    });
    setPdfResult(null);
  };

  const handleClearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    if (pdfResult?.previewUrl) {
      URL.revokeObjectURL(pdfResult.previewUrl);
    }
    setImages([]);
    setPdfResult(null);
    setErrorMessage(null);
    setShowPreview(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (addMoreInputRef.current) addMoreInputRef.current.value = '';
  };

  // Convert an image element to a PNG or JPEG array buffer via Canvas (for WebP and fallback handling)
  const rasterizeToBuffer = async (
    item: ImageItem,
    preferredFormat: 'png' | 'jpeg' = 'png'
  ): Promise<{ buffer: ArrayBuffer; format: 'png' | 'jpeg' }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || item.width;
        canvas.height = img.naturalHeight || item.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context could not be created'));
          return;
        }

        // If converting to JPEG, paint white background to avoid black alpha
        if (preferredFormat === 'jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0);

        const mime = preferredFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
        const quality = preferredFormat === 'jpeg' ? 0.95 : undefined;

        canvas.toBlob(
          async blob => {
            if (!blob) {
              reject(new Error(`Failed to encode image to ${preferredFormat}`));
              return;
            }
            const buffer = await blob.arrayBuffer();
            resolve({ buffer, format: preferredFormat });
          },
          mime,
          quality
        );
      };
      img.onerror = () => reject(new Error(`Failed to load image "${item.name}" for rendering`));
      img.src = item.previewUrl;
    });
  };

  // Convert Images to PDF using pdf-lib
  const handleConvertToPdf = async () => {
    if (images.length === 0) {
      setErrorMessage('Please upload at least one image to convert.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingProgress('Initializing PDF document...');

    try {
      const pdfDoc = await PDFDocument.create();
      const marginPt = MARGIN_POINTS[margin];

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        setProcessingProgress(`Processing image ${i + 1} of ${images.length}: ${item.name}`);

        // Embed image based on format
        // pdf-lib supports embedJpg and embedPng.
        // For WebP or if native embedding fails, fallback to canvas rasterization.
        let embeddedImage;

        if (item.format === 'WebP') {
          // WebP: render to canvas and convert to PNG buffer to preserve quality and transparency
          const { buffer } = await rasterizeToBuffer(item, 'png');
          embeddedImage = await pdfDoc.embedPng(buffer);
        } else if (item.format === 'PNG') {
          try {
            const rawBytes = await item.file.arrayBuffer();
            embeddedImage = await pdfDoc.embedPng(rawBytes);
          } catch {
            // Fallback via canvas if raw PNG has exotic chunks or color models
            const { buffer } = await rasterizeToBuffer(item, 'png');
            embeddedImage = await pdfDoc.embedPng(buffer);
          }
        } else {
          // JPEG
          try {
            const rawBytes = await item.file.arrayBuffer();
            embeddedImage = await pdfDoc.embedJpg(rawBytes);
          } catch {
            // Fallback via canvas for progressive or CMYK JPEGs
            const { buffer } = await rasterizeToBuffer(item, 'jpeg');
            embeddedImage = await pdfDoc.embedJpg(buffer);
          }
        }

        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;

        // Calculate Page Dimensions in PDF points
        let pageWidth: number;
        let pageHeight: number;

        if (pageSize === 'fit_to_image') {
          // Page size fits the image exactly plus configured margins
          pageWidth = imgWidth + 2 * marginPt;
          pageHeight = imgHeight + 2 * marginPt;
        } else {
          // A4 or Letter
          const baseDimensions = PAGE_DIMENSIONS[pageSize];
          let isLandscape = false;

          if (orientation === 'landscape') {
            isLandscape = true;
          } else if (orientation === 'portrait') {
            isLandscape = false;
          } else {
            // Auto orientation: match the image's aspect ratio
            isLandscape = imgWidth >= imgHeight;
          }

          if (isLandscape) {
            pageWidth = Math.max(baseDimensions.width, baseDimensions.height);
            pageHeight = Math.min(baseDimensions.width, baseDimensions.height);
          } else {
            pageWidth = Math.min(baseDimensions.width, baseDimensions.height);
            pageHeight = Math.max(baseDimensions.width, baseDimensions.height);
          }
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Calculate Image Placement and Sizing inside printable area
        const availWidth = Math.max(1, pageWidth - 2 * marginPt);
        const availHeight = Math.max(1, pageHeight - 2 * marginPt);

        let drawWidth: number;
        let drawHeight: number;
        let drawX: number;
        let drawY: number;

        if (pageSize === 'fit_to_image') {
          drawWidth = imgWidth;
          drawHeight = imgHeight;
          drawX = marginPt;
          drawY = marginPt;
        } else if (maintainAspectRatio) {
          if (placement === 'fit') {
            // Contain image within printable boundary without clipping
            const scale = Math.min(availWidth / imgWidth, availHeight / imgHeight);
            drawWidth = imgWidth * scale;
            drawHeight = imgHeight * scale;
          } else {
            // Fill printable boundary (cover)
            const scale = Math.max(availWidth / imgWidth, availHeight / imgHeight);
            drawWidth = imgWidth * scale;
            drawHeight = imgHeight * scale;
          }
          // Center within available space (origin is bottom-left in pdf-lib)
          drawX = marginPt + (availWidth - drawWidth) / 2;
          drawY = marginPt + (availHeight - drawHeight) / 2;
        } else {
          // Stretch to fill available area
          drawWidth = availWidth;
          drawHeight = availHeight;
          drawX = marginPt;
          drawY = marginPt;
        }

        page.drawImage(embeddedImage, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight
        });
      }

      setProcessingProgress('Finalizing and compressing PDF document...');
      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
      const previewUrl = URL.createObjectURL(pdfBlob);

      if (pdfResult?.previewUrl) {
        URL.revokeObjectURL(pdfResult.previewUrl);
      }

      setPdfResult({
        blob: pdfBlob,
        size: pdfBlob.size,
        pageCount: pdfDoc.getPageCount(),
        previewUrl
      });
    } catch (err: unknown) {
      console.error('PDF generation error:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while converting images to PDF.'
      );
    } finally {
      setIsProcessing(false);
      setProcessingProgress('');
    }
  };

  const handleDownload = () => {
    if (!pdfResult) return;
    downloadFile(pdfResult.blob, 'fastpdfx-images.pdf');
  };

  const totalBytesInQueue = images.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <PageMeta
        title="JPG to PDF Converter - FastPDFx"
        description="Convert JPG, PNG, and WebP images into a single printable PDF with custom page sizes, orientations, and margins."
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
            PDF TOOLS · IN-BROWSER CONVERTER
          </span>
          <h1 className="text-2xl font-semibold text-[#20201D] tracking-tight mt-0.5">
            JPG to PDF
          </h1>
          <p className="text-xs text-[#77766F] mt-1">
            Transform photos and graphics (JPG, PNG, WebP) into an organized PDF document. Zero server uploads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-[#68735B] bg-[#EBE7DF] border border-[#DEDCD3] rounded-[2px]">
            <Sparkles className="w-3 h-3" />
            Active Tool
          </span>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-[#FAF0ED] border border-[#E8C2B8] rounded-[2px] flex items-start gap-2.5 text-xs text-[#8A3826]">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-mono">{errorMessage}</div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-[10px] font-mono uppercase text-[#8A3826] hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Upload Zone when empty */}
      {images.length === 0 && (
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed p-10 sm:p-14 text-center cursor-pointer transition-all duration-150 rounded-[2px] ${
            isDragging
              ? 'border-[#20201D] bg-[#EBE7DF]'
              : 'border-[#DEDCD3] hover:border-[#20201D] bg-[#FAF8F5]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
              }
            }}
          />
          <div className="w-12 h-12 mx-auto mb-4 border border-[#DEDCD3] bg-[#F5F3ED] flex items-center justify-center text-[#20201D] rounded-[2px]">
            <Upload className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-[#20201D] mb-1">
            Select or drag images here
          </h3>
          <p className="text-xs text-[#77766F] max-w-sm mx-auto mb-4">
            Supports multiple <strong>JPG</strong>, <strong>PNG</strong>, and <strong>WebP</strong> images. Files are converted directly in your browser.
          </p>
          <button
            type="button"
            className="px-5 py-2.5 bg-[#20201D] hover:bg-[#343430] text-[#F5F3ED] text-xs font-mono font-medium rounded-[2px] transition-colors"
          >
            Choose Image Files
          </button>
        </div>
      )}

      {/* Main Workspace when images are loaded */}
      {images.length > 0 && (
        <div className="space-y-6">
          {/* Settings Card */}
          <div className="bg-[#FAF8F5] border border-[#DEDCD3] p-4 sm:p-5 rounded-[2px] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#DEDCD3]">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#68735B]" />
                <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-[#20201D]">
                  Document & Layout Settings
                </h3>
              </div>
              <span className="text-[11px] font-mono text-[#77766F]">
                {images.length} {images.length === 1 ? 'Page' : 'Pages'} will be generated
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
              {/* Page Size */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#77766F]">
                  PAGE SIZE
                </label>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(e.target.value as PageSizeOption);
                    setPdfResult(null);
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#DEDCD3] px-3 py-2 text-xs rounded-[2px] text-[#20201D] focus:outline-none focus:border-[#20201D]"
                >
                  <option value="a4">A4 (210 × 297 mm)</option>
                  <option value="letter">Letter (8.5 × 11 in)</option>
                  <option value="fit_to_image">Fit to Image Size</option>
                </select>
              </div>

              {/* Orientation */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#77766F]">
                  ORIENTATION
                </label>
                <select
                  value={orientation}
                  disabled={pageSize === 'fit_to_image'}
                  onChange={e => {
                    setOrientation(e.target.value as PageOrientationOption);
                    setPdfResult(null);
                  }}
                  className={`w-full bg-[#FFFFFF] border border-[#DEDCD3] px-3 py-2 text-xs rounded-[2px] text-[#20201D] focus:outline-none focus:border-[#20201D] ${
                    pageSize === 'fit_to_image' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="auto">Auto (Match Image)</option>
                  <option value="portrait">Portrait (Vertical)</option>
                  <option value="landscape">Landscape (Horizontal)</option>
                </select>
              </div>

              {/* Margins */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#77766F]">
                  MARGINS
                </label>
                <select
                  value={margin}
                  onChange={e => {
                    setMargin(e.target.value as MarginOption);
                    setPdfResult(null);
                  }}
                  className="w-full bg-[#FFFFFF] border border-[#DEDCD3] px-3 py-2 text-xs rounded-[2px] text-[#20201D] focus:outline-none focus:border-[#20201D]"
                >
                  <option value="none">No Margins (0 pt)</option>
                  <option value="small">Small (~7 mm / 20 pt)</option>
                  <option value="large">Large (~14 mm / 40 pt)</option>
                </select>
              </div>

              {/* Image Placement */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-[#77766F]">
                  IMAGE PLACEMENT
                </label>
                <select
                  value={placement}
                  disabled={pageSize === 'fit_to_image'}
                  onChange={e => {
                    setPlacement(e.target.value as ImagePlacementOption);
                    setPdfResult(null);
                  }}
                  className={`w-full bg-[#FFFFFF] border border-[#DEDCD3] px-3 py-2 text-xs rounded-[2px] text-[#20201D] focus:outline-none focus:border-[#20201D] ${
                    pageSize === 'fit_to_image' ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="fit">Fit to Page (Contain)</option>
                  <option value="fill">Fill Page (Cover)</option>
                </select>
              </div>
            </div>

            {/* Additional Toggles */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={maintainAspectRatio}
                  onChange={e => {
                    setMaintainAspectRatio(e.target.checked);
                    setPdfResult(null);
                  }}
                  className="rounded-[2px] border-[#DEDCD3] text-[#20201D] focus:ring-0 focus:ring-offset-0"
                />
                <span className="text-[#20201D]">Maintain original image aspect ratio</span>
              </label>

              <div className="text-[11px] text-[#77766F]">
                {pageSize === 'fit_to_image'
                  ? 'Each PDF page will match the native dimensions of its image.'
                  : `Standard ${pageSize.toUpperCase()} paper format with ${margin} margins.`}
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
            <div>
              <h2 className="text-sm font-semibold text-[#20201D]">
                Page Sequence ({images.length} {images.length === 1 ? 'image' : 'images'})
              </h2>
              <p className="text-[11px] font-mono text-[#77766F]">
                Total size: {formatBytes(totalBytesInQueue)} · Drag handles or use arrows to reorder
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                ref={addMoreInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(e.target.files);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => addMoreInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#EBE7DF] hover:bg-[#DEDCD3] text-[#20201D] text-xs font-mono rounded-[2px] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add More Images
              </button>
              <button
                type="button"
                onClick={handleClearAll}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#DEDCD3] hover:border-[#8A3826] hover:text-[#8A3826] text-[#77766F] text-xs font-mono rounded-[2px] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear All
              </button>
            </div>
          </div>

          {/* Images Sequence List */}
          <div className="space-y-2">
            {images.map((item, index) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOverItem(e, index)}
                onDrop={e => handleDropItem(e, index)}
                className={`flex items-center justify-between gap-3 p-3 bg-[#FFFFFF] border transition-all rounded-[2px] ${
                  dragOverIndex === index
                    ? 'border-[#20201D] bg-[#EBE7DF]'
                    : 'border-[#DEDCD3] hover:border-[#20201D]'
                }`}
              >
                {/* Drag Handle & Page Index */}
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    title="Drag to reorder"
                    className="text-[#77766F] hover:text-[#20201D] cursor-grab active:cursor-grabbing p-1"
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <span className="w-7 text-center font-mono text-xs font-bold text-[#68735B] bg-[#F5F3ED] border border-[#DEDCD3] py-0.5 rounded-[2px]">
                    #{index + 1}
                  </span>
                </div>

                {/* Thumbnail Preview */}
                <div className="w-14 h-14 shrink-0 bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] overflow-hidden flex items-center justify-center">
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-full h-full object-contain"
                  />
                </div>

                {/* File Metadata */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[#20201D] truncate">
                      {item.name}
                    </span>
                    <span className="px-1.5 py-0.2 text-[9px] font-mono uppercase bg-[#F5F3ED] text-[#68735B] border border-[#DEDCD3] rounded-[2px]">
                      {item.format}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-[#77766F] mt-0.5">
                    <span>{formatBytes(item.size)}</span>
                    <span>·</span>
                    <span>{item.width} × {item.height} px</span>
                  </div>
                </div>

                {/* Actions: Move Up, Move Down, Remove */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    title="Move Up"
                    className={`p-1.5 border border-[#DEDCD3] rounded-[2px] transition-colors ${
                      index === 0
                        ? 'opacity-30 cursor-not-allowed bg-[#FAF8F5] text-[#77766F]'
                        : 'hover:bg-[#EBE7DF] text-[#20201D]'
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveDown(index)}
                    disabled={index === images.length - 1}
                    title="Move Down"
                    className={`p-1.5 border border-[#DEDCD3] rounded-[2px] transition-colors ${
                      index === images.length - 1
                        ? 'opacity-30 cursor-not-allowed bg-[#FAF8F5] text-[#77766F]'
                        : 'hover:bg-[#EBE7DF] text-[#20201D]'
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeImage(item.id)}
                    title="Remove Image"
                    className="p-1.5 border border-[#DEDCD3] hover:border-[#8A3826] hover:text-[#8A3826] text-[#77766F] rounded-[2px] transition-colors ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Convert Action Bar */}
          <div className="bg-[#FAF8F5] border border-[#DEDCD3] p-4 rounded-[2px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-xs font-mono text-[#77766F]">
              <div>Ready to compile <strong>{images.length} {images.length === 1 ? 'page' : 'pages'}</strong></div>
              <div className="text-[11px] text-[#68735B]">
                Settings: {pageSize.toUpperCase()} · {orientation.toUpperCase()} · {margin.toUpperCase()} MARGINS
              </div>
            </div>

            <button
              type="button"
              onClick={handleConvertToPdf}
              disabled={isProcessing}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#20201D] hover:bg-[#343430] text-[#F5F3ED] text-xs font-mono font-medium rounded-[2px] transition-all shadow-sm ${
                isProcessing ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-[#F5F3ED] border-t-transparent animate-spin rounded-full" />
                  <span>Converting...</span>
                </>
              ) : (
                <>
                  <FileImage className="w-4 h-4" />
                  <span>Convert to PDF</span>
                </>
              )}
            </button>
          </div>

          {/* Processing Indicator */}
          {isProcessing && (
            <div className="p-3 bg-[#EBE7DF] border border-[#DEDCD3] rounded-[2px] text-xs font-mono text-[#20201D] flex items-center gap-2">
              <div className="w-3 h-3 border-2 border-[#20201D] border-t-transparent animate-spin rounded-full" />
              <span>{processingProgress}</span>
            </div>
          )}

          {/* Conversion Success & Download Section */}
          {pdfResult && (
            <div className="bg-[#FFFFFF] border-2 border-[#68735B] p-5 sm:p-6 rounded-[2px] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#DEDCD3]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#EBE7DF] border border-[#68735B] flex items-center justify-center text-[#68735B] rounded-[2px]">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#20201D]">
                      PDF Successfully Generated!
                    </h3>
                    <p className="text-xs font-mono text-[#77766F] mt-0.5">
                      {pdfResult.pageCount} {pdfResult.pageCount === 1 ? 'page' : 'pages'} · {formatBytes(pdfResult.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#DEDCD3] hover:border-[#20201D] text-xs font-mono text-[#20201D] rounded-[2px] transition-colors"
                  >
                    {showPreview ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        Hide Preview
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        Preview PDF
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-[#68735B] hover:bg-[#58624D] text-[#FFFFFF] text-xs font-mono font-medium rounded-[2px] transition-colors shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>
                </div>
              </div>

              {/* PDF Preview Frame */}
              {showPreview && (
                <div className="border border-[#DEDCD3] rounded-[2px] overflow-hidden bg-[#525659]">
                  <iframe
                    src={pdfResult.previewUrl}
                    title="PDF Document Preview"
                    className="w-full h-96 border-0"
                  />
                </div>
              )}

              {/* Conversion Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-3 bg-[#FAF8F5] border border-[#DEDCD3] rounded-[2px]">
                  <div className="text-[10px] font-mono text-[#77766F] uppercase">Source Images</div>
                  <div className="text-base font-semibold text-[#20201D] mt-0.5">{images.length}</div>
                </div>
                <div className="p-3 bg-[#FAF8F5] border border-[#DEDCD3] rounded-[2px]">
                  <div className="text-[10px] font-mono text-[#77766F] uppercase">PDF Pages</div>
                  <div className="text-base font-semibold text-[#20201D] mt-0.5">{pdfResult.pageCount}</div>
                </div>
                <div className="p-3 bg-[#FAF8F5] border border-[#DEDCD3] rounded-[2px]">
                  <div className="text-[10px] font-mono text-[#77766F] uppercase">Combined Size</div>
                  <div className="text-base font-semibold text-[#20201D] mt-0.5">{formatBytes(pdfResult.size)}</div>
                </div>
                <div className="p-3 bg-[#FAF8F5] border border-[#DEDCD3] rounded-[2px]">
                  <div className="text-[10px] font-mono text-[#77766F] uppercase">Default Filename</div>
                  <div className="text-xs font-mono font-medium text-[#20201D] mt-1 truncate">fastpdfx-images.pdf</div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] font-mono text-[#77766F]">
                  Need another document with different settings?
                </span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1 text-xs font-mono text-[#20201D] hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Convert Another
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feature & Privacy Notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-[#DEDCD3]">
        <div className="p-4 bg-[#FAF8F5] border border-[#DEDCD3] rounded-[2px]">
          <div className="flex items-center gap-2 mb-1.5">
            <Info className="w-4 h-4 text-[#68735B]" />
            <h4 className="text-xs font-mono font-semibold uppercase text-[#20201D]">
              Complete Client-Side
            </h4>
          </div>
          <p className="text-xs text-[#77766F] leading-relaxed">
            Your photos never touch any server or cloud API. All document compilation is processed securely within your device's browser memory.
          </p>
        </div>

        <div className="p-4 bg-[#FAF8F5] border border-[#DEDCD3] rounded-[2px]">
          <div className="flex items-center gap-2 mb-1.5">
            <FileImage className="w-4 h-4 text-[#68735B]" />
            <h4 className="text-xs font-mono font-semibold uppercase text-[#20201D]">
              Multi-Format Support
            </h4>
          </div>
          <p className="text-xs text-[#77766F] leading-relaxed">
            Supports standard JPG/JPEG, transparent PNG, and modern WebP image formats with seamless embedded compression and DPI matching.
          </p>
        </div>

        <div className="p-4 bg-[#FAF8F5] border border-[#DEDCD3] rounded-[2px]">
          <div className="flex items-center gap-2 mb-1.5">
            <Settings2 className="w-4 h-4 text-[#68735B]" />
            <h4 className="text-xs font-mono font-semibold uppercase text-[#20201D]">
              Custom Page Layouts
            </h4>
          </div>
          <p className="text-xs text-[#77766F] leading-relaxed">
            Choose between standard A4, US Letter, or exact image dimensions. Automatically detect portrait or landscape orientation per image.
          </p>
        </div>
      </div>
    </div>
  );
};
