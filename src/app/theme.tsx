import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type TextScale = '100' | '112.5' | '125';
export type Density = 'comfortable' | 'compact';
export type WeekStartsOn = 'monday' | 'sunday';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean;
  textScale: TextScale;
  setTextScale: (s: TextScale) => void;
  density: Density;
  setDensity: (d: Density) => void;
  reducedMotion: boolean;
  setReducedMotion: (rm: boolean) => void;
  weekStartsOn: WeekStartsOn;
  setWeekStartsOn: (w: WeekStartsOn) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('ox-theme') as Theme) || 'system';
  });

  const [textScale, setTextScaleState] = useState<TextScale>(() => {
    return (localStorage.getItem('ox-text-scale') as TextScale) || '100';
  });

  const [density, setDensityState] = useState<Density>(() => {
    return (localStorage.getItem('ox-density') as Density) || 'comfortable';
  });

  const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
    return localStorage.getItem('ox-reduced-motion') === 'true';
  });

  const [weekStartsOn, setWeekStartsOnState] = useState<WeekStartsOn>(() => {
    return (localStorage.getItem('ox-week-starts-on') as WeekStartsOn) || 'monday';
  });

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('ox-theme');
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return saved === 'dark' || (!saved || saved === 'system') && systemDark;
  });

  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme() {
      const activeDark = theme === 'dark' || (theme === 'system' && media.matches);
      setIsDark(activeDark);
      if (activeDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      const meta = document.getElementById('theme-color-meta');
      if (meta) {
        meta.setAttribute('content', activeDark ? '#0E131C' : '#EEF1F4');
      }
    }

    applyTheme();

    const listener = () => {
      if (theme === 'system') applyTheme();
    };

    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme]);

  // Apply root text scale
  useEffect(() => {
    const root = document.documentElement;
    if (textScale === '100') {
      root.removeAttribute('data-text-scale');
    } else {
      root.setAttribute('data-text-scale', textScale);
    }
  }, [textScale]);

  // Apply reduced motion
  useEffect(() => {
    const root = document.documentElement;
    if (reducedMotion) {
      root.setAttribute('data-reduce-motion', 'true');
    } else {
      root.removeAttribute('data-reduce-motion');
    }
  }, [reducedMotion]);

  // Apply density
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-density', density);
  }, [density]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('ox-theme', newTheme);
    setThemeState(newTheme);
  };

  const setTextScale = (newScale: TextScale) => {
    localStorage.setItem('ox-text-scale', newScale);
    setTextScaleState(newScale);
  };

  const setDensity = (newDensity: Density) => {
    localStorage.setItem('ox-density', newDensity);
    setDensityState(newDensity);
  };

  const setReducedMotion = (rm: boolean) => {
    localStorage.setItem('ox-reduced-motion', String(rm));
    setReducedMotionState(rm);
  };

  const setWeekStartsOn = (w: WeekStartsOn) => {
    localStorage.setItem('ox-week-starts-on', w);
    setWeekStartsOnState(w);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        isDark,
        textScale,
        setTextScale,
        density,
        setDensity,
        reducedMotion,
        setReducedMotion,
        weekStartsOn,
        setWeekStartsOn,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
