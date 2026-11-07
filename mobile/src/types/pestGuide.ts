import type { ImageSourcePropType } from 'react-native';

import type { SupportedCategory } from './pest';

export type GuideCategoryId = 'stem-borer' | 'rice-leaffolder' | 'healthy-rice' | 'unknown-damage';

export type GuideCategory = SupportedCategory & {
  id: GuideCategoryId;
  image: ImageSourcePropType;
  overview: string;
  characteristics: readonly string[];
  observation: string;
  caution: string;
};
