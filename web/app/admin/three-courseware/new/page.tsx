"use client";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Card, Form, Input, Button, App, Space, Typography } from 'antd';
import { apiPost } from '@/app/_utils/api';

export default function ThreeCoursewareCreatePage() {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    const v = await form.validateFields();
    setSubmitting(true);
    try {
      const created = await apiPost('/api/coursewares', v);
      message.success('已创建');
      router.push(`/admin/three-courseware/${created._id}`);
    } catch (e: any) { message.error(e?.message || '创建失败'); } finally { setSubmitting(false); }
  };

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>新建三维课件</Typography.Title>
      </Space>
      <Card>
        <Form layout="vertical" form={form} style={{ maxWidth: 520 }}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input placeholder="例如：汽车结构讲解"/></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
          <Button type="primary" loading={submitting} onClick={onSubmit}>创建</Button>
        </Form>
      </Card>
    </div>
  );
}


