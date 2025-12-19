"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Space, Typography, App, Input, Modal, Form, Popconfirm, Empty, Spin, Tooltip, Tag } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, FileImageOutlined, EyeOutlined, ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined, SendOutlined } from '@ant-design/icons';
import { apiGet, apiPut, apiDelete, apiPost } from '@/app/_utils/api';

interface CoursewareRow { 
  _id: string; 
  name: string; 
  description?: string;
  modelUrl?: string; 
  thumbnail?: string;
  createdAt?: string; 
  updatedAt?: string; 
  createdBy?: { name: string };
  version?: number;
  reviewStatus?: 'draft' | 'pending' | 'approved' | 'rejected';
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

// 课件卡片组件
function CoursewareCard({ 
  item, 
  onEdit, 
  onDelete,
  onSubmitReview 
}: { 
  item: CoursewareRow; 
  onEdit: (item: CoursewareRow) => void;
  onDelete: (item: CoursewareRow) => void;
  onSubmitReview: (item: CoursewareRow) => void;
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
      border: '1px solid rgba(139, 92, 246, 0.2)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      position: 'relative',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.4)';
      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.5)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
      e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.2)';
    }}
    >
      {/* 缩略图区域 */}
      <Link href={`/editor/three-courseware/${item._id}`}>
        <div style={{
          width: '100%',
          aspectRatio: '16/10',
          background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {thumbnailUrl && !imageError ? (
            <img 
              src={thumbnailUrl} 
              alt={item.name}
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
              color: 'rgba(139, 92, 246, 0.5)',
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
              background: 'rgba(139, 92, 246, 0.9)',
              borderColor: 'transparent',
            }}>
              编辑内容
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
          <Tooltip title={item.name}>
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
              {item.name}
            </h3>
          </Tooltip>
          <span style={{
            fontSize: 11,
            color: '#64748b',
            whiteSpace: 'nowrap',
          }}>
            v{item.version || 1}
          </span>
        </div>
        
        <p style={{ 
          margin: '0 0 12px',
          fontSize: 13,
          color: '#94a3b8',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          lineHeight: 1.5,
          minHeight: 39,
        }}>
          {item.description || '暂无描述'}
        </p>
        
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingTop: 12,
          borderTop: '1px solid rgba(139, 92, 246, 0.15)',
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
            <Tooltip title="修改信息">
              <Button 
                type="text" 
                size="small" 
                icon={<EditOutlined />}
                onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                style={{ color: '#8b5cf6' }}
              />
            </Tooltip>
            <Popconfirm
              title="确定删除此课件吗？"
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

export default function EditorThreeCoursewareListPage() {
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
        setRows(Array.isArray(response) ? response : []);
      }
    } catch (e: any) { message.error(e.message || '加载失败'); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleEdit = (item: CoursewareRow) => {
    setEditingItem(item);
    form.setFieldsValue({
      name: item.name,
      description: item.description || ''
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      await apiPut(`/api/coursewares/${editingItem!._id}`, values);
      message.success('课件信息已更新');
      setEditModalOpen(false);
      setEditingItem(null);
      load();
    } catch (e: any) {
      message.error(e.message || '保存失败');
    }
  };

  const handleDelete = async (item: CoursewareRow) => {
    try {
      await apiDelete(`/api/coursewares/${item._id}`);
      message.success('课件已删除');
      load();
    } catch (e: any) {
      message.error(e.message || '删除失败');
    }
  };

  const handleSubmitReview = async (item: CoursewareRow) => {
    try {
      await apiPost(`/api/review/courseware/${item._id}/submit`, {});
      message.success('已提交审核，请等待管理员审核');
      load();
    } catch (e: any) {
      message.error(e.message || '提交审核失败');
    }
  };

  return (
    <div style={{ padding: 32 }}>
      {/* 页头 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
      }}>
        <Typography.Title level={3} style={{ margin: 0, color: '#fff' }}>
          三维课件
        </Typography.Title>
        <Link href="/editor/three-courseware/new">
          <Button type="primary" icon={<PlusOutlined />} style={{
            background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            borderColor: 'transparent',
            height: 38,
            paddingInline: 20,
            fontWeight: 500,
          }}>
            新建课件
          </Button>
        </Link>
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
      ) : rows.length === 0 ? (
        <Empty 
          description="暂无课件" 
          style={{ marginTop: 100 }}
        >
          <Link href="/editor/three-courseware/new">
            <Button type="primary" icon={<PlusOutlined />}>
              创建第一个课件
            </Button>
          </Link>
        </Empty>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {rows.map((item) => (
            <CoursewareCard 
              key={item._id} 
              item={item} 
              onEdit={handleEdit}
              onDelete={handleDelete}
              onSubmitReview={handleSubmitReview}
            />
          ))}
        </div>
      )}

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

