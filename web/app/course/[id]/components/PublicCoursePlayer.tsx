"use client";
import { useEffect, useRef, useState } from 'react';
import { Button, Progress, Space, Typography, message } from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  StepBackwardOutlined, 
  StepForwardOutlined,
  ShareAltOutlined,
  FullscreenOutlined,
  ExpandOutlined,
  SoundOutlined
} from '@ant-design/icons';
import PublicThreeDViewer, { PublicThreeDViewerControls } from './PublicThreeDViewer';

const { Text } = Typography;

interface PublicCoursePlayerProps {
  courseData: any;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  isFullscreen: boolean;
  onShare: () => void;
  onToggleFullscreen: () => void;
}

interface PlaybackState {
  currentSegmentIndex: number;
  currentItemIndex: number;
  progress: number;
  currentAudio?: HTMLAudioElement;
}

export default function PublicCoursePlayer({ 
  courseData, 
  isPlaying, 
  onPlayStateChange, 
  isFullscreen,
  onShare,
  onToggleFullscreen
}: PublicCoursePlayerProps) {
  const threeDViewerRef = useRef<HTMLDivElement>(null);
  const viewerControlsRef = useRef<PublicThreeDViewerControls>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    currentSegmentIndex: 0,
    currentItemIndex: 0,
    progress: 0
  });
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [currentImage, setCurrentImage] = useState<any>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(true);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewerImageSrc, setViewerImageSrc] = useState('');
  const playbackTimerRef = useRef<NodeJS.Timeout>();
  const [totalItems, setTotalItems] = useState(0);
  const [currentItemNumber, setCurrentItemNumber] = useState(0);

  // 计算总步骤数
  useEffect(() => {
    if (courseData?.courseData?.outline) {
      let total = 0;
      courseData.courseData.outline.forEach((segment: any) => {
        total += segment.items?.length || 0;
      });
      setTotalItems(total);
    }
  }, [courseData]);

  // 计算当前步骤序号
  useEffect(() => {
    if (courseData?.courseData?.outline) {
      let current = 0;
      for (let i = 0; i < playbackState.currentSegmentIndex; i++) {
        const segment = courseData.courseData.outline[i];
        current += segment.items?.length || 0;
      }
      current += playbackState.currentItemIndex + 1;
      setCurrentItemNumber(current);
    }
  }, [playbackState.currentSegmentIndex, playbackState.currentItemIndex, courseData]);

  // 播放控制
  useEffect(() => {
    if (isPlaying) {
      startPlayback();
    } else {
      stopPlayback();
    }
    return () => stopPlayback();
  }, [isPlaying, playbackState.currentSegmentIndex, playbackState.currentItemIndex]);

  const getCurrentItem = () => {
    const outline = courseData?.courseData?.outline;
    if (!outline || !outline[playbackState.currentSegmentIndex]) return null;
    
    const segment = outline[playbackState.currentSegmentIndex];
    if (!segment.items || !segment.items[playbackState.currentItemIndex]) return null;
    
    return segment.items[playbackState.currentItemIndex];
  };

  // 初始化音频上下文（移动端兼容）
  const initAudioContext = async () => {
    if (audioContext) return audioContext;
    
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) {
        console.warn('浏览器不支持AudioContext');
        return null;
      }
      
      const ctx = new AudioContextClass();
      
      // 在iOS上需要用户交互后才能启动AudioContext
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      
      setAudioContext(ctx);
      setNeedsUserInteraction(false);
      console.log('AudioContext初始化成功:', ctx.state);
      return ctx;
    } catch (error) {
      console.error('AudioContext初始化失败:', error);
      return null;
    }
  };

  // 通用音频播放函数（移动端兼容）
  const playAudioWithMobileSupport = async (audioUrl: string, onEnded: () => void, onError: (duration: number) => void, estimatedDuration: number = 3): Promise<void> => {
    const audio = new Audio();
    
    // 移动端兼容性设置
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    
    // 使用公开代理来解决CORS问题
    let processedUrl = audioUrl;
    if (audioUrl.startsWith('https://dl.yf-xr.com/')) {
      processedUrl = `/api/public/proxy?url=${encodeURIComponent(audioUrl)}`;
    }
    
    audio.src = processedUrl;
    playbackState.currentAudio = audio;
    
    audio.onended = onEnded;
    audio.onerror = () => onError(estimatedDuration);
    
    try {
      // 在iOS上确保AudioContext已启动
      if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      await audio.play();
      console.log('音频播放成功:', audioUrl);
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        console.warn('音频自动播放被阻止，尝试用户交互');
        // 在移动端显示播放提示
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          // 移动端使用更友好的方式
          try {
            // 尝试手动触发播放
            document.addEventListener('touchstart', async function autoPlay() {
              document.removeEventListener('touchstart', autoPlay);
              try {
                await audio.play();
                console.log('触摸后音频播放成功');
              } catch (retryError) {
                console.error('触摸后音频播放仍失败:', retryError);
                onError(estimatedDuration);
              }
            }, { once: true });
            
            // 如果3秒内没有触摸，回退到默认时长
            setTimeout(() => {
              if (audio.paused) {
                onError(estimatedDuration);
              }
            }, 3000);
          } catch (retryError) {
            onError(estimatedDuration);
          }
        } else {
          // 桌面端显示确认对话框
          const userConfirm = window.confirm('需要您的许可才能播放音频，点击确定继续');
          if (userConfirm) {
            try {
              await audio.play();
            } catch (retryError) {
              console.error('重试音频播放失败:', retryError);
              onError(estimatedDuration);
            }
          } else {
            onError(estimatedDuration);
          }
        }
      } else {
        console.error('音频播放出错:', error);
        onError(estimatedDuration);
      }
    }
  };

  // 处理图片点击放大
  const handleImageClick = (imageSrc: string) => {
    setViewerImageSrc(imageSrc);
    setImageViewerVisible(true);
  };

  // 关闭图片查看器
  const closeImageViewer = () => {
    setImageViewerVisible(false);
    setViewerImageSrc('');
  };

  const startPlayback = async () => {
    // 首次播放时初始化音频上下文
    if (needsUserInteraction) {
      await initAudioContext();
    }
    
    const currentItem = getCurrentItem();
    if (!currentItem) return;

    console.log('播放步骤:', currentItem);
    
    // 清除之前的定时器
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
    }

    // 重置状态
    if (viewerControlsRef.current?.resetAllStates) {
      viewerControlsRef.current.resetAllStates();
    }

    try {
      const duration = await executeCurrentItem(currentItem);
      
      // 自动切换到下一步
      if (isPlaying) {
        playbackTimerRef.current = setTimeout(() => {
          if (isPlaying) {
            nextItem();
          }
        }, duration * 1000);
      }
    } catch (error) {
      console.error('执行步骤失败:', error);
    }
  };

  const stopPlayback = () => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
    }
    
    if (playbackState.currentAudio) {
      playbackState.currentAudio.pause();
    }
    
    setCurrentSubtitle('');
    setCurrentImage(null);
  };

  const executeCurrentItem = async (item: any): Promise<number> => {
    switch (item.type) {
      case 'talk':
        return await executeTalkItem(item);
      case 'image.explain':
        return await executeImageExplainItem(item);
      case 'scene.action':
        return await executeSceneActionItem(item);
      default:
        return 3; // 默认3秒
    }
  };

  const executeTalkItem = async (item: any): Promise<number> => {
    console.log('执行talk步骤:', {
      type: item.type,
      say: item.say?.substring(0, 50) + '...',
      audioUrl: item.audioUrl,
      hasAudio: !!item.audioUrl
    });
    
    setCurrentSubtitle(item.say || '');
    
    // 开始模型自转
    if (viewerControlsRef.current?.startAutoRotation) {
      viewerControlsRef.current.startAutoRotation();
    }
    
    // 播放音频（如果有）
    if (item.audioUrl) {
      console.log('播放音频:', item.audioUrl);
      return new Promise((resolve) => {
        const audio = new Audio();
        
        // 使用公开代理来解决CORS问题
        let audioUrl = item.audioUrl;
        if (audioUrl.startsWith('https://dl.yf-xr.com/')) {
          audioUrl = `/api/public/proxy?url=${encodeURIComponent(audioUrl)}`;
        }
        
        audio.src = audioUrl;
        playbackState.currentAudio = audio;
        
        audio.onended = () => {
          setCurrentSubtitle('');
          // 停止模型自转
          if (viewerControlsRef.current?.stopAutoRotation) {
            viewerControlsRef.current.stopAutoRotation();
          }
          // 立即解析，不等待额外时间
          resolve(0); // 返回0表示立即跳转
        };
        
        audio.onerror = (error) => {
          console.error('音频播放失败:', error);
          setCurrentSubtitle('');
          // 停止模型自转
          if (viewerControlsRef.current?.stopAutoRotation) {
            viewerControlsRef.current.stopAutoRotation();
          }
          // 回退到估算时长
          const estimatedDuration = Math.max(2, (item.say?.length || 0) * 0.15);
          setTimeout(() => resolve(estimatedDuration), estimatedDuration * 1000);
        };
        
        // 尝试播放音频，如果失败则回退到文本显示
        audio.play().catch((error) => {
          console.error('音频播放启动失败:', error);
          
          // 检查是否是用户交互限制
          if (error.name === 'NotAllowedError') {
            console.log('需要用户交互才能播放音频，显示文本替代');
            // 设置音频为预备状态，等待用户交互后播放
            playbackState.currentAudio = audio;
            // 显示提示用户点击播放
            if (typeof window !== 'undefined') {
              // 尝试在下次用户交互时播放
              const playOnInteraction = () => {
                audio.play().catch(console.error);
                document.removeEventListener('click', playOnInteraction);
                document.removeEventListener('touchstart', playOnInteraction);
              };
              document.addEventListener('click', playOnInteraction, { once: true });
              document.addEventListener('touchstart', playOnInteraction, { once: true });
            }
          }
          
          // 无论如何都要显示文本内容
          const estimatedDuration = Math.max(2, (item.say?.length || 0) * 0.15);
          setTimeout(() => {
            setCurrentSubtitle('');
            if (viewerControlsRef.current?.stopAutoRotation) {
              viewerControlsRef.current.stopAutoRotation();
            }
            resolve(estimatedDuration);
          }, estimatedDuration * 1000);
        });
      });
    } else {
      // 没有音频时，模拟TTS播放
      return new Promise((resolve) => {
        const estimatedDuration = Math.max(2, (item.say?.length || 0) * 0.15); // 每个字符0.15秒
        
        setTimeout(() => {
          setCurrentSubtitle('');
          // 停止模型自转
          if (viewerControlsRef.current?.stopAutoRotation) {
            viewerControlsRef.current.stopAutoRotation();
          }
          resolve(estimatedDuration);
        }, estimatedDuration * 1000);
      });
    }
  };

  const executeImageExplainItem = async (item: any): Promise<number> => {
    console.log('执行image.explain步骤:', {
      type: item.type,
      say: item.say?.substring(0, 50) + '...',
      audioUrl: item.audioUrl,
      imageUrl: item.imageUrl,
      originalImageUrl: item.originalImageUrl,
      hasAudio: !!item.audioUrl,
      allKeys: Object.keys(item)
    });
    
    setCurrentSubtitle(item.say || '');
    
    // 显示图片 - 支持多种图片URL格式
    let imageUrl = null;
    
    if (item.imageUrl) {
      imageUrl = item.imageUrl;
    } else if (item.image && item.image.src) {
      imageUrl = item.image.src; // 从image.src获取
    } else if (item.originalImageUrl) {
      imageUrl = item.originalImageUrl;
    }
    
    if (imageUrl) {
      // 处理CORS问题：如果是外部URL，可能需要通过代理访问
      let processedImageUrl = imageUrl;
      if (imageUrl.startsWith('https://dl.yf-xr.com/')) {
        processedImageUrl = `/api/public/proxy?url=${encodeURIComponent(imageUrl)}`;
      }
        
      setCurrentImage({
        url: processedImageUrl,
        title: item.imageTitle || item.say || 'Course Image'
      });
      
      console.log('设置图片显示:', {
        原始URL: imageUrl,
        处理后URL: processedImageUrl,
        来源: item.imageUrl ? 'imageUrl' : item.image?.src ? 'image.src' : 'originalImageUrl'
      });
    } else {
      console.warn('未找到图片URL:', {
        hasImageUrl: !!item.imageUrl,
        hasImageSrc: !!(item.image && item.image.src),
        hasOriginalImageUrl: !!item.originalImageUrl,
        itemKeys: Object.keys(item)
      });
    }
    
    // 开始模型自转
    if (viewerControlsRef.current?.startAutoRotation) {
      viewerControlsRef.current.startAutoRotation();
    }
    
    // 播放音频（如果有）
    if (item.audioUrl) {
      console.log('播放image.explain音频:', item.audioUrl);
      return new Promise((resolve) => {
        const audio = new Audio();
        
        // 使用公开代理来解决CORS问题
        let audioUrl = item.audioUrl;
        if (audioUrl.startsWith('https://dl.yf-xr.com/')) {
          audioUrl = `/api/public/proxy?url=${encodeURIComponent(audioUrl)}`;
        }
        
        audio.src = audioUrl;
        playbackState.currentAudio = audio;
        
        audio.onended = () => {
          setCurrentSubtitle('');
          setCurrentImage(null);
          // 停止模型自转
          if (viewerControlsRef.current?.stopAutoRotation) {
            viewerControlsRef.current.stopAutoRotation();
          }
          // 立即解析，不等待额外时间
          resolve(0); // 返回0表示立即跳转
        };
        
        audio.onerror = (error) => {
          console.error('image.explain音频播放失败:', error);
          const estimatedDuration = Math.max(5, (item.say?.length || 0) * 0.15);
          setTimeout(() => {
            setCurrentSubtitle('');
            setCurrentImage(null);
            if (viewerControlsRef.current?.stopAutoRotation) {
              viewerControlsRef.current.stopAutoRotation();
            }
            resolve(estimatedDuration);
          }, estimatedDuration * 1000);
        };
        
        // 尝试播放音频
        audio.play().catch((error) => {
          console.error('image.explain音频播放启动失败:', error);
          
          // 用户交互处理
          if (error.name === 'NotAllowedError') {
            if (typeof window !== 'undefined') {
              const playOnInteraction = () => {
                audio.play().catch(console.error);
                document.removeEventListener('click', playOnInteraction);
                document.removeEventListener('touchstart', playOnInteraction);
              };
              document.addEventListener('click', playOnInteraction, { once: true });
              document.addEventListener('touchstart', playOnInteraction, { once: true });
            }
          }
          
          // 回退到文本显示
          const estimatedDuration = Math.max(5, (item.say?.length || 0) * 0.15);
          setTimeout(() => {
            setCurrentSubtitle('');
            setCurrentImage(null);
            if (viewerControlsRef.current?.stopAutoRotation) {
              viewerControlsRef.current.stopAutoRotation();
            }
            resolve(estimatedDuration);
          }, estimatedDuration * 1000);
        });
      });
    } else {
      // 没有音频时，模拟播放
      return new Promise((resolve) => {
        const estimatedDuration = Math.max(3, (item.say?.length || 0) * 0.15);
        setTimeout(() => {
          setCurrentSubtitle('');
          setCurrentImage(null);
          // 停止模型自转
          if (viewerControlsRef.current?.stopAutoRotation) {
            viewerControlsRef.current.stopAutoRotation();
          }
          resolve(estimatedDuration);
        }, estimatedDuration * 1000);
      });
    }
  };

  const executeSceneActionItem = async (item: any): Promise<number> => {
    console.log('执行scene.action步骤:', {
      type: item.type,
      say: item.say?.substring(0, 50) + '...',
      audioUrl: item.audioUrl,
      actions: item.actions,
      hasAudio: !!item.audioUrl
    });
    
    setCurrentSubtitle(item.say || '');
    
    // 执行3D动作
    if (item.actions && viewerControlsRef.current) {
      executeActionsWithControls(item.actions, viewerControlsRef.current);
    }
    
    // 播放音频（如果有）
    if (item.audioUrl) {
      console.log('播放scene.action音频:', item.audioUrl);
      return new Promise((resolve) => {
        const audio = new Audio();
        
        // 使用公开代理来解决CORS问题
        let audioUrl = item.audioUrl;
        if (audioUrl.startsWith('https://dl.yf-xr.com/')) {
          audioUrl = `/api/public/proxy?url=${encodeURIComponent(audioUrl)}`;
        }
        
        audio.src = audioUrl;
        playbackState.currentAudio = audio;
        
        audio.onended = () => {
          setCurrentSubtitle('');
          // 立即解析，不等待额外时间
          resolve(0); // 返回0表示立即跳转
        };
        
        audio.onerror = (error) => {
          console.error('scene.action音频播放失败:', error);
          const estimatedDuration = Math.max(3, (item.say?.length || 0) * 0.15);
          setTimeout(() => {
            setCurrentSubtitle('');
            resolve(estimatedDuration);
          }, estimatedDuration * 1000);
        };
        
        // 尝试播放音频
        audio.play().catch((error) => {
          console.error('scene.action音频播放启动失败:', error);
          
          // 用户交互处理
          if (error.name === 'NotAllowedError') {
            if (typeof window !== 'undefined') {
              const playOnInteraction = () => {
                audio.play().catch(console.error);
                document.removeEventListener('click', playOnInteraction);
                document.removeEventListener('touchstart', playOnInteraction);
              };
              document.addEventListener('click', playOnInteraction, { once: true });
              document.addEventListener('touchstart', playOnInteraction, { once: true });
            }
          }
          
          // 回退到文本显示
          const estimatedDuration = Math.max(3, (item.say?.length || 0) * 0.15);
          setTimeout(() => {
            setCurrentSubtitle('');
            resolve(estimatedDuration);
          }, estimatedDuration * 1000);
        });
      });
    } else {
      // 没有音频时，模拟播放
      return new Promise((resolve) => {
        const estimatedDuration = Math.max(3, (item.say?.length || 0) * 0.15);
        setTimeout(() => {
          setCurrentSubtitle('');
          resolve(estimatedDuration);
        }, estimatedDuration * 1000);
      });
    }
  };

  const executeActionsWithControls = (actions: any[], viewerControls: any) => {
    actions.forEach((action, index) => {
      setTimeout(() => {
        switch (action.type) {
          case 'camera.focus':
            if (action.target?.nodeKey) {
              viewerControls.focusOnNode(action.target.nodeKey);
            }
            break;
          case 'highlight.show':
            if (action.target?.nodeKey) {
              viewerControls.highlightNode(action.target.nodeKey, true);
            }
            break;
          case 'highlight.hide':
            if (action.target?.nodeKey) {
              viewerControls.highlightNode(action.target.nodeKey, false);
            }
            break;
          case 'annotation.show':
            if (action.ids) {
              viewerControls.showAnnotations(action.ids);
            }
            break;
          case 'annotation.hide':
            if (action.ids) {
              viewerControls.hideAnnotations(action.ids);
            }
            break;
          case 'annotation.highlight':
            // 兼容处理
            if (action.target?.nodeKey) {
              viewerControls.highlightNode(action.target.nodeKey, true);
            }
            break;
          case 'animation.play':
            if (action.animationId) {
              viewerControls.playAnimation(action.animationId, action.startTime, action.endTime);
            }
            break;
          case 'visibility.set':
            if (action.items) {
              action.items.forEach((item: any) => {
                viewerControls.setNodeVisibility(item.nodeKey, item.visible);
              });
            }
            break;
        }
      }, index * 300); // 动作间隔300ms
    });
  };

  const nextItem = () => {
    const outline = courseData?.courseData?.outline;
    if (!outline) return;

    const currentSegment = outline[playbackState.currentSegmentIndex];
    if (!currentSegment?.items) return;

    if (playbackState.currentItemIndex < currentSegment.items.length - 1) {
      // 下一个项目
      setPlaybackState(prev => ({
        ...prev,
        currentItemIndex: prev.currentItemIndex + 1,
        progress: 0
      }));
    } else if (playbackState.currentSegmentIndex < outline.length - 1) {
      // 下一个段落
      setPlaybackState(prev => ({
        ...prev,
        currentSegmentIndex: prev.currentSegmentIndex + 1,
        currentItemIndex: 0,
        progress: 0
      }));
    } else {
      // 播放结束
      onPlayStateChange(false);
      message.success('课程播放完成！');
    }
  };

  const prevItem = () => {
    if (playbackState.currentItemIndex > 0) {
      // 上一个项目
      setPlaybackState(prev => ({
        ...prev,
        currentItemIndex: prev.currentItemIndex - 1,
        progress: 0
      }));
    } else if (playbackState.currentSegmentIndex > 0) {
      // 上一个段落的最后一个项目
      const outline = courseData?.courseData?.outline;
      if (!outline) return;
      
      const prevSegment = outline[playbackState.currentSegmentIndex - 1];
      if (!prevSegment?.items) return;

      setPlaybackState(prev => ({
        ...prev,
        currentSegmentIndex: prev.currentSegmentIndex - 1,
        currentItemIndex: prevSegment.items.length - 1,
        progress: 0
      }));
    }
  };

  const canGoPrev = playbackState.currentSegmentIndex > 0 || playbackState.currentItemIndex > 0;
  const canGoNext = (() => {
    const outline = courseData?.courseData?.outline;
    if (!outline) return false;
    
    const currentSegment = outline[playbackState.currentSegmentIndex];
    if (!currentSegment?.items) return false;
    
    return playbackState.currentItemIndex < currentSegment.items.length - 1 || 
           playbackState.currentSegmentIndex < outline.length - 1;
  })();

  return (
    <div style={{ 
      width: '100%', 
      height: '100vh', 
      position: 'relative',
      overflow: 'hidden' // 防止内容超出
    }}>
      {/* 3D查看器 */}
      <div style={{ 
        width: '100%', 
        height: isFullscreen ? '100%' : 'calc(100vh - 140px)', // 非全屏时为控件和字幕留出更多空间
        position: 'absolute', 
        top: 0, 
        left: 0 
      }}>
        <PublicThreeDViewer
          ref={viewerControlsRef}
          coursewareData={courseData?.coursewareData}
          width={typeof window !== 'undefined' ? window.innerWidth : 1920}
          height={typeof window !== 'undefined' ? (isFullscreen ? window.innerHeight : window.innerHeight - 140) : 1080}
        />
      </div>

      {/* 图片叠加层 */}
      {currentImage && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '300px',
          maxWidth: '30%',
          background: 'rgba(0, 0, 0, 0.8)',
          borderRadius: '8px',
          overflow: 'hidden',
          zIndex: 1000,
          cursor: 'pointer',
          transition: 'transform 0.2s ease',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
        }}
        onClick={() => handleImageClick(currentImage.url)}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        title="点击放大查看"
        >
          <img 
            src={currentImage.url} 
            alt={currentImage.title}
            style={{
              width: '100%',
              height: 'auto',
              display: 'block'
            }}
          />
          {currentImage.title && (
            <div style={{
              padding: '8px',
              color: 'white',
              fontSize: '12px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span>{currentImage.title}</span>
              <span style={{ fontSize: '10px', opacity: 0.7 }}>🔍 点击放大</span>
            </div>
          )}
        </div>
      )}

      {/* 字幕 */}
      {currentSubtitle && (
        <div style={{
          position: 'absolute',
          bottom: isFullscreen ? '100px' : '80px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          maxWidth: '90%',
          textAlign: 'center',
          zIndex: 1000
        }}>
          {currentSubtitle}
        </div>
      )}

      {/* 播放控制栏 */}
      <div style={{
        position: 'absolute',
        bottom: isFullscreen ? '20px' : '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '25px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 9999,
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)'
      }}>
        <Button 
          type="text" 
          icon={<StepBackwardOutlined />} 
          onClick={prevItem}
          disabled={!canGoPrev}
          style={{ color: 'white' }}
          size="small"
        />
        
        <Button 
          type="text" 
          icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />} 
          onClick={() => onPlayStateChange(!isPlaying)}
          style={{ color: 'white', fontSize: '18px' }}
          size="small"
        />
        
        <Button 
          type="text" 
          icon={<StepForwardOutlined />} 
          onClick={nextItem}
          disabled={!canGoNext}
          style={{ color: 'white' }}
          size="small"
        />

        <div style={{ 
          color: 'white', 
          fontSize: '12px', 
          minWidth: '60px',
          textAlign: 'center'
        }}>
          {currentItemNumber} / {totalItems}
        </div>

        {isFullscreen && (
          <Space>
            <Button 
              type="text" 
              icon={<ShareAltOutlined />} 
              onClick={onShare}
              style={{ color: 'white' }}
              size="small"
            />
            <Button 
              type="text" 
              icon={<ExpandOutlined />} 
              onClick={onToggleFullscreen}
              style={{ color: 'white' }}
              size="small"
            />
          </Space>
        )}
      </div>

      {/* 图片查看器模态框 */}
      {imageViewerVisible && (
        <ImageViewer 
          src={viewerImageSrc} 
          visible={imageViewerVisible} 
          onClose={closeImageViewer} 
        />
      )}
    </div>
  );
}

