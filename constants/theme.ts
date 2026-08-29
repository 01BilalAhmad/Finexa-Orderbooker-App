// =================================================================
// FINEXA — THEME CONSTANTS (Aurora Glass palette aligned)
// Re-exports the canonical Aurora design tokens plus legacy aliases
// (Colors.*, Spacing, Radius, FontSize, FontWeight, Shadow) for
// screens that still use the old API. Aurora tokens live in
// constants/auroraTheme.ts and are the source of truth.
// =================================================================
import { AuroraColors, AuroraShadow as AuroraShadowTokens } from './auroraTheme';

// ============ LEGACY Colors alias (auto-themed to Aurora) ============
export const Colors = {
  // Primary / brand — Aurora indigo (was blue)
  primary: AuroraColors.indigo600, // #4F46E5
  primaryLight: AuroraColors.indigo100, // #E0E7FF
  primaryDark: AuroraColors.indigo800, // #3730A3

  // Secondary (amber, kept)
  secondary: '#F59E0B',
  secondaryLight: '#FEF3C7',

  // Status
  danger: AuroraColors.rose500, // #F43F5E
  dangerLight: AuroraColors.roseLight,
  success: AuroraColors.emerald500, // #10B981
  successLight: AuroraColors.emeraldLight,
  warning: '#F59E0B',
  warningLight: '#FFFBEB',

  // Background layers
  background: AuroraColors.bgPage, // #F8FAFC slate-50
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  border: AuroraColors.slate200, // #E2E8F0 (kept for legacy borders)
  borderLight: AuroraColors.slate100, // #F1F5F9

  // Text (DARK navy on light bg)
  text: AuroraColors.textPrimary, // #0F172A
  textSecondary: AuroraColors.textSecondary, // #475569
  textMuted: AuroraColors.textMuted, // #94A3B8
  textInverse: AuroraColors.textInverse, // #FFFFFF

  // Tab bar — light with indigo active
  tabBar: '#FFFFFF',
  tabBarBorder: AuroraColors.slate200,
  tabActive: AuroraColors.indigo600, // #4F46E5
  tabInactive: AuroraColors.textMuted, // #94A3B8

  // Extended palette (Aurora-aligned)
  blue: AuroraColors.indigo500, // #6366F1 (now indigo)
  blueLight: AuroraColors.indigo100,
  purple: AuroraColors.violet600, // #7C3AED
  purpleLight: AuroraColors.indigo50, // #EEF2FF
  orange: '#EA580C',
  orangeLight: '#FFF7ED',
};

// ============ SPACING (Aurora-aligned) ============
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// ============ RADIUS (Aurora-aligned) ============
export const Radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  full: 9999,
};

// ============ FONT SIZE ============
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

// ============ FONT WEIGHT ============
export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

// ============ SHADOWS (Aurora indigo-tinted) ============
export const Shadow = {
  sm: AuroraShadowTokens.sm,
  md: AuroraShadowTokens.md,
  lg: AuroraShadowTokens.lg,
  xl: AuroraShadowTokens.xl,
};
