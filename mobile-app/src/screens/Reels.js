import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Film } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../theme';

const Reels = () => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 40,
        friction: 7,
      }),
    ]).start();
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <Animated.View
        style={[
          styles.content,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.glassCard}>
          <View style={styles.iconCircle}>
            <Film size={48} color={theme.colors.accent} />
          </View>
          <Text style={styles.title}>Reels</Text>
          <Text style={styles.subtitle}>Coming soon</Text>
          <Text style={styles.description}>
            Short-form video content is on its way to HYSA.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bgPrimary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  glassCard: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.radius.xl,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: theme.colors.borderLight,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(124, 58, 237, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    ...theme.typography.h2,
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.accent,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    ...theme.typography.bodySm,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
});

export default Reels;
