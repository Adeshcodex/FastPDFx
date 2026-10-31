import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Grid,
  FileText,
  Image as ImageIcon,
  Info,
  Mail,
  Shield,
  FileCode,
  Search,
  X,
  Command
} from 'lucide-react';
import { TOOLS } from '../data/tools';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onFocusSearch?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onFocusSearch }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarSearch, setSidebarSearch] = useState('');

  const pdfCount = TOOLS.filter(t => t.category === 'PDF Tools').length;
  const imageCount = TOOLS.filter(t => t.category === 'Image Tools').length;
  const totalCount = TOOLS.length;

  const handleSidebarSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sidebarSearch.trim()) {
      navigate(`/?q=${encodeURIComponent(sidebarSearch.trim())}`);
      onClose();
    } else {
      navigate('/');
      onClose();
    }
  };

  const isCurrent = (path: string, searchParam?: string) => {
    if (searchParam) {
      return location.pathname === '/' && location.search.includes(searchParam);
    }
    return location.pathname === path && !location.search;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#20201D] text-[#F5F3ED] flex flex-col border-r border-[#2F2F2B] transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#2F2F2B]">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center gap-2.5 group focus:outline-none"
          >
            {/* Minimalist Monochrome Logo Mark */}
            <div className="w-7 h-7 rounded-[2px] bg-[#F5F3ED] text-[#20201D] font-mono font-bold text-xs flex items-center justify-center tracking-tighter">
              FX
            </div>

            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-[#F5F3ED]">
                FastPDFx
              </span>
              <span className="text-[10px] text-[#A6A49B] tracking-wider uppercase">
                PDF & Image Tools
              </span>
            </div>
          </Link>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="lg:hidden p-1 text-[#A6A49B] hover:text-[#F5F3ED] rounded-[2px] hover:bg-white/5"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Search inside Sidebar */}
        <div className="px-4 pt-4 pb-2">
          <form onSubmit={handleSidebarSearchSubmit} className="relative">
            <Search className="w-3.5 h-3.5 text-[#A6A49B] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Search tools..."
              className="w-full pl-8.5 pr-8 py-1.5 bg-[#171715] text-[#F5F3ED] text-xs rounded-[2px] border border-[#2F2F2B] placeholder-[#77766F] focus:outline-none focus:border-[#68735B] transition-colors"
            />
            <button
              type="button"
              onClick={() => {
                if (onFocusSearch) {
                  onFocusSearch();
                  onClose();
                }
              }}
              title="Shortcut"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#A6A49B] bg-[#20201D] px-1 py-0.5 rounded-[2px] border border-[#2F2F2B] flex items-center gap-0.5 font-mono"
            >
              <Command className="w-2.5 h-2.5" /> K
            </button>
          </form>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-6 text-xs">
          {/* Main Links */}
          <div className="space-y-0.5">
            <Link
              to="/"
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2 rounded-[2px] font-medium transition-colors ${
                isCurrent('/')
                  ? 'bg-[#2F2F2B] text-[#F5F3ED] font-semibold'
                  : 'text-[#C5C3BA] hover:text-[#F5F3ED] hover:bg-[#2A2A26]'
              }`}
            >
              <Home className="w-4 h-4 text-[#A6A49B]" />
              <span>Home</span>
            </Link>

            <Link
              to="/?category=all"
              onClick={onClose}
              className={`flex items-center justify-between px-3 py-2 rounded-[2px] font-medium transition-colors ${
                isCurrent('/', 'category=all')
                  ? 'bg-[#2F2F2B] text-[#F5F3ED] font-semibold'
                  : 'text-[#C5C3BA] hover:text-[#F5F3ED] hover:bg-[#2A2A26]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Grid className="w-4 h-4 text-[#A6A49B]" />
                <span>All Tools</span>
              </div>
              <span className="text-[10px] font-mono text-[#A6A49B]">
                {totalCount}
              </span>
            </Link>
          </div>

          {/* Categories Section */}
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-wider text-[#77766F] uppercase">
              Categories
            </div>
            <div className="space-y-0.5">
              <Link
                to="/?category=PDF+Tools"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2 rounded-[2px] font-medium transition-colors ${
                  isCurrent('/', 'PDF+Tools')
                    ? 'bg-[#2F2F2B] text-[#F5F3ED] font-semibold'
                    : 'text-[#C5C3BA] hover:text-[#F5F3ED] hover:bg-[#2A2A26]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-[#A6A49B]" />
                  <span>PDF Tools</span>
                </div>
                <span className="text-[10px] font-mono text-[#A6A49B]">
                  {pdfCount}
                </span>
              </Link>

              <Link
                to="/?category=Image+Tools"
                onClick={onClose}
                className={`flex items-center justify-between px-3 py-2 rounded-[2px] font-medium transition-colors ${
                  isCurrent('/', 'Image+Tools')
                    ? 'bg-[#2F2F2B] text-[#F5F3ED] font-semibold'
                    : 'text-[#C5C3BA] hover:text-[#F5F3ED] hover:bg-[#2A2A26]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-4 h-4 text-[#A6A49B]" />
                  <span>Image Tools</span>
                </div>
                <span className="text-[10px] font-mono text-[#A6A49B]">
                  {imageCount}
                </span>
              </Link>
            </div>
          </div>

          {/* Information Section */}
          <div>
            <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-wider text-[#77766F] uppercase">
              Information
            </div>
            <div className="space-y-0.5">
              <Link
                to="/about"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-[2px] font-medium transition-colors ${
                  isCurrent('/about')
                    ? 'bg-[#2F2F2B] text-[#F5F3ED] font-semibold'
                    : 'text-[#C5C3BA] hover:text-[#F5F3ED] hover:bg-[#2A2A26]'
                }`}
              >
                <Info className="w-4 h-4 text-[#A6A49B]" />
                <span>About</span>
              </Link>

              <Link
                to="/contact"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-[2px] font-medium transition-colors ${
                  isCurrent('/contact')
                    ? 'bg-[#2F2F2B] text-[#F5F3ED] font-semibold'
                    : 'text-[#C5C3BA] hover:text-[#F5F3ED] hover:bg-[#2A2A26]'
                }`}
              >
                <Mail className="w-4 h-4 text-[#A6A49B]" />
                <span>Contact</span>
              </Link>

              <Link
                to="/privacy-policy"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-[2px] font-medium transition-colors ${
                  isCurrent('/privacy-policy')
                    ? 'bg-[#2F2F2B] text-[#F5F3ED] font-semibold'
                    : 'text-[#C5C3BA] hover:text-[#F5F3ED] hover:bg-[#2A2A26]'
                }`}
              >
                <Shield className="w-4 h-4 text-[#A6A49B]" />
                <span>Privacy Policy</span>
              </Link>

              <Link
                to="/terms"
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-[2px] font-medium transition-colors ${
                  isCurrent('/terms')
                    ? 'bg-[#2F2F2B] text-[#F5F3ED] font-semibold'
                    : 'text-[#C5C3BA] hover:text-[#F5F3ED] hover:bg-[#2A2A26]'
                }`}
              >
                <FileCode className="w-4 h-4 text-[#A6A49B]" />
                <span>Terms of Service</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Minimal Footer Tag */}
        <div className="p-4 border-t border-[#2F2F2B] text-[11px] text-[#A6A49B] font-mono">
          <span>Client-side execution</span>
        </div>
      </aside>
    </>
  );
};
