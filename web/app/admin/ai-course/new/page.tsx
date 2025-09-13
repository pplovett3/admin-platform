"use client";
import { useEffect, useMemo, useState } from 'react';
import { Button, Form, Input, Select, message } from 'antd';
import { authFetch } from '@/app/_lib/api';
import { useRouter } from 'next/navigation';

export default function NewAICoursePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [loadingCw, setLoadingCw] = useState(false);
  const [coursewares, setCoursewares] = useState<any[]>([]);

  async function loadCoursewares() {
    setLoadingCw(true);
    try {
      const res = await authFetch<{ items: any[] }>(`/api/coursewares?page=1&limit=50`);
      setCoursewares(res.items || []);
    } catch (e: any) {
      message.error(e?.message || '课件列表加载失败');
    } finally {
      setLoadingCw(false);
    }
  }

  useEffect(() => { loadCoursewares(); }, []);

  async function onFinish(values: any) {
    setSubmitting(true);
    try {
      const res = await authFetch<any>('/api/ai-courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      message.success('创建成功');
      router.push(`/admin/ai-course/${res._id}`);
    } catch (e: any) {
      message.error(e?.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <Form layout="vertical" onFinish={onFinish} initialValues={{ coursewareId: '' }}>
        <Form.Item label="课程名称" name="title" rules={[{ required: true, message: '请输入课程名称' }]}>
          <Input placeholder="如：汽车结构AI讲解" />
        </Form.Item>
        <Form.Item label="选择三维课件" name="coursewareId" rules={[{ required: true, message: '请选择三维课件' }]}>
          <Select
            loading={loadingCw}
            showSearch
            placeholder="选择一个已有的三维课件"
            optionFilterProp="label"
            options={coursewares.map((cw) => ({ label: cw.name || cw.title || cw._id, value: cw._id }))}
          />
        </Form.Item>
        <Form.Item label="课程主题" name="theme">
          <Input placeholder="如：发动机与传动基础" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>创建</Button>
        </Form.Item>
      </Form>
    </div>
  );
}



