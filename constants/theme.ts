// ═══════════════════════════════════════════════════════════════════════════
//  FINEXA — Aurora Glass Global Theme
//  All existing components using Colors.* automatically get the Aurora aesthetic:
//  dark midnight background, glassmorphic surfaces, soft white text, neon accents
// ═══════════════════════════════════════════════════════════════════════════

export const Colors = {
  // ── Brand Accents (kept compatible with old code) ──
  primary: '#6366F1',         // Aurora neon indigo
  primaryLight: 'rgba(99, 102, 241, 0.18)',  // indigo glass tint
  primaryDark: '#4F46E5',     // deeper indigo
  secondary: '#A78BFA',       // Aurora neon purple
  secondaryLight: 'rgba(167, 139, 250, 0.18)',
  danger: '#F87171',
  dangerLight: 'rgba(248, 113, 113, 0.15)',
  success: '#34D399',
  successLight: 'rgba(52, 211, 153, 0.15)',
  warning: '#FBBF24',
  warningLight: 'rgba(251, 191, 36, 0.15)',

  // ── Aurora Background ──
  background: '#0B0720',          // deep midnight (replaces light gray)
  surface: 'rgba(255, 255, 255, 0.06)',     // glass base — semi-transparent
  surfaceElevated: 'rgba(255, 255, 255, 0.12)',  // glass strong
  border: 'rgba(255, 255, 255, 0.16)',      // glass hairline border
  borderLight: 'rgba(255, 255, 255, 0.08)',

  // ── Text (light on dark) ──
  text: '#F5F3FF',                  // soft white
  textSecondary: 'rgba(245, 243, 255, 0.78)',
  textMuted: 'rgba(245, 243, 255, 0.50)',
  textInverse: '#0B0720',

  // ── Tab Bar ──
  tabBar: 'rgba(11, 7, 32, 0.85)',       // dark translucent
  tabBarBorder: 'rgba(255, 255, 255, 0.10)',
  tabActive: '#A78BFA',                  // neon purple
  tabInactive: 'rgba(245, 243, 255, 0.45)',

  // ── Extended palette (kept for backward compat with screens using these) ──
  blue: '#6366F1',          // maps to neon indigo
  blueLight: 'rgba(99, 102, 241, 0.18)',
  purple: '#A78BFA',        // maps to neon purple
  purpleLight: 'rgba(167, 139, 250, 0.18)',
  orange: '#FBBF24',
  orangeLight: 'rgba(251, 191, 36, 0.15)',
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
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
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

export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.30,
    shadowRadius: 4,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.40,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.50,
    shadowRadius: 24,
    elevation: 12,
  },
};
