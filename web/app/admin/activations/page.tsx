"use client";
import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Input,
  Select,
  App,
  Tag,
  Typography
} from 'antd';
import { apiDelete, apiGet } from '@/app/_utils/api';
import dayjs from 'dayjs';

const { Search } = Input;
const { Title } = Typography;

export default function ActivationsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({
    courseId: undefined,
    status: undefined,
    q: undefined
  });
  const { message } = App.useApp();

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.courseId) params.append('courseId', filters.courseId);
      if (filters.status) params.append('status', filters.status);
      if (filters.q) params.append('q', filters.q);

      const result = await apiGet<any>(`/api/activation/list?${params.toString()}`);
      setData(result.items || []);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      const list = await apiGet<any[]>('/api/courses');
      setCourses(Array.isArray(list) ? list : []);
    } catch (e: any) {
      message.error(e.message);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    load();
  }, [filters]);

  const cols = useMemo(() => [
    {
      title: '用户',
      key: 'user',
      render: (_: any, record: any) => (
        <div>
          <div>{record.userName}</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {record.studentId && `学号：${record.studentId}`}
            {record.userPhone && ` | ${record.userPhone}`}
          </div>
        </div>
      )
    },
    {
      title: '学校/班级',
      key: 'school',
      render: (_: any, record: any) => (
        <div>
          <div>{record.school || '-'}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.className || '-'}</div>
        </div>
      )
    },
    {
      title: '课程',
      key: 'course',
      render: (_: any, record: any) => (
        <div>
          <div>{record.courseName}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.courseCode}</div>
        </div>
      )
    },
    {
      title: '激活码',
      dataIndex: 'activationCode',
      key: 'activationCode'
    },
    {
      title: '激活时间',
      dataIndex: 'activatedAt',
      key: 'activatedAt',
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD') : '永久'
    },
    {
      title: '最后验证',
      dataIndex: 'lastVerifiedAt',
      key: 'lastVerifiedAt',
      render: (date: string) => date ? dayjs(date).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: any = {
          active: 'green',
          expired: 'orange',
          revoked: 'red'
        };
        const textMap: any = {
          active: '激活',
          expired: '过期',
          revoked: '已撤销'
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space size="small">
          {record.status === 'active' && (
            <Button
              size="small"
              danger
              onClick={() => onRevoke(record)}
            >
              撤销
            </Button>
          )}
        </Space>
      ),
    },
  ], []);

  const onRevoke = (record: any) => {
    Modal.confirm({
      title: '确认撤销激活？',
      content: `撤销后，用户"${record.userName}"将无法访问课程"${record.courseName}"`,
      onOk: async () => {
        try {
          await apiDelete(`/api/activation/revoke/${record.userId}/${record.courseId}`);
          message.success('已撤销激活');
          load();
        } catch (e: any) {
          message.error(e.message);
        }
      }
    });
  };

  const handleSearch = (value: string) => {
    setFilters({ ...filters, q: value });
  };

  if (!mounted) return null;

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Title level={2}>激活记录</Title>
        </div>

        {/* 筛选区域 */}
        <Space size="middle" wrap>
          <Select
            placeholder="选择课程"
            style={{ width: 200 }}
            allowClear
            value={filters.courseId}
            onChange={(value) => setFilters({ ...filters, courseId: value })}
            options={[
              { label: '全部课程', value: undefined },
              ...courses.map(c => ({ label: c.name, value: c._id }))
            ]}
          />

          <Select
            placeholder="选择状态"
            style={{ width: 150 }}
            allowClear
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={[
              { label: '全部状态', value: undefined },
              { label: '激活', value: 'active' },
              { label: '过期', value: 'expired' },
              { label: '已撤销', value: 'revoked' }
            ]}
          />

          <Search
            placeholder="搜索用户名、学号、手机号、激活码"
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
          />

          <Button onClick={load}>刷新</Button>
        </Space>

        <Table
          columns={cols}
          dataSource={data}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Space>
    </div>
  );
}

