import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('ox-theme') as Theme) || 'system';
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

  const setTheme = (newTheme: Theme) => {
    localStorage.setItem('ox-theme', newTheme);
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
