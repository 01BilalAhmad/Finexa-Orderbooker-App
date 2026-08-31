// Finexa Orderbooker App — AURORA GLASS theme
// Faithful port of "Style 1: Aurora Glass (light + glassmorphism)" from
// finexa-app-preview-v2.html — light aurora background, indigo-violet brand
// gradient, translucent glass cards, soft indigo shadows.
import { Platform } from 'react-native';

// ── Brand gradient (CSS: --gradient-brand: 135deg #4F46E5 0% → #7C3AED 50% → #6366F1 100%)
export const AURORA = {
  // Brand gradient stops, in order
  brandGradient: ['#4F46E5', '#7C3AED', '#6366F1'] as const,
  // Danger gradient (CSS: --gradient-danger: 135deg #E11D48 → #F43F5E → #FB7185)
  dangerGradient: ['#E11D48', '#F43F5E', '#FB7185'] as const,
  // Emerald / amber tier gradients (map pins + avatars)
  emeraldGradient: ['#10B981', '#34D399'] as const,
  amberGradient: ['#F59E0B', '#FBBF24'] as const,

  // Page base (#F8FAFC) with aurora radial tints baked into screens via
  // LinearGradient — see AuroraBackground component usage.
  bgPage: '#F8FAFC',

  // Glass surfaces (CSS vars)
  bgCard: 'rgba(255,255,255,0.78)',
  bgElevated: 'rgba(255,255,255,0.92)',
  bgGlass: 'rgba(255,255,255,0.72)',
  bgPill: 'rgba(255,255,255,0.85)',

  // Glass borders (CSS: rgba(148,163,184, 0.18/0.24/0.40))
  borderSubtle: 'rgba(148,163,184,0.18)',
  borderDefault: 'rgba(148,163,184,0.24)',
  borderStrong: 'rgba(148,163,184,0.40)',

  // Hero glass pills (on gradient, CSS: rgba(255,255,255,0.18) + border 0.28)
  heroGlassBg: 'rgba(255,255,255,0.18)',
  heroGlassBorder: 'rgba(255,255,255,0.28)',
  heroGlassBg2: 'rgba(255,255,255,0.15)',
  heroGlassBorder2: 'rgba(255,255,255,0.22)',

  // Indigo chip (CSS: [data-style=aurora] .chip → rgba(99,102,241,0.16) / #4338CA / border 0.28)
  chipBg: 'rgba(99,102,241,0.16)',
  chipText: '#4338CA',
  chipBorder: 'rgba(99,102,241,0.28)',
  chipActiveBg: 'rgba(99,102,241,0.10)',
  chipActiveBorder: 'rgba(99,102,241,0.24)',

  // Semantic chips (CSS .chip-success / warning / danger)
  chipSuccessBg: '#D1FAE5',
  chipSuccessText: '#047857',
  chipSuccessBorder: '#A7F3D0',
  chipWarningBg: '#FEF3C7',
  chipWarningText: '#B45309',
  chipWarningBorder: '#FDE68A',
  chipDangerBg: '#FEE2E2',
  chipDangerText: '#B91C1C',
  chipDangerBorder: '#FECACA',
};

export const Colors = {
  // Brand (indigo — accent-color: var(--c-indigo-600) = #4F46E5)
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  primaryDark: '#4338CA',
  secondary: '#7C3AED',
  secondaryLight: '#F5F3FF',
  danger: '#E11D48',
  dangerLight: '#FFE4E6',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',

  // Aurora light surfaces
  background: '#F8FAFC',
  surface: 'rgba(255,255,255,0.78)',
  surfaceElevated: 'rgba(255,255,255,0.92)',
  border: 'rgba(148,163,184,0.24)',
  borderLight: 'rgba(148,163,184,0.18)',

  // Text (CSS: --text-primary/secondary/muted)
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  // Tab bar (glass pill)
  tabBar: 'rgba(255,255,255,0.85)',
  tabBarBorder: 'rgba(148,163,184,0.24)',
  tabActive: '#4F46E5',
  tabInactive: '#94A3B8',

  // Extended palette (mockup tokens)
  indigo: '#6366F1',
  indigoLight: '#EEF2FF',
  violet: '#7C3AED',
  violetLight: '#F5F3FF',
  blue: '#818CF8',
  blueLight: '#E0E7FF',
  emerald: '#10B981',
  emeraldDark: '#059669',
  emeraldLight: '#D1FAE5',
  amber: '#F59E0B',
  amberDark: '#D97706',
  amberLight: '#FEF3C7',
  rose: '#F43F5E',
  roseDark: '#E11D48',
  roseLight: '#FFE4E6',
  sky: '#0EA5E9',
  orange: '#EA580C',
  orangeLight: '#FFF7ED',
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
  full: 9999,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 30,
};

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// Monospace numerals (mockup uses JetBrains Mono; RN fallback per platform)
export const FontMono = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

export const Shadow = {
  // --shadow-xs
  xs: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  // --shadow-sm
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  // --shadow-md (indigo-tinted)
  md: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  // --shadow-lg (indigo glow)
  lg: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
  },
  // --shadow-xl
  xl: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.22,
    shadowRadius: 32,
    elevation: 16,
  },
  // --shadow-glow (button glow)
  glow: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  // --btn-shadow
  button: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 8,
  },
};

// ============ Cross-compat re-exports (auroraTheme.ts — parallel Aurora system) ============
// Remote screens (route-start, overdue, aurora/* components) import these
// symbols from constants/auroraTheme. Re-exporting here keeps BOTH systems
// importable from either path — values are identical (same HTML mockup).
export { AuroraColors, AuroraGradients, AuroraShadow } from './auroraTheme';
