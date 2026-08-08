/**
 * Comedy App Central Design System & Color Tokens
 * Single source of truth for all colors across the app.
 */

// Raw Color Palette
export const PALETTE = {
  // Brand Oranges & Golds
  orangePrimary: '#FF8D00',
  orangeSecondary: '#FF5A1F',
  orangeLight: '#FFF9F2',
  orangeBorder: '#FFE5CC',
  yellowGold: '#FBBC04',
  yellowFigma: '#FFD60A',
  amberWarning: '#FF9500',

  // Status & Actions
  danger: '#FF3B30',
  dangerSoft: '#FF4B4B',
  dangerLight: '#FFF0F0',
  success: '#10B981',
  info: '#0095F6',

  // Neutrals (Light Theme Default)
  white: '#FFFFFF',
  black: '#000000',
  offWhite: '#F8F9FA',
  gray100: '#F0F2F5',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#111827',
  darkOled: '#0F0F12',
  darkCard: '#1A1A1E',
};

// Light Theme Tokens
export const lightTheme = {
  // Brand Primary (Signature Orange Theme)
  primary: PALETTE.orangePrimary, // #FF8D00
  primaryGradient: [PALETTE.yellowGold, PALETTE.orangePrimary] as const, // ['#FBBC04', '#FF8D00']
  primaryLight: PALETTE.orangeLight, // #FFF9F2
  primaryBorder: PALETTE.orangeBorder, // #FFE5CC
  
  background: PALETTE.white,
  surface: PALETTE.offWhite,
  card: PALETTE.white,
  inputBg: PALETTE.gray100,
  border: PALETTE.gray200,

  textPrimary: PALETTE.gray900,
  textSecondary: PALETTE.gray500,
  textMuted: PALETTE.gray400,
  textLight: PALETTE.white,

  accent: PALETTE.orangeSecondary, // #FF5A1F
  badgeYellow: PALETTE.yellowGold, // #FBBC04 (Bright Gold/Yellow for Subscription & Payout buttons)
  danger: PALETTE.danger,
  dangerLight: PALETTE.dangerLight,
  success: PALETTE.success,
  info: PALETTE.info,
  black: PALETTE.black,
  white: PALETTE.white,

  // Dark/Media Surface Tokens (for Story Creator & Fullscreen Camera views)
  darkBackground: PALETTE.black, // #000000
  darkCard: '#1C1C1E',          // Dark charcoal card background
  darkBorder: '#2C2C2E',        // Dark subtle divider border
  darkText: PALETTE.white,      // White text on dark cards
  darkTextMuted: '#8E8E93',     // Muted gray subtext on dark cards
};

// Default Active Theme Export
export const COLORS = lightTheme;
export default COLORS;
