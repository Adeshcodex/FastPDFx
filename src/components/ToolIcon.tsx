import React from 'react';
import {
  Minimize2,
  Maximize2,
  RefreshCw,
  Layers,
  FileImage,
  Scissors,
  FileArchive,
  FileText,
  Sparkles,
  LucideProps
} from 'lucide-react';

interface ToolIconProps extends LucideProps {
  name: string;
}

export const ToolIcon: React.FC<ToolIconProps> = ({ name, ...props }) => {
  switch (name) {
    case 'Minimize2':
      return <Minimize2 {...props} />;
    case 'Maximize2':
      return <Maximize2 {...props} />;
    case 'RefreshCw':
      return <RefreshCw {...props} />;
    case 'Layers':
      return <Layers {...props} />;
    case 'FileImage':
      return <FileImage {...props} />;
    case 'Scissors':
      return <Scissors {...props} />;
    case 'FileArchive':
      return <FileArchive {...props} />;
    case 'FileText':
      return <FileText {...props} />;
    default:
      return <Sparkles {...props} />;
  }
};
