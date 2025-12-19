"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { App, Spin, Button, Empty, Typography } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, EyeOutlined, FileTextOutlined, AppstoreOutlined, ExperimentOutlined } from '@ant-design/icons';
import { apiGet } from '@/app/_utils/api';
import dynamic from 'next/dynamic';

// 动态导入粒子背景
const ParticleBackground = dynamic(
  () => import('@/app/_components/ParticleBackground'),
  { ssr: false }
);

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  thumbnail?: string;
  modelUrl?: string;
  type: 'courseware' | 'ai-course';
  createdBy?: string;
  reviewedAt?: string;
  // 三维课件字段
  hotspots?: any[];
  animations?: any[];
  // AI课件字段
  courseData?: {
    outline?: any[];
    quizEnabled?: boolean;
  };
}

export default function PortalCoursePage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<CourseDetail | null>(null);

  const courseId = params.id as string;
  const courseType = searchParams.get('type') || 'courseware';

  useEffect(() => {
    if (courseId) {
      loadCourse();
    }
  }, [courseId, courseType]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      
      // 根据类型调用不同的 Portal API（学生可访问）
      if (courseType === 'courseware') {
        // countView=true 表示增加访问计数
        const resp = await apiGet<any>(`/api/portal/courseware/${courseId}?countView=true`);
        setCourse({
          id: resp._id,
          title: resp.name,
          description: resp.description || '',
          thumbnail: resp.thumbnail,
          modelUrl: resp.modelUrl,
          type: 'courseware',
          createdBy: resp.createdBy?.name || 'Unknown',
          reviewedAt: resp.reviewedAt,
          hotspots: resp.hotspots || [],
          animations: resp.animations || [],
        });
      } else if (courseType === 'ai-course') {
        const resp = await apiGet<any>(`/api/portal/ai-course/${courseId}`);
        setCourse({
          id: resp._id,
          title: resp.title,
          description: resp.theme || '',
          thumbnail: resp.thumbnail,
          type: 'ai-course',
          createdBy: resp.createdBy?.name || 'Unknown',
          reviewedAt: resp.reviewedAt,
          courseData: resp.courseData,
        });
      }
    } catch (error: any) {
      message.error(error?.message || '加载课程失败');
    } finally {
      setLoading(false);
    }
  };

  // 转换缩略图URL
  const getThumbnailUrl = (url?: string): string | null => {
    if (!url) return null;
    if (url.includes('/api/files/thumbnail/')) return url;
    const match = url.match(/\/api\/files\/([a-f0-9]{24})\/download/i);
    if (match) {
      return `/api/files/thumbnail/${match[1]}`;
    }
    return url;
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: 'calc(100vh - 64px)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ padding: 48 }}>
        <Empty description={<span style={{ color: 'rgba(255,255,255,0.7)' }}>课程不存在或已下架</span>} />
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Button onClick={() => router.push('/portal')}>返回课程列表</Button>
        </div>
      </div>
    );
  }

  const thumbnailUrl = getThumbnailUrl(course.thumbnail);
  const outline = course.courseData?.outline || [];

  // 处理开始学习/查看模型
  const handleStartLearning = () => {
    if (course.type === 'courseware') {
      // 三维课件 - 跳转到模型查看器（带标签和动画功能）
      router.push(`/portal/viewer/${course.id}`);
    } else {
      // AI课件 - 跳转到门户学习页面
      router.push(`/portal/learn/${course.id}`);
    }
  };

  return (
    <div style={{ 
      minHeight: 'calc(100vh - 64px)', 
      padding: '32px 48px',
    }}>
      {/* 返回按钮 */}
      <Button 
        type="text" 
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push('/portal')}
        style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 24 }}
      >
        返回课程列表
      </Button>

      {/* 课程详情卡片 */}
      <div style={{
        background: 'rgba(10, 26, 24, 0.88)',
        backdropFilter: 'blur(12px)',
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid rgba(16, 185, 129, 0.25)',
        maxWidth: 1000,
        margin: '0 auto',
      }}>
        {/* 封面区域 */}
        <div style={{
          height: 300,
          background: thumbnailUrl 
            ? `url(${thumbnailUrl}) center/cover`
            : 'linear-gradient(135deg, #064e3b 0%, #0d3a2d 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}>
          {!thumbnailUrl && (
            <div style={{ fontSize: 80, color: 'rgba(16, 185, 129, 0.3)' }}>
              {course.type === 'courseware' ? <AppstoreOutlined /> : <ExperimentOutlined />}
            </div>
          )}
          
          {/* 课程类型标签 */}
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: course.type === 'courseware' 
              ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            padding: '6px 16px',
            borderRadius: 20,
            color: '#fff',
            fontSize: 13,
            fontWeight: 500,
          }}>
            {course.type === 'courseware' ? '三维课件' : 'AI课件'}
          </div>

          {/* 开始学习按钮 */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '40px 0 30px',
            background: 'linear-gradient(to top, rgba(10, 26, 24, 0.95) 0%, transparent 100%)',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <Button 
              type="primary" 
              size="large"
              icon={course.type === 'courseware' ? <EyeOutlined /> : <PlayCircleOutlined />}
              onClick={handleStartLearning}
              style={{
                height: 52,
                paddingLeft: 40,
                paddingRight: 40,
                borderRadius: 26,
                fontSize: 16,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)',
                border: 'none',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
              }}
            >
              {course.type === 'courseware' ? '查看模型' : '开始学习'}
            </Button>
          </div>
        </div>

        {/* 课程信息区 */}
        <div style={{ padding: '32px 40px' }}>
          <Typography.Title level={2} style={{ color: '#fff', marginBottom: 12 }}>
            {course.title}
          </Typography.Title>
          
          <p style={{ 
            color: 'rgba(255, 255, 255, 0.7)', 
            fontSize: 15, 
            lineHeight: 1.8,
            marginBottom: 24 
          }}>
            {course.description || '暂无描述'}
          </p>

          {/* 课程元信息 */}
          <div style={{
            display: 'flex',
            gap: 32,
            paddingTop: 24,
            borderTop: '1px solid rgba(16, 185, 129, 0.15)',
          }}>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>创建者</div>
              <div style={{ color: '#fff', fontWeight: 500 }}>{course.createdBy}</div>
            </div>
            <div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>审核通过时间</div>
              <div style={{ color: '#fff', fontWeight: 500 }}>
                {course.reviewedAt ? new Date(course.reviewedAt).toLocaleDateString() : '未知'}
              </div>
            </div>
            {course.type === 'courseware' && (
              <>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>标签数量</div>
                  <div style={{ color: '#10b981', fontWeight: 500 }}>{course.hotspots?.length || 0}</div>
                </div>
                <div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>动画数量</div>
                  <div style={{ color: '#10b981', fontWeight: 500 }}>{course.animations?.length || 0}</div>
                </div>
              </>
            )}
            {course.type === 'ai-course' && (
              <div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 4 }}>章节数</div>
                <div style={{ color: '#10b981', fontWeight: 500 }}>{outline.length}</div>
              </div>
            )}
          </div>

          {/* AI课件大纲预览 */}
          {course.type === 'ai-course' && outline.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <Typography.Title level={4} style={{ color: '#fff', marginBottom: 16 }}>
                <FileTextOutlined style={{ marginRight: 8 }} />
                课程大纲
              </Typography.Title>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 12 
              }}>
                {outline.slice(0, 6).map((segment: any, index: number) => (
                  <div 
                    key={index}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: 10,
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}>
                      {index + 1}
                    </div>
                    <div style={{ 
                      color: '#e2e8f0', 
                      fontSize: 13,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {segment.title || `第${index + 1}章`}
                    </div>
                  </div>
                ))}
              </div>
              {outline.length > 6 && (
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 12 }}>
                  还有 {outline.length - 6} 个章节...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
