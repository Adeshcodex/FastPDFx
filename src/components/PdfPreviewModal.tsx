import React, { useEffect } from 'react';
import { PdfCanvasViewer, PdfViewerFile } from './PdfCanvasViewer';

interface PdfPreviewModalProps {
  file: PdfViewerFile;
  onClose: () => void;
  onDownload?: () => void;
}

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  file,
  onClose,
  onDownload
}) => {
  // Lock body scroll when modal is active
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${file.name}`}
    >
      <div className="bg-white border border-[#DEDCD3] rounded-[2px] w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        <PdfCanvasViewer
          file={file}
          inline={false}
          onClose={onClose}
          onDownload={onDownload}
        />
      </div>
    </div>
  );
};
