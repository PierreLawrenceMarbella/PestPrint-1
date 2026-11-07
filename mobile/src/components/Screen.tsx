import type { PropsWithChildren, ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { theme } from '../theme';

type ScreenProps = PropsWithChildren<{
  contentStyle?: StyleProp<ViewStyle>;
  header?: ReactNode;
  testID?: string;
}>;

export function Screen({ children, contentStyle, header, testID }: ScreenProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      {header}
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        testID={testID}
      >
        <View style={[styles.contentInner, contentStyle]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  contentInner: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 600,
    paddingHorizontal: theme.spacing.mdLg,
    width: '100%',
  },
});
