"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button, message, Space, Progress, Typography, Card, Spin, Alert, Modal, Input, Form } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ShareAltOutlined, FullscreenOutlined, ExpandOutlined, EyeOutlined, FormOutlined, UserOutlined, LogoutOutlined, LoginOutlined } from '@ant-design/icons';
import PublicCoursePlayer from './components/PublicCoursePlayer';
import ModelExplorer from './components/ModelExplorer';
import QuizPlayer from './components/QuizPlayer';
import dynamic from 'next/dynamic';

const ParticleBackground = dynamic(
  () => import('@/app/_components/ParticleBackground'),
  { ssr: false }
);

const { Title, Text } = Typography;

// 课件查看模式
type ViewMode = 'select' | 'learn' | 'explore' | 'quiz';

interface PublishedCourseData {
  id: string;
  originalCourseId?: string; // 原始 AICourse ID，用于考试成绩提交
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
  const [viewMode, setViewMode] = useState<ViewMode>('select');
  const [showModeSelect, setShowModeSelect] = useState(false);
  
  // 登录相关状态
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginForm] = Form.useForm();

  // 调试代码已移除 - 生产环境不需要

  // 检查登录状态
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUserName = localStorage.getItem('userName');
    if (token) {
      setIsLoggedIn(true);
      setUserName(storedUserName || '已登录用户');
    }
  }, []);

  // 登录处理
  const handleLogin = async (values: { username: string; password: string }) => {
    setLoginLoading(true);
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values)
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('userName', data.user?.name || values.username);
        setIsLoggedIn(true);
        setUserName(data.user?.name || values.username);
        setShowLoginModal(false);
        loginForm.resetFields();
        message.success('登录成功！答题成绩将会保存');
      } else {
        const errorData = await response.json();
        message.error(errorData.message || '登录失败');
      }
    } catch (e: any) {
      message.error('登录失败，请检查网络');
    } finally {
      setLoginLoading(false);
    }
  };

  // 登出处理
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userName');
    setIsLoggedIn(false);
    setUserName('');
    message.success('已退出登录');
  };

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
      // 使用当前域名作为基础URL（浏览器端始终使用 window.location.origin）
      // 不使用 NEXT_PUBLIC_API_URL，因为那可能是 Docker 内部地址（如 server:4000）
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const apiUrl = `${baseUrl}/api/public/course/${publishId}`;
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 404) {
          throw new Error('课程不存在或已停用');
        }
        throw new Error(`加载失败: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      setCourseData(data);
      setLoadingProgress(30);
      
      // 预加载资源
      await preloadResources(data);
      
    } catch (error: any) {
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
        // 使用当前域名作为基础URL（浏览器端始终使用 window.location.origin）
        // 不使用 NEXT_PUBLIC_API_URL，因为那可能是 Docker 内部地址
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        let modelUrl = data.coursewareData.modifiedModelUrl;
        
        // 处理相对路径
        if (modelUrl.startsWith('/')) {
          modelUrl = `${baseUrl}${modelUrl}`;
        }
        // 如果是dl.yf-xr.com的URL，通过代理访问
        else if (modelUrl.startsWith('https://dl.yf-xr.com/')) {
          modelUrl = `${baseUrl}/api/public/proxy?url=${encodeURIComponent(modelUrl)}`;
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
      
      // 显示模式选择界面
      setShowModeSelect(true);
      
    } catch (error) {
      // 即使预加载失败也允许选择模式
      setAllResourcesLoaded(true);
      setShowModeSelect(true);
    }
  };

  // 预加载3D模型 - 真正加载模型文件
  const preloadModel = async (modelUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      const loader = new XMLHttpRequest();
      loader.open('GET', modelUrl, true);
      loader.responseType = 'blob';
      loader.onload = () => {
        resolve(); // 无论成功失败都继续
      };
      loader.onerror = () => {
        resolve(); // 即使失败也继续
      };
      loader.timeout = 15000; // 15秒超时
      loader.ontimeout = () => {
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
    // 使用当前域名作为基础URL（浏览器端始终使用 window.location.origin）
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const promises = urls.slice(0, 10).map(url => { // 最多预加载前10个音频
      return new Promise<void>((resolve) => {
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.oncanplaythrough = () => resolve();
        audio.onerror = () => resolve(); // 即使失败也继续
        
        let processedUrl = url;
        if (url.startsWith('/')) {
          processedUrl = `${baseUrl}${url}`;
        } else if (url.startsWith('https://dl.yf-xr.com/')) {
          processedUrl = `${baseUrl}/api/public/proxy?url=${encodeURIComponent(url)}`;
        }
        audio.src = processedUrl;
        
        // 5秒超时
        setTimeout(() => resolve(), 5000);
      });
    });
    
    await Promise.allSettled(promises);
  };

  // 预加载图片
  const preloadImages = async (urls: string[]): Promise<void> => {
    // 使用当前域名作为基础URL（浏览器端始终使用 window.location.origin）
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const promises = urls.slice(0, 5).map(url => { // 最多预加载前5张图片
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // 即使失败也继续
        
        let processedUrl = url;
        if (url.startsWith('/')) {
          processedUrl = `${baseUrl}${url}`;
        } else if (url.startsWith('https://dl.yf-xr.com/')) {
          processedUrl = `${baseUrl}/api/public/proxy?url=${encodeURIComponent(url)}`;
        }
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



  if (loading) {
    return (
      <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        <ParticleBackground theme="green" />
        <Modal
          open={true}
          footer={null}
          centered
          width={440}
          maskClosable={false}
          closable={false}
          styles={{
            mask: { background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(6px)' },
            content: {
              background: 'linear-gradient(135deg, rgba(10, 26, 24, 0.92) 0%, rgba(5, 13, 16, 0.90) 100%)',
              backdropFilter: 'blur(24px) saturate(160%)',
              WebkitBackdropFilter: 'blur(24px) saturate(160%)',
              borderRadius: '22px',
              border: '1px solid rgba(16, 185, 129, 0.22)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
              padding: '36px 32px',
            }
          }}
        >
          <div style={{ textAlign: 'center' }}>
            {/* 动画图标 */}
            <div style={{
              width: 72,
              height: 72,
              margin: '0 auto 20px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.25) 0%, rgba(16, 185, 129, 0.15) 100%)',
              border: '2px solid rgba(52, 211, 153, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              animation: 'loading-pulse 2s ease-in-out infinite',
            }}>
              📦
            </div>

            {/* 标题 */}
            <div style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'rgba(255, 255, 255, 0.95)',
              marginBottom: 6,
              letterSpacing: 1,
            }}>
              正在准备课程资源
            </div>

            {/* 动态消息 */}
            <div style={{
              fontSize: 13,
              color: 'rgba(110, 231, 183, 0.85)',
              marginBottom: 24,
              minHeight: 20,
              transition: 'opacity 0.3s ease',
            }}>
              {loadingMessage}
            </div>

            {/* 进度条 */}
            <div style={{
              width: '100%',
              height: 8,
              background: 'rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              overflow: 'hidden',
              marginBottom: 10,
              border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{
                width: `${loadingProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #34d399 0%, #10b981 50%, #059669 100%)',
                borderRadius: 8,
                transition: 'width 0.3s ease',
                boxShadow: '0 0 12px rgba(52, 211, 153, 0.5)',
              }} />
            </div>

            {/* 百分比 + 加载点 */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                {loadingProgress}%
              </span>
              <span style={{ color: 'rgba(52, 211, 153, 0.6)', fontSize: 14 }}>
                {[0, 1, 2].map(i => (
                  <span key={i} style={{
                    display: 'inline-block',
                    animation: `loading-dot 1.2s ease-in-out ${i * 0.15}s infinite`,
                  }}>.</span>
                ))}
              </span>
            </div>
          </div>

          <style>{`
            @keyframes loading-pulse {
              0%, 100% { transform: scale(1); opacity: 0.85; }
              50% { transform: scale(1.08); opacity: 1; }
            }
            @keyframes loading-dot {
              0%, 80%, 100% { opacity: 0.2; }
              40% { opacity: 1; }
            }
          `}</style>
        </Modal>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        <ParticleBackground theme="green" interactive={false} />
        <div style={{
          position: 'relative',
          zIndex: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'radial-gradient(ellipse at center, rgba(10, 26, 24, 0.55) 0%, rgba(5, 13, 16, 0.75) 55%, rgba(2, 8, 5, 0.88) 100%)',
        }}>
          <Alert
            message={<span style={{ color: '#fff' }}>加载失败</span>}
            description={<span style={{ color: 'rgba(255,255,255,0.75)' }}>{error}</span>}
            type="error"
            showIcon
            style={{
              width: 520,
              maxWidth: '92vw',
              background: 'rgba(10, 26, 24, 0.75)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
            action={
              <Button size="small" onClick={loadCourseData}>
                重试
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!courseData) {
    return null;
  }

  // 检查是否有考题
  const hasQuestions = courseData?.courseData?.questions && courseData.courseData.questions.length > 0;

  // 选择模式后的处理
  const handleModeSelect = (mode: ViewMode) => {
    setShowModeSelect(false);
    setViewMode(mode);
    // 不自动播放，等待用户点击"开始播放"按钮
  };

  // 返回选择界面
  const handleBackToSelect = () => {
    setViewMode('select');
    setShowModeSelect(true);
    setIsPlaying(false);
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      background: '#000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <ParticleBackground theme="green" />
      {/* 学习模式 */}
      {viewMode === 'learn' && (
        <PublicCoursePlayer
          courseData={courseData}
          isPlaying={isPlaying}
          onPlayStateChange={setIsPlaying}
          onShare={handleShare}
          onBack={handleBackToSelect}
        />
      )}

      {/* 模型查看模式 */}
      {viewMode === 'explore' && courseData && (
        <ModelExplorer
          coursewareData={courseData.coursewareData}
          onBack={handleBackToSelect}
        />
      )}

      {/* 答题模式 */}
      {viewMode === 'quiz' && courseData && (
        <QuizPlayer
          courseId={courseData.originalCourseId || courseData.id}
          publishId={params?.id as string}
          courseData={courseData}
          onBack={handleBackToSelect}
        />
      )}

      {/* 模式选择对话框 - 毛玻璃深色风格 */}
      <Modal
        title={null}
        open={showModeSelect}
        footer={null}
        centered
        width={480}
        maskClosable={false}
        closable={false}
        styles={{
          mask: { 
            backdropFilter: 'blur(8px)',
            background: 'rgba(0, 0, 0, 0.6)'
          },
          content: {
            background: 'linear-gradient(135deg, rgba(10, 26, 24, 0.86) 0%, rgba(5, 13, 16, 0.84) 100%)',
            backdropFilter: 'blur(24px) saturate(160%)',
            WebkitBackdropFilter: 'blur(24px) saturate(160%)',
            borderRadius: '24px',
            border: '1px solid rgba(16, 185, 129, 0.22)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
          }
        }}
      >
        <div style={{ textAlign: 'center', padding: '36px 28px' }}>
          <div style={{ 
            fontSize: '52px', 
            marginBottom: '16px'
          }}>🎓</div>
          
          <div style={{ 
            fontSize: '22px', 
            fontWeight: 700,
            marginBottom: '8px',
            color: 'rgba(255, 255, 255, 0.95)'
          }}>
            {courseData?.title || '3D AI课程'}
          </div>
          
          <div style={{ 
            color: 'rgba(255, 255, 255, 0.5)', 
            marginBottom: '32px', 
            fontSize: '14px' 
          }}>
            请选择您想要的学习方式
          </div>
          
          {(() => {
            const cardBase: React.CSSProperties = {
              width: '140px',
              padding: '22px 16px',
              borderRadius: '18px',
              cursor: 'pointer',
              transition: 'all 0.25s ease',
              boxShadow: '0 10px 34px rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.10)',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
              backdropFilter: 'blur(18px) saturate(160%)',
              WebkitBackdropFilter: 'blur(18px) saturate(160%)',
              position: 'relative',
              overflow: 'hidden',
            };
            const accentBar = (from: string, to: string): React.CSSProperties => ({
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: `linear-gradient(90deg, ${from}, ${to})`,
              opacity: 0.9,
            });
            const hoverOn = (e: any) => {
              e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 18px 46px rgba(0,0,0,0.48)';
              e.currentTarget.style.borderColor = 'rgba(16, 185, 129, 0.35)';
            };
            const hoverOff = (e: any) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow = '0 10px 34px rgba(0,0,0,0.35)';
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
            };
            const iconWrap = (bg: string): React.CSSProperties => ({
              width: 56,
              height: 56,
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
              background: bg,
              boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25)',
            });
            return (
              <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* 开始学习 */}
            <div 
              onClick={() => handleModeSelect('learn')}
              style={cardBase}
              onMouseEnter={hoverOn}
              onMouseLeave={hoverOff}
            >
              <div style={accentBar('#34d399', '#10b981')} />
              <div style={iconWrap('linear-gradient(135deg, rgba(52, 211, 153, 0.95) 0%, rgba(16, 185, 129, 0.95) 100%)')}>
                <PlayCircleOutlined style={{ fontSize: '28px', color: 'white' }} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '15px' }}>开始学习</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginTop: '6px' }}>跟随AI讲解</div>
            </div>

            {/* 模型查看 */}
            <div 
              onClick={() => handleModeSelect('explore')}
              style={cardBase}
              onMouseEnter={hoverOn}
              onMouseLeave={hoverOff}
            >
              <div style={accentBar('#10b981', '#14b8a6')} />
              <div style={iconWrap('linear-gradient(135deg, rgba(16, 185, 129, 0.95) 0%, rgba(20, 184, 166, 0.95) 100%)')}>
                <EyeOutlined style={{ fontSize: '28px', color: 'white' }} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '15px' }}>模型查看</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginTop: '6px' }}>自由探索模型</div>
            </div>

            {/* 开始答题 */}
            <div 
              onClick={() => hasQuestions ? handleModeSelect('quiz') : message.info('暂无考题')}
              style={{
                ...cardBase,
                cursor: hasQuestions ? 'pointer' : 'not-allowed',
                opacity: hasQuestions ? 1 : 0.55,
              }}
              onMouseEnter={(e) => { if (hasQuestions) hoverOn(e); }}
              onMouseLeave={(e) => { if (hasQuestions) hoverOff(e); }}
            >
              <div style={accentBar(hasQuestions ? '#f59e0b' : 'rgba(148,163,184,0.4)', hasQuestions ? '#10b981' : 'rgba(148,163,184,0.2)')} />
              <div style={iconWrap(hasQuestions
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.95) 0%, rgba(16, 185, 129, 0.95) 100%)'
                : 'linear-gradient(135deg, rgba(100, 116, 139, 0.75) 0%, rgba(71, 85, 105, 0.75) 100%)'
              )}>
                <FormOutlined style={{ fontSize: '28px', color: 'white' }} />
              </div>
              <div style={{ color: 'rgba(255,255,255,0.95)', fontWeight: 700, fontSize: '15px' }}>开始答题</div>
              <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '12px', marginTop: '6px' }}>
                {hasQuestions ? `${courseData?.courseData?.questions?.length}道题` : '暂无考题'}
              </div>
            </div>
          </div>
            );
          })()}
          
          {typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && (
            <div style={{ 
              marginTop: '28px', 
              fontSize: '12px', 
              color: 'rgba(255, 255, 255, 0.6)',
              background: 'rgba(239, 68, 68, 0.15)',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}>
              📱 移动端提示：学习模式中如无声音，请点击屏幕中央的音频图标
            </div>
          )}

          {/* 登录状态/入口 */}
          <div style={{ 
            marginTop: '28px',
            paddingTop: '20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {isLoggedIn ? (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '12px'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  padding: '8px 16px',
                  background: 'rgba(16, 185, 129, 0.15)',
                  borderRadius: '20px',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}>
                  <UserOutlined style={{ color: '#10b981' }} />
                  <span style={{ color: '#10b981', fontSize: '13px' }}>{userName}</span>
                </div>
                <Button 
                  type="text" 
                  size="small"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '12px' }}
                >
                  退出
                </Button>
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{ 
                  color: 'rgba(255, 255, 255, 0.4)', 
                  fontSize: '12px' 
                }}>
                  登录后答题成绩将会保存
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <Button 
                    type="primary"
                    icon={<LoginOutlined />}
                    onClick={() => setShowLoginModal(true)}
                    style={{ 
                      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                      border: 'none'
                    }}
                  >
                    账号登录
                  </Button>
                  <Button 
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      color: 'rgba(255, 255, 255, 0.7)'
                    }}
                    onClick={() => message.info('您正在以访客身份浏览，答题成绩不会保存')}
                  >
                    访客浏览
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* 登录弹窗 */}
      <Modal
        title={null}
        open={showLoginModal}
        footer={null}
        centered
        width={360}
        onCancel={() => setShowLoginModal(false)}
        styles={{
          mask: { 
            backdropFilter: 'blur(8px)',
            background: 'rgba(0, 0, 0, 0.6)'
          },
          content: {
            background: 'linear-gradient(135deg, rgba(10, 26, 24, 0.90) 0%, rgba(5, 13, 16, 0.88) 100%)',
            backdropFilter: 'blur(24px) saturate(160%)',
            borderRadius: '20px',
            border: '1px solid rgba(16, 185, 129, 0.22)',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)'
          }
        }}
      >
        <div style={{ padding: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔐</div>
            <div style={{ 
              fontSize: '18px', 
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.95)'
            }}>
              账号登录
            </div>
            <div style={{ 
              fontSize: '13px', 
              color: 'rgba(255, 255, 255, 0.5)',
              marginTop: '4px'
            }}>
              登录后答题成绩将会保存到您的账户
            </div>
          </div>
          
          <Form
            form={loginForm}
            onFinish={handleLogin}
            layout="vertical"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input 
                prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />}
                placeholder="用户名"
                size="large"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}
              />
            </Form.Item>
            
            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password 
                placeholder="密码"
                size="large"
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '10px',
                  color: 'rgba(255, 255, 255, 0.9)'
                }}
              />
            </Form.Item>
            
            <Form.Item style={{ marginBottom: 0 }}>
              <Button 
                type="primary"
                htmlType="submit"
                loading={loginLoading}
                block
                size="large"
                style={{
                  height: '44px',
                  background: 'linear-gradient(135deg, #34d399 0%, #10b981 55%, #059669 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600
                }}
              >
                登录
              </Button>
            </Form.Item>
          </Form>
          
          <div style={{ 
            textAlign: 'center', 
            marginTop: '16px',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '12px'
          }}>
            没有账号？请联系管理员创建
          </div>
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

      {/* 调试面板已隐藏 - 生产环境不显示 */}
    </div>
  );
}
