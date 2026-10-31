import React from 'react';
import { Shield, Zap, Globe, Cpu, Check } from 'lucide-react';
import { PageMeta } from '../components/PageMeta';

export const AboutPage: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <PageMeta
        title="About - FastPDFx"
        description="Learn about FastPDFx, our commitment to browser-based client-side tools, and our philosophy."
      />

      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#68735B] uppercase mb-2">
          ABOUT FASTPDFX
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#20201D] tracking-tight">
          Reliable, private digital tools.
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-[#77766F] leading-relaxed max-w-xl">
          FastPDFx provides an uncluttered, privacy-focused collection of everyday document and image tools designed to process files locally.
        </p>
      </div>

      {/* Philosophy Card */}
      <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-6 sm:p-8 space-y-5">
        <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D]">
          Core Philosophy
        </h2>
        <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed">
          Most online conversion websites require users to upload sensitive files—such as financial statements, contracts, personal photos, and resumes—to remote servers. Users often face queue delays, intrusive advertisements, and unknown retention policies.
        </p>
        <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed">
          FastPDFx takes a direct approach: utilize modern browser standards (HTML5 Canvas, TypedArrays, WebAssembly, and client-side JavaScript) so that tasks run inside the user's local browser memory.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-[#DEDCD3]">
          <div className="p-4 rounded-[2px] bg-[#F5F3ED] border border-[#DEDCD3]">
            <div className="w-8 h-8 rounded-[2px] bg-white text-[#20201D] flex items-center justify-center mb-2.5 border border-[#DEDCD3]">
              <Shield className="w-4 h-4 text-[#68735B]" />
            </div>
            <h3 className="font-semibold text-xs text-[#20201D]">Privacy-Targeted</h3>
            <p className="text-[11px] text-[#77766F] mt-1">In-browser memory execution.</p>
          </div>

          <div className="p-4 rounded-[2px] bg-[#F5F3ED] border border-[#DEDCD3]">
            <div className="w-8 h-8 rounded-[2px] bg-white text-[#20201D] flex items-center justify-center mb-2.5 border border-[#DEDCD3]">
              <Zap className="w-4 h-4 text-[#68735B]" />
            </div>
            <h3 className="font-semibold text-xs text-[#20201D]">Instant Execution</h3>
            <p className="text-[11px] text-[#77766F] mt-1">No network queue bottleneck.</p>
          </div>

          <div className="p-4 rounded-[2px] bg-[#F5F3ED] border border-[#DEDCD3]">
            <div className="w-8 h-8 rounded-[2px] bg-white text-[#20201D] flex items-center justify-center mb-2.5 border border-[#DEDCD3]">
              <Globe className="w-4 h-4 text-[#68735B]" />
            </div>
            <h3 className="font-semibold text-xs text-[#20201D]">Free Access</h3>
            <p className="text-[11px] text-[#77766F] mt-1">No mandatory registrations.</p>
          </div>
        </div>
      </div>

      {/* Roadmap Card */}
      <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-6 sm:p-8">
        <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] mb-4">
          Development Roadmap
        </h2>

        <div className="space-y-3">
          <div className="flex items-start gap-3 p-4 rounded-[2px] bg-[#F5F3ED] border border-[#DEDCD3]">
            <Check className="w-4 h-4 text-[#68735B] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-[#20201D]">Phase 1 & 2: Architecture & Directory (Active)</h3>
              <p className="text-[11px] text-[#77766F] mt-0.5">
                Minimalist workspace layout, sidebar navigation, searchable tool directory, filter controls, and legal framework.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-[2px] bg-white border border-[#DEDCD3]">
            <Cpu className="w-4 h-4 text-[#77766F] shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs font-semibold text-[#20201D]">Phase 3: Tool Processing Engines (Next)</h3>
              <p className="text-[11px] text-[#77766F] mt-0.5">
                Implementation of client-side PDF merging, document splitting, PDF and image compression, and format conversions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
