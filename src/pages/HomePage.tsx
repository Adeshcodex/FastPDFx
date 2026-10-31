import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Lock,
  Zap,
  UserX,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon
} from 'lucide-react';
import { TOOLS } from '../data/tools';
import { ToolCard } from '../components/ToolCard';
import { PageMeta } from '../components/PageMeta';

const CATEGORIES = [
  { label: 'All Tools', value: 'all' },
  { label: 'PDF Tools', value: 'PDF Tools' },
  { label: 'Image Tools', value: 'Image Tools' }
];

const FAQS = [
  {
    question: 'How does in-browser file processing work?',
    answer:
      'FastPDFx is built using modern Web APIs such as HTML5 Canvas, TypedArrays, and WebAssembly. Calculations and conversions execute locally inside your browser memory without transmitting your document contents to external storage servers.'
  },
  {
    question: 'Why do tool cards display "Coming Soon"?',
    answer:
      'We are currently in the foundation and architecture phase. Rather than showcasing non-working placeholder buttons or mock upload progress, all 8 tools are actively scheduled for functional engine roll-out in Phase 3.'
  },
  {
    question: 'Are there any usage limits or subscriptions?',
    answer:
      'No. FastPDFx tools are completely free for personal and commercial usage with no account creation, no credit card requirements, and no document watermarks.'
  },
  {
    question: 'Can I use these tools on my mobile phone or tablet?',
    answer:
      'Yes. The interface and upcoming file engines are fully responsive and engineered for touch-based mobile and desktop browsers.'
  },
  {
    question: 'What file formats are supported?',
    answer:
      'For PDF workflows, standard PDF documents and JPG/PNG images are supported. For Image tools, universal formats including JPEG, PNG, WebP, and BMP are supported.'
  }
];

interface HomePageProps {
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const HomePage: React.FC<HomePageProps> = ({ searchInputRef }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';
  const queryParam = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [activeCategory, setActiveCategory] = useState<string>(categoryParam);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const localSearchInputRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef || localSearchInputRef;

  // Sync category param from URL
  useEffect(() => {
    if (categoryParam) {
      setActiveCategory(categoryParam);
    }
  }, [categoryParam]);

  // Sync search param from URL
  useEffect(() => {
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, [queryParam]);

  const handleCategorySelect = (category: string) => {
    setActiveCategory(category);
    if (category === 'all') {
      searchParams.delete('category');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ category });
    }
  };

