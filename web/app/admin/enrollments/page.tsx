"use client";
import { useEffect, useState } from 'react';
import { Table, Button, Space, Typography, Form, Select, App, message, Modal } from 'antd';
import { apiDelete, apiGet, apiPost } from '@/app/_utils/api';
import { getToken, parseJwt } from '@/app/_utils/auth';

export default function EnrollmentsPage() {
  const [schools, setSchools] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [bindings, setBindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [filterForm] = Form.useForm();
  const { message } = App.useApp();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const me = (() => parseJwt(getToken()))();
  const isSuperadmin = me?.role === 'superadmin';

  const load = async (params?: { schoolId?: string; courseId?: string }) => {
    setLoading(true);
    try {
      const sch = await apiGet<any[]>('/api/schools');
      const cs = await apiGet<any[]>('/api/courses');
      setSchools(Array.isArray(sch) ? sch : []);
      setCourses(Array.isArray(cs) ? cs : []);
      const query = new URLSearchParams(params as any).toString();
      const list = await apiGet<any[]>(`/api/enrollments/schools${query ? `?${query}` : ''}`);
      setBindings(Array.isArray(list) ? list : []);
    } catch (e: any) { message.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const assign = async () => {
    const v = await form.validateFields();
    await apiPost('/api/enrollments/schools', { schoolId: v.schoolId, courseId: v.courseId, enabled: true });
    message.success('已授权');
    load(filterForm.getFieldsValue());
  };

  const onFilter = async () => {
    const fv = filterForm.getFieldsValue();
    load(fv);
  };

  const onDelete = async (id: string) => {
    Modal.confirm({
      title: '取消该授权？',
      onOk: async () => { await apiDelete(`/api/enrollments/schools/${id}`); message.success('已删除'); load(filterForm.getFieldsValue()); },
    });
  };

  if (!mounted) return null;

  if (!isSuperadmin) {
    return (
      <div style={{ padding: 24 }}>
        <Typography.Title level={3}>课程授权</Typography.Title>
        <Typography.Paragraph type="secondary">此页面仅超管可见。</Typography.Paragraph>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* filters */}

      <Form layout="inline" form={form} style={{ marginBottom: 12 }}>
        <Form.Item name="schoolId" label="学校" rules={[{ required: true }]}>
          <Select style={{ minWidth: 240 }} options={(schools || []).map(s => ({ value: s._id, label: s.name }))} />
        </Form.Item>
        <Form.Item name="courseId" label="课程" rules={[{ required: true }]}>
          <Select style={{ minWidth: 240 }} options={(courses || []).map(c => ({ value: c._id, label: `${c.name}(${c.type})` }))} />
        </Form.Item>
        <Button type="primary" onClick={assign}>授权</Button>
      </Form>

      <Form layout="inline" form={filterForm} style={{ marginBottom: 12 }} onValuesChange={onFilter}>
        <Form.Item name="schoolId" label="学校">
          <Select allowClear style={{ minWidth: 240 }} options={(schools || []).map(s => ({ value: s._id, label: s.name }))} />
        </Form.Item>
        <Form.Item name="courseId" label="课程">
          <Select allowClear style={{ minWidth: 240 }} options={(courses || []).map(c => ({ value: c._id, label: `${c.name}(${c.type})` }))} />
        </Form.Item>
        <Button onClick={onFilter}>筛选</Button>
      </Form>

      <Table rowKey={(r) => r._id} loading={loading} dataSource={bindings || []} columns={[
        { title: '学校', dataIndex: ['schoolId','name'], render: (_: any, r: any) => r.schoolId?.name || '-' },
        { title: '课程', dataIndex: ['courseId','name'], render: (_: any, r: any) => r.courseId?.name || '-' },
        { title: '启用', dataIndex: 'enabled', render: (v: boolean) => (v ? '是' : '否') },
        { title: '操作', render: (_: any, r: any) => <Button size="small" danger onClick={() => onDelete(r._id)}>删除</Button> },
      ] as any} />
    </div>
  );
} 