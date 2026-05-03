import React, { useRef } from 'react';
import { Animated, TouchableOpacity } from 'react-native';
import { press } from '../utils/haptics';

const AnimatedPressable = React.forwardRef(({ onPress, onLongPress, style, children, haptic = true, scaleTo = 0.96, ...rest }, ref) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const animatePress = (callback) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: scaleTo,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    if (callback) callback();
  };

  const handlePressIn = () => {
    if (haptic) press();
    Animated.timing(scaleAnim, {
      toValue: scaleTo,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    animatePress(onPress);
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        ref={ref}
        onPress={handlePress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.7}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
});

AnimatedPressable.displayName = 'AnimatedPressable';

export default AnimatedPressable;
