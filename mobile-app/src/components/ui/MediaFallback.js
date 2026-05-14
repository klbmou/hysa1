import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ImageOff } from 'lucide-react-native';
import theme from '../../theme';

const MediaFallback = ({ message = 'Media unavailable', style }) => (
  <View style={[styles.wrap, style]}>
    <View style={styles.iconWrap}>
      <ImageOff size={24} color={theme.colors.accent} />
    </View>
    <Text style={styles.text}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  wrap: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.xl,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,59,138,0.12)',
    marginBottom: theme.spacing.sm,
  },
  text: {
    color: theme.colors.textSoft,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default MediaFallback;
