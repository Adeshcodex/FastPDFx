import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { ToolItem } from '../types/tool';
import { ToolIcon } from './ToolIcon';

interface ToolCardProps {
  tool: ToolItem;
}

export const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  return (
    <Link
      to={`/tool/${tool.slug}`}
      className="group relative flex items-start gap-3.5 p-4.5 bg-white rounded-[2px] border border-[#DEDCD3] hover:border-[#20201D] transition-colors duration-150"
    >
      {/* Small Monochrome Icon Container */}
      <div className="w-10 h-10 rounded-[2px] bg-[#F5F3ED] text-[#20201D] flex items-center justify-center shrink-0 border border-[#DEDCD3] group-hover:bg-[#20201D] group-hover:text-[#F5F3ED] transition-colors duration-150">
        <ToolIcon name={tool.iconName} className="w-4.5 h-4.5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-sm text-[#20201D] group-hover:text-[#68735B] transition-colors truncate">
              {tool.name}
            </h3>
            <ArrowUpRight className="w-3.5 h-3.5 text-[#A6A49B] opacity-0 group-hover:opacity-100 group-hover:text-[#20201D] transition-opacity shrink-0" />
          </div>

          <p className="mt-1 text-xs text-[#77766F] line-clamp-2 leading-relaxed">
            {tool.shortDescription}
          </p>
        </div>

        {/* Clean Typographic Metadata */}
        <div className="mt-3 pt-2.5 border-t border-[#F5F3ED] flex items-center justify-between text-[10px] font-mono tracking-wider uppercase">
          <span className="text-[#68735B] font-semibold">
            {tool.category}
          </span>
          {tool.status === 'ready' ? (
            <span className="text-[#68735B] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#68735B]" />
              Active Tool
            </span>
          ) : (
            <span className="text-[#A6A49B]">
              Coming Soon
            </span>
          )}
        </div>
      </div>
    </Link>
  );
};
