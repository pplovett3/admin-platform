"use client";
import { useEffect, useState } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, App } from 'antd';
import { apiDelete, apiGet, apiPost, apiPut } from '@/app/_utils/api';

export default function SchoolsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const list = await apiGet<any[]>('/api/schools');
      setData(list);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cols = [
    { title: '名称', dataIndex: 'name' },
    { title: '代码', dataIndex: 'code' },
    { title: '启用', dataIndex: 'enabled', render: (v: boolean) => (v ? '是' : '否') },
    { title: '地址', dataIndex: 'address' },
    { title: '联系人', dataIndex: 'contact' },
    {
      title: '操作',
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" onClick={() => { setEditing(r); setOpen(true); }}>编辑</Button>
          <Button size="small" danger onClick={() => onDelete(r._id)}>删除</Button>
        </Space>
      ),
    },
  ];

  const onDelete = (id: string) => {
    Modal.confirm({ title: '删除该学校？', onOk: async () => { await apiDelete(`/api/schools/${id}`); message.success('已删除'); load(); } });
  };

  const onSubmit = async () => {
    const values = await form.validateFields();
    if (editing) {
      await apiPut(`/api/schools/${editing._id}`, values);
      message.success('已更新');
    } else {
      await apiPost('/api/schools', values);
      message.success('已创建');
    }
    setOpen(false);
    setEditing(null);
    load();
  };

  if (!mounted) return null;

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 12 }}>
        <Button type="primary" onClick={() => { setEditing(null); form.resetFields(); setOpen(true); }}>新增学校</Button>
      </Space>
      <Table rowKey="_id" columns={cols as any} dataSource={data} loading={loading} />

      <Modal
        title={editing ? '编辑学校' : '新增学校'}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={onSubmit}
        destroyOnHidden
        getContainer={false}
        afterOpenChange={(visible) => {
          if (visible && editing) {
            form.setFieldsValue({ ...editing });
          }
        }}
      >
        <Form layout="vertical" form={form} preserve={false}>
          <Form.Item name="name" label="名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="code" label="代码" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="address" label="地址"><Input /></Form.Item>
          <Form.Item name="contact" label="联系人"><Input /></Form.Item>
          <Form.Item name="enabled" label="启用"><Input placeholder="true/false" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
} 