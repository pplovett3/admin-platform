"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card, Button, Space, Table, Typography, Upload, App, Input, Select, Tag, Switch } from 'antd';
import type { UploadProps } from 'antd';
import { apiGet } from '@/app/_utils/api';

interface CoursewareRow { _id: string; name: string; glbUrl?: string; createdAt?: string; updatedAt?: string; modelStats?: any }

export default function ThreeCoursewareListPage() {
  const [rows, setRows] = useState<CoursewareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();

  const load = async () => {
    setLoading(true);
    try {
      const list = await apiGet<CoursewareRow[]>('/api/coursewares');
      setRows(Array.isArray(list) ? list : []);
    } catch (e: any) { message.error(e.message || '加载失败'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const columns = useMemo(() => [
    { title: '名称', dataIndex: 'name' },
    { title: '模型', dataIndex: 'glbUrl', render: (v: string) => v ? <a href={v} target="_blank">GLB</a> : '-' },
    { title: '更新时间', dataIndex: 'updatedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '操作', key: 'op', render: (_:any, r:CoursewareRow) => <Space>
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


