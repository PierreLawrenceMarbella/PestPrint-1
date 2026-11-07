import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type SupportedCategory = {
  description: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  name: string;
  tone: 'green' | 'red' | 'amber';
};