// 图片查看器组件
interface ImageViewerProps {
  src: string;
  visible: boolean;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, visible, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 重置状态
  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // 缩放处理
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(0.5, Math.min(5, scale + delta));
    setScale(newScale);
  };

  // 鼠标按下
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // 左键
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragOffset(position);
    }
  };

  // 鼠标移动
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      setPosition({
        x: dragOffset.x + dx,
        y: dragOffset.y + dy
      });
    }
  };

  // 鼠标松开
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 触摸事件处理（移动端支持）
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // 单指拖拽
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX, y: touch.clientY });
      setDragOffset(position);
    } else if (e.touches.length === 2) {
      // 双指缩放
      e.preventDefault();
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging) {
      // 单指拖拽
      const touch = e.touches[0];
      const dx = touch.clientX - dragStart.x;
      const dy = touch.clientY - dragStart.y;
      setPosition({
        x: dragOffset.x + dx,
        y: dragOffset.y + dy
      });
    } else if (e.touches.length === 2) {
      // 双指缩放逻辑可以在这里添加
      // 为简化，暂时只支持按钮缩放
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // 双击重置
  const handleDoubleClick = () => {
    if (scale === 1) {
      setScale(2);
    } else {
      resetView();
    }
  };

  // 键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;
      
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          setScale(prev => Math.min(5, prev + 0.2));
          break;
        case '-':
          setScale(prev => Math.max(0.5, prev - 0.2));
          break;
        case '0':
          resetView();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, onClose]);

  // 组件卸载时重置
  useEffect(() => {
    if (visible) {
      resetView();
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 顶部工具栏 */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '25px',
        padding: '8px 16px',
        color: 'white',
        fontSize: '14px',
        zIndex: 10001,
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        maxWidth: '90vw',
        overflow: 'hidden'
      }}>
        <span>缩放: {Math.round(scale * 100)}%</span>
        <span style={{ display: window.innerWidth > 640 ? 'inline' : 'none' }}>|</span>
        <span style={{ 
          display: window.innerWidth > 640 ? 'inline' : 'none',
          whiteSpace: 'nowrap'
        }}>
          {window.innerWidth > 768 ? '滚轮缩放 • 拖拽移动 • 双击重置 • ESC关闭' : '拖拽移动 • 双击重置'}
        </span>
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: 'none',
          background: 'rgba(255, 255, 255, 0.2)',
          color: 'white',
          fontSize: '20px',
          cursor: 'pointer',
          zIndex: 10001,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(10px)'
        }}
        title="关闭 (ESC)"
      >
        ×
      </button>

      {/* 缩放控制按钮 */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 10001
      }}>
        <button
          onClick={() => setScale(prev => Math.min(5, prev + 0.2))}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)'
          }}
          title="放大 (+)"
        >
          +
        </button>
        <button
          onClick={() => setScale(prev => Math.max(0.5, prev - 0.2))}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: '18px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)'
          }}
          title="缩小 (-)"
        >
          -
        </button>
        <button
          onClick={resetView}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: 'none',
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            fontSize: '12px',
            cursor: 'pointer',
            backdropFilter: 'blur(10px)'
          }}
          title="重置 (0)"
        >
          1:1
        </button>
      </div>

      {/* 图片 */}
      <img
        ref={imageRef}
        src={src}
        alt="放大查看"
        style={{
          maxWidth: scale === 1 ? '90vw' : 'none',
          maxHeight: scale === 1 ? '90vh' : 'none',
          transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          cursor: isDragging ? 'grabbing' : scale > 1 ? 'grab' : 'default',
          userSelect: 'none',
          pointerEvents: 'auto'
        }}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onDragStart={(e) => e.preventDefault()}
      />
    </div>
  );
};
