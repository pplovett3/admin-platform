"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, message, Space, Progress, Typography, Card, Spin, Alert, Modal } from 'antd';
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
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('正在加载课程信息...');
  const [allResourcesLoaded, setAllResourcesLoaded] = useState(false);
  const [showPlayConfirm, setShowPlayConfirm] = useState(false);
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
    setLoadingProgress(10);
    setLoadingMessage('正在加载课程信息...');
    
    try {
      console.log('Loading course data for publishId:', publishId);
      const apiUrl = `/api/public/course/${publishId}`;
      console.log('API URL:', apiUrl);
      
      const response = await fetch(apiUrl);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log('Error response:', errorText);
        
        if (response.status === 404) {
          throw new Error('课程不存在或已停用');
        }
        throw new Error(`加载失败: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      console.log('Course data loaded:', data);
      setCourseData(data);
      setLoadingProgress(30);
      
      // 预加载资源
      await preloadResources(data);
      
    } catch (error: any) {
      console.error('Load course data error:', error);
      setError(error.message || '加载课程失败');
    } finally {
      setLoading(false);
    }
  };

  // 预加载所有资源（模型、音频、图片）
  const preloadResources = async (data: PublishedCourseData) => {
    try {
      setLoadingMessage('正在加载3D模型...');
      setLoadingProgress(40);
      
      // 预加载3D模型（完整下载）
      if (data.coursewareData?.modifiedModelUrl) {
        let modelUrl = data.coursewareData.modifiedModelUrl;
        // 如果是dl.yf-xr.com的URL，通过代理访问
        if (modelUrl.startsWith('https://dl.yf-xr.com/')) {
          modelUrl = `/api/public/proxy?url=${encodeURIComponent(modelUrl)}`;
        }
        await preloadModel(modelUrl);
      }
      setLoadingProgress(60);
      
      setLoadingMessage('正在加载音频文件...');
      
      // 预加载所有音频
      const audioUrls = extractAudioUrls(data.courseData);
      await preloadAudios(audioUrls);
      setLoadingProgress(80);
      
      setLoadingMessage('正在加载图片资源...');
      
      // 预加载所有图片
      const imageUrls = extractImageUrls(data.courseData);
      await preloadImages(imageUrls);
      setLoadingProgress(100);
      
      setLoadingMessage('加载完成！');
      setAllResourcesLoaded(true);
      
      // 不自动播放，等待用户确认
      setShowPlayConfirm(true);
      
    } catch (error) {
      console.error('Preload resources error:', error);
      // 即使预加载失败也允许播放
      setAllResourcesLoaded(true);
      setShowPlayConfirm(true);
    }
  };

  // 预加载3D模型 - 真正加载模型文件
  const preloadModel = async (modelUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const loader = new XMLHttpRequest();
      loader.open('GET', modelUrl, true);
      loader.responseType = 'blob';
      loader.onload = () => {
        if (loader.status === 200) {
          console.log('模型文件预加载完成:', modelUrl, '大小:', loader.response.size);
          resolve();
        } else {
          console.warn('模型预加载失败，但继续:', loader.status);
          resolve(); // 即使失败也继续
        }
      };
      loader.onerror = () => {
        console.warn('模型预加载出错，但继续');
        resolve(); // 即使失败也继续
      };
      loader.timeout = 15000; // 15秒超时
      loader.ontimeout = () => {
        console.warn('模型预加载超时，但继续');
        resolve();
      };
      loader.send();
    });
  };

  // 提取所有音频URL
  const extractAudioUrls = (courseData: any): string[] => {
    const urls: string[] = [];
    if (courseData.outline) {
      courseData.outline.forEach((segment: any) => {
        if (segment.items) {
          segment.items.forEach((item: any) => {
            if (item.audioUrl) {
              urls.push(item.audioUrl);
            }
          });
        }
      });
    }
    return urls;
  };

  // 提取所有图片URL
  const extractImageUrls = (courseData: any): string[] => {
    const urls: string[] = [];
    if (courseData.outline) {
      courseData.outline.forEach((segment: any) => {
        if (segment.items) {
          segment.items.forEach((item: any) => {
            if (item.imageUrl) {
              urls.push(item.imageUrl);
            } else if (item.image && item.image.src) {
              urls.push(item.image.src);
            }
          });
        }
      });
    }
    return urls;
  };

  // 预加载音频
  const preloadAudios = async (urls: string[]): Promise<void> => {
    const promises = urls.slice(0, 10).map(url => { // 最多预加载前10个音频
      return new Promise<void>((resolve) => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => resolve(); // 即使失败也继续
        // audio.ontimeout = () => resolve(); // HTMLAudioElement没有ontimeout属性
        const processedUrl = url.startsWith('https://dl.yf-xr.com/') 
          ? `/api/public/proxy?url=${encodeURIComponent(url)}`
          : url;
        audio.src = processedUrl;
        
        // 5秒超时
        setTimeout(() => resolve(), 5000);
      });
    });
    
    await Promise.allSettled(promises);
  };

  // 预加载图片
  const preloadImages = async (urls: string[]): Promise<void> => {
    const promises = urls.slice(0, 5).map(url => { // 最多预加载前5张图片
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // 即使失败也继续
        const processedUrl = url.startsWith('https://dl.yf-xr.com/') 
          ? `/api/public/proxy?url=${encodeURIComponent(url)}`
          : url;
        img.src = processedUrl;
        
        // 5秒超时
        setTimeout(() => resolve(), 5000);
      });
    });
    
    await Promise.allSettled(promises);
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
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
        color: 'white'
      }}>
        <div style={{ textAlign: 'center', maxWidth: '300px', padding: '20px' }}>
          <div style={{ 
            fontSize: '18px', 
            fontWeight: 'bold', 
            marginBottom: '20px',
            color: 'white'
          }}>
            {loadingMessage}
          </div>
          
          {/* 简洁进度条 */}
          <div style={{ 
            width: '100%', 
            height: '4px', 
            backgroundColor: 'rgba(255,255,255,0.2)', 
            borderRadius: '2px',
            overflow: 'hidden',
            marginBottom: '16px'
          }}>
            <div style={{ 
              width: `${loadingProgress}%`, 
              height: '100%', 
              backgroundColor: '#1890ff',
              borderRadius: '2px',
              transition: 'width 0.3s ease'
            }} />
          </div>
          
          <div style={{ 
            fontSize: '14px', 
            opacity: 0.8,
            color: 'white'
          }}>
            {loadingProgress}%
          </div>
        </div>
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

      {/* 播放确认对话框 */}
      <Modal
        title={null}
        open={showPlayConfirm}
        footer={null}
        centered
        width={360}
        maskClosable={false}
        styles={{
          mask: { backdropFilter: 'blur(10px)' },
          content: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)'
          }
        }}
      >
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ 
            fontSize: '48px', 
            marginBottom: '16px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>🎓</div>
          
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold',
            marginBottom: '32px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            准备开始学习
          </div>
          
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Button 
              size="large"
              style={{
                borderRadius: '25px',
                padding: '8px 24px',
                height: 'auto',
                background: 'rgba(102, 126, 234, 0.1)',
                borderColor: 'rgba(102, 126, 234, 0.3)',
                color: '#667eea'
              }}
              onClick={() => {
                setShowPlayConfirm(false);
              }}
            >
              稍后播放
            </Button>
            
            <Button 
              type="primary"
              size="large"
              style={{
                borderRadius: '25px',
                padding: '8px 24px',
                height: 'auto',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
              }}
              onClick={() => {
                setShowPlayConfirm(false);
                setIsPlaying(true);
              }}
            >
              开始播放
            </Button>
          </div>
          
          {/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && (
            <div style={{ 
              marginTop: '24px', 
              fontSize: '12px', 
              color: '#999',
              background: 'rgba(255, 107, 107, 0.1)',
              padding: '8px 12px',
              borderRadius: '12px',
              border: '1px solid rgba(255, 107, 107, 0.2)'
            }}>
              📱 移动端提示：播放过程中如无声音，请点击屏幕中央的音频图标
            </div>
          )}
        </div>
      </Modal>

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
