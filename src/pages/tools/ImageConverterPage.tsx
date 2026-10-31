import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  Download,
  RotateCcw,
  Check,
  AlertCircle,
  FileImage,
  RefreshCw,
  Trash2,
  Archive,
  Info,
  Sliders,
  Plus,
  Layers,
  Sparkles
} from 'lucide-react';
import JSZip from 'jszip';
import heic2any from 'heic2any';
import { PageMeta } from '../../components/PageMeta';
import { formatBytes } from '../../utils/formatBytes';
import { downloadFile } from '../../utils/downloadFile';
import {
  isAvifSupported,
  encodeBmp,
  encodeIco,
  decodeTiff,
  encodeTiff,
  sanitizeAndLoadSvg,
  wrapRasterInSvg
} from '../../utils/imageEncoders';

export type SupportedOutputFormat =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/avif'
  | 'image/bmp'
  | 'image/tiff'
  | 'image/x-icon'
  | 'image/svg+xml';

interface OutputFormatConfig {
  label: string;
  ext: string;
  hasQuality: boolean;
  description: string;
}

const OUTPUT_FORMATS: Record<SupportedOutputFormat, OutputFormatConfig> = {
  'image/jpeg': {
    label: 'JPEG',
    ext: 'jpg',
    hasQuality: true,
    description: 'Universal photo format. White background applied for transparent images.'
  },
  'image/png': {
    label: 'PNG',
    ext: 'png',
    hasQuality: false,
    description: 'Lossless format preserving full alpha transparency.'
  },
  'image/webp': {
    label: 'WebP',
    ext: 'webp',
    hasQuality: true,
    description: 'Modern high-compression web format with transparency support.'
  },
  'image/avif': {
    label: 'AVIF',
    ext: 'avif',
    hasQuality: true,
    description: 'Next-generation AV1 image format with superior compression efficiency.'
  },
  'image/bmp': {
    label: 'BMP',
    ext: 'bmp',
    hasQuality: false,
    description: 'Standard 24-bit uncompressed Windows bitmap format.'
  },
  'image/tiff': {
    label: 'TIFF',
    ext: 'tiff',
    hasQuality: false,
    description: 'High-fidelity raster format commonly used in printing and scanning.'
  },
  'image/x-icon': {
    label: 'ICO',
    ext: 'ico',
    hasQuality: false,
    description: 'Windows icon and website favicon format (PNG-in-ICO container standard).'
  },
  'image/svg+xml': {
    label: 'SVG',
    ext: 'svg',
    hasQuality: false,
    description: 'XML vector container embedding high-resolution graphic payload.'
  }
};

interface ConvertedImageItem {
  id: string;
  file: File;
  name: string;
  detectedFormat: string;
  originalSize: number;
  width: number;
  height: number;
  sourcePreviewUrl: string;
  canvasSource: HTMLCanvasElement;
  targetFormat: SupportedOutputFormat;
  status: 'idle' | 'converting' | 'completed' | 'error';
  notice?: string;
  errorMessage?: string;
  convertedBlob?: Blob;
  convertedSize?: number;
  convertedPreviewUrl?: string;
}

