/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { ScrollToTop } from './components/ScrollToTop';
import { HomePage } from './pages/HomePage';
import { ToolDetailPage } from './pages/ToolDetailPage';
import { ImageCompressorPage } from './pages/tools/ImageCompressorPage';
import { ImageResizerPage } from './pages/tools/ImageResizerPage';
import { ImageConverterPage } from './pages/tools/ImageConverterPage';
import { MergePdfPage } from './pages/tools/MergePdfPage';
import { JpgToPdfPage } from './pages/tools/JpgToPdfPage';
import { SplitPdfPage } from './pages/tools/SplitPdfPage';
import { CompressPdfPage } from './pages/tools/CompressPdfPage';
import { PdfToWordPage } from './pages/tools/PdfToWordPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { TermsPage } from './pages/TermsPage';

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Keyboard shortcut listener for Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (location.pathname !== '/') {
          navigate('/');
        }
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [location.pathname, navigate]);

  const handleFocusSearch = () => {
    if (location.pathname !== '/') {
      navigate('/');
    }
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }, 50);
  };

  return (
    <div className="min-h-screen bg-[#F5F3ED] text-[#20201D] flex flex-col font-sans antialiased selection:bg-[#20201D] selection:text-[#F5F3ED]">
      <ScrollToTop />

      {/* Dark Navy Sidebar (Desktop fixed, Mobile drawer) */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onFocusSearch={handleFocusSearch}
      />

      {/* Main Workspace (Offset by sidebar width on desktop) */}
      <div className="flex-1 flex flex-col lg:pl-64 transition-all duration-300">
        {/* Mobile Header */}
        <Header
          onToggleSidebar={() => setSidebarOpen(true)}
          onFocusSearch={handleFocusSearch}
        />

        {/* Workspace Canvas */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <Routes>
            <Route path="/" element={<HomePage searchInputRef={searchInputRef} />} />
            <Route path="/tool/merge-pdf" element={<MergePdfPage />} />
            <Route path="/tool/jpg-to-pdf" element={<JpgToPdfPage />} />
            <Route path="/tool/split-pdf" element={<SplitPdfPage />} />
            <Route path="/tool/pdf-compressor" element={<CompressPdfPage />} />
            <Route path="/tool/compress-pdf" element={<Navigate to="/tool/pdf-compressor" replace />} />
            <Route path="/tool/pdf-to-word" element={<PdfToWordPage />} />
            <Route path="/tool/pdf-to-docx" element={<Navigate to="/tool/pdf-to-word" replace />} />
            <Route path="/tool/image-compressor" element={<ImageCompressorPage />} />
            <Route path="/tool/image-resizer" element={<ImageResizerPage />} />
            <Route path="/tool/image-converter" element={<ImageConverterPage />} />
            <Route path="/tool/:slug" element={<ToolDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Footer inside workspace container */}
          <Footer />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  );
}
