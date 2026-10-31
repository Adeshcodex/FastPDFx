import React from 'react';
import { FileText, AlertTriangle, Scale, Shield } from 'lucide-react';
import { PageMeta } from '../components/PageMeta';

export const TermsPage: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <PageMeta
        title="Terms of Service - FastPDFx"
        description="Review the terms and conditions for utilizing FastPDFx online PDF and image tools."
      />

      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#68735B] uppercase mb-2">
          TERMS & CONDITIONS
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#20201D] tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-1 text-xs font-mono text-[#77766F]">
          Last Updated: October 2026
        </p>
      </div>

      <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-6 sm:p-8 space-y-7 text-[#77766F] text-xs sm:text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#68735B]" />
            1. Acceptance
          </h2>
          <p>
            By accessing and utilizing FastPDFx ("the Service"), you agree to be bound by these Terms of Service. If you disagree with any portion of these terms, you should discontinue use of the tools.
          </p>
        </section>

        <section className="space-y-2 pt-5 border-t border-[#DEDCD3]">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#68735B]" />
            2. Permitted Use & Full Ownership
          </h2>
          <p>
            FastPDFx grants you a non-exclusive license to use our web-based tools for personal, academic, and lawful commercial workflows.
          </p>
          <p>
            <strong>You retain 100% intellectual property ownership</strong> over all files, images, documents, and data processed through FastPDFx. Because processing is executed in your browser memory, FastPDFx asserts no ownership claims over your work.
          </p>
        </section>

        <section className="space-y-2 pt-5 border-t border-[#DEDCD3]">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#68735B]" />
            3. Prohibited Usage
          </h2>
          <p>
            You agree not to use the tools to execute malicious software, intentionally bypass network protections, or disrupt CDN distribution.
          </p>
        </section>

        <section className="space-y-2 pt-5 border-t border-[#DEDCD3]">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#68735B]" />
            4. Warranty Disclaimer
          </h2>
          <p>
            The tools and services on FastPDFx are provided on an <strong>"as-is" and "as-available"</strong> basis without warranties of any kind. Users are advised to retain backup copies of critical documents prior to batch processing or conversions.
          </p>
        </section>

        <section className="space-y-2 pt-5 border-t border-[#DEDCD3]">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D]">
            5. Inquiries
          </h2>
          <p>
            Questions regarding these Terms may be directed to{' '}
            <a href="mailto:contact@fastpdfx.com" className="text-[#20201D] underline hover:text-[#68735B]">
              contact@fastpdfx.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
};
