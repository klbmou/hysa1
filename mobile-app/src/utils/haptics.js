import { Vibration, Platform } from 'react-native';

export function light() {
  if (Platform.OS === 'ios') {
    Vibration.vibrate(10);
  } else {
    Vibration.vibrate(10);
  }
}

export function medium() {
  Vibration.vibrate(20);
}

export function heavy() {
  Vibration.vibrate([0, 30, 10, 30]);
}

export function success() {
  Vibration.vibrate([0, 15, 10, 15, 10, 15]);
}

export function warning() {
  Vibration.vibrate([0, 40, 20, 40]);
}

export function error() {
  Vibration.vibrate([0, 50, 20, 50, 20, 50]);
}

export function press() {
  Vibration.vibrate(5);
}
