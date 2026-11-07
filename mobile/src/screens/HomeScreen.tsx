import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  ReduceMotion,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '../components/AppButton';
import { BrandHeader } from '../components/BrandHeader';
import { theme } from '../theme';

// Run once on mount. System reduced-motion settings skip these short entrances.
const logoEntrance = FadeIn.duration(360).reduceMotion(ReduceMotion.System);
const headingEntrance = FadeInDown.duration(420)
  .withInitialValues({ transform: [{ translateY: 10 }] })
  .delay(80)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const buttonEntrance = FadeInDown.duration(420)
  .withInitialValues({ transform: [{ translateY: 6 }] })
  .delay(160)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const imageEntrance = FadeIn.duration(540)
  .delay(220)
  .reduceMotion(ReduceMotion.System);

export function HomeScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 360;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
        testID="home-screen"
      >
        <View style={styles.landing}>
          <Animated.View entering={logoEntrance} style={styles.brand}>
            <BrandHeader />
          </Animated.View>

          <Animated.View entering={headingEntrance} style={styles.copy}>
            <Text
              accessibilityRole="header"
              style={[styles.title, compact && styles.compactTitle]}
            >
              Identifies Rice Pests Through Crop Damage Images
            </Text>
            <Text style={styles.description}>
              An image-based crop damage analysis app that identifies the most
              likely rice pest based on visible damage on rice crops.
            </Text>
          </Animated.View>

          <Animated.View entering={buttonEntrance} style={styles.action}>
            <AppButton
              allowLabelWrap
              label="Analyze a Rice Crop Image"
              leadingIcon="camera-outline"
              onPress={() => router.push('/analyze')}
              style={styles.button}
              testID="home-analyze-button"
              trailingIcon={compact ? undefined : 'chevron-forward'}
            />
          </Animated.View>

          <Animated.View entering={imageEntrance} style={styles.riceFrame}>
            <Animated.Image
              accessibilityLabel="Golden rice grains growing in a lush green rice field"
              accessibilityRole="image"
              resizeMode="cover"
              resizeMethod="resize"
              source={require('../../assets/home-rice-field.jpg')}
              style={styles.riceImage}
              testID="home-rice-image"
            />
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.background,
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  landing: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 600,
    width: '100%',
  },
  brand: {
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.mdLg,
  },
  copy: {
    paddingHorizontal: theme.spacing.lg,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.type.size.display,
    fontWeight: theme.type.weight.bold,
    letterSpacing: -0.8,
    lineHeight: theme.type.lineHeight.display,
  },
  compactTitle: {
    fontSize: theme.type.size.pageTitle,
    lineHeight: theme.type.lineHeight.pageTitle,
  },
  description: {
    color: theme.colors.text,
    fontSize: theme.type.size.body,
    lineHeight: theme.type.lineHeight.body,
    marginTop: theme.spacing.md,
  },
  action: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  button: {
    paddingHorizontal: theme.spacing.sm,
  },
  riceFrame: {
    backgroundColor: theme.colors.mint,
    flexGrow: 1,
    minHeight: 220,
    overflow: 'hidden',
  },
  riceImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    width: '100%',
  },
});
