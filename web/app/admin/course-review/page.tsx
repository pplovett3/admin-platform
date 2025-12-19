"use client";
import { useEffect, useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Tag, 
  Space, 
  Modal, 
  Input, 
  Tabs,
  App,
  Tooltip,
  Avatar,
  Empty,
  Spin
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  EyeOutlined,
  FileImageOutlined,
  ExperimentOutlined,
  AppstoreOutlined,
  StopOutlined
} from '@ant-design/icons';
import { apiGet, apiPost } from '@/app/_utils/api';

interface ReviewItem {
  id: string;
  type: 'courseware' | 'ai-course';
  name: string;
  description?: string;
  thumbnail?: string;
  reviewStatus: 'pending' | 'approved' | 'rejected';
  reviewComment?: string;
  submittedAt?: string;
  reviewedAt?: string;
  createdBy: string;
  updatedAt?: string;
}

interface ReviewListResponse {
  coursewares: {
    items: ReviewItem[];
    total: number;
  };
  aiCourses: {
    items: ReviewItem[];
    total: number;
  };
}

export default function CourseReviewPage() {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [coursewares, setCoursewares] = useState<ReviewItem[]>([]);
  const [aiCourses, setAiCourses] = useState<ReviewItem[]>([]);
  const [activeTab, setActiveTab] = useState('pending');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<ReviewItem | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReviews();
  }, [activeTab]);

  const loadReviews = async () => {
    try {
      setLoading(true);
      const resp = await apiGet<ReviewListResponse>(
        `/api/review/pending?status=${activeTab === 'all' ? 'all' : activeTab}`
      );
      setCoursewares(resp.coursewares?.items || []);
      setAiCourses(resp.aiCourses?.items || []);
    } catch (error: any) {
      message.error(error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (item: ReviewItem) => {
    setCurrentItem(item);
    setReviewComment('');
    setReviewModalOpen(true);
  };

  const submitReview = async (action: 'approve' | 'reject') => {
    if (!currentItem) return;
    
    try {
      setSubmitting(true);
      await apiPost(`/api/review/${currentItem.type}/${currentItem.id}/review`, {
        action,
        comment: reviewComment || (action === 'approve' ? '审核通过' : '审核未通过'),
      });
      message.success(action === 'approve' ? '审核已通过' : '审核已拒绝');
      setReviewModalOpen(false);
      setCurrentItem(null);
      loadReviews();
    } catch (error: any) {
      message.error(error?.message || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpublish = (item: ReviewItem) => {
    modal.confirm({
      title: '确认下架',
      content: (
        <div>
          <p>确定要下架课程「{item.name}」吗？</p>
          <p style={{ color: '#f59e0b', fontSize: 12 }}>
            下架后课程将变为草稿状态，如需重新上架需要重新提交审核。
          </p>
        </div>
      ),
      okText: '确认下架',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiPost(`/api/review/${item.type}/${item.id}/unpublish`, {
            reason: '管理员下架',
          });
          message.success('课程已下架');
          loadReviews();
        } catch (error: any) {
          message.error(error?.message || '下架失败');
        }
      },
    });
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'pending':
        return <Tag icon={<ClockCircleOutlined />} color="processing">待审核</Tag>;
      case 'approved':
        return <Tag icon={<CheckCircleOutlined />} color="success">已通过</Tag>;
      case 'rejected':
        return <Tag icon={<CloseCircleOutlined />} color="error">已拒绝</Tag>;
      default:
        return <Tag color="default">草稿</Tag>;
    }
  };

  const columns = [
    {
      title: '课件信息',
      key: 'info',
      render: (_: any, record: ReviewItem) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar
            shape="square"
            size={48}
            src={record.thumbnail}
            icon={record.type === 'courseware' ? <AppstoreOutlined /> : <ExperimentOutlined />}
            style={{
              background: record.type === 'courseware' 
                ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)' 
                : 'linear-gradient(135deg, #f59e0b, #d97706)',
            }}
          />
          <div>
            <div style={{ fontWeight: 500, color: '#e2e8f0' }}>{record.name}</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {record.description || '暂无描述'}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '类型',
      key: 'type',
      width: 100,
      render: (_: any, record: ReviewItem) => (
        <Tag color={record.type === 'courseware' ? 'purple' : 'orange'}>
          {record.type === 'courseware' ? '三维课件' : 'AI课件'}
        </Tag>
      ),
    },
    {
      title: '提交人',
      dataIndex: 'createdBy',
      key: 'createdBy',
      width: 100,
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      key: 'submittedAt',
      width: 160,
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: '状态',
      dataIndex: 'reviewStatus',
      key: 'reviewStatus',
      width: 100,
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '审核意见',
      dataIndex: 'reviewComment',
      key: 'reviewComment',
      width: 150,
      render: (comment: string) => (
        <Tooltip title={comment}>
          <span style={{ 
            color: '#94a3b8',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            maxWidth: 150,
          }}>
            {comment || '-'}
          </span>
        </Tooltip>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      render: (_: any, record: ReviewItem) => (
        <Space>
          <Tooltip title="预览">
            <Button 
              type="text" 
              size="small"
              icon={<EyeOutlined />}
              onClick={() => window.open(
                record.type === 'courseware' 
                  ? `/admin/three-courseware/${record.id}` 
                  : `/admin/ai-course/${record.id}`,
                '_blank'
              )}
              style={{ color: '#38bdf8' }}
            />
          </Tooltip>
          {record.reviewStatus === 'pending' && (
            <Tooltip title="审核">
              <Button 
                type="primary" 
                size="small"
                onClick={() => handleReview(record)}
                style={{
                  background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                  border: 'none',
                }}
              >
                审核
              </Button>
            </Tooltip>
          )}
          {record.reviewStatus === 'approved' && (
            <Tooltip title="下架课程">
              <Button 
                danger
                size="small"
                icon={<StopOutlined />}
                onClick={() => handleUnpublish(record)}
              >
                下架
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const allItems = [...coursewares, ...aiCourses].sort((a, b) => {
    const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return dateB - dateA;
  });

  const tabItems = [
    { key: 'pending', label: `待审核 (${allItems.filter(i => i.reviewStatus === 'pending').length})` },
    { key: 'approved', label: '已通过' },
    { key: 'rejected', label: '已拒绝' },
    { key: 'all', label: '全部' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
      }}>
        <h1 style={{ 
          fontSize: 24, 
          fontWeight: 600, 
          color: '#e2e8f0',
          margin: 0
        }}>
          课程审核
        </h1>
      </div>

      <Card
        style={{
          background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.6), rgba(15, 23, 42, 0.8))',
          border: '1px solid rgba(100, 116, 139, 0.2)',
          borderRadius: 16,
        }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ marginBottom: 16 }}
        />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
          </div>
        ) : allItems.length === 0 ? (
          <Empty 
            description={activeTab === 'pending' ? '暂无待审核的课件' : '暂无记录'} 
            style={{ padding: 80 }}
          />
        ) : (
          <Table
            dataSource={allItems}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>

      {/* 审核弹窗 */}
      <Modal
        title={`审核 - ${currentItem?.name}`}
        open={reviewModalOpen}
        onCancel={() => {
          setReviewModalOpen(false);
          setCurrentItem(null);
        }}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, color: '#94a3b8' }}>审核意见（可选）：</div>
          <Input.TextArea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            placeholder="请输入审核意见..."
            rows={3}
          />
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <Button 
            danger
            loading={submitting}
            onClick={() => submitReview('reject')}
            icon={<CloseCircleOutlined />}
          >
            拒绝
          </Button>
          <Button 
            type="primary"
            loading={submitting}
            onClick={() => submitReview('approve')}
            icon={<CheckCircleOutlined />}
            style={{
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              border: 'none',
            }}
          >
            通过
          </Button>
        </div>
      </Modal>
    </div>
  );
}

