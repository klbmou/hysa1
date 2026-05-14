import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../../theme';

const SectionHeader = ({ title, right }) => (
  <View style={styles.row}>
    <Text style={styles.title}>{title}</Text>
    {right}
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
});

export default SectionHeader;
