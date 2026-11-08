import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light' | 'special' | 'system';

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'dark' | 'light' | 'special';
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  resolvedTheme: 'dark',
  setTheme: () => {},
});

const THEME_STORAGE_KEY = 'azod_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'dark';
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (saved === 'dark' || saved === 'light' || saved === 'special' || saved === 'system') {
        return saved;
      }
    } catch {
      // fallback
    }
    return 'dark';
  });

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light' | 'special'>('dark');

  useEffect(() => {
    const root = document.documentElement;

    const computeResolved = (selected: ThemeMode): 'dark' | 'light' | 'special' => {
      if (selected === 'special') return 'special';
      if (selected === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return selected;
    };

    const resolved = computeResolved(theme);
    setResolvedTheme(resolved);

    if (resolved === 'special') {
      root.classList.add('dark', 'theme-special');
      root.classList.remove('light');
      root.style.colorScheme = 'dark';
    } else if (resolved === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light', 'theme-special');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark', 'theme-special');
      root.classList.add('light');
      root.style.colorScheme = 'light';
    }

    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // ignore
    }

    // Listener for system preference changes when in 'system' mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e: MediaQueryListEvent) => {
        const next = e.matches ? 'dark' : 'light';
        setResolvedTheme(next);
        if (next === 'dark') {
          root.classList.add('dark');
          root.classList.remove('light', 'theme-special');
          root.style.colorScheme = 'dark';
        } else {
          root.classList.remove('dark', 'theme-special');
          root.classList.add('light');
          root.style.colorScheme = 'light';
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
