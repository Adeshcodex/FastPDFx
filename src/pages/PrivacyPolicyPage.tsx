import React from 'react';
import { Shield, Eye, Lock, FileText } from 'lucide-react';
import { PageMeta } from '../components/PageMeta';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-8">
      <PageMeta
        title="Privacy Policy - FastPDFx"
        description="Learn how FastPDFx handles file processing, user privacy, and data protection with browser-based architecture."
      />

      <div>
        <div className="text-[10px] font-mono tracking-widest text-[#68735B] uppercase mb-2">
          LEGAL & PRIVACY
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#20201D] tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-1 text-xs font-mono text-[#77766F]">
          Last Updated: October 2026
        </p>
      </div>

      <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-6 sm:p-8 space-y-7 text-[#77766F] text-xs sm:text-sm leading-relaxed">
        <section className="space-y-2">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#68735B]" />
            1. Overview & Architecture
          </h2>
          <p>
            At FastPDFx, user confidentiality is fundamental. We believe individuals should not have to surrender the privacy of their documents, contracts, or personal photographs to perform everyday file operations.
          </p>
          <p>
            Our architecture is built around <strong>client-side processing</strong>. File operations (including image resizing, compression, format conversion, and PDF merging) take place within your web browser’s local memory (RAM).
          </p>
        </section>

        <section className="space-y-2 pt-5 border-t border-[#DEDCD3]">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#68735B]" />
            2. Document & File Handling
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-[#77766F]">
            <li>
              <strong>No Server Storage:</strong> Files selected or dropped into tools are loaded into browser RAM via HTML5 File APIs. They are never transmitted to or archived on remote FastPDFx databases.
            </li>
            <li>
              <strong>Local Synthesis:</strong> Converted and compressed files are assembled directly in your browser memory and saved to your device.
            </li>
            <li>
              <strong>Immediate Disposal:</strong> Reloading or closing the tab causes your browser to purge temporary memory automatically.
            </li>
          </ul>
        </section>

        <section className="space-y-2 pt-5 border-t border-[#DEDCD3]">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#68735B]" />
            3. Information We Do Not Collect
          </h2>
          <ul className="list-disc pl-5 space-y-1 text-[#77766F]">
            <li>No account registrations, emails, or personal identification records.</li>
            <li>No inspection, indexing, or logging of file contents or metadata.</li>
            <li>No selling or sharing of user files with third-party data brokers.</li>
          </ul>
        </section>

        <section className="space-y-2 pt-5 border-t border-[#DEDCD3]">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D] flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#68735B]" />
            4. Hosting & Infrastructure
          </h2>
          <p>
            FastPDFx is hosted as a static web application on global content distribution networks (such as Cloudflare Pages). Standard server logs (e.g. IP address, timestamp, browser type) are handled strictly by infrastructure providers for network stability, DDoS mitigation, and routing.
          </p>
        </section>

        <section className="space-y-2 pt-5 border-t border-[#DEDCD3]">
          <h2 className="text-sm font-mono uppercase tracking-wider font-semibold text-[#20201D]">
            5. Inquiries
          </h2>
          <p>
            For questions regarding our privacy architecture, write to{' '}
            <a href="mailto:contact@fastpdfx.com" className="text-[#20201D] underline hover:text-[#68735B]">
              contact@fastpdfx.com
            </a>.
          </p>
        </section>
      </div>
    </div>
  );
};