export const ImageConverterPage: React.FC = () => {
  const [items, setItems] = useState<ConvertedImageItem[]>([]);
  const [globalFormat, setGlobalFormat] = useState<SupportedOutputFormat>('image/webp');
  const [quality, setQuality] = useState<number>(90);
  const [avifCapable, setAvifCapable] = useState<boolean>(true);
  const [isProcessingAll, setIsProcessingAll] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  // Check AVIF browser encoder support on mount
  useEffect(() => {
    isAvifSupported().then(supported => {
      setAvifCapable(supported);
    });
  }, []);

  // Cleanup object URLs on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      items.forEach(item => {
        if (item.sourcePreviewUrl) URL.revokeObjectURL(item.sourcePreviewUrl);
        if (item.convertedPreviewUrl) URL.revokeObjectURL(item.convertedPreviewUrl);
      });
    };
  }, [items]);

  // Decode any supported input format into an in-memory HTMLCanvasElement
  const decodeFileToCanvas = async (
    file: File
  ): Promise<{
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    formatName: string;
    notice?: string;
    sourcePreviewUrl: string;
  }> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    let formatName = file.type || ext.toUpperCase();

    // 1. HEIC / HEIF Decoding
    if (ext === 'heic' || ext === 'heif' || file.type.includes('heic') || file.type.includes('heif')) {
      formatName = 'HEIC/HEIF';
      try {
        const decodedBlob = await heic2any({ blob: file, toType: 'image/png' });
        const pngBlob = Array.isArray(decodedBlob) ? decodedBlob[0] : decodedBlob;
        const url = URL.createObjectURL(pngBlob);
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(new Error('Failed to render decoded HEIC payload.'));
          img.src = url;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);

        return {
          canvas,
          width: img.naturalWidth,
          height: img.naturalHeight,
          formatName,
          notice: 'Decoded from Apple HEIC container',
          sourcePreviewUrl: url
        };
      } catch (err: unknown) {
        throw new Error(
          err instanceof Error
            ? `HEIC decoding error: ${err.message}`
            : 'Unable to decode HEIC file. The file may be corrupt or encrypted.'
        );
      }
    }

    // 2. TIFF / TIF Decoding
    if (ext === 'tiff' || ext === 'tif' || file.type.includes('tiff')) {
      formatName = 'TIFF';
      try {
        const buffer = await file.arrayBuffer();
        const tiffData = await decodeTiff(buffer);
        const canvas = document.createElement('canvas');
        canvas.width = tiffData.width;
        canvas.height = tiffData.height;
        const ctx = canvas.getContext('2d')!;
        ctx.putImageData(tiffData.imageData, 0, 0);

        const previewBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Failed to create preview.'))), 'image/png');
        });
        const previewUrl = URL.createObjectURL(previewBlob);

        return {
          canvas,
          width: tiffData.width,
          height: tiffData.height,
          formatName,
          notice: tiffData.pageCount > 1 ? `Multi-page TIFF (${tiffData.pageCount} pages): converting page 1` : undefined,
          sourcePreviewUrl: previewUrl
        };
      } catch (err: unknown) {
        throw new Error(
          err instanceof Error ? `TIFF error: ${err.message}` : 'Failed to decode TIFF image.'
        );
      }
    }

    // 3. SVG Decoding & Sanitization
    if (ext === 'svg' || file.type.includes('svg')) {
      formatName = 'SVG';
      try {
        const text = await file.text();
        const svgData = await sanitizeAndLoadSvg(text);
        const canvas = document.createElement('canvas');
        canvas.width = svgData.width;
        canvas.height = svgData.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(svgData.img, 0, 0);

        const previewBlob = new Blob([svgData.sanitizedSvg], { type: 'image/svg+xml;charset=utf-8' });
        const previewUrl = URL.createObjectURL(previewBlob);

        return {
          canvas,
          width: svgData.width,
          height: svgData.height,
          formatName,
          notice: 'Sanitized with DOMPurify against XSS vectors',
          sourcePreviewUrl: previewUrl
        };
      } catch (err: unknown) {
        throw new Error(
          err instanceof Error ? `SVG parsing error: ${err.message}` : 'Invalid or malformed SVG file.'
        );
      }
    }

    // 4. Standard Formats (JPG, PNG, WebP, AVIF, GIF, BMP, ICO)
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Browser was unable to decode ${file.name}.`));
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    let notice: string | undefined;
    if (ext === 'gif' || file.type.includes('gif')) {
      formatName = 'GIF';
      notice = 'Converted from frame 1 of GIF image';
    } else if (ext === 'bmp' || file.type.includes('bmp')) {
      formatName = 'BMP';
    } else if (ext === 'ico' || file.type.includes('icon')) {
      formatName = 'ICO';
    } else if (ext === 'avif' || file.type.includes('avif')) {
      formatName = 'AVIF';
    } else if (ext === 'webp' || file.type.includes('webp')) {
      formatName = 'WebP';
    } else if (ext === 'png' || file.type.includes('png')) {
      formatName = 'PNG';
    } else {
      formatName = 'JPEG';
    }

    return {
      canvas,
      width: img.naturalWidth,
      height: img.naturalHeight,
      formatName,
      notice,
      sourcePreviewUrl: objectUrl
    };
  };

  // Convert an in-memory Canvas to the requested target format
  const encodeCanvasToTarget = async (
    canvas: HTMLCanvasElement,
    targetFormat: SupportedOutputFormat,
    qualityVal: number
  ): Promise<{ blob: Blob; size: number; previewUrl: string }> => {
    // A. BMP Encoding (Dependency-free 24-bit binary bitmap)
    if (targetFormat === 'image/bmp') {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const blob = encodeBmp(imageData);
      const previewUrl = URL.createObjectURL(blob);
      return { blob, size: blob.size, previewUrl };
    }

    // B. ICO Encoding (Windows ICON container standard)
    if (targetFormat === 'image/x-icon') {
      const blob = await encodeIco(canvas);
      const previewUrl = URL.createObjectURL(blob);
      return { blob, size: blob.size, previewUrl };
    }

    // C. TIFF Encoding (Standard baseline TIFF via UTIF)
    if (targetFormat === 'image/tiff') {
      const ctx = canvas.getContext('2d')!;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const blob = encodeTiff(imageData);
      const previewUrl = URL.createObjectURL(blob);
      return { blob, size: blob.size, previewUrl };
    }

    // D. SVG Container Embedding
    if (targetFormat === 'image/svg+xml') {
      const dataUrl = canvas.toDataURL('image/png');
      const blob = wrapRasterInSvg(dataUrl, canvas.width, canvas.height);
      const previewUrl = URL.createObjectURL(blob);
      return { blob, size: blob.size, previewUrl };
    }

    // E. AVIF Encoding
    if (targetFormat === 'image/avif') {
      if (!avifCapable) {
        throw new Error(
          'AVIF output encoding is not supported in this browser. Please select WebP or PNG.'
        );
      }
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          b => (b ? resolve(b) : reject(new Error('Canvas failed to export AVIF blob.'))),
          'image/avif',
          qualityVal / 100
        );
      });
      const previewUrl = URL.createObjectURL(blob);
      return { blob, size: blob.size, previewUrl };
    }

    // F. Standard Raster Formats (JPEG, PNG, WebP)
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (targetFormat === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(canvas, 0, 0);

    const qualityParam = targetFormat === 'image/png' ? undefined : qualityVal / 100;
    const blob = await new Promise<Blob>((resolve, reject) => {
      exportCanvas.toBlob(
        b => (b ? resolve(b) : reject(new Error(`Failed to encode to ${targetFormat}.`))),
        targetFormat,
        qualityParam
      );
    });

    const previewUrl = URL.createObjectURL(blob);
    return { blob, size: blob.size, previewUrl };
  };

  // Convert a single item
  const processItem = useCallback(
    async (itemId: string, format: SupportedOutputFormat, qVal: number) => {
      setItems(prev =>
        prev.map(i => (i.id === itemId ? { ...i, status: 'converting', targetFormat: format } : i))
      );

      const targetItem = items.find(i => i.id === itemId);
      if (!targetItem) return;

      try {
        const result = await encodeCanvasToTarget(targetItem.canvasSource, format, qVal);

        setItems(prev =>
          prev.map(i => {
            if (i.id === itemId) {
              if (i.convertedPreviewUrl) {
                URL.revokeObjectURL(i.convertedPreviewUrl);
              }
              return {
                ...i,
                status: 'completed',
                targetFormat: format,
                convertedBlob: result.blob,
                convertedSize: result.size,
                convertedPreviewUrl: result.previewUrl,
                errorMessage: undefined
              };
            }
            return i;
          })
        );
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Conversion error occurred.';
        setItems(prev =>
          prev.map(i => (i.id === itemId ? { ...i, status: 'error', errorMessage: msg } : i))
        );
      }
    },
    [items, avifCapable]
  );

  // Batch convert all items
  const handleConvertAll = async () => {
    if (items.length === 0) return;
    setIsProcessingAll(true);
    setGlobalError(null);

    for (const item of items) {
      await processItem(item.id, globalFormat, quality);
    }

    setIsProcessingAll(false);
  };

  // Handle uploaded files
  const handleFiles = async (fileList: FileList) => {
    setGlobalError(null);

    for (const file of Array.from(fileList)) {
      try {
        const decoded = await decodeFileToCanvas(file);
        const newItem: ConvertedImageItem = {
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          detectedFormat: decoded.formatName,
          originalSize: file.size,
          width: decoded.width,
          height: decoded.height,
          sourcePreviewUrl: decoded.sourcePreviewUrl,
          canvasSource: decoded.canvas,
          targetFormat: globalFormat,
          notice: decoded.notice,
          status: 'idle'
        };

        setItems(prev => [...prev, newItem]);
      } catch (err: unknown) {
        console.error('Decoding error:', err);
        const errorMsg =
          err instanceof Error
            ? `Failed to load "${file.name}": ${err.message}`
            : `Failed to load "${file.name}".`;
        setGlobalError(errorMsg);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleRemoveItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item) {
        if (item.sourcePreviewUrl) URL.revokeObjectURL(item.sourcePreviewUrl);
        if (item.convertedPreviewUrl) URL.revokeObjectURL(item.convertedPreviewUrl);
      }
      return prev.filter(i => i.id !== id);
    });
  };

  const handleClearAll = () => {
    items.forEach(item => {
      if (item.sourcePreviewUrl) URL.revokeObjectURL(item.sourcePreviewUrl);
      if (item.convertedPreviewUrl) URL.revokeObjectURL(item.convertedPreviewUrl);
    });
    setItems([]);
    setGlobalError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (addMoreInputRef.current) addMoreInputRef.current.value = '';
  };

  const handleDownloadItem = (item: ConvertedImageItem) => {
    if (!item.convertedBlob) return;
    const baseName = item.name.replace(/\.[^/.]+$/, '');
    const ext = OUTPUT_FORMATS[item.targetFormat].ext;
    downloadFile(item.convertedBlob, `${baseName}.${ext}`);
  };

  const handleDownloadAllZip = async () => {
    const completedItems = items.filter(i => i.status === 'completed' && i.convertedBlob);
    if (completedItems.length === 0) return;

    if (completedItems.length === 1) {
      handleDownloadItem(completedItems[0]);
      return;
    }

    setIsZipping(true);
    try {
      const zip = new JSZip();
      const namesTracker: Record<string, number> = {};

      completedItems.forEach(item => {
        const base = item.name.replace(/\.[^/.]+$/, '');
        const ext = OUTPUT_FORMATS[item.targetFormat].ext;

        let filename = `${base}.${ext}`;
        if (namesTracker[filename]) {
          namesTracker[filename] += 1;
          filename = `${base}-${namesTracker[filename]}.${ext}`;
        } else {
          namesTracker[filename] = 1;
        }

        zip.file(filename, item.convertedBlob!);
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipBlob, 'fastpdfx-converted-images.zip');
    } catch (err: unknown) {
      console.error('ZIP packaging error:', err);
      setGlobalError('Failed to assemble ZIP archive.');
    } finally {
      setIsZipping(false);
    }
  };

  const completedCount = items.filter(i => i.status === 'completed').length;
  const currentFormatConfig = OUTPUT_FORMATS[globalFormat];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <PageMeta
        title="Image Format Converter - FastPDFx"
        description="Convert between 10 raster and vector formats (JPG, PNG, WebP, AVIF, BMP, GIF, TIFF, ICO, HEIC, SVG) directly in your browser."
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
            IMAGE TOOLS · 10 FORMAT ENGINE
          </span>
          <h1 className="text-2xl font-semibold text-[#20201D] tracking-tight mt-0.5">
            Image Format Converter
          </h1>
          <p className="text-xs text-[#77766F] mt-1">
            Convert JPG, PNG, WebP, AVIF, BMP, GIF, TIFF, ICO, HEIC/HEIF and SVG locally in your browser.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={handleClearAll}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#20201D] bg-white border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#77766F]" />
            <span>Clear Queue</span>
          </button>
        )}
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="p-3.5 bg-white border border-[#20201D] rounded-[2px] text-xs text-[#20201D] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#68735B] shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Notice: </strong>
            <span>{globalError}</span>
          </div>
        </div>
      )}

      {/* Upload Dropzone (When Empty) */}
      {items.length === 0 && (
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
            accept=".jpg,.jpeg,.png,.webp,.avif,.bmp,.gif,.tiff,.tif,.ico,.heic,.heif,.svg,image/*"
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
              }
            }}
          />

          <div className="w-12 h-12 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center mx-auto mb-3.5 border border-[#DEDCD3]">
            <Upload className="w-5 h-5 text-[#68735B]" />
          </div>

          <h3 className="text-sm font-semibold text-[#20201D]">
            Select one or multiple images to convert
          </h3>
          <p className="text-xs text-[#77766F] mt-1 max-w-md mx-auto">
            Supports JPG, PNG, WebP, AVIF, BMP, GIF, TIFF, ICO, HEIC/HEIF and SVG
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#20201D] text-[#F5F3ED] text-xs font-medium rounded-[2px]">
            <span>Browse Files</span>
          </div>

          <p className="text-[11px] font-mono text-[#A6A49B] mt-4">
            Processed 100% locally in browser memory · Zero remote server uploads
          </p>
        </div>
      )}

      {/* Active Converter Workspace */}
      {items.length > 0 && (
        <div className="space-y-5">
          {/* Global Target Format & Quality Toolbar */}
          <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              {/* Output format selector */}
              <div className="space-y-1">
                <span className="block text-[11px] font-mono uppercase text-[#77766F]">
                  Convert All To:
                </span>
                <div className="inline-flex flex-wrap rounded-[2px] border border-[#DEDCD3] font-mono text-xs overflow-hidden">
                  {(Object.keys(OUTPUT_FORMATS) as SupportedOutputFormat[]).map(fmt => {
                    const isSelected = globalFormat === fmt;
                    const isAvifDisabled = fmt === 'image/avif' && !avifCapable;
                    return (
                      <button
                        key={fmt}
                        type="button"
                        disabled={isAvifDisabled}
                        onClick={() => setGlobalFormat(fmt)}
                        title={isAvifDisabled ? 'AVIF not supported in this browser' : OUTPUT_FORMATS[fmt].description}
                        className={`px-2.5 py-1.5 transition-colors border-r last:border-r-0 border-[#DEDCD3] disabled:opacity-30 disabled:cursor-not-allowed ${
                          isSelected
                            ? 'bg-[#20201D] text-[#F5F3ED] font-semibold'
                            : 'bg-white text-[#20201D] hover:bg-[#F5F3ED]'
                        }`}
                      >
                        {OUTPUT_FORMATS[fmt].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quality slider for lossy encodings */}
              {currentFormatConfig.hasQuality && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-[#77766F] gap-2">
                    <span>Quality:</span>
                    <span className="font-bold text-[#20201D]">{quality}%</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="100"
                    step="1"
                    value={quality}
                    onChange={e => setQuality(Number(e.target.value))}
                    className="w-28 h-1 bg-[#F5F3ED] rounded-[2px] appearance-none cursor-pointer accent-[#20201D]"
                  />
                </div>
              )}

              {!currentFormatConfig.hasQuality && (
                <div className="text-[11px] font-mono text-[#77766F] md:self-end pb-1.5">
                  * {OUTPUT_FORMATS[globalFormat].label} output uses lossless encoding.
                </div>
              )}
            </div>

            {/* Batch Action Buttons */}
            <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-[#F5F3ED]">
              {/* Add more files button */}
              <button
                type="button"
                onClick={() => addMoreInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#20201D] bg-white border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add More</span>
              </button>
              <input
                ref={addMoreInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.avif,.bmp,.gif,.tiff,.tif,.ico,.heic,.heif,.svg,image/*"
                className="hidden"
                onChange={e => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFiles(e.target.files);
                  }
                }}
              />

              {/* Convert All Button */}
              <button
                type="button"
                onClick={handleConvertAll}
                disabled={isProcessingAll}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#20201D] text-[#F5F3ED] text-xs font-semibold rounded-[2px] hover:bg-[#33322E] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessingAll ? 'animate-spin' : ''}`} />
                <span>{isProcessingAll ? 'Converting...' : 'Convert All'}</span>
              </button>

              {/* Download All as ZIP */}
              {completedCount > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadAllZip}
                  disabled={isZipping}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#68735B] text-white text-xs font-semibold rounded-[2px] hover:bg-[#555E4A] transition-colors shadow-2xs disabled:opacity-50"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>
                    {isZipping
                      ? 'Archiving...'
                      : completedCount > 1
                      ? `Download All (${completedCount} ZIP)`
                      : 'Download Image'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Image Items List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-[#77766F] px-1">
              <span>
                Queue: {items.length} {items.length === 1 ? 'image' : 'images'} ({completedCount} converted)
              </span>
            </div>

            {items.map((item, index) => {
              const targetFmtLabel = OUTPUT_FORMATS[item.targetFormat].label;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-[2px] border border-[#DEDCD3] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors hover:border-[#20201D]"
                >
                  {/* Left: Thumbnail & Information */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span className="font-mono text-xs text-[#A6A49B] w-4 shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-[2px] bg-[#171715] flex items-center justify-center shrink-0 overflow-hidden border border-[#DEDCD3]">
                      <img
                        src={item.convertedPreviewUrl || item.sourcePreviewUrl}
                        alt={item.name}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-[#20201D] truncate max-w-[200px] sm:max-w-xs">
                        {item.name}
                      </h4>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] font-mono text-[#77766F]">
                        <span>
                          {item.width} × {item.height} px
                        </span>
                        <span>·</span>
                        <span className="text-[#20201D] font-medium">{item.detectedFormat}</span>
                        <span>·</span>
                        <span>{formatBytes(item.originalSize)}</span>

                        {item.convertedSize !== undefined && (
                          <>
                            <span className="text-[#20201D] font-bold">➔</span>
                            <span className="text-[#68735B] font-bold">
                              {targetFmtLabel}: {formatBytes(item.convertedSize)}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Informative notice for multi-page TIFF, GIF animation, or HEIC */}
                      {item.notice && (
                        <div className="mt-1 text-[10px] text-[#77766F] font-mono flex items-center gap-1">
                          <Info className="w-3 h-3 text-[#68735B] shrink-0" />
                          <span>{item.notice}</span>
                        </div>
                      )}

                      {/* Error message */}
                      {item.errorMessage && (
                        <div className="mt-1 text-[10px] text-rose-700 font-mono">
                          Error: {item.errorMessage}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Individual Format Selector, Convert & Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F5F3ED]">
                    {/* Individual format selector */}
                    <select
                      value={item.targetFormat}
                      onChange={e => {
                        const newFormat = e.target.value as SupportedOutputFormat;
                        processItem(item.id, newFormat, quality);
                      }}
                      className="px-2 py-1 bg-[#F5F3ED] text-[#20201D] text-xs font-mono rounded-[2px] border border-[#DEDCD3] focus:outline-none focus:border-[#20201D]"
                    >
                      {(Object.keys(OUTPUT_FORMATS) as SupportedOutputFormat[]).map(fmt => (
                        <option
                          key={fmt}
                          value={fmt}
                          disabled={fmt === 'image/avif' && !avifCapable}
                        >
                          to {OUTPUT_FORMATS[fmt].label}
                        </option>
                      ))}
                    </select>

                    {/* Convert Button */}
                    <button
                      type="button"
                      onClick={() => processItem(item.id, item.targetFormat, quality)}
                      disabled={item.status === 'converting'}
                      className="px-2.5 py-1 text-xs font-medium text-[#20201D] bg-white border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D] disabled:opacity-50"
                    >
                      {item.status === 'converting' ? '...' : item.status === 'completed' ? 'Re-convert' : 'Convert'}
                    </button>

                    {/* Download Button */}
                    {item.status === 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleDownloadItem(item)}
                        title="Download converted file"
                        className="p-1.5 bg-[#20201D] text-[#F5F3ED] rounded-[2px] hover:bg-[#33322E] transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      title="Remove file"
                      className="p-1.5 text-[#A6A49B] hover:text-[#20201D] rounded-[2px] hover:bg-[#F5F3ED] transition-colors"
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

      {/* Format Capabilities & Explanations */}
      <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 sm:p-6 space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#68735B]" />
          Supported Formats & Conversion Pipeline
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#77766F] leading-relaxed">
          <div>
            <strong className="text-[#20201D] block mb-1">Apple HEIC & TIFF Decoders</strong>
            Client-side decoding via `heic2any` (libheif WebAssembly) and `UTIF.js`. Decodes iOS Photos and multi-page desktop scanning formats directly into memory.
          </div>
          <div>
            <strong className="text-[#20201D] block mb-1">Windows ICO & BMP Encoders</strong>
            Generates standard ICONDIR binary headers with embedded high-resolution icon payloads and 24-bit/32-bit Windows DIB bitmaps.
          </div>
          <div>
            <strong className="text-[#20201D] block mb-1">SVG Vector & Sanitization</strong>
            Input SVG documents are sanitized with DOMPurify against script injection before canvas rendering. Raster-to-SVG produces standard XML containers.
          </div>
        </div>
      </div>
    </div>
  );
};
