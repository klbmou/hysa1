// HYSA Mobile Design System
// Matches HYSA web app: dark glass, purple/pink neon accents, modern cards.

const colors = {
  bgPrimary: '#0A0A0F',
  bgSecondary: '#13131A',
  bgCard: '#1A1A24',
  bgGlass: 'rgba(20, 22, 29, 0.94)',
  bgGlassLight: 'rgba(26, 26, 36, 0.68)',
  bgOverlay: 'rgba(4, 5, 8, 0.58)',
  bgInput: 'rgba(0, 0, 0, 0.32)',
  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0B0',
  textMuted: 'rgba(160, 160, 176, 0.54)',
  accent: '#7c3aed',
  accentSecondary: '#ff2d95',
  gradient: ['#7c3aed', '#ff2d95'],
  border: '#2A2A3A',
  borderLight: 'rgba(255, 255, 255, 0.09)',
  danger: '#ff5874',
  like: '#ff4f76',
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
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 999,
};

const typography = {
  h1: { fontSize: 36, fontWeight: '900', letterSpacing: -0.5 },
  h2: { fontSize: 28, fontWeight: '800', letterSpacing: -0.3 },
  h3: { fontSize: 20, fontWeight: '700' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 22 },
  bodySm: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  caption: { fontSize: 11, fontWeight: '500' },
  mono: { fontSize: 12, fontWeight: '500', fontFamily: 'monospace' },
  button: { fontSize: 15, fontWeight: '700' },
};

const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  glow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
};

export default { colors, spacing, radius, typography, shadows };
