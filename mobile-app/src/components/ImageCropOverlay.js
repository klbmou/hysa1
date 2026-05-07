import React, { useState, useRef } from 'react';
import { View, StyleSheet, PanResponder, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const ImageCropOverlay = ({ imageUri, onDone, onCancel, onReset }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const lastPosition = useRef({ x: 0, y: 0 });
  const lastTouch = useRef(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        lastTouch.current = { x: gestureState.x0, y: gestureState.y0 };
      },
      onPanResponderMove: (evt, gestureState) => {
        if (lastTouch.current) {
          const dx = gestureState.moveX - lastTouch.current.x;
          const dy = gestureState.moveY - lastTouch.current.y;
          setPosition(prev => ({
            x: prev.x + dx,
            y: prev.y + dy,
          }));
          lastTouch.current = { x: gestureState.moveX, y: gestureState.moveY };
        }
      },
      onPanResponderRelease: () => {
        lastTouch.current = null;
      },
    })
  ).current;

  const handlePinch = (evt) => {
    // Simplified pinch-to-zoom using button controls
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    if (onReset) onReset();
  };

  return (
    <View style={styles.container}>
      <View style={styles.cropFrame}>
        <View
          style={[styles.imageContainer, { transform: [{ scale }, { translateX: position.x }, { translateY: position.y }] }]}
          {...panResponder.panHandlers}
        >
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="cover"
          />
        </View>
        
        {/* Crop frame overlay */}
        <View style={styles.cropBorder} pointerEvents="none">
          <View style={styles.cropCornerTopLeft} />
          <View style={styles.cropCornerTopRight} />
          <View style={styles.cropCornerBottomLeft} />
          <View style={styles.cropCornerBottomRight} />
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.zoomControls}>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut} activeOpacity={0.7}>
            <Text style={styles.zoomBtnText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.zoomText}>{Math.round(scale * 100)}%</Text>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn} activeOpacity={0.7}>
            <Text style={styles.zoomBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.7}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={() => onDone({ scale, position })} activeOpacity={0.7}>
            <Text style={styles.doneText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropFrame: {
    width: SCREEN_W - 40,
    height: SCREEN_W - 40, // Square crop frame
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  imageContainer: {
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  cropBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 8,
  },
  cropCornerTopLeft: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#fff',
    borderTopLeftRadius: 8,
  },
  cropCornerTopRight: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderColor: '#fff',
    borderTopRightRadius: 8,
  },
  cropCornerBottomLeft: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderColor: '#fff',
    borderBottomLeftRadius: 8,
  },
  cropCornerBottomRight: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderColor: '#fff',
    borderBottomRightRadius: 8,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  zoomControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    gap: 20,
  },
  zoomBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
  },
  zoomText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  cancelText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  resetBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  resetText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  doneBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: '#FF3B8A',
  },
  doneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ImageCropOverlay;
