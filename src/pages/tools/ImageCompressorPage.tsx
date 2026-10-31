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
  Sliders,
  Eye,
  Info,
  Sparkles
} from 'lucide-react';
import { PageMeta } from '../../components/PageMeta';
import { formatBytes } from '../../utils/formatBytes';
import { downloadFile } from '../../utils/downloadFile';

type OutputFormat = 'original' | 'image/jpeg' | 'image/webp' | 'image/png';

interface ImageMetadata {
  file: File;
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
  previewUrl: string;
}

interface CompressedResult {
  blob: Blob;
  size: number;
  previewUrl: string;
  mimeType: string;
  reductionPercentage: number;
  isLarger: boolean;
}

export const ImageCompressorPage: React.FC = () => {
  const [sourceImage, setSourceImage] = useState<ImageMetadata | null>(null);
  const [quality, setQuality] = useState<number>(75);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('original');
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressedResult, setCompressedResult] = useState<CompressedResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'compressed' | 'original' | 'split'>('compressed');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  // Clean up object URLs to prevent memory leaks
  const cleanupSourceUrl = useCallback(() => {
    if (sourceImage?.previewUrl) {
      URL.revokeObjectURL(sourceImage.previewUrl);
    }
  }, [sourceImage]);

  const cleanupCompressedUrl = useCallback(() => {
    if (compressedResult?.previewUrl) {
      URL.revokeObjectURL(compressedResult.previewUrl);
    }
  }, [compressedResult]);

  useEffect(() => {
    return () => {
      cleanupSourceUrl();
      cleanupCompressedUrl();
    };
  }, [cleanupSourceUrl, cleanupCompressedUrl]);

  // Determine effective MIME type
  const getEffectiveMimeType = useCallback((): string => {
    if (!sourceImage) return 'image/jpeg';
    if (outputFormat === 'original') {
      // If original is PNG, JPEG or WebP, use it. Otherwise fallback to JPEG
      if (['image/jpeg', 'image/png', 'image/webp'].includes(sourceImage.type)) {
        return sourceImage.type;
      }
      return 'image/jpeg';
    }
    return outputFormat;
  }, [sourceImage, outputFormat]);

  // Execute compression using Canvas API
  const performCompression = useCallback(
    async (imgElement: HTMLImageElement, originalSize: number) => {
      setIsCompressing(true);
      setErrorMessage(null);

      try {
        const mimeType = getEffectiveMimeType();
        const canvas = document.createElement('canvas');
        const width = imgElement.naturalWidth;
        const height = imgElement.naturalHeight;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('Unable to initialize canvas 2D rendering context.');
        }

        // If target is JPEG, draw white background first to avoid black artifacts on transparent images
        if (mimeType === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
        }

        ctx.drawImage(imgElement, 0, 0, width, height);

        // Quality parameter: 0.01 to 1.0. PNG ignores quality in browser toBlob specs
        const qualityParam = quality / 100;

        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            resultBlob => {
              if (resultBlob) {
                resolve(resultBlob);
              } else {
                reject(new Error('Canvas failed to export image blob.'));
              }
            },
            mimeType,
            qualityParam
          );
        });

        const newPreviewUrl = URL.createObjectURL(blob);
        const compressedSize = blob.size;
        const diff = originalSize - compressedSize;
        const reductionPct = Math.round((diff / originalSize) * 100);
        const isLarger = compressedSize > originalSize;

        // Cleanup old compressed preview URL
        if (compressedResult?.previewUrl) {
          URL.revokeObjectURL(compressedResult.previewUrl);
        }

        setCompressedResult({
          blob,
          size: compressedSize,
          previewUrl: newPreviewUrl,
          mimeType,
          reductionPercentage: reductionPct,
          isLarger
        });
      } catch (err: unknown) {
        console.error('Compression error:', err);
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during compression.'
        );
      } finally {
        setIsCompressing(false);
      }
    },
    [getEffectiveMimeType, quality, compressedResult]
  );

  // Trigger compression whenever quality or format changes
  useEffect(() => {
    if (loadedImageRef.current && sourceImage) {
      const timer = setTimeout(() => {
        performCompression(loadedImageRef.current!, sourceImage.size);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [quality, outputFormat, sourceImage, performCompression]);

  // Handle uploaded file
  const handleFile = (file: File) => {
    setErrorMessage(null);

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const isExtensionValid = /\.(jpe?g|png|webp)$/i.test(file.name);

    if (!validTypes.includes(file.type) && !isExtensionValid) {
      setErrorMessage('Please select a valid image file (JPG, PNG, or WebP).');
      return;
    }

    // Revoke previous URLs
    cleanupSourceUrl();
    cleanupCompressedUrl();
    setCompressedResult(null);

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      loadedImageRef.current = img;
      const metadata: ImageMetadata = {
        file,
        name: file.name,
        size: file.size,
        type: file.type || 'image/jpeg',
        width: img.naturalWidth,
        height: img.naturalHeight,
        previewUrl: objectUrl
      };
      setSourceImage(metadata);
      performCompression(img, file.size);
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
    cleanupCompressedUrl();
    setSourceImage(null);
    setCompressedResult(null);
    setErrorMessage(null);
    setQuality(75);
    setOutputFormat('original');
    loadedImageRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDownload = () => {
    if (!compressedResult || !sourceImage) return;

    // Determine download filename extension
    let ext = 'jpg';
    if (compressedResult.mimeType === 'image/png') ext = 'png';
    else if (compressedResult.mimeType === 'image/webp') ext = 'webp';

    const baseName = sourceImage.name.replace(/\.[^/.]+$/, '');
    const fileName = `${baseName}-compressed.${ext}`;

    downloadFile(compressedResult.blob, fileName);
  };

  const effectiveMime = getEffectiveMimeType();
  const isPngOutput = effectiveMime === 'image/png';

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <PageMeta
        title="Image Compressor - FastPDFx"
        description="Compress JPEG, PNG, and WebP images in your browser with real-time preview and quality control."
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
            Image Compressor
          </h1>
          <p className="text-xs text-[#77766F] mt-1">
            Reduce image file size with real-time compression quality control. Runs entirely in your browser memory.
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

      {/* Compressor Workspace (When Image is Loaded) */}
      {sourceImage && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Image Previews */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-4 space-y-3">
              {/* Preview Header & View Mode Switcher */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#F5F3ED] text-xs">
                <div className="flex items-center gap-2">
                  <FileImage className="w-4 h-4 text-[#68735B]" />
                  <span className="font-semibold text-[#20201D] truncate max-w-[200px] sm:max-w-xs">
                    {sourceImage.name}
                  </span>
                </div>

                <div className="flex items-center gap-1 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => setViewMode('compressed')}
                    className={`px-2 py-0.5 rounded-[2px] border transition-colors ${
                      viewMode === 'compressed'
                        ? 'bg-[#20201D] text-[#F5F3ED] border-[#20201D]'
                        : 'bg-white text-[#77766F] border-[#DEDCD3] hover:border-[#20201D]'
                    }`}
                  >
                    Compressed
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('original')}
                    className={`px-2 py-0.5 rounded-[2px] border transition-colors ${
                      viewMode === 'original'
                        ? 'bg-[#20201D] text-[#F5F3ED] border-[#20201D]'
                        : 'bg-white text-[#77766F] border-[#DEDCD3] hover:border-[#20201D]'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('split')}
                    className={`hidden sm:inline-block px-2 py-0.5 rounded-[2px] border transition-colors ${
                      viewMode === 'split'
                        ? 'bg-[#20201D] text-[#F5F3ED] border-[#20201D]'
                        : 'bg-white text-[#77766F] border-[#DEDCD3] hover:border-[#20201D]'
                    }`}
                  >
                    Side-by-Side
                  </button>
                </div>
              </div>

              {/* Preview Canvas Container */}
              <div className="relative min-h-[300px] max-h-[460px] bg-[#171715] flex items-center justify-center p-3 rounded-[2px] overflow-hidden">
                {isCompressing && (
                  <div className="absolute inset-0 bg-[#20201D]/75 backdrop-blur-2xs flex flex-col items-center justify-center text-white z-10 font-mono text-xs gap-2">
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Compressing image...</span>
                  </div>
                )}

                {viewMode === 'split' ? (
                  <div className="w-full h-full grid grid-cols-2 gap-2 text-center">
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <span className="text-[10px] font-mono text-[#A6A49B] uppercase">
                        Original ({formatBytes(sourceImage.size)})
                      </span>
                      <img
                        src={sourceImage.previewUrl}
                        alt="Original"
                        className="max-h-[360px] max-w-full object-contain border border-[#2F2F2B]"
                      />
                    </div>
                    <div className="flex flex-col items-center justify-center space-y-1">
                      <span className="text-[10px] font-mono text-[#A6A49B] uppercase">
                        Compressed ({compressedResult ? formatBytes(compressedResult.size) : '...'})
                      </span>
                      {compressedResult && (
                        <img
                          src={compressedResult.previewUrl}
                          alt="Compressed"
                          className="max-h-[360px] max-w-full object-contain border border-[#2F2F2B]"
                        />
                      )}
                    </div>
                  </div>
                ) : viewMode === 'original' ? (
                  <img
                    src={sourceImage.previewUrl}
                    alt="Original Preview"
                    className="max-h-[400px] max-w-full object-contain"
                  />
                ) : (
                  compressedResult && (
                    <img
                      src={compressedResult.previewUrl}
                      alt="Compressed Preview"
                      className="max-h-[400px] max-w-full object-contain"
                    />
                  )
                )}
              </div>

              {/* Dimensions and Metadata Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] font-mono text-[#77766F]">
                <div>
                  Dimensions:{' '}
                  <span className="text-[#20201D] font-semibold">
                    {sourceImage.width} × {sourceImage.height} px
                  </span>
                </div>
                <div>
                  Format:{' '}
                  <span className="text-[#20201D] font-semibold uppercase">
                    {sourceImage.type.replace('image/', '')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Compression Controls & Metrics */}
          <div className="space-y-4">
            {/* Control Panel Card */}
            <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 space-y-5">
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
                  <Sliders className="w-3.5 h-3.5 text-[#68735B]" />
                  Compression Settings
                </h3>
              </div>

              {/* Quality Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor="quality-slider" className="font-medium text-[#20201D]">
                    Quality Level
                  </label>
                  <span className="font-mono font-bold text-sm text-[#20201D]">
                    {quality}%
                  </span>
                </div>

                <input
                  id="quality-slider"
                  type="range"
                  min="5"
                  max="100"
                  step="1"
                  disabled={isPngOutput}
                  value={quality}
                  onChange={e => setQuality(Number(e.target.value))}
                  className="w-full h-1.5 bg-[#F5F3ED] rounded-[2px] appearance-none cursor-pointer accent-[#20201D] disabled:opacity-40 disabled:cursor-not-allowed"
                />

                {/* Preset Buttons */}
                <div className="flex items-center justify-between gap-1 pt-1 font-mono text-[10px]">
                  <button
                    type="button"
                    disabled={isPngOutput}
                    onClick={() => setQuality(50)}
                    className="px-2 py-1 bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D] disabled:opacity-40"
                  >
                    Low (50%)
                  </button>
                  <button
                    type="button"
                    disabled={isPngOutput}
                    onClick={() => setQuality(75)}
                    className="px-2 py-1 bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D] disabled:opacity-40"
                  >
                    Balanced (75%)
                  </button>
                  <button
                    type="button"
                    disabled={isPngOutput}
                    onClick={() => setQuality(90)}
                    className="px-2 py-1 bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D] disabled:opacity-40"
                  >
                    High (90%)
                  </button>
                </div>

                {isPngOutput && (
                  <p className="text-[10px] text-[#77766F] font-mono leading-relaxed pt-1">
                    * PNG utilizes lossless DEFLATE encoding in browser engines. To adjust lossy compression quality, select JPEG or WebP.
                  </p>
                )}
              </div>

              {/* Output Format Selector */}
              <div className="space-y-2 pt-2 border-t border-[#F5F3ED]">
                <label className="block text-xs font-medium text-[#20201D]">
                  Target Format
                </label>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setOutputFormat('original')}
                    className={`px-2.5 py-1.5 rounded-[2px] border text-left transition-colors ${
                      outputFormat === 'original'
                        ? 'bg-[#20201D] text-[#F5F3ED] border-[#20201D]'
                        : 'bg-white text-[#20201D] border-[#DEDCD3] hover:border-[#20201D]'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutputFormat('image/jpeg')}
                    className={`px-2.5 py-1.5 rounded-[2px] border text-left transition-colors ${
                      outputFormat === 'image/jpeg'
                        ? 'bg-[#20201D] text-[#F5F3ED] border-[#20201D]'
                        : 'bg-white text-[#20201D] border-[#DEDCD3] hover:border-[#20201D]'
                    }`}
                  >
                    JPEG
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutputFormat('image/webp')}
                    className={`px-2.5 py-1.5 rounded-[2px] border text-left transition-colors ${
                      outputFormat === 'image/webp'
                        ? 'bg-[#20201D] text-[#F5F3ED] border-[#20201D]'
                        : 'bg-white text-[#20201D] border-[#DEDCD3] hover:border-[#20201D]'
                    }`}
                  >
                    WebP
                  </button>
                  <button
                    type="button"
                    onClick={() => setOutputFormat('image/png')}
                    className={`px-2.5 py-1.5 rounded-[2px] border text-left transition-colors ${
                      outputFormat === 'image/png'
                        ? 'bg-[#20201D] text-[#F5F3ED] border-[#20201D]'
                        : 'bg-white text-[#20201D] border-[#DEDCD3] hover:border-[#20201D]'
                    }`}
                  >
                    PNG
                  </button>
                </div>
              </div>
            </div>

            {/* Size Comparison & Download Card */}
            {compressedResult && (
              <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#20201D]">
                    Compression Results
                  </h3>
                </div>

                <div className="space-y-2 font-mono text-xs">
                  <div className="flex items-center justify-between pb-1 border-b border-[#F5F3ED]">
                    <span className="text-[#77766F]">Original Size:</span>
                    <span className="text-[#20201D] font-medium">
                      {formatBytes(sourceImage.size)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-1 border-b border-[#F5F3ED]">
                    <span className="text-[#77766F]">Compressed Size:</span>
                    <span className="text-[#20201D] font-bold">
                      {formatBytes(compressedResult.size)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[#77766F]">Size Difference:</span>
                    {compressedResult.isLarger ? (
                      <span className="text-[#A6A49B] font-bold">
                        +{Math.abs(compressedResult.reductionPercentage)}% (Larger)
                      </span>
                    ) : (
                      <span className="text-[#68735B] font-bold">
                        -{compressedResult.reductionPercentage}% (Saved{' '}
                        {formatBytes(sourceImage.size - compressedResult.size)})
                      </span>
                    )}
                  </div>
                </div>

                {compressedResult.isLarger && (
                  <div className="p-2.5 bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] text-[11px] text-[#77766F] leading-relaxed">
                    <strong>Note:</strong> Re-encoding produced a larger output because the source image was already heavily optimized. Try lowering the quality level or selecting WebP format.
                  </div>
                )}

                {/* Primary Download Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#20201D] text-[#F5F3ED] text-xs font-semibold rounded-[2px] hover:bg-[#33322E] transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Compressed Image</span>
                  </button>
                  <p className="mt-1.5 text-[10px] font-mono text-center text-[#77766F]">
                    No server storage · Saved straight to your device
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Educational & Privacy Explanations */}
      <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5 sm:p-6 space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-[#68735B]" />
          How In-Browser Image Compression Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#77766F] leading-relaxed">
          <div>
            <strong className="text-[#20201D] block mb-1">Canvas Pixel Rasterization</strong>
            Your image bytes are read into an in-memory HTML5 Canvas element. The browser decodes the compressed bitstream into raw pixel coordinates without network transfers.
          </div>
          <div>
            <strong className="text-[#20201D] block mb-1">Lossy & Lossless Encoders</strong>
            The canvas exports binary chunks via `toBlob` using the browser’s native JPEG/WebP quantization tables, stripping unnecessary EXIF data and reducing high-frequency noise.
          </div>
          <div>
            <strong className="text-[#20201D] block mb-1">Guaranteed Privacy</strong>
            Because the binary blob is generated directly on your local CPU and GPU, your photos never touch any remote API or third-party web server.
          </div>
        </div>
      </div>
    </div>
  );
};
