"use client";
import { useEffect, useState } from 'react';
import { Input, Spin, Empty, Tag, Row, Col, Typography } from 'antd';
import { SearchOutlined, PlayCircleOutlined, BookOutlined, ExperimentOutlined, AppstoreOutlined } from '@ant-design/icons';
import { apiGet } from '@/app/_utils/api';
import Link from 'next/link';

interface PublishedCourse {
  id: string;
  // AI课件发布后的公开链接（后端已保证存在：未发布的AI课件不会返回给学生）
  publishedId?: string;
  sharePath?: string;
  title: string;
  description: string;
  type?: 'courseware' | 'ai-course' | 'published';
  thumbnail?: string;
  viewCount?: number;
  publishedAt?: string;
  createdBy?: string;
}

export default function PortalHomePage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<PublishedCourse[]>([]);
  const [searchText, setSearchText] = useState('');

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      // 获取所有已发布且通过审核的公开课程
      const resp = await apiGet<{ items: PublishedCourse[] }>('/api/portal/courses');
      setCourses(resp.items || []);
    } catch (error) {
      console.error('加载课程失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => 
    course.title.toLowerCase().includes(searchText.toLowerCase()) ||
    course.description?.toLowerCase().includes(searchText.toLowerCase())
  );

  const getCourseTypeIcon = (type?: string) => {
    switch (type) {
      case 'courseware':
        return <AppstoreOutlined style={{ color: '#8b5cf6' }} />;
      case 'ai-course':
        return <ExperimentOutlined style={{ color: '#f59e0b' }} />;
      default:
        return <BookOutlined style={{ color: '#10b981' }} />;
    }
  };

  const getCourseTypeTag = (type?: string) => {
    const tagStyle: React.CSSProperties = {
      fontWeight: 600,
      fontSize: 12,
      padding: '2px 10px',
      borderRadius: 4,
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      border: 'none',
    };
    switch (type) {
      case 'courseware':
        return <Tag style={{ ...tagStyle, background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: '#fff' }}>三维课件</Tag>;
      case 'ai-course':
        return <Tag style={{ ...tagStyle, background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }}>AI课件</Tag>;
      default:
        return <Tag style={{ ...tagStyle, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff' }}>课程</Tag>;
    }
  };

  // 转换缩略图URL
  const getThumbnailUrl = (url?: string): string | null => {
    if (!url) return null;
    // 兼容后端可能返回的绝对地址（如 http://server:4000/...），统一为同源相对路径
    // 避免浏览器访问不到 docker 内部 host（server:4000）导致封面不显示
    try {
      if (/^https?:\/\//i.test(url)) {
        const u = new URL(url);
        url = `${u.pathname}${u.search}`;
      }
    } catch {}
    if (url.includes('/api/files/thumbnail/')) return url;
    const match = url.match(/\/api\/files\/([a-f0-9]{24})\/download/i);
    if (match) {
      return `/api/files/thumbnail/${match[1]}`;
    }
    return url;
  };

  return (
    <div style={{ padding: '32px 48px' }}>
      {/* 页面头部 */}
      <div style={{ marginBottom: 32 }}>
        <Typography.Title level={2} style={{ 
          color: '#fff',
          marginBottom: 8,
          textShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          探索课程
        </Typography.Title>
        <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 14 }}>
          选择感兴趣的课程开始学习，体验沉浸式三维交互
        </p>
      </div>

      {/* 搜索栏 */}
      <div style={{ marginBottom: 32 }}>
        <Input
          prefix={<SearchOutlined style={{ color: 'rgba(16, 185, 129, 0.6)' }} />}
          placeholder="搜索课程名称或描述..."
          size="large"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ 
            maxWidth: 480,
            borderRadius: 12,
            height: 48,
            background: 'rgba(10, 26, 24, 0.8)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#fff',
          }}
        />
      </div>

      {/* 课程列表 */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Spin size="large" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <Empty 
          description={<span style={{ color: 'rgba(255,255,255,0.6)' }}>{searchText ? '没有找到匹配的课程' : '暂无可用课程'}</span>} 
          style={{ padding: 80 }}
        />
      ) : (
        <Row gutter={[24, 24]}>
          {filteredCourses.map((course) => {
            const thumbnailUrl = getThumbnailUrl(course.thumbnail);
            const href =
              course.type === 'ai-course'
                ? (course.sharePath || (course.publishedId ? `/course/${course.publishedId}` : `/portal/course/${course.id}?type=${course.type}`))
                : `/portal/course/${course.id}?type=${course.type}`;
            return (
              <Col key={course.id} xs={24} sm={12} md={8} lg={6}>
                <Link href={href} style={{ textDecoration: 'none' }}>
                  <div
                    style={{
                      background: 'rgba(10, 26, 24, 0.85)',
                      backdropFilter: 'blur(12px)',
                      borderRadius: 16,
                      overflow: 'hidden',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.4)';
                      e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
                      e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.2)';
                    }}
                  >
                    {/* 封面图 */}
                    <div style={{
                      height: 160,
                      background: thumbnailUrl 
                        ? `url(${thumbnailUrl}) center/cover`
                        : 'linear-gradient(135deg, #064e3b 0%, #0d3a2d 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}>
                      {!thumbnailUrl && (
                        <div style={{ fontSize: 48, color: 'rgba(16, 185, 129, 0.3)' }}>
                          {getCourseTypeIcon(course.type)}
                        </div>
                      )}
                      <div style={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                      }}>
                        {getCourseTypeTag(course.type)}
                      </div>
                    </div>

                    {/* 信息区 */}
                    <div style={{ padding: 16 }}>
                      <h3 style={{ 
                        fontSize: 16, 
                        fontWeight: 600, 
                        color: '#e2e8f0',
                        marginBottom: 8,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {course.title}
                      </h3>
                      <p style={{ 
                        fontSize: 13, 
                        color: '#94a3b8',
                        marginBottom: 12,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        minHeight: 40,
                        lineHeight: 1.5,
                      }}>
                        {course.description || '暂无描述'}
                      </p>
                      <div style={{ 
                        fontSize: 12, 
                        color: '#64748b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingTop: 12,
                        borderTop: '1px solid rgba(16, 185, 129, 0.15)',
                      }}>
                        <span>{course.createdBy || '匿名'}</span>
                        <span>
                          <PlayCircleOutlined style={{ marginRight: 4, color: '#10b981' }} />
                          {course.viewCount || 0} 次学习
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </Col>
            );
          })}
        </Row>
      )}
    </div>
  );
}
