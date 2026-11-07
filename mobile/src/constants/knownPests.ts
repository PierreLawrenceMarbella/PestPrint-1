import type { KnownPestId } from '../types/pestResult';

type PestEducation = {
  name: string;
  description: string;
  characteristics: readonly string[];
};

export const knownPests: Record<KnownPestId, PestEducation> = {
  rice_leaffolder: {
    name: 'Rice Leaffolder',
    description: 'Rice leaffolder damage is associated with folded leaves and scraping of leaf tissue.',
    characteristics: [
      'Folded leaves',
      'Scraped/window-pane appearance',
      'White patches on leaf surface',
    ],
  },
  rice_stem_borer: {
    name: 'Stem Borer',
    description: 'Stem borer damage is associated with dead hearts, whiteheads, and boring damage in rice stems.',
    characteristics: [
      'Dead hearts',
      'Whiteheads',
      'Stem boring damage',
    ],
  },
};
