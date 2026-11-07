import type { ClassificationResult } from '../types/pestResult';
import { theme } from './index';

export const resultPalette: Record<ClassificationResult['kind'], { surface: string; border: string; accent: string }> = {
  'known-pest': { surface: theme.colors.predictionSurface, border: theme.colors.predictionBorder, accent: theme.colors.predictionAccent },
  healthy: { surface: theme.colors.mint, border: theme.colors.forestSoft, accent: theme.colors.forestDark },
  unknown: { surface: theme.colors.amberSurface, border: theme.colors.amberBorder, accent: theme.colors.amber },
};
