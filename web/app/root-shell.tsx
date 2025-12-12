"use client";
import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import ClientNav from './nav-client';
import TopBarClient from './topbar-client';
import dynamic from 'next/dynamic';

// 动态导入粒子背景组件，禁用SSR
const ParticleBackground = dynamic(
  () => import('./_components/ParticleBackground'),
  { ssr: false }
);

export default function RootShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === '/login';
  const isEditorFullscreen = pathname?.startsWith('/admin/three-courseware/editor') || pathname?.match(/^\/admin\/three-courseware\/[^\/]+$/);
  const isPublicCourse = pathname?.startsWith('/course/');

  // 登录页有自己的背景
  if (isLogin) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
        {children}
      </div>
    );
  }

  // 编辑器全屏模式
  if (isEditorFullscreen) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--background)', color: 'var(--foreground)' }}>
        <div style={{ height: '100vh', padding: 0, margin: 0 }}>{children}</div>
      </div>
    );
  }

  // 公开课程页面
  if (isPublicCourse) {
    return (
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
        <div style={{ height: '100vh', padding: 0, margin: 0 }}>{children}</div>
      </div>
    );
  }

  // 主应用布局 - 带粒子背景
  return (
    <div style={{ 
      display: 'flex', 
      minHeight: '100vh', 
      background: 'var(--background)', 
      color: 'var(--foreground)',
      position: 'relative'
    }}>
      {/* 粒子背景 */}
      <ParticleBackground particleCount={120} interactive={true} />
      
      {/* 导航栏 */}
      <ClientNav />
      
      {/* 主内容区 */}
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        marginLeft: 240,
        position: 'relative',
        zIndex: 1
      }}>
        <TopBarClient />
        <div style={{ 
          flex: 1, 
          padding: 20, 
          overflow: 'auto', 
          marginTop: 60,
          position: 'relative'
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}
