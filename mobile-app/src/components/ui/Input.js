import React from 'react';
import { TextInput, StyleSheet } from 'react-native';
import theme from '../../theme';

const Input = ({ style, placeholderTextColor, ...props }) => (
  <TextInput
    placeholderTextColor={placeholderTextColor || theme.colors.textMuted}
    style={[styles.input, style]}
    {...props}
  />
);

const styles = StyleSheet.create({
  input: {
    backgroundColor: theme.colors.bgInput,
    borderRadius: theme.radius.md,
    padding: 14,
    fontSize: 15,
    color: theme.colors.textPrimary,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});

export default Input;
