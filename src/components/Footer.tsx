import React from 'react';
import { Link } from 'react-router-dom';
import { TOOLS } from '../data/tools';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const pdfTools = TOOLS.filter(t => t.category === 'PDF Tools');
  const imageTools = TOOLS.filter(t => t.category === 'Image Tools');

  return (
    <footer className="mt-24 pt-12 pb-10 border-t border-[#DEDCD3] text-[#77766F] text-xs">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
        {/* Brand Column */}
        <div className="space-y-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-[2px] bg-[#20201D] text-[#F5F3ED] font-mono font-bold text-xs flex items-center justify-center">
              FX
            </div>
            <span className="text-sm font-semibold tracking-tight text-[#20201D]">
              FastPDFx
            </span>
          </Link>
          <p className="text-xs leading-relaxed max-w-xs text-[#77766F]">
            Simple, reliable in-browser tools for managing PDF documents and images.
          </p>
          <div className="text-[11px] font-mono text-[#68735B] pt-1">
            Browser memory execution
          </div>
        </div>

        {/* PDF Tools Column */}
        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#20201D] font-semibold mb-3">
            PDF Tools ({pdfTools.length})
          </h4>
          <ul className="space-y-2">
            {pdfTools.map(tool => (
              <li key={tool.id}>
                <Link
                  to={`/tool/${tool.slug}`}
                  className="hover:text-[#20201D] transition-colors"
                >
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Image Tools Column */}
        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#20201D] font-semibold mb-3">
            Image Tools ({imageTools.length})
          </h4>
          <ul className="space-y-2">
            {imageTools.map(tool => (
              <li key={tool.id}>
                <Link
                  to={`/tool/${tool.slug}`}
                  className="hover:text-[#20201D] transition-colors"
                >
                  {tool.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Information & Legal */}
        <div>
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-[#20201D] font-semibold mb-3">
            Information
          </h4>
          <ul className="space-y-2">
            <li>
              <Link to="/about" className="hover:text-[#20201D] transition-colors">
                About
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-[#20201D] transition-colors">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/privacy-policy" className="hover:text-[#20201D] transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/terms" className="hover:text-[#20201D] transition-colors">
                Terms of Service
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="pt-6 border-t border-[#DEDCD3] flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-[#A6A49B]">
        <p>© {currentYear} FastPDFx. All 8 tools operate locally.</p>
        <p>Swiss Minimalist Architecture</p>
      </div>
    </footer>
  );
};
