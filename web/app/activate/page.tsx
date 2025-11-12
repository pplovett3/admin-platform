"use client";
import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  App,
  Typography,
  Space,
  Alert
} from 'antd';
import { KeyOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { apiGet, apiPost } from '@/app/_utils/api';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

export default function ActivatePage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const loadCourses = async () => {
    try {
      const list = await apiGet<any[]>('/api/courses');
      setCourses(Array.isArray(list) ? list : []);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const onSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const response = await apiPost<{ message?: string }>('/api/activation/activate', {
        code: values.code.trim(),
        courseId: values.courseId
      });

      message.success(response.message || '激活成功！');
      
      // 3秒后跳转到首页
      setTimeout(() => {
        router.push('/');
      }, 3000);

    } catch (e: any) {
      message.error(e.message || '激活失败');
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div style={{ 
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: 24
    }}>
      <Card
        style={{
          width: '100%',
          maxWidth: 500,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <KeyOutlined style={{ fontSize: 48, color: '#667eea', marginBottom: 16 }} />
            <Title level={2} style={{ marginBottom: 8 }}>激活课程</Title>
            <Text type="secondary">输入激活码，开始您的学习之旅</Text>
          </div>

          <Alert
            message="激活说明"
            description="请先选择要激活的课程，然后输入您获得的激活码。激活成功后，您就可以在启动器中访问该课程了。"
            type="info"
            showIcon
          />

          <Form
            form={form}
            layout="vertical"
            onFinish={onSubmit}
          >
            <Form.Item
              label="选择课程"
              name="courseId"
              rules={[{ required: true, message: '请选择要激活的课程' }]}
            >
              <Select
                placeholder="请选择课程"
                size="large"
                options={courses.map(c => ({
                  label: c.name,
                  value: c._id,
                  description: c.description
                }))}
                optionRender={(option) => (
                  <div>
                    <div style={{ fontWeight: 500 }}>{option.label}</div>
                    {option.data.description && (
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {option.data.description}
                      </div>
                    )}
                  </div>
                )}
              />
            </Form.Item>

            <Form.Item
              label="激活码"
              name="code"
              rules={[
                { required: true, message: '请输入激活码' },
                { 
                  pattern: /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 
                  message: '激活码格式不正确（格式：XXXX-XXXX-XXXX）' 
                }
              ]}
            >
              <Input
                placeholder="XXXX-XXXX-XXXX"
                size="large"
                prefix={<KeyOutlined />}
                style={{ textTransform: 'uppercase' }}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase();
                  form.setFieldsValue({ code: value });
                }}
              />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={loading}
                icon={<CheckCircleOutlined />}
              >
                立即激活
              </Button>
            </Form.Item>
          </Form>

          <div style={{ textAlign: 'center' }}>
            <Button type="link" onClick={() => router.push('/')}>
              返回首页
            </Button>
          </div>
        </Space>
      </Card>
    </div>
  );
}

