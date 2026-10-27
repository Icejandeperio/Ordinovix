import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'system' | 'light' | 'dark';
export type TextScale = '100' | '112.5' | '125';
export type Density = 'comfortable' | 'compact';
export type WeekStartsOn = 'monday' | 'sunday';
export type PaletteId = 'amethyst' | 'terracotta' | 'pine' | 'cobalt' | 'vermilion' | 'obsidian';

export interface PaletteDefinition {
  id: PaletteId;
  name: string;
  tagline: string;
  primaryLight: string;
  primaryDark: string;
  secondaryLight: string;
  secondaryDark: string;
  previewBgLight: string;
  previewBgDark: string;
}

export const PALETTES: PaletteDefinition[] = [
  {
    id: 'amethyst',
    name: 'Classic Amethyst',
    tagline: 'Royal violet & deep teal — Original tax seal heritage',
    primaryLight: '#5A3DB8',
    primaryDark: '#A794F5',
    secondaryLight: '#00928A',
    secondaryDark: '#14A89E',
    previewBgLight: '#EFEAFB',
    previewBgDark: '#251E44',
  },
  {
    id: 'terracotta',
    name: 'Manila Terracotta',
    tagline: 'Warm clay & slate navy — Low blue-light eye comfort',
    primaryLight: '#C2410C',
    primaryDark: '#FB923C',
    secondaryLight: '#1E3A8A',
    secondaryDark: '#60A5FA',
    previewBgLight: '#FFEDD5',
    previewBgDark: '#3A1E11',
  },
  {
    id: 'pine',
    name: 'Pine & Brass',
    tagline: 'Forest pine & warm brass — Classic banking ledger calm',
    primaryLight: '#0F766E',
    primaryDark: '#2DD4BF',
    secondaryLight: '#B45309',
    secondaryDark: '#FBBF24',
    previewBgLight: '#CCFBF1',
    previewBgDark: '#112C28',
  },
  {
    id: 'cobalt',
    name: 'Maritime Cobalt',
    tagline: 'Pacific cobalt & copper — High-contrast institutional clarity',
    primaryLight: '#1D4ED8',
    primaryDark: '#60A5FA',
    secondaryLight: '#EA580C',
    secondaryDark: '#FB923C',
    previewBgLight: '#DBEAFE',
    previewBgDark: '#152747',
  },
  {
    id: 'vermilion',
    name: 'Vermilion Sand',
    tagline: 'Vermilion red & golden sand — Bold, warm accent',
    primaryLight: '#BE123C',
    primaryDark: '#FB7185',
    secondaryLight: '#A16207',
    secondaryDark: '#FACC15',
    previewBgLight: '#FFE4E6',
    previewBgDark: '#3E151E',
  },
  {
    id: 'obsidian',
    name: 'Monolith Obsidian',
    tagline: 'Graphite slate & honey gold — Minimalist neutral architectural focus',
    primaryLight: '#334155',
    primaryDark: '#94A3B8',
    secondaryLight: '#D97706',
    secondaryDark: '#F59E0B',
    previewBgLight: '#F1F5F9',
    previewBgDark: '#1E293B',
  },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  palette: PaletteId;
  setPalette: (p: PaletteId) => void;
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

  const [palette, setPaletteState] = useState<PaletteId>(() => {
    return (localStorage.getItem('ox-palette') as PaletteId) || 'amethyst';
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

  // Apply color palette
  useEffect(() => {
    const root = document.documentElement;
    if (palette === 'amethyst') {
      root.removeAttribute('data-palette');
    } else {
      root.setAttribute('data-palette', palette);
    }
  }, [palette]);

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('ox-theme', newTheme);
    setThemeState(newTheme);
  };

  const setPalette = (newPalette: PaletteId) => {
    localStorage.setItem('ox-palette', newPalette);
    setPaletteState(newPalette);
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
        palette,
        setPalette,
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
