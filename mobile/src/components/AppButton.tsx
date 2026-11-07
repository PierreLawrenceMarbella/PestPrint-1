import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { theme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type AppButtonProps = Pick<PressableProps, 'disabled' | 'onPress' | 'testID'> & {
  allowLabelWrap?: boolean;
  label: string;
  leadingIcon?: keyof typeof Ionicons.glyphMap;
  resultFeedback?: boolean;
  style?: StyleProp<ViewStyle>;
  trailingIcon?: keyof typeof Ionicons.glyphMap;
  variant?: 'primary' | 'secondary';
};

export function AppButton({
  allowLabelWrap = true,
  disabled,
  label,
  leadingIcon,
  onPress,
  resultFeedback = false,
  style,
  testID,
  trailingIcon,
  variant = 'primary',
}: AppButtonProps) {
  const secondary = variant === 'secondary';
  const [focused, setFocused] = useState(false);
  const feedback = useSharedValue(0);
  const feedbackStyle = useAnimatedStyle(() => ({
    opacity: disabled ? 0.48 : 1 - feedback.value * (resultFeedback ? 0.05 : 0.07),
    transform: [{ translateY: feedback.value * (resultFeedback ? 0.75 : 1) }],
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${resultFeedback ? feedback.value * 8 : 0}deg` }],
  }));
  useEffect(() => {
    if (resultFeedback) return () => cancelAnimation(feedback);
  }, [feedback, resultFeedback]);
  const animateFeedback = (value: number) => {
    feedback.value = withTiming(value, {
      duration: value ? theme.motion.press : theme.motion.release,
      easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System,
    });
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onBlur={() => {
        setFocused(false);
        if (resultFeedback) { cancelAnimation(feedback); feedback.value = 0; }
      }}
      onFocus={() => setFocused(true)}
      onPress={onPress}
      onPressIn={() => animateFeedback(1)}
      onPressOut={() => animateFeedback(0)}
      style={[
        styles.base,
        secondary ? styles.secondary : styles.primary,
        focused && styles.focused,
        style,
        feedbackStyle,
      ]}
      testID={testID}
    >
      {leadingIcon ? (
        resultFeedback ? <Animated.View pointerEvents="none" style={iconStyle} testID={`${testID}-icon-feedback`}>
          <Ionicons color={secondary ? theme.colors.forest : theme.colors.surface} name={leadingIcon} size={19} />
        </Animated.View> :
        <Ionicons
          color={secondary ? theme.colors.forest : theme.colors.surface}
          name={leadingIcon}
          size={19}
        />
      ) : null}
      <Text style={[styles.label, secondary && styles.secondaryLabel, allowLabelWrap && styles.wrappedLabel]}>{label}</Text>
      {trailingIcon ? (
        <Ionicons
          color={secondary ? theme.colors.forest : theme.colors.surface}
          name={trailingIcon}
          size={18}
        />
      ) : null}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: theme.radius.button,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: theme.spacing.mdLg,
    paddingVertical: theme.spacing.smMd,
  },
  primary: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
    ...theme.shadow.card,
  },
  secondary: {
    backgroundColor: theme.colors.mint,
    borderColor: theme.colors.forestSoft,
  },
  label: {
    color: theme.colors.surface,
    fontSize: theme.type.size.body,
    fontWeight: theme.type.weight.bold,
  },
  secondaryLabel: {
    color: theme.colors.forest,
  },
  wrappedLabel: {
    flexShrink: 1,
    textAlign: 'center',
  },
  focused: { outlineColor: theme.colors.forestDark, outlineOffset: 3, outlineWidth: 2 },
});
