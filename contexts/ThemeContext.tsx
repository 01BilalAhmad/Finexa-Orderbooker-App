// =================================================================
// FINEXA — THEME CONTEXT (Light / Dark Aurora)
// Provides the active theme mode + the resolved color palette, gradient
// set, and shadow set so any screen can theme itself without hard-
// coding light-only tokens.
//
// Modes:
//   • 'light' → AuroraColors + AuroraGradients + AuroraShadow (slate-50 bg, indigo brand)
//   • 'dark'  → AuroraDarkColors + AuroraDarkGradients + AuroraDarkShadow (#050817 bg, gold brand)
//
// Persistence:
//   Mode is stored in AsyncStorage under @finexa_theme so the user's
//   choice survives app restarts. Default mode on first launch: 'light'.
// =================================================================
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuroraColors,
  AuroraGradients,
  AuroraShadow,
  AuroraDarkColors,
  AuroraDarkGradients,
  AuroraDarkShadow,
  ThemeMode,
  AuroraPalette,
  AuroraGradientSet,
  AuroraShadowSet,
} from '@/constants/auroraTheme';

const THEME_STORAGE_KEY = '@finexa_theme';

// ─────────────────────────────────────────────────────────────────
// Context shape — exposes both the mode (for toggling) and the
// resolved palette / gradients / shadows (for direct use in styles)
// ─────────────────────────────────────────────────────────────────
export interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  colors: AuroraPalette;
  gradients: AuroraGradientSet;
  shadows: AuroraShadowSet;
  /** Status bar style for current theme ('dark' text or 'light' text) */
  statusBarStyle: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
  colors: AuroraColors,
  gradients: AuroraGradients,
  shadows: AuroraShadow,
  statusBarStyle: 'dark',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [isHydrated, setIsHydrated] = useState(false);

  // ── On mount, load saved mode from AsyncStorage ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = (await AsyncStorage.getItem(THEME_STORAGE_KEY)) as
          | ThemeMode
          | null;
        if (saved === 'light' || saved === 'dark') {
          setMode(saved);
        }
      } catch (e) {
        console.warn('[ThemeContext] Failed to load saved theme:', e);
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  // ── Persist to AsyncStorage whenever mode changes (after hydration) ─
  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode).catch((e) =>
      console.warn('[ThemeContext] Failed to save theme:', e)
    );
  }, [mode, isHydrated]);

  const setTheme = useCallback((next: ThemeMode) => setMode(next), []);
  const toggleTheme = useCallback(
    () => setMode((prev) => (prev === 'light' ? 'dark' : 'light')),
    []
  );

  // ── Resolve the active palette / gradients / shadows from mode ──
  // useMemo so consumers get stable references and React-style components
  // can use this as a dependency without re-render storms.
  const value = useMemo<ThemeContextValue>(() => {
    const isDark = mode === 'dark';
    // Cast to AuroraPalette / AuroraGradientSet / AuroraShadowSet so the
    // union of LIGHT and DARK tokens is hidden behind a single typed
    // surface. Both palettes have identical shapes after the gold colors
    // were added to LIGHT, so this cast is type-safe at runtime.
    return {
      mode,
      isDark,
      setTheme,
      toggleTheme,
      colors: (isDark ? AuroraDarkColors : AuroraColors) as AuroraPalette,
      gradients: (isDark ? AuroraDarkGradients : AuroraGradients) as AuroraGradientSet,
      shadows: (isDark ? AuroraDarkShadow : AuroraShadow) as AuroraShadowSet,
      statusBarStyle: isDark ? 'light' : 'dark',
    };
  }, [mode, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function useThemeMode(): {
  mode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
} {
  const { mode, isDark, toggleTheme, setTheme } = useTheme();
  return { mode, isDark, toggleTheme, setTheme };
}
