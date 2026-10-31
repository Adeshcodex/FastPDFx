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
  Maximize2,
  Lock,
  Unlock,
  Info,
  Sparkles
} from 'lucide-react';
import { PageMeta } from '../../components/PageMeta';
import { formatBytes } from '../../utils/formatBytes';
import { downloadFile } from '../../utils/downloadFile';

interface ImageMetadata {
  file: File;
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
  aspectRatio: number;
  previewUrl: string;
}

interface ResizedResult {
  blob: Blob;
  size: number;
  width: number;
  height: number;
  previewUrl: string;
  mimeType: string;
}

const PRESETS = [
  { name: 'Instagram Square', width: 1080, height: 1080 },
  { name: 'Instagram Portrait', width: 1080, height: 1350 },
  { name: 'YouTube Thumbnail', width: 1280, height: 720 },
  { name: 'Full HD', width: 1920, height: 1080 },
  { name: 'Passport Photo', width: 413, height: 531 }
];

const MAX_DIMENSION = 10000;
const MIN_DIMENSION = 1;

export const ImageResizerPage: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<ImageMetadata | null>(null);
  const [targetWidth, setTargetWidth] = useState<string>('');
  const [targetHeight, setTargetHeight] = useState<string>('');
  const [maintainAspectRatio, setMaintainAspectRatio] = useState<boolean>(true);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [resizedResult, setResizedResult] = useState<ResizedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);

  // URL Cleanup helper
  const cleanupSourceUrl = useCallback(() => {
    if (sourceImage?.previewUrl) {
      URL.revokeObjectURL(sourceImage.previewUrl);
    }
  }, [sourceImage]);

  const cleanupResizedUrl = useCallback(() => {
    if (resizedResult?.previewUrl) {
      URL.revokeObjectURL(resizedResult.previewUrl);
    }
  }, [resizedResult]);

  useEffect(() => {
    return () => {
      cleanupSourceUrl();
      cleanupResizedUrl();
    };
  }, [cleanupSourceUrl, cleanupResizedUrl]);

  // Dimension Change Handlers
  const handleWidthChange = (val: string) => {
    setTargetWidth(val);
    const numWidth = parseInt(val, 10);
    if (!isNaN(numWidth) && numWidth > 0 && sourceImage && maintainAspectRatio) {
      const calculatedHeight = Math.round(numWidth / sourceImage.aspectRatio);
      setTargetHeight(String(calculatedHeight));
    }
  };

  const handleHeightChange = (val: string) => {
    setTargetHeight(val);
    const numHeight = parseInt(val, 10);
    if (!isNaN(numHeight) && numHeight > 0 && sourceImage && maintainAspectRatio) {
      const calculatedWidth = Math.round(numHeight * sourceImage.aspectRatio);
      setTargetWidth(String(calculatedWidth));
    }
  };

  const applyPreset = (preset: { name: string; width: number; height: number }) => {
    setMaintainAspectRatio(false); // Presets have specific fixed aspect ratios
    setTargetWidth(String(preset.width));
    setTargetHeight(String(preset.height));
  };

  const handleFile = (file: File) => {
    setErrorMessage(null);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const isExtensionValid = /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!validTypes.includes(file.type) && !isExtensionValid) {
      setErrorMessage('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    cleanupSourceUrl();
    cleanupResizedUrl();
    setResizedResult(null);

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      loadedImgRef.current = img;
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspectRatio = width / height;

      setSourceImage({
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'image/jpeg',
        width,
        height,
        aspectRatio,
        previewUrl: objectUrl
      });

      setTargetWidth(String(width));
      setTargetHeight(String(height));
      setMaintainAspectRatio(true);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setErrorMessage('Failed to decode the image. The file may be corrupted.');
    };

    img.src = objectUrl;
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleReset = () => {
    cleanupSourceUrl();
    cleanupResizedUrl();
    setSourceImage(null);
    setResizedResult(null);
    setErrorMessage(null);
    setTargetWidth('');
    setTargetHeight('');
    setMaintainAspectRatio(true);
    loadedImgRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Perform Resize using HTML Canvas
  const handleResize = async () => {
    if (!sourceImage || !loadedImgRef.current) return;

    setErrorMessage(null);
    const width = parseInt(targetWidth, 10);
    const height = parseInt(targetHeight, 10);

    // Validate dimensions
    if (isNaN(width) || isNaN(height)) {
      setErrorMessage('Please enter valid numeric dimensions.');
      return;
    }

    if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
      setErrorMessage(`Dimensions must be at least ${MIN_DIMENSION}px.`);
      return;
    }

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      setErrorMessage(`Dimensions cannot exceed ${MAX_DIMENSION}px to preserve browser performance.`);
      return;
    }

    setIsResizing(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Unable to initialize canvas rendering context.');
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const mimeType = sourceImage.type === 'image/png' ? 'image/png' : sourceImage.type === 'image/webp' ? 'image/webp' : 'image/jpeg';

      // If JPEG, fill white background to prevent black background on transparent PNGs
      if (mimeType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(loadedImgRef.current, 0, 0, width, height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          resultBlob => {
            if (resultBlob) {
              resolve(resultBlob);
            } else {
              reject(new Error('Canvas failed to export resized image blob.'));
            }
          },
          mimeType,
          0.92
        );
      });

      const newPreviewUrl = URL.createObjectURL(blob);

      // Clean up previous result preview
      if (resizedResult?.previewUrl) {
        URL.revokeObjectURL(resizedResult.previewUrl);
      }

      setResizedResult({
        blob,
        size: blob.size,
        width,
        height,
        previewUrl: newPreviewUrl,
        mimeType
      });
    } catch (err: unknown) {
      console.error('Resize error:', err);
      setErrorMessage(
        err instanceof Error ? err.message : 'An error occurred while resizing the image.'
      );
    } finally {
      setIsResizing(false);
    }
  };

  const handleDownload = () => {
    if (!resizedResult || !sourceImage) return;

    let ext = 'jpg';
    if (resizedResult.mimeType === 'image/png') ext = 'png';
    else if (resizedResult.mimeType === 'image/webp') ext = 'webp';

    const baseName = sourceImage.name.replace(/\.[^/.]+$/, '');
    const fileName = `${baseName}-resized-${resizedResult.width}x${resizedResult.height}.${ext}`;

    downloadFile(resizedResult.blob, fileName);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <PageMeta
        title="Image Resizer - FastPDFx"
        description="Resize JPG, PNG, and WebP images by exact pixel width and height or social media presets. Runs 100% in your browser."
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
            IMAGE TOOLS · BROWSER ENGINE
          </span>
          <h1 className="text-2xl font-semibold text-[#20201D] tracking-tight mt-0.5">
            Image Resizer
          </h1>
          <p className="text-xs text-[#77766F] mt-1">
            Scale photos by exact pixel dimensions or standard presets. Runs entirely in browser memory.
          </p>
        </div>

        {sourceImage && (
          <button
            type="button"
            onClick={handleReset}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#20201D] bg-white border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#77766F]" />
            <span>Reset Tool</span>
          </button>
        )}
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-3.5 bg-white border border-[#20201D] rounded-[2px] text-xs text-[#20201D] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#68735B] shrink-0 mt-0.5" />
          <div className="flex-1">
            <strong>Error: </strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Upload Dropzone (When No Image Selected) */}
      {!sourceImage && (
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
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => {
              if (e.target.files && e.target.files.length > 0) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          <div className="w-12 h-12 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center mx-auto mb-3.5 border border-[#DEDCD3]">
            <Upload className="w-5 h-5 text-[#68735B]" />
          </div>

          <h3 className="text-sm font-semibold text-[#20201D]">
            Select an image or drag & drop here
          </h3>
          <p className="text-xs text-[#77766F] mt-1">
            Supports JPG, JPEG, PNG, and WebP (up to 50 MB)
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-[#20201D] text-[#F5F3ED] text-xs font-medium rounded-[2px]">
            <span>Browse File</span>
          </div>

          <p className="text-[11px] font-mono text-[#A6A49B] mt-4">
            Processed 100% locally in your browser memory
          </p>
        </div>
      )}

      {/* Resizer Workspace (When Image is Loaded) */}
      {sourceImage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Image Preview Canvas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-4 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#F5F3ED] text-xs">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-[#68735B]" />
                  <span className="font-semibold text-[#20201D] truncate max-w-[220px] sm:max-w-sm">
                    {sourceImage.name}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#77766F]">
                  {formatBytes(sourceImage.size)}
                </span>
              </div>

              {/* Preview Window */}
              <div className="relative min-h-[300px] max-h-[440px] bg-[#171715] flex items-center justify-center p-3 rounded-[2px] overflow-hidden">
                {isResizing && (
                  <div className="absolute inset-0 bg-[#20201D]/75 backdrop-blur-2xs flex flex-col items-center justify-center text-white z-10 font-mono text-xs gap-2">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Resizing image...</span>
                  </div>
                )}

                <img
                  src={resizedResult ? resizedResult.previewUrl : sourceImage.previewUrl}
                  alt={resizedResult ? 'Resized Preview' : 'Original Preview'}
                  className="max-h-[380px] max-w-full object-contain"
                />
              </div>

              {/* Status & Dimensions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] font-mono text-[#77766F]">
                <div>
                  Original:{' '}
                  <span className="text-[#20201D] font-semibold">
                    {sourceImage.width} × {sourceImage.height} px
                  </span>
                </div>

                {resizedResult && (
                  <div className="text-[#68735B] font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    Resized: {resizedResult.width} × {resizedResult.height} px ({formatBytes(resizedResult.size)})
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Dimensions, Presets & Action */}
          <div className="space-y-4">
            <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 space-y-5">
              <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5 text-[#68735B]" />
                Dimensions Settings
              </h3>

              {/* Width & Height Inputs */}
              <div className="space-y-3 font-mono text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="resizer-width" className="block text-[11px] text-[#77766F] mb-1">
                      Width (px)
                    </label>
                    <input
                      id="resizer-width"
                      type="number"
                      min={MIN_DIMENSION}
                      max={MAX_DIMENSION}
                      value={targetWidth}
                      onChange={e => handleWidthChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#DEDCD3] rounded-[2px] text-[#20201D] text-xs focus:outline-none focus:border-[#20201D]"
                    />
                  </div>

                  <div>
                    <label htmlFor="resizer-height" className="block text-[11px] text-[#77766F] mb-1">
                      Height (px)
                    </label>
                    <input
                      id="resizer-height"
                      type="number"
                      min={MIN_DIMENSION}
                      max={MAX_DIMENSION}
                      value={targetHeight}
                      onChange={e => handleHeightChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#DEDCD3] rounded-[2px] text-[#20201D] text-xs focus:outline-none focus:border-[#20201D]"
                    />
                  </div>
                </div>

                {/* Aspect Ratio Toggle */}
                <button
                  type="button"
                  onClick={() => setMaintainAspectRatio(!maintainAspectRatio)}
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 px-3 border rounded-[2px] text-[11px] transition-colors ${
                    maintainAspectRatio
                      ? 'bg-[#F5F3ED] border-[#20201D] text-[#20201D] font-medium'
                      : 'bg-white border-[#DEDCD3] text-[#77766F] hover:border-[#20201D]'
                  }`}
                >
                  {maintainAspectRatio ? (
                    <>
                      <Lock className="w-3 h-3 text-[#68735B]" />
                      <span>Maintain Aspect Ratio (Locked)</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-3 h-3 text-[#77766F]" />
                      <span>Maintain Aspect Ratio (Unlocked)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Standard Dimensions Presets */}
              <div className="space-y-2 pt-2 border-t border-[#F5F3ED]">
                <span className="block text-[11px] font-mono text-[#77766F] uppercase">
                  Standard Presets
                </span>
                <div className="space-y-1 font-mono text-xs">
                  {PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="w-full flex items-center justify-between p-2 rounded-[2px] border border-[#F5F3ED] hover:border-[#DEDCD3] hover:bg-[#F5F3ED] text-left transition-colors"
                    >
                      <span className="text-[#20201D]">{preset.name}</span>
                      <span className="text-[10px] text-[#77766F]">
                        {preset.width} × {preset.height}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-[#F5F3ED] space-y-2">
                <button
                  type="button"
                  onClick={handleResize}
                  disabled={isResizing}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#20201D] text-[#F5F3ED] text-xs font-semibold rounded-[2px] hover:bg-[#33322E] transition-colors disabled:opacity-50"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>{isResizing ? 'Resizing...' : 'Resize Image'}</span>
                </button>

                {resizedResult && (
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#68735B] text-white text-xs font-semibold rounded-[2px] hover:bg-[#555E4A] transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Resized Image</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Educational & Architectural Explanations */}
      <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 sm:p-6 space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#68735B]" />
          How In-Browser Image Resizing Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#77766F] leading-relaxed">
          <div>
            <strong className="text-[#20201D] block mb-1">Bicubic Pixel Interpolation</strong>
            Canvas 2D utilizes native bicubic smoothing filters to scale pixel density smoothly, eliminating pixelation on downscales and preserving edge clarity on upscales.
          </div>
          <div>
            <strong className="text-[#20201D] block mb-1">Aspect Ratio Preservation</strong>
            When locked, the mathematical ratio ($W/H$) calculates complementary axes automatically to prevent visual warping, distortion, or squishing.
          </div>
          <div>
            <strong className="text-[#20201D] block mb-1">Local Processing</strong>
            Every calculation runs directly inside your device's memory. Your personal photographs and documents are never transmitted to any third-party web server.
          </div>
        </div>
      </div>
    </div>
  );
};
