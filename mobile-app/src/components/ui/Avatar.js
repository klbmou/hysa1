import React from 'react';
import { Image, View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User } from 'lucide-react-native';
import theme from '../../theme';

const Avatar = ({ uri, name, size = 40, ring = false, style }) => {
  const radius = size / 2;
  const innerSize = ring ? size - 5 : size;
  const innerRadius = innerSize / 2;
  const initial = name ? String(name).trim().charAt(0).toUpperCase() : '';

  const avatar = uri ? (
    <Image source={{ uri }} style={{ width: innerSize, height: innerSize, borderRadius: innerRadius }} />
  ) : (
    <View style={[styles.placeholder, { width: innerSize, height: innerSize, borderRadius: innerRadius }]}>
      {initial ? <Text style={[styles.initial, { fontSize: Math.max(13, size * 0.35) }]}>{initial}</Text> : <User size={Math.max(16, size * 0.42)} color={theme.colors.textMuted} />}
    </View>
  );

  if (ring) {
    return (
      <LinearGradient colors={theme.colors.gradient} style={[styles.ring, { width: size, height: size, borderRadius: radius }, style]}>
        {avatar}
      </LinearGradient>
    );
  }

  return <View style={[{ width: size, height: size, borderRadius: radius }, style]}>{avatar}</View>;
};

const styles = StyleSheet.create({
  ring: {
    padding: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  initial: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
  },
});

export default Avatar;
