import { useLocalSearchParams } from 'expo-router';

import { PestGuideDetailScreen } from '@/src/screens/PestGuideDetailScreen';

export default function PestGuideDetailRoute() {
  const { category } = useLocalSearchParams<{ category: string }>();
  return <PestGuideDetailScreen categoryId={category} key={category} />;
}
