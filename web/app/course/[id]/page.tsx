"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, message, Space, Progress, Typography, Card, Spin, Alert } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ShareAltOutlined, FullscreenOutlined, ExpandOutlined } from '@ant-design/icons';
import PublicCoursePlayer from './components/PublicCoursePlayer';

const { Title, Text } = Typography;

interface PublishedCourseData {
  id: string;
  title: string;
  description?: string;
  publishConfig: {
    isPublic: boolean;
    showAuthor: boolean;
    autoPlay: boolean;
  };
  courseData: any;
  coursewareData: any;
  resourceBaseUrl: string;
  stats: {
    viewCount: number;
  };
  publishedAt: string;
}

export default function PublicCoursePage() {
  const params = useParams();
  const publishId = params?.id as string;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [courseData, setCourseData] = useState<PublishedCourseData | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 加载课程数据
  useEffect(() => {
    if (!publishId) return;
    
    loadCourseData();
  }, [publishId]);

  const loadCourseData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/public/course/${publishId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('课程不存在或已停用');
        }
        throw new Error('加载失败');
      }
      
      const data = await response.json();
      setCourseData(data);
      
      // 如果设置了自动播放，延迟开始播放
      if (data.publishConfig?.autoPlay) {
        setTimeout(() => {
          setIsPlaying(true);
        }, 1000);
      }
    } catch (error: any) {
      setError(error.message || '加载课程失败');
    } finally {
      setLoading(false);
    }
  };

  // 分享功能
  const handleShare = async () => {
    const url = window.location.href;
    
    if (navigator.share) {
      // 使用原生分享API（移动端）
      try {
        await navigator.share({
          title: courseData?.title || '3D AI课程',
          text: courseData?.description || '精彩的3D AI讲解课程',
          url: url,
        });
      } catch (error) {
        // 用户取消分享，不需要处理
      }
    } else {
      // 降级方案：复制链接
      try {
        await navigator.clipboard.writeText(url);
        message.success('链接已复制到剪贴板');
      } catch (error) {
        // 再次降级
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        message.success('链接已复制到剪贴板');
      }
    }
  };

  // 全屏功能
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()?.then(() => {
        setIsFullscreen(true);
      });
    } else {
      document.exitFullscreen()?.then(() => {
        setIsFullscreen(false);
      });
    }
  };

  // 监听全屏状态变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f5f5f5'
      }}>
        <Spin size="large" />
        <Text style={{ marginLeft: 16 }}>正在加载课程...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#f5f5f5',
        padding: 20
      }}>
        <Alert
          message="加载失败"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={loadCourseData}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  if (!courseData) {
    return null;
  }

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: '#000',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative'
    }}>
      {/* 顶部信息栏（非全屏时显示） */}
      {!isFullscreen && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '12px 20px',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={4} style={{ color: 'white', margin: 0, fontSize: '16px' }}>
              {courseData.title}
            </Title>
            {courseData.description && (
              <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
                {courseData.description}
              </Text>
            )}
          </div>
          <Space>
            <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px' }}>
              {courseData.stats.viewCount} 次观看
            </Text>
            <Button 
              type="text" 
              icon={<ShareAltOutlined />} 
              onClick={handleShare}
              style={{ color: 'white' }}
              size="small"
            >
              分享
            </Button>
            <Button 
              type="text" 
              icon={<FullscreenOutlined />} 
              onClick={toggleFullscreen}
              style={{ color: 'white' }}
              size="small"
            >
              全屏
            </Button>
          </Space>
        </div>
      )}

      {/* 主播放区域 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <PublicCoursePlayer
          courseData={courseData}
          isPlaying={isPlaying}
          onPlayStateChange={setIsPlaying}
          isFullscreen={isFullscreen}
          onShare={handleShare}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>

      {/* 底部控制栏（移动端友好） */}
      {!isFullscreen && (
        <div style={{
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '8px 20px',
          color: 'white',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <Text style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', textAlign: 'center' }}>
            由 3D AI 课件系统 生成 • 发布于 {new Date(courseData.publishedAt).toLocaleDateString()}
          </Text>
        </div>
      )}

      {/* 移动端优化的CSS */}
      <style jsx>{`
        @media (max-width: 768px) {
          .ant-typography h4 {
            font-size: 14px !important;
          }
          .ant-btn {
            font-size: 12px !important;
            padding: 2px 6px !important;
          }
        }
      `}</style>
    </div>
  );
}
