"use client";
import { ConfigProvider, theme, App as AntdApp } from 'antd';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type UiTheme = 'dark' | 'light';

interface ThemeContextValue {
  uiTheme: UiTheme;
  setUiTheme: (t: UiTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
export function useUiTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useUiTheme must be used within Providers');
  return ctx;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [uiTheme, setUiTheme] = useState<UiTheme>('dark');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? (localStorage.getItem('uiTheme') as UiTheme | null) : null;
    if (saved === 'light' || saved === 'dark') setUiTheme(saved);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('uiTheme', uiTheme);
  }, [uiTheme]);

  // keep global CSS variables in sync so the whole page background switches
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (uiTheme === 'light') {
      root.style.setProperty('--background', '#f7f9fc');
      root.style.setProperty('--foreground', '#0f172a');
    } else {
      root.style.setProperty('--background', '#0b1220');
      root.style.setProperty('--foreground', '#d6e4ff');
    }
  }, [uiTheme]);

  const antdTheme = useMemo(() => {
    if (uiTheme === 'light') {
      return {
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: '#14b8a6',
          colorInfo: '#14b8a6',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          colorTextBase: '#0f172a',
          colorTextSecondary: '#334155',
          colorBgBase: '#f7f9fc',
          colorBgLayout: '#f7f9fc',
          colorBgContainer: '#ffffff',
          colorBorder: '#e2e8f0',
          borderRadius: 10,
          borderRadiusLG: 14,
          borderRadiusSM: 8,
          boxShadow: '0 6px 20px rgba(2, 6, 23, 0.08)',
          boxShadowSecondary: '0 2px 10px rgba(2, 6, 23, 0.06)'
        },
        components: {
          Card: {
            colorBgContainer: '#ffffff',
            borderRadiusLG: 14,
            boxShadow: '0 8px 24px rgba(2, 6, 23, 0.06)'
          },
        },
      } as any;
    }
    // dark
    return {
      algorithm: theme.darkAlgorithm,
      token: {
        colorPrimary: '#22d3ee', // teal/cyan accent
        colorInfo: '#22d3ee',
        colorSuccess: '#34d399',
        colorWarning: '#fbbf24',
        colorError: '#f87171',
        colorBgBase: '#0b1220',
        colorBgLayout: '#0b1220',
        colorBgContainer: '#0f1b36',
        colorBgElevated: '#0f1b36',
        colorBorder: '#193357',
        colorTextBase: '#c7d2fe',
        colorTextSecondary: '#99a7c2',
        borderRadius: 10,
        borderRadiusLG: 14,
        borderRadiusSM: 8,
        boxShadow: '0 10px 30px rgba(2, 11, 32, 0.55)',
        boxShadowSecondary: '0 6px 18px rgba(2, 11, 32, 0.45)'
      },
      components: {
        Card: {
          colorBgContainer: '#0f1b36',
          borderRadiusLG: 14,
          boxShadow: '0 10px 30px rgba(2, 11, 32, 0.55)'
        },
        Table: {
          headerBg: '#132448',
          headerColor: '#c7d2fe',
          rowHoverBg: '#14284d',
          colorBgContainer: '#0f1b36'
        },
        Menu: {
          itemSelectedBg: '#14325c',
          itemActiveBg: '#102a4a',
          itemColor: '#9fb3d6',
          itemSelectedColor: '#ffffff'
        },
        Modal: {
          colorBgElevated: '#0f1b36',
          borderRadiusLG: 12
        },
        Tabs: {
          itemSelectedColor: '#22d3ee',
          inkBarColor: '#22d3ee'
        }
      }
    } as any;
  }, [uiTheme]);

  const ctxValue = useMemo(() => ({ uiTheme, setUiTheme }), [uiTheme]);

  return (
    <ThemeContext.Provider value={ctxValue}>
      <ConfigProvider theme={antdTheme}>
        <AntdApp>{children}</AntdApp>
      </ConfigProvider>
    </ThemeContext.Provider>
  );
} 