"use client";
import { useEffect, useMemo, useState } from 'react';
import { Button } from 'antd';
import { getToken, parseJwt } from './_utils/auth';
import { usePathname } from 'next/navigation';

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
    if (pathname.startsWith('/users')) return '用户管理';
    if (pathname.startsWith('/scores')) return '成绩查看';
    if (pathname.startsWith('/analytics')) return '数据总览';
    return '';
  }, [pathname]);

  return (
    <div
      style={{
        position: 'fixed',
        left: 220,
        right: 0,
        top: 0,
        height: 50,
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 16px',
        background: 'linear-gradient(180deg, rgba(20,33,66,0.75), rgba(11,18,32,0.75))',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(6px)'
      }}
    >
      <div style={{ fontWeight: 700, opacity: 0.95 }}>{title}</div>
      <div>
        <span style={{ marginRight: 12, opacity: 0.9 }}>{name || '未登录'}</span>
        <Button type="link" onClick={onLogout} style={{ color: '#22d3ee' }}>退出</Button>
      </div>
    </div>
  );
} 