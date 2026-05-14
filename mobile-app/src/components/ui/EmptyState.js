import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import theme from '../../theme';
import GlassCard from './GlassCard';

const EmptyState = ({ icon, title, message, action }) => (
  <GlassCard gradient style={styles.card} contentStyle={styles.content}>
    {icon ? <View style={styles.icon}>{icon}</View> : null}
    <Text style={styles.title}>{title}</Text>
    {message ? <Text style={styles.message}>{message}</Text> : null}
    {action ? <View style={styles.action}>{action}</View> : null}
  </GlassCard>
);

const styles = StyleSheet.create({
  card: {
    marginHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.xxl,
  },
  content: {
    alignItems: 'center',
    padding: theme.spacing.xxl,
  },
  icon: {
    marginBottom: theme.spacing.md,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  message: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  action: {
    marginTop: theme.spacing.lg,
  },
});

export default EmptyState;
