import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { knownPests } from '../constants/knownPests';
import { theme } from '../theme';
import type { KnownPestId } from '../types/pestResult';
import { SectionTitle } from './SectionTitle';

export function PestDamageCharacteristics({ pest }: { pest: KnownPestId }) {
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Ionicons color={theme.colors.forest} name="leaf-outline" size={23} />
        <SectionTitle style={styles.title}>Typical Damage Characteristics</SectionTitle>
      </View>
      <Text style={styles.note}>
        Educational reference only. These signs are not confirmed findings in your image.
      </Text>
      {knownPests[pest].characteristics.map((characteristic) => (
        <View key={characteristic} style={styles.row}>
          <Text accessible={false} style={styles.bullet}>•</Text>
          <Text style={styles.characteristic}>{characteristic}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: theme.spacing.lg },
  heading: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.sm },
  title: { flex: 1, fontSize: theme.type.size.sectionTitle },
  note: { color: theme.colors.muted, fontSize: theme.type.size.caption, lineHeight: 18, marginVertical: theme.spacing.sm },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  bullet: { color: theme.colors.forest, fontSize: 19, lineHeight: theme.type.lineHeight.body },
  characteristic: { color: theme.colors.text, flex: 1, fontSize: theme.type.size.body, lineHeight: theme.type.lineHeight.body },
});
