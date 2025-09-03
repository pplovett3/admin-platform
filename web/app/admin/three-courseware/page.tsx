"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, Button, Space, Table, Typography, Upload, App, Input, Select, Tag, Switch } from 'antd';
import type { UploadProps } from 'antd';
import { apiGet } from '@/app/_utils/api';

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

  const columns = useMemo(() => [
    { title: '名称', dataIndex: 'name', width: 200 },
    { title: '描述', dataIndex: 'description', width: 300, render: (v: string) => v || '-' },
    { title: '模型', dataIndex: 'modelUrl', width: 100, render: (v: string) => v ? <a href={v} target="_blank" rel="noopener noreferrer">GLB</a> : '-' },
    { title: '创建者', dataIndex: ['createdBy', 'name'], width: 100, render: (v: string) => v || '-' },
    { title: '版本', dataIndex: 'version', width: 80, render: (v: number) => `v${v || 1}` },
    { title: '更新时间', dataIndex: 'updatedAt', width: 150, render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '操作', key: 'op', width: 100, render: (_:any, r:CoursewareRow) => <Space>
      <Link href={`/admin/three-courseware/${r._id}`}>编辑</Link>
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
    </div>
  );
}


