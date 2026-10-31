export type ToolCategory = 'PDF Tools' | 'Image Tools';

export interface ToolItem {
  id: string;
  name: string;
  slug: string;
  category: ToolCategory;
  shortDescription: string;
  fullDescription: string;
  iconName: string;
  badge?: string;
  status: 'planned' | 'in_development' | 'ready';
  popular?: boolean;
  features: string[];
}
