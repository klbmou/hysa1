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
        colors={['rgba(255,255,255,0.13)', 'rgba(255,59,138,0.085)', 'rgba(124,58,237,0.065)', 'rgba(255,255,255,0.04)']}
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
    backgroundColor: theme.colors.bgGlassLight,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
    shadowColor: '#FF3B8A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  content: {
    flex: 1,
  },
});

export default GlassCard;
