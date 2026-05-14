import React from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '../../theme';

const HysaButton = ({
  children,
  title,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  style,
  textStyle,
  leftIcon,
}) => {
  const content = loading ? (
    <ActivityIndicator size="small" color="#fff" />
  ) : (
    <>
      {leftIcon}
      <Text style={[styles.text, variant === 'ghost' && styles.ghostText, textStyle]}>
        {title || children}
      </Text>
    </>
  );

  if (variant === 'primary') {
    return (
      <TouchableOpacity onPress={onPress} disabled={disabled || loading} activeOpacity={0.82} style={[disabled && styles.disabled, style]}>
        <LinearGradient colors={theme.colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.78}
      style={[styles.ghost, disabled && styles.disabled, style]}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  primary: {
    minHeight: 42,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: theme.radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ghost: {
    minHeight: 42,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceStrong,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabled: {
    opacity: 0.52,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  ghostText: {
    color: theme.colors.textPrimary,
  },
});

export default HysaButton;
