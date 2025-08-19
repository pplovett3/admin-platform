"use client";
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import ClientNav from './nav-client';
import TopBarClient from './topbar-client';

export default function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';

  if (isLogin) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
        {children}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
      <ClientNav />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginLeft: 220, background: 'var(--background)' }}>
        <TopBarClient />
        <div style={{ flex: 1, padding: 16, background: 'var(--background)', overflow: 'auto', marginTop: 50 }}>{children}</div>
      </div>
    </div>
  );
} 