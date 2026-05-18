import { filterProfanity } from './safety';

const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
const CONTROL_RE = /[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;

export function normalizeDisplayText(value, fallback = '') {
  const raw = String(value ?? '').replace(CONTROL_RE, '').trim();
  const normalized = typeof raw.normalize === 'function' ? raw.normalize('NFC') : raw;
  return normalized || fallback;
}

export function displayUsername(value, fallback = 'User') {
  const safe = normalizeDisplayText(value, fallback);
  return filterProfanity(safe) || fallback;
}

export function displayHandle(value, fallback = '') {
  const safe = normalizeDisplayText(value, fallback);
  return filterProfanity(safe).replace(/\s+/g, '_');
}

export function hasRtlText(value) {
  return RTL_RE.test(String(value || ''));
}

export function nameTextStyle(value, align = 'left') {
  return {
    writingDirection: hasRtlText(value) ? 'rtl' : 'ltr',
    textAlign: align,
    includeFontPadding: false,
  };
}

export function avatarInitial(value) {
  const text = displayUsername(value, '');
  const first = text.trim().charAt(0);
  if (!first || first === '*') return '';
  return first.toUpperCase();
}

export default {
  normalizeDisplayText,
  displayUsername,
  displayHandle,
  hasRtlText,
  nameTextStyle,
  avatarInitial,
};
