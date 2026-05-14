// HYSA Mobile Design System
// Premium dark glass, pink/purple identity, and reusable spacing/type tokens.

const colors = {
  background: '#070711',
  bgPrimary: '#070711',
  bgSecondary: '#101020',
  bgCard: 'rgba(255,255,255,0.04)',
  bgGlass: 'rgba(15, 15, 31, 0.88)',
  bgGlassStrong: 'rgba(18, 18, 35, 0.94)',
  bgGlassLight: 'rgba(255,255,255,0.06)',
  bgOverlay: 'rgba(4, 5, 10, 0.68)',
  bgInput: 'rgba(255,255,255,0.055)',
  surface: 'rgba(255,255,255,0.04)',
  surfaceStrong: 'rgba(255,255,255,0.07)',
  textPrimary: '#FFFFFF',
  textSoft: '#D0D0DA',
  textSecondary: '#A0A0B0',
  textMuted: '#8A8A9A',
  textFaint: 'rgba(255,255,255,0.46)',
  accent: '#FF3B8A',
  accentSecondary: '#7C3AED',
  purple: '#7C3AED',
  blue: '#5CCBE3',
  gradient: ['#FF3B8A', '#7C3AED'],
  gradientCool: ['#7C3AED', '#5CCBE3'],
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.08)',
  borderSubtle: 'rgba(255,255,255,0.055)',
  danger: '#FF5874',
  like: '#FF3B8A',
  bookmark: '#1DA1F2',
  verified: '#1DA1F2',
  success: '#17BF63',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

const radius = {
  sm: 12,
  md: 16,
  lg: 22,
  xl: 28,
  full: 999,
};

const typography = {
  h1: { fontSize: 36, fontWeight: '900', letterSpacing: 0 },
  h2: { fontSize: 28, fontWeight: '800', letterSpacing: 0 },
  h3: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodySm: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500' },
  mono: { fontSize: 12, fontWeight: '500', fontFamily: 'monospace' },
  button: { fontSize: 15, fontWeight: '700' },
};

const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
    elevation: 7,
  },
  modal: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  glow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 18,
    elevation: 6,
  },
};

const glass = {
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  sheet: {
    backgroundColor: colors.bgGlassStrong,
    borderColor: colors.border,
    borderWidth: 1,
  },
};

export default { colors, spacing, radius, typography, shadows, glass };
