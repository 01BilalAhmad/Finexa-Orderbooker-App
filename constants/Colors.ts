/**
 * Legacy light/dark palette — aligned to the Aurora Glass design system
 * (finexa-app-preview-v2.html, style 1). Primary tint is indigo #4F46E5.
 */

const tintColorLight = '#4F46E5';
const tintColorDark = '#A5B4FC';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8FAFC',
    tint: tintColorLight,
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F8FAFC',
    background: '#0F172A',
    tint: tintColorDark,
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: tintColorDark,
  },
};
