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
        colors={['rgba(255,255,255,0.16)', 'rgba(255,59,138,0.07)', 'rgba(124,58,237,0.055)', 'rgba(255,255,255,0.045)']}
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
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
    shadowColor: '#FF3B8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 5,
  },
  content: {
    flex: 1,
  },
});

export default GlassCard;
