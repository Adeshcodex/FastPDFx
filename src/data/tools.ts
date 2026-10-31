import { ToolItem } from '../types/tool';

export const TOOLS: ToolItem[] = [
  // PDF Tools (5)
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    slug: 'merge-pdf',
    category: 'PDF Tools',
    shortDescription: 'Combine multiple PDF files into one clean, well-organized document in seconds.',
    fullDescription: 'Select multiple PDF files, organize their sequence, and merge them into a single consolidated PDF document right inside your browser memory.',
    iconName: 'Layers',
    status: 'ready',
    popular: true,
    features: ['Drag-and-drop page ordering', 'Multi-document bundling', 'In-memory assembly', 'Retains original document resolution']
  },
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    slug: 'jpg-to-pdf',
    category: 'PDF Tools',
    shortDescription: 'Convert photos and images into standard printable PDF documents.',
    fullDescription: 'Transform single or multiple JPG and PNG images into a clean PDF document. Choose custom margins, page orientation (portrait or landscape), and paper size.',
    iconName: 'FileImage',
    status: 'ready',
    popular: true,
    features: ['Multi-image sequencing', 'Portrait & landscape layouts', 'Standard A4/Letter sizing', 'Configurable page margins']
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    slug: 'split-pdf',
    category: 'PDF Tools',
    shortDescription: 'Extract specific pages or custom page ranges from a PDF document.',
    fullDescription: 'Extract pages from multi-page PDFs by entering specific ranges (e.g., 1-3, 5, 8-10) or separate every page into individual single-page documents.',
    iconName: 'Scissors',
    status: 'ready',
    popular: true,
    features: ['Custom page range syntax', 'Extract single or bulk pages', 'Page preview layout', 'Instant download']
  },
  {
    id: 'pdf-compressor',
    name: 'PDF Compressor',
    slug: 'pdf-compressor',
    category: 'PDF Tools',
    shortDescription: 'Reduce PDF file size by optimizing embedded image streams and metadata.',
    fullDescription: 'Shrink hefty PDF documents without sacrificing critical legibility. Perfect for uploading files to portal forms, applications, or email attachments.',
    iconName: 'FileArchive',
    status: 'ready',
    popular: true,
    features: ['Embedded image optimization', 'Metadata stream cleaning', 'Preserves text searchability', 'Zero server uploads']
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word Converter',
    slug: 'pdf-to-word',
    category: 'PDF Tools',
    shortDescription: 'Extract text blocks and layout from PDF files into editable Word (.docx) documents.',
    fullDescription: 'Converts selectable text and layout from PDF pages into an editable Microsoft Word document directly in your browser without third-party server calls.',
    iconName: 'FileText',
    status: 'ready',
    popular: true,
    features: ['Reconstructs headings and paragraphs', 'Scanned page OCR with Tesseract.js', 'Generates standard .docx format', '100% private in-browser memory']
  },

  // Image Tools (3)
  {
    id: 'image-compressor',
    name: 'Image Compressor',
    slug: 'image-compressor',
    category: 'Image Tools',
    shortDescription: 'Reduce image file size with custom compression quality while preserving visual clarity.',
    fullDescription: 'Optimize JPEG, PNG, and WebP images directly in your browser. Fine-tune compression quality, compare previews side-by-side, and save storage space.',
    iconName: 'Minimize2',
    status: 'ready',
    popular: true,
    features: ['Custom quality slider (1-100%)', 'Side-by-side comparison', 'Batch compression support', 'Instant local download']
  },
  {
    id: 'image-resizer',
    name: 'Image Resizer',
    slug: 'image-resizer',
    category: 'Image Tools',
    shortDescription: 'Resize photos by exact pixel width and height or preset percentages with aspect ratio lock.',
    fullDescription: 'Quickly scale images for social media, websites, or profile pictures. Maintain original proportions or crop to standard dimensions.',
    iconName: 'Maximize2',
    status: 'ready',
    popular: false,
    features: ['Exact pixel or percentage resizing', 'Aspect ratio locking', 'Standard dimension presets', 'Fast canvas rendering']
  },
  {
    id: 'image-converter',
    name: 'Image Format Converter',
    slug: 'image-converter',
    category: 'Image Tools',
    shortDescription: 'Convert between 10 raster and vector formats: JPG, PNG, WebP, AVIF, BMP, GIF, TIFF, ICO, HEIC, and SVG.',
    fullDescription: 'Convert between 10 image formats in your browser with HEIC/HEIF decoding, TIFF processing, SVG sanitization, and batch ZIP export.',
    iconName: 'RefreshCw',
    status: 'ready',
    popular: false,
    features: ['10 format conversion pipeline', 'Client-side HEIC, TIFF & SVG decoding', 'Individual & batch ZIP export', 'Preserves transparency & alpha channels']
  }
];
