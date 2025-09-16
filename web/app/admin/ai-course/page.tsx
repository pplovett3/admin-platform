"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Input, Space, Table, Tag, message } from 'antd';
import { authFetch } from '@/app/_lib/api';

export default function AICourseListPage() {
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch<{ items: any[] }>(`/api/ai-courses?q=${encodeURIComponent(q)}&page=1&limit=20`);
      setData(res.items || []);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16 }}>
        <Input placeholder="搜索名称/主题" value={q} onChange={(e) => setQ(e.target.value)} onPressEnter={load} allowClear />
        <Button onClick={load}>搜索</Button>
        <Link href="/admin/ai-course/new"><Button type="primary">新建AI课程</Button></Link>
      </Space>
      <Table
        rowKey={(r) => r._id}
        loading={loading}
        dataSource={data}
        columns={[
          { title: '名称', dataIndex: 'title', key: 'title', render: (v, r) => <Link href={`/admin/ai-course/${r._id}`}>{v}</Link> },
          { title: '主题', dataIndex: 'theme', key: 'theme' },
          { title: '状态', dataIndex: 'status', key: 'status', render: (v) => <Tag color={v === 'published' ? 'green' : 'default'}>{v}</Tag> },
          { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', render: (v) => v ? new Date(v).toLocaleString() : '-' }
        ]}
      />
    </div>
  );
}







