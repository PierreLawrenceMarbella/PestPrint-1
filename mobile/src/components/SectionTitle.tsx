import { StyleSheet, Text, type TextProps } from 'react-native';

import { theme } from '../theme';

type SectionTitleProps = TextProps & {
  children: string;
};

export function SectionTitle({ children, style, ...props }: SectionTitleProps) {
  return (
    <Text accessibilityRole="header" style={[styles.title, style]} {...props}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    color: theme.colors.text,
    fontSize: theme.type.size.sectionTitle,
    fontWeight: theme.type.weight.bold,
    lineHeight: 24,
  },
});
