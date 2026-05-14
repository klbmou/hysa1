import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import theme from '../../theme';

const GlassCard = ({ children, style, contentStyle, gradient = false }) => {
  const body = (
    <View style={[styles.content, contentStyle]}>
      {children}
    </View>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={['rgba(255,255,255,0.105)', 'rgba(255,255,255,0.052)', 'rgba(255,59,138,0.038)', 'rgba(124,58,237,0.03)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.card, style]}
      >
        {body}
      </LinearGradient>
    );
  }

  return <View style={[styles.card, style]}>{body}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 3,
  },
  content: {
    flex: 1,
  },
});

export default GlassCard;
