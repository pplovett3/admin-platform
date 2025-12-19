"use client";
import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getToken, parseJwt, Role } from '@/app/_utils/auth';
import { Layout, Menu, Spin, Button, Avatar, Dropdown } from 'antd';
import {
  AppstoreOutlined,
  FileOutlined,
  ExperimentOutlined,
  ArrowLeftOutlined,
  UserOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 动态导入粒子背景组件
const ParticleBackground = dynamic(
  () => import('@/app/_components/ParticleBackground'),
  { ssr: false }
);

const { Header, Sider, Content } = Layout;

export default function EditorLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [userRole, setUserRole] = useState<Role | undefined>(undefined);

  // 全屏编辑器模式（三维课件编辑器和AI课件编辑器）
  const isFullscreenEditor = 
    pathname?.match(/^\/editor\/three-courseware\/[^\/]+$/) ||
    pathname?.startsWith('/editor/three-courseware/editor') ||
    pathname?.match(/^\/editor\/ai-course\/[^\/]+$/);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.push('/login');
      return;
    }

    const payload = parseJwt(token);
    if (!payload) {
      router.push('/login');
      return;
    }

    // 只允许超管、校管、老师访问编辑器
    if (!['superadmin', 'schoolAdmin', 'teacher'].includes(payload.role)) {
      router.push('/login');
      return;
    }

    setUserName(payload.name || '用户');
    setUserRole(payload.role);
    setLoading(false);
  }, [pathname, router]);

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

  // 全屏编辑器模式直接渲染内容
  if (isFullscreenEditor) {
    return <>{children}</>;
  }

  const menuItems = [
    { 
      key: '/editor', 
      icon: <AppstoreOutlined />, 
      label: <Link href="/editor">编辑器首页</Link> 
    },
    { 
      key: '/editor/resources', 
      icon: <FileOutlined />, 
      label: <Link href="/editor/resources">资源管理</Link> 
    },
    { 
      key: '/editor/three-courseware', 
      icon: <AppstoreOutlined />, 
      label: <Link href="/editor/three-courseware">三维课件</Link> 
    },
    { 
      key: '/editor/ai-course', 
      icon: <ExperimentOutlined />, 
      label: <Link href="/editor/ai-course">AI课件</Link> 
    },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  const userMenuItems = [
    {
      key: 'admin',
      icon: <SettingOutlined />,
      label: '管理后台',
      onClick: () => router.push('/admin/analytics'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh', position: 'relative' }}>
      {/* 全局粒子背景 - 紫色主题 */}
      <ParticleBackground particleCount={100} interactive={true} theme="purple" />
      
      {/* 侧边栏 */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
        style={{
          background: 'linear-gradient(180deg, rgba(26, 20, 46, 0.92) 0%, rgba(22, 18, 42, 0.92) 100%)',
          borderRight: '1px solid rgba(139, 92, 246, 0.25)',
          backdropFilter: 'blur(12px)',
          zIndex: 10,
        }}
        theme="dark"
      >
        {/* Logo */}
        <div style={{ 
          padding: collapsed ? '20px 12px' : '20px 20px', 
          borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
          textAlign: collapsed ? 'center' : 'left',
        }}>
          {collapsed ? (
            <div style={{ 
              fontSize: 20, 
              fontWeight: 700, 
              color: '#a78bfa',
            }}>
              3D
            </div>
          ) : (
            <>
              <div style={{ 
                fontSize: 18, 
                fontWeight: 700, 
                color: '#fff',
                letterSpacing: 1,
              }}>
                三维课件编辑器
              </div>
              <div style={{ 
                fontSize: 11, 
                color: 'rgba(148, 163, 184, 0.6)',
                marginTop: 4,
              }}>
                CollabXR Content Studio
              </div>
            </>
          )}
        </div>

        {/* 导航菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[pathname || '/editor']}
          items={menuItems}
          style={{ 
            background: 'transparent',
            borderRight: 0,
            padding: '8px 0',
          }}
          theme="dark"
        />

        {/* 底部返回按钮 */}
        <div style={{ 
          position: 'absolute', 
          bottom: 60, 
          left: 0, 
          right: 0, 
          padding: collapsed ? '0 12px' : '0 20px',
        }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />}
            onClick={() => router.push('/admin/analytics')}
            style={{ 
              color: 'rgba(148, 163, 184, 0.8)', 
              width: '100%',
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            {!collapsed && '返回管理后台'}
          </Button>
        </div>
      </Sider>

      <Layout>
        {/* 顶部栏 */}
        <Header style={{
          background: 'rgba(26, 20, 46, 0.92)',
          backdropFilter: 'blur(12px)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(139, 92, 246, 0.2)',
        }}>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            {pathname === '/editor' && '欢迎使用三维课件编辑器'}
            {pathname === '/editor/resources' && '资源管理'}
            {pathname === '/editor/three-courseware' && '三维课件列表'}
            {pathname === '/editor/ai-course' && 'AI课件列表'}
            {pathname?.startsWith('/editor/three-courseware/new') && '新建三维课件'}
            {pathname?.startsWith('/editor/ai-course/new') && '新建AI课件'}
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
                style={{ background: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)' }} 
              />
              <span>{userName}</span>
            </div>
          </Dropdown>
        </Header>

        {/* 主内容区 */}
        <Content style={{
          background: 'transparent',
          minHeight: 'calc(100vh - 64px)',
          position: 'relative',
          zIndex: 1,
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}

