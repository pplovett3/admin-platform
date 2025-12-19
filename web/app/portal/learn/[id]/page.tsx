"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { App, Spin, Button, Typography, Card, Progress, Empty } from 'antd';
import { 
  ArrowLeftOutlined, 
  PlayCircleOutlined, 
  PauseCircleOutlined,
  CheckCircleOutlined,
  BookOutlined
} from '@ant-design/icons';
import { apiGet } from '@/app/_utils/api';
import dynamic from 'next/dynamic';

const ParticleBackground = dynamic(
  () => import('@/app/_components/ParticleBackground'),
  { ssr: false }
);

interface AICourseDetail {
  _id: string;
  title: string;
  theme?: string;
  thumbnail?: string;
  courseData?: {
    outline?: Array<{
      title: string;
      content?: string;
      items?: Array<{
        type: string;
        content: string;
        audioUrl?: string;
      }>;
    }>;
    quizEnabled?: boolean;
    quiz?: any[];
  };
  createdBy?: { name: string };
  reviewedAt?: string;
}

export default function PortalLearnPage() {
  const params = useParams();
  const router = useRouter();
  const { message } = App.useApp();
  
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<AICourseDetail | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [completedSegments, setCompletedSegments] = useState<Set<number>>(new Set());

  const courseId = params.id as string;

  useEffect(() => {
    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      const resp = await apiGet<AICourseDetail>(`/api/portal/ai-course/${courseId}`);
      setCourse(resp);
    } catch (e: any) {
      message.error(e?.message || '加载课程失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a1a18'
      }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a1a18',
        color: '#fff'
      }}>
        <Empty description={<span style={{ color: 'rgba(255,255,255,0.7)' }}>课程不存在或未通过审核</span>} />
        <Button onClick={() => router.push('/portal')} style={{ marginTop: 16 }}>
          返回课程列表
        </Button>
      </div>
    );
  }

  const outline = course.courseData?.outline || [];
  const currentSegment = outline[currentSegmentIndex];
  const progress = outline.length > 0 ? (completedSegments.size / outline.length) * 100 : 0;

  const handleSegmentClick = (index: number) => {
    setCurrentSegmentIndex(index);
  };

  const handleComplete = () => {
    setCompletedSegments(prev => new Set([...prev, currentSegmentIndex]));
    if (currentSegmentIndex < outline.length - 1) {
      setCurrentSegmentIndex(currentSegmentIndex + 1);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#0a1a18',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 顶部导航 */}
      <div style={{
        height: 56,
        background: 'rgba(10, 26, 24, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(16, 185, 129, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Button 
            type="text" 
            icon={<ArrowLeftOutlined />}
            onClick={() => router.back()}
            style={{ color: '#fff' }}
          >
            返回
          </Button>
          <Typography.Title level={5} style={{ margin: 0, color: '#fff' }}>
            {course.title}
          </Typography.Title>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
            学习进度
          </span>
          <Progress 
            percent={Math.round(progress)} 
            size="small" 
            style={{ width: 120 }}
            strokeColor="#10b981"
          />
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: 'flex' }}>
        {/* 左侧大纲 */}
        <div style={{
          width: 280,
          background: 'rgba(10, 26, 24, 0.9)',
          borderRight: '1px solid rgba(16, 185, 129, 0.15)',
          overflow: 'auto',
          padding: 16,
        }}>
          <Typography.Title level={5} style={{ color: '#10b981', marginBottom: 16 }}>
            <BookOutlined style={{ marginRight: 8 }} />
            课程大纲
          </Typography.Title>
          
          {outline.length === 0 ? (
            <Empty description={<span style={{ color: 'rgba(255,255,255,0.5)' }}>暂无大纲</span>} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {outline.map((segment, index) => (
                <div
                  key={index}
                  onClick={() => handleSegmentClick(index)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    background: currentSegmentIndex === index 
                      ? 'rgba(16, 185, 129, 0.2)' 
                      : 'rgba(255, 255, 255, 0.05)',
                    border: currentSegmentIndex === index 
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: completedSegments.has(index)
                        ? '#10b981'
                        : 'rgba(255, 255, 255, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      color: '#fff',
                      flexShrink: 0,
                    }}>
                      {completedSegments.has(index) ? <CheckCircleOutlined /> : index + 1}
                    </div>
                    <span style={{ 
                      color: currentSegmentIndex === index ? '#10b981' : '#e2e8f0',
                      fontSize: 13,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {segment.title || `第${index + 1}章`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 右侧内容区 */}
        <div style={{ 
          flex: 1, 
          padding: 32, 
          overflow: 'auto',
          background: 'radial-gradient(ellipse at center, #0a1a18 0%, #050d10 50%, #020805 100%)',
        }}>
          {currentSegment ? (
            <div style={{ maxWidth: 800, margin: '0 auto' }}>
              <Card
                style={{
                  background: 'rgba(10, 26, 24, 0.85)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: 16,
                }}
              >
                <Typography.Title level={3} style={{ color: '#fff', marginBottom: 24 }}>
                  {currentSegment.title || `第${currentSegmentIndex + 1}章`}
                </Typography.Title>

                {/* 内容展示 */}
                {currentSegment.content && (
                  <div style={{ 
                    color: 'rgba(255, 255, 255, 0.85)', 
                    fontSize: 15,
                    lineHeight: 1.8,
                    marginBottom: 24,
                  }}>
                    {currentSegment.content}
                  </div>
                )}

                {/* 知识点列表 */}
                {currentSegment.items && currentSegment.items.length > 0 && (
                  <div style={{ marginBottom: 24 }}>
                    {currentSegment.items.map((item, idx) => (
                      <div 
                        key={idx}
                        style={{
                          padding: 16,
                          background: 'rgba(16, 185, 129, 0.1)',
                          borderRadius: 10,
                          marginBottom: 12,
                          border: '1px solid rgba(16, 185, 129, 0.15)',
                        }}
                      >
                        <div style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.7 }}>
                          {item.content}
                        </div>
                        {item.audioUrl && (
                          <audio 
                            controls 
                            src={item.audioUrl}
                            style={{ marginTop: 12, width: '100%' }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* 操作按钮 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
                  <Button
                    disabled={currentSegmentIndex === 0}
                    onClick={() => setCurrentSegmentIndex(prev => prev - 1)}
                    style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
                  >
                    上一章
                  </Button>
                  
                  {currentSegmentIndex < outline.length - 1 ? (
                    <Button
                      type="primary"
                      onClick={handleComplete}
                      style={{
                        background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                        border: 'none',
                      }}
                    >
                      完成并继续
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      onClick={() => {
                        handleComplete();
                        message.success('🎉 恭喜完成全部课程！');
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                        border: 'none',
                      }}
                    >
                      完成课程
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          ) : (
            <Empty 
              description={<span style={{ color: 'rgba(255,255,255,0.5)' }}>暂无课程内容</span>}
            />
          )}
        </div>
      </div>
    </div>
  );
}

