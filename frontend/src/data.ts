export type ClassId =
  | "healthy_rice"
  | "rice_leaffolder"
  | "rice_stem_borer"
  | "unknown";
export const classNames: Record<ClassId, string> = {
  healthy_rice: "Healthy Rice",
  rice_leaffolder: "Rice Leaffolder Damage",
  rice_stem_borer: "Stem Borer Damage",
  unknown: "Unknown (Other Damage)",
};
export const isClassId = (value: unknown): value is ClassId =>
  typeof value === "string" && Object.hasOwn(classNames, value);
export const asset = (name: string) =>
  `${import.meta.env.BASE_URL}images/${name}`;
export interface GuideEntry {
  slug: string;
  name: string;
  scientific: string;
  image: string;
  alt: string;
  summary: string;
  symptoms: string[];
  detail: string;
  observation: string;
  category: string;
  source?: string;
  sourceName?: string;
  photoTips?: string;
}
export const unknownGuidance = [
  "The model could not match the image to its defined healthy or known-pest categories.",
  "Damage may be associated with other pests, diseases, environmental conditions, or non-insect factors.",
  "Consider consulting an agricultural expert for further assessment.",
];
export const guides: GuideEntry[] = [
  {
    slug: "stem-borer",
    name: "Stem Borer",
    scientific: "Rice stem-borer species",
    image: "stem-borer.jpg",
    alt: "Rice plant with a drying central shoot associated with stem-borer damage",
    category: "Stem damage",
    summary:
      "Larvae bore into rice stems, causing deadhearts in young plants and whiteheads at later stages.",
    symptoms: [
      "Drying central shoots (deadhearts)",
      "Whitish, empty panicles (whiteheads)",
      "Small entry holes in stems",
    ],
    detail:
      "Stem-borer larvae feed inside rice stems. Damage during vegetative growth can dry the central shoot, called a deadheart. At the reproductive stage, affected panicles may turn white and fail to fill with grain.",
    observation:
      "Inspect the central shoots and panicles. Similar signs can have other causes, so check the stem and seek local agricultural guidance when the diagnosis is uncertain.",
    source:
      "https://keyserver.lucidcentral.org/key-server/data/0e090d01-0209-460e-810c-0d060708030c/media/Html/Stem_borer.htm",
    sourceName: "IRRI factsheet · Stem borer",
  },
  {
    slug: "rice-leaffolder",
    name: "Rice Leaffolder",
    scientific: "Cnaphalocrocis medinalis",
    image: "rice-leaffolder.jpg",
    alt: "Close-up of a rice leaf with long pale scraped feeding marks",
    category: "Leaf damage",
    summary:
      "Larvae fold leaves and scrape the green tissue, leaving whitish streaks on the leaf surface.",
    symptoms: [
      "Leaves folded lengthwise",
      "Scraped or window-pane appearance",
      "White patches or streaks on leaves",
    ],
    detail:
      "Leaffolder larvae shelter inside leaves folded with silk and feed on green leaf tissue. Their feeding leaves pale, elongated marks that may become more obvious as the leaf opens.",
    observation:
      "Photograph the folded leaf and the visible feeding marks in natural light. A damage photograph supports identification but does not establish the number of pests present.",
    source:
      "https://www.knowledgebank.irri.org/training/fact-sheets/pest-management/insects/item/rice-leaffolder",
    sourceName: "IRRI Rice Knowledge Bank · Rice leaffolder",
  },
  {
    slug: "healthy-rice",
    name: "Healthy Rice",
    scientific: "Oryza sativa",
    image: "healthy-rice.jpg",
    alt: "Green rice leaves without obvious pest feeding damage",
    category: "Healthy appearance",
    summary:
      "Rice leaves and stems appear intact, without obvious signs of the supported pest-related damage.",
    symptoms: [
      "Intact leaves without obvious feeding marks",
      "Normal-looking stems for the growth stage",
      "No obvious deadhearts or pest-related whiteheads",
    ],
    detail:
      "Healthy-looking rice generally has intact leaf tissue and normal growth for its variety and stage. Leaf color and grain appearance change as rice develops, so compare plants at the same growth stage.",
    observation:
      "The Healthy Rice prediction means the image best matches the model’s healthy category. It does not establish that a plant is completely free of pests, disease, or nutrient stress. Continue observing the crop.",
  },
  {
    slug: "unknown-damage",
    name: "Unknown (Other Damage)",
    scientific: "An unrecognized pattern, not a diagnosis",
    image: "unknown-damage.jpg",
    alt: "Rice leaf with discolored streaks from the project's Unknown image category",
    category: "Further assessment needed",
    summary:
      "Damage patterns not included in the defined pest categories. These may be caused by other pests, diseases, or non-insect factors.",
    symptoms: unknownGuidance,
    detail:
      "An Unknown result means the model assigned the image to its trained Unknown category rather than Healthy Rice or a known pest category. Some damage patterns fall outside the examples it learned, and different causes can look similar. This result does not identify a specific pest, disease, or environmental cause.",
    observation:
      "Other pests, diseases, environmental conditions, or non-insect factors are possible explanations, not confirmed findings. Image quality can also make interpretation difficult. An agricultural expert can inspect the plant and its surroundings to assess a cause that a single photograph cannot establish.",
    photoTips:
      "Take a clear, well-lit close-up of the affected rice leaf, stem, or grains. Keep the camera steady and the rice crop visible, avoid distant or blurry views, and include enough surrounding plant tissue for context. If the result remains uncertain, bring the photographs and crop observations to a local agricultural expert.",
  },
];
export const guideForClass: Record<ClassId, string> = {
  healthy_rice: "healthy-rice",
  rice_leaffolder: "rice-leaffolder",
  rice_stem_borer: "stem-borer",
  unknown: "unknown-damage",
};

// These are presentation categories. Only /api/health declares model capability.
export const classificationCards: {
  id: ClassId;
  image: string;
  alt: string;
}[] = [
  {
    id: "healthy_rice",
    image: "healthy-rice.jpg",
    alt: "Healthy green rice leaves",
  },
  {
    id: "rice_stem_borer",
    image: "stem-borer.jpg",
    alt: "Drying central rice shoot associated with stem-borer damage",
  },
  {
    id: "rice_leaffolder",
    image: "rice-leaffolder.jpg",
    alt: "Rice leaf with pale scraped feeding marks",
  },
  {
    id: "unknown",
    image: "unknown-damage.jpg",
    alt: "Rice leaf with other damage from the project's Unknown category",
  },
];
