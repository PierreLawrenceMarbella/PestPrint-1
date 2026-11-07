import type { GuideCategory } from '../types/pestGuide';
import { knownPests } from './knownPests';

/** Educational examples only. This catalog does not classify images. */
export const pestGuideCategories: readonly GuideCategory[] = [
  {
    id: 'stem-borer',
    name: knownPests.rice_stem_borer.name,
    icon: 'bug-outline',
    tone: 'red',
    image: require('../../assets/classes/stem-borer.jpg'),
    description: 'Larvae bore into rice stems, causing dead hearts, whiteheads, and stem damage.',
    overview: 'Stem-borer larvae feed inside rice stems. A drying central shoot is called a dead heart. Affected panicles may appear whitish and fail to fill with grain, a symptom called whiteheads.',
    characteristics: knownPests.rice_stem_borer.characteristics,
    observation: 'Include the affected central shoot, stem, or panicle in a clear photo. Keep nearby plant tissue visible to provide context.',
    caution: 'Similar symptoms can have other causes. These are typical signs, not confirmed findings in your crop.',
  },
  {
    id: 'rice-leaffolder',
    name: knownPests.rice_leaffolder.name,
    icon: 'cut-outline',
    tone: 'red',
    image: require('../../assets/classes/rice-leaffolder.jpg'),
    description: 'Larvae fold leaves and scrape green tissue, leaving pale patches on the surface.',
    overview: 'Rice leaffolder damage is associated with folded leaves and feeding on green leaf tissue. Scraping can leave a pale, window-pane appearance or white patches on the leaf surface.',
    characteristics: knownPests.rice_leaffolder.characteristics,
    observation: 'Photograph the folded leaf and visible feeding marks in clear, natural light. Keep the camera steady and avoid distant views.',
    caution: 'Damage patterns can support identification, but a photo alone does not establish the number of pests present or confirm every symptom.',
  },
  {
    id: 'healthy-rice',
    name: 'Healthy Rice',
    icon: 'leaf-outline',
    tone: 'green',
    image: require('../../assets/classes/healthy-rice.jpg'),
    description: 'Healthy-looking leaves and stems without obvious signs of the supported pest damage.',
    overview: 'Healthy Rice describes an appearance category. Leaves, stems, and grains may look normal for the crop, without obvious damage from the supported pest categories.',
    characteristics: ['Leaves appear intact without obvious feeding marks.', 'Stems and grains look normal for the growth stage.', 'No obvious damage associated with the supported pests.'],
    observation: 'Include leaves and stems in a well-lit photo. Continue observing the crop for new or persistent symptoms.',
    caution: 'A healthy-looking image does not guarantee that the crop is free of pests, diseases, or other problems.',
  },
  {
    id: 'unknown-damage',
    name: 'Unknown (Other Damage)',
    icon: 'help-outline',
    tone: 'amber',
    image: require('../../assets/classes/unknown-damage.jpg'),
    description: 'Unrecognized or unsupported damage that needs further assessment.',
    overview: 'Unknown (Other Damage) does not identify a specific cause. Damage may involve another pest, a disease, or a non-insect factor. Different causes can look similar in a single photo.',
    characteristics: ['The damage does not identify a supported pest.', 'Other causes are possibilities, not confirmed findings.', 'More crop observations may be needed.'],
    observation: 'Take a clear close-up of the affected leaves, stem, or grains. Note when symptoms appeared and share the photo and observations with a local agricultural expert.',
    caution: 'Unknown is not a diagnosis. Crop observations and advice from an agricultural expert can help establish the cause.',
  },
];

export function getGuideCategory(id: unknown): GuideCategory | undefined {
  return typeof id === 'string' ? pestGuideCategories.find((category) => category.id === id) : undefined;
}
