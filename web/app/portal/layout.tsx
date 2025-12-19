"use client";
import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, parseJwt } from '@/app/_utils/auth';
import { Layout, Menu, Avatar, Dropdown, Spin } from 'antd';
import {
  HomeOutlined,
  BookOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 动态导入粒子背景组件
const ParticleBackground = dynamic(
  () => import('@/app/_components/ParticleBackground'),
  { ssr: false }
);

const { Header, Content } = Layout;

export default function PortalLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  
  // 登录页面不需要布局
  const isLoginPage = pathname === '/portal/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      router.push('/portal/login');
      return;
    }

    const payload = parseJwt(token);
    if (!payload || payload.role !== 'student') {
      // 非学生用户重定向到管理后台登录
      router.push('/login');
      return;
    }

    setUserName(payload.name || '学生');
    setLoading(false);
  }, [pathname, router, isLoginPage]);

  // 登录页面直接渲染
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0d1117'
      }}>
        <Spin size="large" />
      </div>
    );
  }

  const menuItems = [
    { key: '/portal', icon: <HomeOutlined />, label: <Link href="/portal">课程首页</Link> },
    { key: '/portal/my-study', icon: <BookOutlined />, label: <Link href="/portal/my-study">我的学习</Link> },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/portal/login');
  };

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', position: 'relative' }}>
      {/* 全局粒子背景 - 绿色主题 */}
      <ParticleBackground particleCount={100} interactive={true} theme="green" />

      {/* 顶部导航 */}
      <Header style={{
        background: 'rgba(10, 26, 24, 0.92)',
        backdropFilter: 'blur(12px)',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
        position: 'fixed',
        width: '100%',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ 
            fontSize: 20, 
            fontWeight: 700, 
            color: '#fff',
            letterSpacing: 2
          }}>
            CollabXR 课程门户
          </div>
          <Menu
            mode="horizontal"
            selectedKeys={[pathname || '/portal']}
            items={menuItems}
            style={{
              background: 'transparent',
              borderBottom: 'none',
              color: '#fff',
            }}
            theme="dark"
          />
        </div>
        
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 8, 
            cursor: 'pointer',
            color: '#fff'
          }}>
            <Avatar 
              icon={<UserOutlined />} 
              style={{ background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)' }} 
            />
            <span>{userName}</span>
          </div>
        </Dropdown>
      </Header>

      {/* 主内容区 */}
      <Content style={{
        marginTop: 64,
        minHeight: 'calc(100vh - 64px)',
        background: 'transparent',
        position: 'relative',
        zIndex: 1,
      }}>
        {children}
      </Content>
    </Layout>
  );
}
