import './globals.css';
import type { Metadata } from 'next';
import Providers from './providers';
import RootShell from './root-shell';

export const metadata: Metadata = {
  title: '虚拟仿真多人多地协同教学系统',
  description: '虚拟仿真多人多地协同教学系统',
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
