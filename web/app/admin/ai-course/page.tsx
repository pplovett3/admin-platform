"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Input, Space, Tag, message, Empty, Spin, Typography, Tooltip, Popconfirm, Modal, Form } from 'antd';
import { PlusOutlined, SearchOutlined, FileImageOutlined, EyeOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { authFetch } from '@/app/_lib/api';

interface AICourseRow {
  _id: string;
  title: string;
  theme?: string;
  thumbnail?: string;
  status: 'draft' | 'published';
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
}: { 
  item: AICourseRow;
  onDelete: (item: AICourseRow) => void;
}) {
  const [imageError, setImageError] = useState(false);
  const thumbnailUrl = getThumbnailUrl(item.thumbnail);
  
  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    draft: { bg: 'rgba(100, 116, 139, 0.2)', text: '#94a3b8', border: 'rgba(100, 116, 139, 0.3)' },
    published: { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: 'rgba(34, 197, 94, 0.3)' },
  };
  
  const statusLabels: Record<string, string> = {
    draft: '草稿',
    published: '已发布',
  };
  
  const colors = statusColors[item.status] || statusColors.draft;
  
  return (
    <div style={{
      background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.8), rgba(15, 23, 42, 0.9))',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid rgba(100, 116, 139, 0.2)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      cursor: 'pointer',
      position: 'relative',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.4)';
      e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
      e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.2)';
    }}
    >
      {/* 缩略图区域 */}
      <Link href={`/admin/ai-course/${item._id}`}>
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
              color: 'rgba(168, 85, 247, 0.4)',
            }}>
              <FileImageOutlined style={{ fontSize: 48 }} />
              <span style={{ fontSize: 12 }}>暂无预览</span>
            </div>
          )}
          
          {/* 状态标签 */}
          <div style={{
            position: 'absolute',
            top: 12,
            right: 12,
            padding: '4px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 500,
            background: colors.bg,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            backdropFilter: 'blur(8px)',
          }}>
            {statusLabels[item.status]}
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
              background: 'rgba(168, 85, 247, 0.9)',
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
          color: '#a78bfa',
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
          borderTop: '1px solid rgba(100, 116, 139, 0.15)',
        }}>
          <div style={{ fontSize: 11, color: '#64748b' }}>
            <div>{item.createdBy?.name || 'Admin'}</div>
            <div>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}</div>
          </div>
          <Space size={4}>
            <Link href={`/admin/ai-course/${item._id}`}>
              <Tooltip title="编辑">
                <Button 
                  type="text" 
                  size="small" 
                  icon={<EditOutlined />}
                  style={{ color: '#a78bfa' }}
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

export default function AICourseListPage() {
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [data, setData] = useState<AICourseRow[]>([]);

  async function load() {
    setLoading(true);
    try {
      const res = await authFetch<{ items: AICourseRow[] }>(`/api/ai-courses?q=${encodeURIComponent(q)}&page=1&limit=50`);
      setData(res.items || []);
    } catch (e: any) {
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(item: AICourseRow) {
    try {
      await authFetch(`/api/ai-courses/${item._id}`, { method: 'DELETE' });
      message.success('课程已删除');
      load();
    } catch (e: any) {
      message.error(e?.message || '删除失败');
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 24 }}>
      {/* 页头 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <Typography.Title level={3} style={{ margin: 0, color: '#e2e8f0' }}>
          AI课程编辑
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
          <Link href="/admin/ai-course/new">
            <Button type="primary" icon={<PlusOutlined />} style={{
              background: 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)',
              borderColor: 'transparent',
              height: 38,
              paddingInline: 20,
              fontWeight: 500,
            }}>
              新建AI课程
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
          description={q ? "没有找到匹配的课程" : "暂无AI课程"} 
          style={{ marginTop: 100 }}
        >
          <Link href="/admin/ai-course/new">
            <Button type="primary" icon={<PlusOutlined />}>
              创建第一个AI课程
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
