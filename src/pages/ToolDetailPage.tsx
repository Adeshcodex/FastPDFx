import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock, Check, Shield, AlertCircle, Sparkles } from 'lucide-react';
import { TOOLS } from '../data/tools';
import { ToolIcon } from '../components/ToolIcon';
import { PageMeta } from '../components/PageMeta';

export const ToolDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const tool = TOOLS.find(t => t.slug === slug);

  if (!tool) {
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <PageMeta title="Tool Not Found" description="The requested tool could not be found." />
        <h1 className="text-xl font-semibold text-[#20201D]">Tool Not Found</h1>
        <p className="mt-2 text-xs text-[#77766F]">The tool does not exist in our directory.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#20201D] text-[#F5F3ED] rounded-[2px] text-xs font-medium hover:bg-[#33322E] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Directory
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <PageMeta
        title={`${tool.name} - FastPDFx`}
        description={tool.shortDescription}
      />

      {/* Breadcrumb Back Link */}
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono text-[#77766F] hover:text-[#20201D] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Directory
        </Link>
      </div>

      {/* Main Tool Card */}
      <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#DEDCD3]">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center shrink-0 border border-[#DEDCD3]">
              <ToolIcon name={tool.iconName} className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#68735B] font-semibold">
                {tool.category}
              </span>
              <h1 className="text-xl sm:text-2xl font-semibold text-[#20201D] tracking-tight mt-0.5">
                {tool.name}
              </h1>
            </div>
          </div>

          <div className="flex items-center">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[2px] text-[11px] font-mono bg-[#F5F3ED] text-[#20201D] border border-[#DEDCD3]">
              <Clock className="w-3 h-3 text-[#77766F]" />
              Coming Soon (Phase 3)
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#77766F] leading-relaxed">
          {tool.fullDescription}
        </p>

        <div className="bg-[#F5F3ED] border border-[#DEDCD3] rounded-[2px] p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-[#68735B] shrink-0 mt-0.5" />
          <div className="text-xs text-[#20201D] leading-relaxed">
            <strong className="font-semibold text-[#20201D]">Status: In Development</strong>
            <p className="mt-0.5 text-[#77766F]">
              In accordance with our design philosophy, we do not present non-working placeholder buttons. The functional processing engine for <strong>{tool.name}</strong> will be implemented in Phase 3.
            </p>
          </div>
        </div>
      </div>

      {/* Planned Capabilities & Standards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#20201D] font-semibold flex items-center gap-2 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[#68735B]" />
            Planned Capabilities
          </h2>
          <ul className="space-y-2">
            {tool.features.map((feat, index) => (
              <li key={index} className="flex items-start gap-2 text-xs text-[#77766F]">
                <Check className="w-3.5 h-3.5 text-[#68735B] shrink-0 mt-0.5" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-[2px] border border-[#DEDCD3] p-5">
          <h2 className="text-xs font-mono uppercase tracking-wider text-[#20201D] font-semibold flex items-center gap-2 mb-3">
            <Shield className="w-3.5 h-3.5 text-[#68735B]" />
            Standards
          </h2>
          <ul className="space-y-2 text-xs text-[#77766F]">
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#68735B] shrink-0 mt-0.5" />
              <span>In-browser execution utilizing native Web APIs.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#68735B] shrink-0 mt-0.5" />
              <span>Zero server document persistence or remote storage.</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-3.5 h-3.5 text-[#68735B] shrink-0 mt-0.5" />
              <span>Immediate local file export upon completion.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
