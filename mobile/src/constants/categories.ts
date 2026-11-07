import type { SupportedCategory } from '../types/pest';

export const supportedCategories: readonly SupportedCategory[] = [
  {
    description: 'Rice plants with no visible signs of pest-related damage.',
    icon: 'leaf-outline',
    name: 'Healthy Rice',
    tone: 'green',
  },
  {
    description: 'Damage commonly seen on stems, including dead hearts or white heads.',
    icon: 'bug-outline',
    name: 'Stem Borer',
    tone: 'red',
  },
  {
    description: 'Folded leaves and scraped tissue that can leave pale patches.',
    icon: 'cut-outline',
    name: 'Rice Leaffolder',
    tone: 'red',
  },
  {
    description: 'Visible damage that does not match the supported pest categories.',
    icon: 'help-outline',
    name: 'Unknown (Other Damage)',
    tone: 'amber',
  },
] as const;
