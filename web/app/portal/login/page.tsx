"use client";
import { App, Button, Card, Form, Input } from 'antd';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/app/_utils/api';
import { parseJwt } from '@/app/_utils/auth';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 动态导入粒子背景组件
const ParticleBackground = dynamic(
  () => import('@/app/_components/ParticleBackground'),
  { ssr: false }
);

type LoginResp = { token: string };

export default function PortalLoginPage() {
  const { message } = App.useApp();
  const router = useRouter();

  const onFinish = async (values: any) => {
    try {
      const resp = await apiPost<LoginResp>('/api/auth/login', values);
      const token = resp.token;
      
      // 解析 JWT 获取角色信息
      const payload = parseJwt(token);
      
      // 只允许学生登录
      if (payload?.role !== 'student') {
        message.error('此入口仅供学生使用，管理员请从管理后台登录');
        return;
      }
      
      localStorage.setItem('token', token);
      router.push('/portal');
    } catch (e: any) {
      message.error(e?.message || '登录失败');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      gap: 32
    }}>
      {/* 粒子网络背景 - 绿色主题 */}
      <ParticleBackground particleCount={150} interactive={true} theme="green" />
      
      {/* 平台标题 */}
      <div style={{
        zIndex: 10,
        textAlign: 'center',
        position: 'relative'
      }}>
        <h1 style={{
          fontSize: 38,
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: 4,
          margin: 0,
          textShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif'
        }}>
          CollabXR 课程门户
        </h1>
        <p style={{
          fontSize: 14,
          color: 'rgba(255, 255, 255, 0.85)',
          marginTop: 8,
          letterSpacing: 2
        }}>
          探索沉浸式学习体验
        </p>
      </div>
      
      {/* 登录卡片 - 绿色主题毛玻璃 */}
      <Card 
        style={{ 
          width: 400, 
          borderRadius: 20,
          background: 'rgba(10, 26, 24, 0.88)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          zIndex: 10,
          position: 'relative',
        }} 
        styles={{ body: { padding: 36 } }}
      >
        <div style={{ 
          fontSize: 22, 
          fontWeight: 600, 
          marginBottom: 28, 
          textAlign: 'center',
          color: '#ffffff',
          letterSpacing: 2,
        }}>
          学生登录
        </div>
        
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item 
            label={<span style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 13 }}>手机号</span>} 
            name="phone" 
            rules={[{ required: true, message: '请输入手机号' }]}
          >
            <Input 
              size="large" 
              placeholder="请输入手机号" 
              allowClear 
              style={{
                borderRadius: 10,
                height: 48,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#fff',
              }}
            />
          </Form.Item>
          <Form.Item 
            label={<span style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 13 }}>密码</span>} 
            name="password" 
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password 
              size="large" 
              placeholder="请输入密码"
              style={{
                borderRadius: 10,
                height: 48,
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                color: '#fff',
              }}
            />
          </Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            block 
            size="large"
            style={{
              marginTop: 12,
              height: 52,
              borderRadius: 12,
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: 4,
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)',
              border: 'none',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
            }}
          >
            进入学习
          </Button>
        </Form>

        {/* 管理员入口 */}
        <div style={{ 
          marginTop: 24, 
          textAlign: 'center',
          paddingTop: 20,
          borderTop: '1px solid rgba(16, 185, 129, 0.15)'
        }}>
          <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 13 }}>
            教师/管理员？
          </span>
          <Link 
            href="/login" 
            style={{ 
              color: '#34d399', 
              marginLeft: 8,
              fontSize: 13,
              textDecoration: 'none'
            }}
          >
            前往管理后台登录
          </Link>
        </div>
      </Card>
    </div>
  );
}
