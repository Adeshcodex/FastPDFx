import React from 'react';
import { Link } from 'react-router-dom';
import { Menu, Search } from 'lucide-react';

interface HeaderProps {
  onToggleSidebar: () => void;
  onFocusSearch?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, onFocusSearch }) => {
  return (
    <header className="lg:hidden sticky top-0 z-30 w-full bg-[#20201D] text-[#F5F3ED] border-b border-[#2F2F2B] px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-1.5 text-[#C5C3BA] hover:text-[#F5F3ED] rounded-[2px] hover:bg-white/5 focus:outline-none"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        <Link to="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[2px] bg-[#F5F3ED] text-[#20201D] font-mono font-bold text-xs flex items-center justify-center">
            FX
          </div>
          <span className="text-sm font-semibold tracking-tight text-[#F5F3ED]">
            FastPDFx
          </span>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onFocusSearch}
          className="p-1.5 text-[#C5C3BA] hover:text-[#F5F3ED] rounded-[2px] hover:bg-white/5"
          aria-label="Search tools"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
