"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, Button, Space, Table, Typography, Upload, App, Input, Select, Tag, Switch, Modal, Form, Popconfirm } from 'antd';
import type { UploadProps } from 'antd';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { apiGet, apiPut, apiDelete } from '@/app/_utils/api';

interface CoursewareRow { 
  _id: string; 
  name: string; 
  description?: string;
  modelUrl?: string; 
  createdAt?: string; 
  updatedAt?: string; 
  createdBy?: { name: string };
  version?: number;
}

interface CoursewareListResponse {
  items: CoursewareRow[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function ThreeCoursewareListPage() {
  const [rows, setRows] = useState<CoursewareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CoursewareRow | null>(null);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  const load = async () => {
    setLoading(true);
    try {
      const response = await apiGet<CoursewareListResponse>('/api/coursewares');
      if (response && response.items) {
        setRows(response.items);
        setPagination(response.pagination);
      } else {
        // 兼容旧的直接数组格式
        setRows(Array.isArray(response) ? response : []);
      }
    } catch (e: any) { message.error(e.message || '加载失败'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // 编辑课件
  const handleEdit = (item: CoursewareRow) => {
    setEditingItem(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description || ''
    });
    setEditModalOpen(true);
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      await apiPut(`/api/coursewares/${editingItem!._id}`, values);
      message.success('课件信息已更新');
      setEditModalOpen(false);
      setEditingItem(null);
      load(); // 重新加载列表
    } catch (e: any) {
      message.error(e.message || '保存失败');
    }
  };

  // 删除课件
  const handleDelete = async (item: CoursewareRow) => {
    try {
      await apiDelete(`/api/coursewares/${item._id}`);
      message.success('课件已删除');
      load(); // 重新加载列表
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  const columns = useMemo(() => [
    { title: '名称', dataIndex: 'name', width: 200 },
    { title: '描述', dataIndex: 'description', width: 300, render: (v: string) => v || '-' },
    { title: '模型', dataIndex: 'modelUrl', width: 100, render: (v: string) => v ? <a href={v} target="_blank" rel="noopener noreferrer">GLB</a> : '-' },
    { title: '创建者', dataIndex: ['createdBy', 'name'], width: 100, render: (v: string) => v || '-' },
    { title: '更新时间', dataIndex: 'updatedAt', width: 150, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '操作', key: 'op', width: 150, render: (_:any, r:CoursewareRow) => <Space>
      <Link href={`/admin/three-courseware/${r._id}`}>
        <Button type="link" size="small">编辑内容</Button>
      </Link>
      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>修改</Button>
      <Popconfirm
        title="确定删除此课件吗？"
        description="删除后无法恢复，请谨慎操作。"
        onConfirm={() => handleDelete(r)}
        okText="确定"
        cancelText="取消"
      >
        <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
      </Popconfirm>
    </Space> },
  ],[]);

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>三维课件</Typography.Title>
        <Link href={`/admin/three-courseware/new`}><Button type="primary">新建课件</Button></Link>
      </Space>
      <Card>
        <Table rowKey="_id" loading={loading} dataSource={rows} columns={columns as any} pagination={false} />
      </Card>

      {/* 编辑课件弹窗 */}
      <Modal
        title="修改课件信息"
        open={editModalOpen}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingItem(null);
        }}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="课件名称"
            rules={[{ required: true, message: '请输入课件名称' }]}
          >
            <Input placeholder="请输入课件名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="课件描述"
          >
            <Input.TextArea rows={3} placeholder="请输入课件描述" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}


