"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Input, Space, Tag, Empty, Spin, Typography, Tooltip, Popconfirm, App } from 'antd';
import { PlusOutlined, SearchOutlined, FileImageOutlined, EyeOutlined, EditOutlined, DeleteOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, SendOutlined } from '@ant-design/icons';
import { apiGet, apiDelete, apiPost } from '@/app/_utils/api';

interface AICourseRow {
  _id: string;
  title: string;
  theme?: string;
  thumbnail?: string;
  status: 'draft' | 'published';
  reviewStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
  updatedAt?: string;
  createdBy?: { name: string };
  courseVersion?: number;
}

// 转换缩略图URL为公开访问格式
function getThumbnailUrl(url?: string): string | null {
  if (!url) return null;
  if (url.includes('/api/files/thumbnail/')) return url;
  const match = url.match(/\/api\/files\/([a-f0-9]{24})\/download/i);
  if (match) {
    return `/api/files/thumbnail/${match[1]}`;
  }
  return url;
}

// AI课程卡片组件
function AICourseCard({ 
  item,
  onDelete,
  onSubmitReview,
}: { 
  item: AICourseRow;
  onDelete: (item: AICourseRow) => void;
  onSubmitReview: (item: AICourseRow) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const thumbnailUrl = getThumbnailUrl(item.thumbnail);

  const getReviewStatusTag = () => {
    const tagStyle: React.CSSProperties = {
      fontWeight: 600,
      fontSize: 12,
      padding: '2px 10px',
      borderRadius: 4,
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      border: 'none',
    };
    switch (item.reviewStatus) {
      case 'pending':
        return <Tag icon={<ClockCircleOutlined />} style={{ ...tagStyle, background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: '#fff' }}>待审核</Tag>;
      case 'approved':
        return <Tag icon={<CheckCircleOutlined />} style={{ ...tagStyle, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>已通过</Tag>;
      case 'rejected':
        return <Tag icon={<ExclamationCircleOutlined />} style={{ ...tagStyle, background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff' }}>已拒绝</Tag>;
      default:
        return <Tag style={{ ...tagStyle, background: 'linear-gradient(135deg, #64748b, #475569)', color: '#fff' }}>草稿</Tag>;
    }
  };
  
  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(245, 158, 11, 0.2)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      position: 'relative',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.4)';
      e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.5)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
      e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.2)';
    }}
    >
      {/* 缩略图区域 */}
      <Link href={`/editor/ai-course/${item._id}`}>
        <div style={{
          width: '100%',
          aspectRatio: '16/10',
          background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {thumbnailUrl && !imageError ? (
            <img 
              src={thumbnailUrl} 
              alt={item.title}
              onError={() => setImageError(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              color: 'rgba(245, 158, 11, 0.4)',
            }}>
              <FileImageOutlined style={{ fontSize: 48 }} />
              <span style={{ fontSize: 12 }}>暂无预览</span>
            </div>
          )}
          
          {/* 审核状态标签 */}
          <div style={{ position: 'absolute', top: 12, right: 12 }}>
            {getReviewStatusTag()}
          </div>
          
          {/* 悬停遮罩 */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(15, 23, 42, 0.9) 0%, transparent 50%)',
            opacity: 0,
            transition: 'opacity 0.3s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          className="card-overlay"
          >
            <Button type="primary" icon={<EyeOutlined />} style={{ 
              background: 'rgba(245, 158, 11, 0.9)',
              borderColor: 'transparent',
            }}>
              编辑课程
            </Button>
          </div>
        </div>
      </Link>
      
      {/* 信息区域 */}
      <div style={{ padding: '16px 16px 12px' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: 8,
        }}>
          <Tooltip title={item.title}>
            <h3 style={{ 
              margin: 0, 
              fontSize: 15,
              fontWeight: 600,
              color: '#e2e8f0',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              marginRight: 8,
            }}>
              {item.title}
            </h3>
          </Tooltip>
          <span style={{
            fontSize: 11,
            color: '#64748b',
            whiteSpace: 'nowrap',
          }}>
            v{item.courseVersion || 1}
          </span>
        </div>
        
        <p style={{ 
          margin: '0 0 12px',
          fontSize: 13,
          color: '#f59e0b',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: 1.5,
        }}>
          {item.theme || '暂无主题'}
        </p>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingTop: 12,
          borderTop: '1px solid rgba(245, 158, 11, 0.15)',
        }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            <div>{item.createdBy?.name || 'Admin'}</div>
            <div>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}</div>
          </div>
          <Space size={4}>
            {/* 提交审核按钮 - 仅在草稿或被拒绝状态显示 */}
            {(!item.reviewStatus || item.reviewStatus === 'draft' || item.reviewStatus === 'rejected') && (
              <Tooltip title="提交审核">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<SendOutlined />}
                  onClick={(e) => { e.stopPropagation(); onSubmitReview(item); }}
                  style={{ color: '#22d3ee' }}
                />
              </Tooltip>
            )}
            <Link href={`/editor/ai-course/${item._id}`}>
              <Tooltip title="编辑">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<EditOutlined />}
                  style={{ color: '#f59e0b' }}
                />
              </Tooltip>
            </Link>
            <Popconfirm
              title="确定删除此课程吗？"
              description="删除后无法恢复，请谨慎操作。"
              onConfirm={() => onDelete(item)}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="删除">
                <Button 
                  type="text" 
                  size="small" 
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Tooltip>
            </Popconfirm>
          </Space>
        </div>
      </div>
      
      {/* 卡片悬停样式 */}
      <style jsx>{`
        div:hover .card-overlay {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}

export default function EditorAICourseListPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState<AICourseRow[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await apiGet<{ items: AICourseRow[] }>(`/api/ai-courses?q=${encodeURIComponent(q)}&page=1&limit=50`);
      setData(res.items || []);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(item: AICourseRow) {
    try {
      await apiDelete(`/api/ai-courses/${item._id}`);
      message.success('课程已删除');
      load();
    } catch (e: any) {
      message.error(e?.message || '删除失败');
    }
  }

  async function handleSubmitReview(item: AICourseRow) {
    try {
      await apiPost(`/api/review/ai-course/${item._id}/submit`, {});
      message.success('已提交审核，请等待管理员审核');
      load();
    } catch (e: any) {
      message.error(e?.message || '提交审核失败');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 32 }}>
      {/* 页头 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <Typography.Title level={3} style={{ margin: 0, color: '#fff' }}>
          AI课件
        </Typography.Title>
        <Space>
          <Input 
            placeholder="搜索名称/主题" 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            onPressEnter={load} 
            allowClear 
            prefix={<SearchOutlined style={{ color: '#64748b' }} />}
            style={{ 
              width: 220,
              background: 'rgba(30, 41, 59, 0.6)',
              borderColor: 'rgba(100, 116, 139, 0.3)',
            }}
          />
          <Button onClick={load} style={{
            borderColor: 'rgba(100, 116, 139, 0.3)',
          }}>搜索</Button>
          <Link href="/editor/ai-course/new">
            <Button type="primary" icon={<PlusOutlined />} style={{
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              borderColor: 'transparent',
              height: 38,
              paddingInline: 20,
              fontWeight: 500,
            }}>
              新建AI课件
            </Button>
          </Link>
        </Space>
      </div>
      
      {/* 卡片网格 */}
      {loading ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: 400,
        }}>
          <Spin size="large" />
        </div>
      ) : data.length === 0 ? (
        <Empty 
          description={q ? "没有找到匹配的课程" : "暂无AI课件"} 
          style={{ marginTop: 100 }}
        >
          <Link href="/editor/ai-course/new">
            <Button type="primary" icon={<PlusOutlined />}>
              创建第一个AI课件
            </Button>
          </Link>
        </Empty>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {data.map((item) => (
            <AICourseCard 
              key={item._id} 
              item={item}
              onDelete={handleDelete}
              onSubmitReview={handleSubmitReview}
            />
          ))}
        </div>
      )}
    </div>
  );
}

