"use client";
import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, Select, App, message as rawMessage } from 'antd';
import { apiDelete, apiGet, apiPost, apiPut } from '@/app/_utils/api';

export default function CoursesPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [modulesCourse, setModulesCourse] = useState<any | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const list = await apiGet<any[]>('/api/courses');
      setData(Array.isArray(list) ? list : []);
    } catch (e: any) { message.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const cols = useMemo(() => [
    { title: '名称', dataIndex: 'name' },
    { title: '代码', dataIndex: 'code' },
    { title: '类型', dataIndex: 'type' },
    { title: '启用', dataIndex: 'enabled', render: (v: boolean) => (v ? '是' : '否') },
    { title: '描述', dataIndex: 'description' },
    {
      title: '操作',
      render: (_: any, r: any) => (
        <Space>
          <Button
            size="small"
            onClick={() => {
              setEditing(r);
              form.setFieldsValue({
                name: r.name,
                code: r.code,
                type: r.type,
                description: r.description,
                enabled: typeof r.enabled === 'boolean' ? String(r.enabled) : r.enabled,
              });
              setOpen(true);
            }}
          >编辑</Button>
          {r.type === 'modular' && <Button size="small" onClick={() => manageModules(r)}>模块</Button>}
          <Button size="small" danger onClick={() => onDelete(r._id)}>删除</Button>
        </Space>
      ),
    },
  ], [form]);

  useEffect(() => {
    if (open && editing) {
      form.setFieldsValue({
        name: editing.name,
        code: editing.code,
        type: editing.type,
        description: editing.description,
        enabled: typeof editing.enabled === 'boolean' ? String(editing.enabled) : editing.enabled,
      });
    }
  }, [open, editing, form]);

  const onDelete = (id: string) => {
    Modal.confirm({ title: '删除该课程？', onOk: async () => { await apiDelete(`/api/courses/${id}`); message.success('已删除'); load(); } });
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    if (editing) { await apiPut(`/api/courses/${editing._id}`, values); message.success('已更新'); }
    else { await apiPost('/api/courses', values); message.success('已创建'); }
    setOpen(false); setEditing(null); load();
  };

  const manageModules = async (course: any) => {
    setModulesCourse(course);
    setModulesOpen(true);
  };

  if (!mounted) return null;

  const initialValues = editing ? {
    name: editing.name,
    code: editing.code,
    type: editing.type,
    description: editing.description,
    enabled: typeof editing.enabled === 'boolean' ? String(editing.enabled) : editing.enabled,
  } : undefined;

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>新增课程</Button>
      </Space>
      <Table rowKey="_id" columns={cols as any} dataSource={data || []} loading={loading} />

      <Modal title={editing ? '编辑课程' : '新增课程'} open={open} onCancel={() => setOpen(false)} onOk={onSubmit} destroyOnHidden getContainer={false}>
        <Form layout="vertical" form={form} preserve={false} initialValues={initialValues}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="代码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}> 
            <Select options={[{ value: 'simple', label: '简单课程(时长)' }, { value: 'modular', label: '模块化课程' }]} />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="enabled" label="启用"><Input placeholder="true/false" /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`模块管理 - ${modulesCourse?.name || ''}`} open={modulesOpen} onCancel={() => setModulesOpen(false)} footer={null} destroyOnHidden getContainer={false}>
        {modulesCourse && <ModuleManager course={modulesCourse} initial={[]} onChange={() => {}} />}
      </Modal>
    </div>
  );
}

function ModuleManager({ course, initial, onChange }: { course: any; initial: any[]; onChange: () => void }) {
  const [items, setItems] = useState<any[]>(initial || []);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const load = async () => {
    setLoading(true);
    try { setItems(Array.isArray(await apiGet<any[]>(`/api/courses/${course._id}/modules`)) ? await apiGet<any[]>(`/api/courses/${course._id}/modules`) : []); } catch { } finally { setLoading(false); }
  };

  const add = async () => {
    const v = await form.validateFields();
    await apiPost(`/api/courses/${course._id}/modules`, v);
    form.resetFields();
    load();
  };

  const del = async (id: string) => {
    await apiDelete(`/api/courses/${course._id}/modules/${id}`);
    load();
  };

  useEffect(() => { load(); }, [course?._id]);

  return (
    <div>
      <Form layout="inline" form={form} style={{ marginBottom: 12 }}>
        <Form.Item name="moduleId" label="模块ID" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="maxScore" label="满分"><Input placeholder="100" /></Form.Item>
        <Form.Item name="order" label="排序"><Input placeholder="0" /></Form.Item>
        <Button type="primary" onClick={add}>新增模块</Button>
      </Form>
      <Table rowKey="_id" loading={loading} dataSource={items || []} pagination={false} columns={[
        { title: '模块ID', dataIndex: 'moduleId' },
        { title: '名称', dataIndex: 'name' },
        { title: '满分', dataIndex: 'maxScore' },
        { title: '排序', dataIndex: 'order' },
        { title: '操作', render: (_: any, r: any) => <Button danger size="small" onClick={() => del(r._id)}>删除</Button> },
      ] as any} />
    </div>
  );
} 