  // Filter tools based on search and category
  const filteredTools = useMemo(() => {
    return TOOLS.filter(tool => {
      const matchesCategory =
        activeCategory === 'all' || tool.category === activeCategory;

      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === '' ||
        tool.name.toLowerCase().includes(query) ||
        tool.shortDescription.toLowerCase().includes(query) ||
        tool.category.toLowerCase().includes(query) ||
        tool.features.some(f => f.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, activeCategory]);

  const popularTools = useMemo(() => {
    return TOOLS.filter(t => t.popular);
  }, []);

  const pdfTools = useMemo(() => {
    return TOOLS.filter(t => t.category === 'PDF Tools');
  }, []);

  const imageTools = useMemo(() => {
    return TOOLS.filter(t => t.category === 'Image Tools');
  }, []);

  const isBrowsingAll = activeCategory === 'all' && !searchQuery.trim();

  return (
    <div className="w-full max-w-5xl mx-auto space-y-20">
      <PageMeta
        title="FastPDFx - Professional PDF and Image Tools"
        description="Simple, reliable tools for managing PDFs and images directly in your browser."
      />

      {/* SECTION B: CENTERED HERO & SEARCH */}
      <section className="pt-6 pb-4 text-center">
        <div className="max-w-xl mx-auto">
          {/* Eyebrow */}
          <div className="text-[11px] font-mono tracking-widest text-[#68735B] uppercase mb-3">
            YOUR DIGITAL WORKSPACE
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl font-semibold text-[#20201D] tracking-tight leading-tight">
            Everything you need to work with files.
          </h1>

          {/* Description */}
          <p className="mt-3 text-sm text-[#77766F] leading-relaxed max-w-md mx-auto">
            Simple, reliable tools for managing PDFs and images.
          </p>

          {/* Centered Search Input with Sharp Corners */}
          <div className="mt-7 max-w-lg mx-auto">
            <div className="relative flex items-center">
              <Search className="w-4 h-4 text-[#77766F] absolute left-3.5 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tools (e.g. merge, compress, resize)..."
                className="w-full pl-10 pr-12 py-2.5 bg-white text-[#20201D] text-xs rounded-[2px] border border-[#DEDCD3] placeholder-[#77766F] focus:outline-none focus:border-[#20201D] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 text-[11px] font-mono text-[#77766F] hover:text-[#20201D]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* SECTION C: CATEGORY NAVIGATION (Sharp Buttons) */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.value;
              const count =
                cat.value === 'all'
                  ? TOOLS.length
                  : cat.value === 'PDF Tools'
                  ? pdfTools.length
                  : imageTools.length;

              return (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => handleCategorySelect(cat.value)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-[2px] text-xs transition-colors ${
                    isActive
                      ? 'bg-[#20201D] text-[#F5F3ED] font-medium'
                      : 'bg-white text-[#20201D] border border-[#DEDCD3] hover:border-[#20201D]'
                  }`}
                >
                  <span>{cat.label}</span>
                  <span
                    className={`text-[10px] font-mono ${
                      isActive ? 'text-[#C5C3BA]' : 'text-[#77766F]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* FILTERED RESULTS VIEW (When Searching or Filtering) */}
      {!isBrowsingAll && (
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#DEDCD3]">
            <div>
              <h2 className="text-sm font-semibold text-[#20201D]">
                {activeCategory === 'all' ? 'Filtered Tools' : activeCategory}
              </h2>
              {searchQuery && (
                <p className="text-xs text-[#77766F] mt-0.5">
                  Results matching "{searchQuery}"
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                handleCategorySelect('all');
              }}
              className="text-xs font-mono text-[#68735B] hover:underline"
            >
              Reset to all tools
            </button>
          </div>

          {filteredTools.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTools.map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-10 text-center max-w-sm mx-auto my-6">
              <Search className="w-6 h-6 text-[#77766F] mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-semibold text-[#20201D]">No tools found</h3>
              <p className="text-xs text-[#77766F] mt-1">
                No tools matching "{searchQuery}". Try "PDF", "Image", "Compress", or "Resize".
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  handleCategorySelect('all');
                }}
                className="mt-4 px-3 py-1.5 text-xs font-medium text-[#20201D] bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] hover:border-[#20201D]"
              >
                View all 8 tools
              </button>
            </div>
          )}
        </section>
      )}

      {/* DEFAULT HOMEPAGE SECTIONS */}
      {isBrowsingAll && (
        <>
          {/* SECTION D: POPULAR TOOLS */}
          <section className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-[#20201D] tracking-tight">
                Popular tools
              </h2>
              <p className="text-xs text-[#77766F] mt-0.5">
                Simple solutions for everyday file tasks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {popularTools.map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>

          {/* SECTION E: PDF TOOLS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DEDCD3]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#68735B]" />
                <div>
                  <h2 className="text-sm font-semibold text-[#20201D]">
                    PDF Tools
                  </h2>
                </div>
              </div>
              <span className="text-[11px] font-mono text-[#77766F]">
                5 tools
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pdfTools.map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>

          {/* SECTION F: IMAGE TOOLS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#DEDCD3]">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#68735B]" />
                <div>
                  <h2 className="text-sm font-semibold text-[#20201D]">
                    Image Tools
                  </h2>
                </div>
              </div>
              <span className="text-[11px] font-mono text-[#77766F]">
                3 tools
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {imageTools.map(tool => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>

          {/* SECTION G: WHY FASTPDFX */}
          <section className="text-center pt-8 border-t border-[#DEDCD3]">
            <div className="max-w-md mx-auto mb-8">
              <span className="text-[10px] font-mono tracking-widest text-[#68735B] uppercase">
                WHY FASTPDFX
              </span>
              <h2 className="text-xl font-semibold text-[#20201D] tracking-tight mt-1">
                Simple tools. Better workflow.
              </h2>
              <p className="mt-1.5 text-xs text-[#77766F] leading-relaxed">
                Engineered to handle file modifications without complex software or privacy risks.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              {/* Feature 1 */}
              <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
                <div className="w-8 h-8 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center mb-3 border border-[#DEDCD3]">
                  <Lock className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-xs text-[#20201D]">
                  Privacy-conscious processing
                </h3>
                <p className="mt-1.5 text-xs text-[#77766F] leading-relaxed">
                  Documents and photos are processed in your browser memory. We avoid archiving files on remote servers.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
                <div className="w-8 h-8 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center mb-3 border border-[#DEDCD3]">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-xs text-[#20201D]">
                  Simple and fast workflow
                </h3>
                <p className="mt-1.5 text-xs text-[#77766F] leading-relaxed">
                  No queue delays or external processing wait times. Operations run locally on your device hardware.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
                <div className="w-8 h-8 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center mb-3 border border-[#DEDCD3]">
                  <UserX className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-xs text-[#20201D]">
                  No unnecessary registration
                </h3>
                <p className="mt-1.5 text-xs text-[#77766F] leading-relaxed">
                  Access every tool immediately. No accounts, no email collections, and no paywalls.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION H: HOW IT WORKS */}
          <section className="text-center pt-4">
            <div className="max-w-md mx-auto mb-8">
              <span className="text-[10px] font-mono tracking-widest text-[#77766F] uppercase">
                PROCESS
              </span>
              <h2 className="text-xl font-semibold text-[#20201D] tracking-tight mt-1">
                How FastPDFx Works
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
                <span className="text-[10px] font-mono font-bold text-[#68735B] mb-2 block">
                  01
                </span>
                <h3 className="font-semibold text-xs text-[#20201D]">1. Choose your tool</h3>
                <p className="mt-1 text-xs text-[#77766F] leading-relaxed">
                  Select the required PDF or image tool from our directory.
                </p>
              </div>

              <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
                <span className="text-[10px] font-mono font-bold text-[#68735B] mb-2 block">
                  02
                </span>
                <h3 className="font-semibold text-xs text-[#20201D]">2. Upload your file</h3>
                <p className="mt-1 text-xs text-[#77766F] leading-relaxed">
                  Select your file locally to initiate in-browser processing.
                </p>
              </div>

              <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
                <span className="text-[10px] font-mono font-bold text-[#68735B] mb-2 block">
                  03
                </span>
                <h3 className="font-semibold text-xs text-[#20201D]">3. Download your result</h3>
                <p className="mt-1 text-xs text-[#77766F] leading-relaxed">
                  Save your modified document or image directly to your computer.
                </p>
              </div>
            </div>
          </section>

          {/* SECTION I: FAQS */}
          <section className="pt-4">
            <div className="text-center max-w-md mx-auto mb-8">
              <span className="text-[10px] font-mono tracking-widest text-[#77766F] uppercase">
                QUESTIONS
              </span>
              <h2 className="text-xl font-semibold text-[#20201D] tracking-tight mt-1">
                Frequently Asked Questions
              </h2>
            </div>

            <div className="max-w-2xl mx-auto space-y-2">
              {FAQS.map((faq, idx) => {
                const isExpanded = expandedFaq === idx;
                return (
                  <div
                    key={idx}
                    className="bg-white rounded-[2px] border border-[#DEDCD3] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                      className="w-full px-4 py-3.5 text-left flex items-center justify-between gap-4 font-medium text-xs sm:text-sm text-[#20201D] hover:text-[#68735B] transition-colors"
                      aria-expanded={isExpanded}
                    >
                      <span>{faq.question}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#77766F] shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#77766F] shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-3.5 pt-1 text-xs text-[#77766F] leading-relaxed border-t border-[#F5F3ED]">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
