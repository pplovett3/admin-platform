"use client";
import { useEffect, useMemo, useState } from 'react';
import { Button, Avatar } from 'antd';
import { getToken, parseJwt } from './_utils/auth';
import { usePathname } from 'next/navigation';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';

export default function TopBarClient() {
  const [name, setName] = useState<string>('');
  const pathname = usePathname();

  useEffect(() => {
    const token = getToken();
    const payload = parseJwt(token);
    setName((payload as any)?.name || '');
  }, []);

  const onLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  const title = useMemo(() => {
    if (!pathname) return '';
    if (pathname.startsWith('/admin/schools')) return '学校管理';
    if (pathname.startsWith('/admin/courses')) return '课程管理';
    if (pathname.startsWith('/admin/classes')) return '班级管理';
    if (pathname.startsWith('/admin/analytics')) return '平台总览';
    if (pathname.startsWith('/admin/three-courseware')) return '三维课件';
    if (pathname.startsWith('/admin/ai-course')) return 'AI课程编辑';
    if (pathname.startsWith('/admin/activation-codes')) return '激活码管理';
    if (pathname.startsWith('/admin/activations')) return '激活记录';
    if (pathname.startsWith('/admin/quiz-records')) return '成绩管理';
    if (pathname.startsWith('/metaverse')) return '元宇宙大厅授权';
    if (pathname.startsWith('/resources')) return '资源管理';
    if (pathname.startsWith('/users')) return '用户管理';
    if (pathname.startsWith('/scores')) return '成绩查看';
    if (pathname.startsWith('/analytics')) return '数据总览';
    if (pathname.startsWith('/activate')) return '激活课程';
    return '';
  }, [pathname]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 240,
        right: 0,
        top: 0,
        height: 60,
        zIndex: 99,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0 24px',
        // 半透明毛玻璃 + 浅蓝边框发光
        background: 'linear-gradient(180deg, rgba(13, 21, 32, 0.7) 0%, rgba(10, 16, 24, 0.65) 100%)',
        backdropFilter: 'blur(20px) saturate(150%)',
        WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        borderBottom: '1px solid rgba(34, 211, 238, 0.15)',
        boxShadow: '0 4px 30px rgba(34, 211, 238, 0.05)'
      }}
    >
      
      <div style={{ 
        fontWeight: 600, 
        fontSize: 16,
        color: '#fff',
        letterSpacing: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }}>
        <div style={{
          width: 3,
          height: 18,
          background: 'linear-gradient(180deg, #22d3ee 0%, #06b6d4 100%)',
          borderRadius: 2,
          boxShadow: '0 0 10px rgba(34, 211, 238, 0.5)'
        }} />
        {title}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 16px',
          background: 'rgba(255, 255, 255, 0.06)',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <Avatar 
            size={28} 
            icon={<UserOutlined />}
            style={{ 
              background: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
              boxShadow: '0 2px 8px rgba(34, 211, 238, 0.3)'
            }}
          />
          <span style={{ 
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: 13,
            fontWeight: 500
          }}>
            {name || '未登录'}
          </span>
        </div>
        
        <Button 
          type="text" 
          onClick={onLogout}
          icon={<LogoutOutlined />}
          style={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: 13,
            padding: '6px 12px',
            borderRadius: 8
          }}
        >
          退出
        </Button>
      </div>
    </div>
  );
} 