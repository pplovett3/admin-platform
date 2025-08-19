"use client";
import { App, Button, Card, Form, Input } from 'antd';
import { useRouter } from 'next/navigation';
import { apiPost } from '@/app/_utils/api';

type LoginResp = { token: string };

export default function LoginPage() {
  const { message } = App.useApp();
  const router = useRouter();

  const onFinish = async (values: any) => {
    try {
      const resp = await apiPost<LoginResp>('/api/auth/login', values);
      localStorage.setItem('token', resp.token);
      router.push('/');
    } catch (e: any) {
      message.error(e?.message || '登录失败');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(180deg, #0e1730 0%, #0b1220 100%)'
    }}>
      <Card style={{ width: 360, borderRadius: 14 }} bodyStyle={{ padding: 24 }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>登录</div>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item label="手机号" name="phone" rules={[{ required: true, message: '请输入手机号' }]}>
            <Input size="large" placeholder="请输入手机号" allowClear />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password size="large" placeholder="请输入密码" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large">登录</Button>
        </Form>
      </Card>
    </div>
  );
} 