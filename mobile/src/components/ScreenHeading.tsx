import { StyleSheet, Text, View } from 'react-native';

import { theme } from '../theme';

type ScreenHeadingProps = {
  description?: string;
  eyebrow?: string;
  title: string;
};

export function ScreenHeading({ description, eyebrow, title }: ScreenHeadingProps) {
  return (
    <View style={styles.container}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  eyebrow: {
    color: theme.colors.forest,
    fontSize: theme.type.size.caption,
    fontWeight: theme.type.weight.bold,
    letterSpacing: 1.1,
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.type.size.pageTitle,
    fontWeight: theme.type.weight.black,
    letterSpacing: -0.8,
    lineHeight: theme.type.lineHeight.pageTitle,
  },
  description: {
    color: theme.colors.muted,
    fontSize: theme.type.size.body,
    lineHeight: theme.type.lineHeight.body,
    marginTop: theme.spacing.smMd,
  },
});
