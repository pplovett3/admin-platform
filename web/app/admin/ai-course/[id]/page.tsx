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
  const [form] = Form.useForm();

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const res = await authFetch<any>(`/api/ai-courses/${id}`);
      form.setFieldsValue(res);
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
      await authFetch(`/api/ai-courses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      message.success('保存成功');
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验错误
      message.error(e?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button onClick={load} loading={loading}>刷新</Button>
        <Button type="primary" onClick={onSave} loading={saving}>保存</Button>
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
      {/* TODO: 段落树与属性面板骨架将在阶段二实现 */}
    </div>
  );
}


