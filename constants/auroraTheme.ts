// ═══════════════════════════════════════════════════════════════════════════
//  FINEXA · AURORA GLASS DESIGN SYSTEM
//  Premium glassmorphism + neon indigo glow on deep midnight base
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Aurora Glass palette — designed for a premium, glassmorphic feel.
 * - Background: deep midnight indigo with subtle violet undertones
 * - Surface: semi-transparent glass layers (rgba white + blur)
 * - Accent: neon indigo / electric violet glow
 * - Text: soft white / lavender secondary
 */

export const AuroraColors = {
  // ── Deep Midnight Base ──
  bgVoid:       '#070314',  // absolute void (status bar area)
  bgDeep:       '#0B0720',  // app background
  bgMid:        '#120A2E',  // elevated background
  bgSoft:       '#1A0F3D',  // soft indigo

  // ── Glass Layers (translucent) ──
  glassBase:    'rgba(255, 255, 255, 0.06)',  // base glass card
  glassHover:   'rgba(255, 255, 255, 0.10)',  // pressed/hover state
  glassStrong:  'rgba(255, 255, 255, 0.14)',  // strong glass card (modals)
  glassBorder:  'rgba(255, 255, 255, 0.16)',  // glass border (hairline)
  glassInner:   'rgba(255, 255, 255, 0.08)',  // inner highlights

  // ── Neon Indigo Accents ──
  neonIndigo:   '#6366F1',  // primary indigo
  neonViolet:   '#818CF8',  // light indigo
  neonPurple:   '#A78BFA',  // accent purple
  neonPink:     '#E879F9',  // accent pink (rare)
  neonCyan:     '#22D3EE',  // success/info accent
  neonGlow:     'rgba(99, 102, 241, 0.40)',  // glow shadow color

  // ── Gradients ──
  gradStart:    '#4F46E5',  // indigo-600
  gradMid:      '#7C3AED',  // violet-600
  gradEnd:      '#EC4899',  // pink-500 (rare accent)

  // ── Text ──
  text:         '#F5F3FF',  // primary text (soft white)
  textSecondary:'rgba(245, 243, 255, 0.78)',  // secondary
  textMuted:    'rgba(245, 243, 255, 0.50)',  // muted
  textInverse:  '#0B0720',  // inverse (on light accents)

  // ── Semantic Colors ──
  success:      '#34D399',
  successGlow:  'rgba(52, 211, 153, 0.35)',
  warning:      '#FBBF24',
  warningGlow:  'rgba(251, 191, 36, 0.35)',
  danger:       '#F87171',
  dangerGlow:   'rgba(248, 113, 113, 0.35)',
  info:         '#60A5FA',
  infoGlow:     'rgba(96, 165, 250, 0.35)',

  // ── Tab Bar ──
  tabBarBg:     'rgba(11, 7, 32, 0.85)',  // dark translucent
  tabBarBorder: 'rgba(255, 255, 255, 0.10)',
  tabActive:    '#A78BFA',
  tabInactive:  'rgba(245, 243, 255, 0.45)',
  tabGlow:      'rgba(167, 139, 250, 0.50)',
} as const;

// ────────────────────────────────────────────────────────────────────────────
//  Aurora Glass Effects (shadows, blurs, glows)
// ────────────────────────────────────────────────────────────────────────────

export const AuroraShadow = {
  // Soft ambient glow for glass cards
  glass: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 24,
    elevation: 8,
  },
  // Neon indigo glow for primary CTAs
  neon: {
    shadowColor: AuroraColors.neonIndigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 6,
  },
  // Strong neon for active/pressed state
  neonStrong: {
    shadowColor: AuroraColors.neonViolet,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.70,
    shadowRadius: 20,
    elevation: 10,
  },
  // Subtle floating shadow
  float: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
//  Aurora Glass Gradients (Linear presets)
// ────────────────────────────────────────────────────────────────────────────

export const AuroraGradients = {
  // App background — deep midnight with violet bloom
  background: ['#070314', '#0B0720', '#1A0F3D'] as const,
  // Primary CTA — neon indigo to violet
  primary: ['#6366F1', '#818CF8', '#A78BFA'] as const,
  // Success — emerald to teal
  success: ['#34D399', '#10B981'] as const,
  // Danger — rose to red
  danger: ['#F87171', '#EF4444'] as const,
  // Tab indicator — neon indigo
  tabIndicator: ['#A78BFA', '#6366F1'] as const,
  // Aurora glow accent (for hero areas)
  aurora: ['#4F46E5', '#7C3AED', '#EC4899'] as const,
  // Status bar tint
  statusBar: ['#070314', '#0B0720'] as const,
} as const;

// ────────────────────────────────────────────────────────────────────────────
//  Typography (Aurora uses Manrope-style geometric sans)
// ────────────────────────────────────────────────────────────────────────────

export const AuroraFont = {
  family: {
    regular: 'System',
    medium: 'System',
    semibold: 'System',
    bold: 'System',
    extrabold: 'System',
  },
  size: {
    caption: 11,
    xs: 12,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
    display: 36,
    hero: 44,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
    black: '900' as const,
  },
  tracking: {
    tight: -0.5,
    normal: 0,
    wide: 0.5,
    wider: 1.2,
  },
  lineHeight: {
    tight: 1.15,
    normal: 1.4,
    relaxed: 1.6,
  },
} as const;

// ────────────────────────────────────────────────────────────────────────────
//  Aurora Glass Spacing & Radius
// ────────────────────────────────────────────────────────────────────────────

export const AuroraSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const AuroraRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  full: 9999,
} as const;

// ────────────────────────────────────────────────────────────────────────────
//  Aurora Glass — Live "aurora" gradient stops for animated background
//  These positions create the floating northern-lights feel
// ────────────────────────────────────────────────────────────────────────────

export const AuroraOrbs = [
  // Top-left indigo orb
  { color: 'rgba(99, 102, 241, 0.35)', size: 320, x: -80, y: -60, blur: 80 },
  // Top-right violet orb
  { color: 'rgba(167, 139, 250, 0.30)', size: 280, x: 220, y: -100, blur: 70 },
  // Bottom-center pink orb
  { color: 'rgba(236, 72, 153, 0.18)', size: 360, x: 60, y: 480, blur: 90 },
  // Mid-left cyan orb
  { color: 'rgba(34, 211, 238, 0.14)', size: 240, x: -60, y: 360, blur: 60 },
] as const;

// Type exports for consumers
export type AuroraColorKey = keyof typeof AuroraColors;
export type AuroraGradientKey = keyof typeof AuroraGradients;
