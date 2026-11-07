/** Format display text only; callers must specify the stored value's units. */
export function formatPercentage(value: number, scale: 'percent' | 'probability'): string {
  'worklet';
  const maximum = scale === 'probability' ? 1 : 100;
  if (!Number.isFinite(value) || value < 0 || value > maximum) return 'Percentage unavailable';

  const percent = scale === 'probability' ? value * 100 : value;
  return percent > 0 && percent < 0.05 ? '<0.1%' : `${percent.toFixed(1)}%`;
}
