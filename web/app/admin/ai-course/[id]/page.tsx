"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, Form, Input, Space, message } from 'antd';
import { authFetch } from '@/app/_lib/api';

export default function EditAICoursePage() {
  const params = useParams();
  const id = params?.id as string;
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form] = Form.useForm();
  const [courseData, setCourseData] = useState<any>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await authFetch<any>(`/api/ai-courses/${id}`);
      form.setFieldsValue(res);
      setCourseData(res);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function onSave() {
    setSaving(true);
    try {
      const values = await form.validateFields();
      const updated = { ...values, outline: courseData?.outline || [] };
      await authFetch(`/api/ai-courses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      message.success('保存成功');
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验错误
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function onGenerateAI() {
    if (!courseData?.coursewareId) {
      message.error('请先保存基础信息');
      return;
    }
    
    setGenerating(true);
    try {
      const values = await form.validateFields(['theme', 'audience', 'durationTarget']);
      const res = await authFetch<any>('/api/ai/generate-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coursewareId: courseData.coursewareId,
          theme: values.theme || '设备结构介绍',
          audience: values.audience || '初学者',
          durationTarget: values.durationTarget || 10
        })
      });
      
      // 更新课程数据
      setCourseData({ ...courseData, outline: res.outline });
      message.success('AI生成成功！已生成课程大纲');
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error(e?.message || 'AI生成失败');
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button onClick={load} loading={loading}>刷新</Button>
        <Button type="primary" onClick={onSave} loading={saving}>保存</Button>
        <Button onClick={onGenerateAI} loading={generating} style={{ backgroundColor: '#52c41a', borderColor: '#52c41a', color: 'white' }}>
          AI生成初稿
        </Button>
      </Space>
      <Form layout="vertical" form={form} style={{ maxWidth: 900 }}>
        <Form.Item label="课程名称" name="title" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item label="课程主题" name="theme">
          <Input />
        </Form.Item>
        <Form.Item label="受众" name="audience">
          <Input />
        </Form.Item>
        <Form.Item label="语言" name="language">
          <Input placeholder="zh-CN" />
        </Form.Item>
        <Form.Item label="课程目标时长(分钟)" name="durationTarget">
          <Input type="number" />
        </Form.Item>
        <Form.Item label="coursewareId" name="coursewareId" rules={[{ required: true }]}>
          <Input disabled />
        </Form.Item>
      </Form>
      
      {/* 显示生成的课程大纲 */}
      {courseData?.outline && courseData.outline.length > 0 && (
        <div style={{ marginTop: 24, padding: 16, border: '1px solid #d9d9d9', borderRadius: 6 }}>
          <h3>生成的课程大纲</h3>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, overflow: 'auto', maxHeight: 400 }}>
            {JSON.stringify(courseData.outline, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}



