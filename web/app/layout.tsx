import './globals.css';
import type { Metadata } from 'next';
import Providers from './providers';
import RootShell from './root-shell';

export const metadata: Metadata = {
  title: 'YF课程管理平台',
  description: 'Unity 教学培训后台管理',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Providers>
          <RootShell>
            {children}
          </RootShell>
        </Providers>
      </body>
    </html>
  );
}
