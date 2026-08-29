// =================================================================
// FINEXA — AURORA GLASS DESIGN SYSTEM
// Light theme: glassmorphic white cards on slate-50 background
// Indigo/violet brand gradient + soft indigo glow shadows
// Matches HTML mockup: finexa-app-preview-v2.html (data-style="aurora")
// =================================================================

// ============ COLOR PALETTE ============
export const AuroraColors = {
  // ── Background layers ───────────────────────────────────────────
  bgPage: '#F8FAFC', // slate-50 — main app background
  bgCard: 'rgba(255,255,255,0.78)', // white glassmorphic card
  bgElevated: 'rgba(255,255,255,0.92)', // inputs, list rows
  bgGlass: 'rgba(255,255,255,0.72)', // modals, sheets
  bgPill: 'rgba(255,255,255,0.85)', // chips, tabs, FAB border

  // ── Text colors (DARK NAVY on LIGHT bg) ─────────────────────────
  textPrimary: '#0F172A', // slate-900 — main text
  textSecondary: '#475569', // slate-600 — secondary text
  textMuted: '#94A3B8', // slate-400 — placeholder, hints
  textInverse: '#FFFFFF', // white text on dark/gradient bg

  // ── Borders (slate-tinted, semi-transparent) ───────────────────
  borderSubtle: 'rgba(148,163,184,0.18)',
  borderDefault: 'rgba(148,163,184,0.24)',
  borderStrong: 'rgba(148,163,184,0.40)',

  // ── Indigo / violet brand palette ──────────────────────────────
  indigo50: '#EEF2FF',
  indigo100: '#E0E7FF',
  indigo200: '#C7D2FE',
  indigo300: '#A5B4FC',
  indigo400: '#818CF8',
  indigo500: '#6366F1',
  indigo600: '#4F46E5',
  indigo700: '#4338CA',
  indigo800: '#3730A3',
  indigo900: '#312E81',

  violet400: '#A78BFA',
  violet500: '#8B5CF6',
  violet600: '#7C3AED',
  violet700: '#6D28D9',

  // ── Status colors ──────────────────────────────────────────────
  emerald400: '#34D399',
  emerald500: '#10B981',
  emerald600: '#059669',
  emeraldLight: '#D1FAE5',
  emeraldBorder: '#A7F3D0',

  amber400: '#FBBF24',
  amber500: '#F59E0B',
  amber600: '#D97706',
  amberLight: '#FEF3C7',
  amberBorder: '#FDE68A',

  rose400: '#FB7185',
  rose500: '#F43F5E',
  rose600: '#E11D48',
  roseLight: '#FEE2E2',
  roseBorder: '#FECACA',

  sky400: '#38BDF8',
  sky500: '#0EA5E9',

  // ── Slate grays ────────────────────────────────────────────────
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  slate950: '#020617',

  // ── Glass overlay on gradient heroes (semi-transparent white) ──
  glassOnGradient: 'rgba(255,255,255,0.18)', // pill on hero
  glassOnGradientBorder: 'rgba(255,255,255,0.28)',
  glassOnGradientText: 'rgba(255,255,255,0.92)',
} as const;

// ============ GRADIENTS ============
export const AuroraGradients = {
  // Brand — used for hero sections, primary buttons, FABs, active states
  brand: ['#4F46E5', '#7C3AED', '#6366F1'], // indigo-600 → violet-600 → indigo-500
  brandStart: '#4F46E5',
  brandMid: '#7C3AED',
  brandEnd: '#6366F1',

  // Danger — destructive actions, overdue indicators
  danger: ['#E11D48', '#F43F5E', '#FB7185'], // rose-600 → rose-500 → rose-400
  dangerStart: '#E11D48',
  dangerMid: '#F43F5E',
  dangerEnd: '#FB7185',

  // Success
  success: ['#059669', '#10B981', '#34D399'], // emerald-600 → emerald-500 → emerald-400

  // Soft indigo background orbs (radial gradient overlays on slate-50 bg)
  orbTopLeft: 'rgba(124,58,237,0.16)', // violet-600 at 16% opacity
  orbBottomRight: 'rgba(79,70,229,0.14)', // indigo-600 at 14% opacity

  // Glow under hero gradients
  glowViolet: 'rgba(124,58,237,0.32)',
  glowIndigo: 'rgba(99,102,241,0.45)',
} as const;

// ============ TYPOGRAPHY ============
export const AuroraFont = {
  sans: 'Inter',
  display: 'Manrope',
  mono: 'JetBrains Mono',
  // sizes (px)
  fs2xs: 10,
  fsXs: 11,
  fsSm: 13,
  fsBase: 15,
  fsMd: 16,
  fsLg: 18,
  fsXl: 20,
  fs2xl: 24,
  fs3xl: 30,
  fs4xl: 40,
  fs5xl: 56,
  // weights
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
} as const;

// ============ SPACING ============
export const AuroraSpacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
} as const;

// ============ BORDER RADIUS ============
export const AuroraRadius = {
  rXs: 6,
  rSm: 8,
  rMd: 12,
  rLg: 16,
  rXl: 20,
  r2xl: 28,
  r3xl: 40,
  rFull: 9999,
} as const;

// ============ SHADOWS (soft indigo-tinted, depth-focused) ============
// On Android, elevation replaces shadow* properties.
export interface AuroraShadowType {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export const AuroraShadow: Record<string, AuroraShadowType> = {
  xs: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  // Indigo-tinted medium shadow (used on cards for soft glow)
  md: {
    shadowColor: '#4F46E5', // indigo-600
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 4,
  },
  lg: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.18,
    shadowRadius: 48,
    elevation: 8,
  },
  xl: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.22,
    shadowRadius: 64,
    elevation: 12,
  },
  // Brand-colored glow (used on active buttons, FABs)
  glow: {
    shadowColor: '#6366F1', // indigo-500
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 32,
    elevation: 8,
  },
  btnPrimary: {
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 20,
    elevation: 4,
  },
};

// ============ AURORA FLOATING ORBS (background) ============
// Position percentages for the radial gradient overlays on the main background
export const AuroraOrbs = [
  { x: 15, y: 8, size: 60, color: AuroraGradients.orbTopLeft }, // top-left violet
  { x: 85, y: 85, size: 50, color: AuroraGradients.orbBottomRight }, // bottom-right indigo
] as const;

// ============ ANIMATION EASING ============
export const AuroraEasing = {
  spring: { tension: 200, friction: 12 }, // matches cubic-bezier(0.34,1.56,0.64,1)
  out: { duration: 300 }, // matches cubic-bezier(0.16,1,0.3,1)
} as const;

// ============ TYPE EXPORTS ============
export type GlowTone = 'brand' | 'danger' | 'success' | 'default';
