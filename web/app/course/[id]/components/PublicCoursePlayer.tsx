"use client";
import { useEffect, useRef, useState, Component, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Button, Modal, Progress, Space, Typography, message } from 'antd';
import { 
  PlayCircleOutlined, 
  PauseCircleOutlined, 
  StepBackwardOutlined, 
  StepForwardOutlined,
  ShareAltOutlined,
  SoundOutlined,
  ArrowLeftOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  CheckCircleOutlined,
  PlayCircleFilled
} from '@ant-design/icons';
import PublicThreeDViewer, { PublicThreeDViewerControls } from './PublicThreeDViewer';

// 错误边界组件
class PlayerErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('PublicCoursePlayer Error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          width: '100%', 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#000',
          color: 'white',
          padding: '20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>课程播放器加载失败</div>
          <div style={{ 
            fontSize: '12px', 
            color: '#ff6b6b', 
            background: 'rgba(255,0,0,0.1)',
            padding: '15px',
            borderRadius: '8px',
            maxWidth: '90%',
            wordBreak: 'break-all',
            textAlign: 'left',
            fontFamily: 'monospace'
          }}>
            {this.state.error?.message || '未知错误'}
            <br/><br/>
            {this.state.error?.stack?.slice(0, 500)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const { Text } = Typography;

interface PublicCoursePlayerProps {
  courseData: any;
  isPlaying: boolean;
  onPlayStateChange: (playing: boolean) => void;
  onShare: () => void;
  onBack?: () => void;
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
  onShare,
  onBack
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
  const [showMobileAudioButton, setShowMobileAudioButton] = useState(false);
  const playbackTimerRef = useRef<NodeJS.Timeout>();
  const currentAudioRef = useRef<HTMLAudioElement | null>(null); // 当前播放的音频引用
  const [totalItems, setTotalItems] = useState(0);
  const [currentItemNumber, setCurrentItemNumber] = useState(0);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [outlineVisible, setOutlineVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 图片预览打开时隐藏 WebGL 画布，规避浏览器合成层覆盖弹窗的问题。
  useEffect(() => {
    if (!imageViewerVisible) return;

    const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas'));
    const previousVisibility = canvases.map(canvas => canvas.style.visibility);
    canvases.forEach(canvas => {
      canvas.style.visibility = 'hidden';
    });

    return () => {
      canvases.forEach((canvas, index) => {
        canvas.style.visibility = previousVisibility[index];
      });
    };
  }, [imageViewerVisible]);
  const [windowSize, setWindowSize] = useState({ width: 1920, height: 1080 });

  // 检测移动端和窗口尺寸（安全检查）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const updateSize = () => {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

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

  // 移动端音频检测
  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;
    
    // console.log('🔍 设备检测:', {
    //   userAgent: navigator.userAgent,
    //   isIOS,
    //   isAndroid,
    //   isMobile,
    //   isPlaying,
    //   needsUserInteraction,
    //   audioContextState: audioContext?.state || 'none'
    // });
    
    if (isMobile) {
      // console.log('📱 检测到移动端设备');
      
      // iOS设备需要特殊处理
      if (isIOS) {
        // iOS总是需要用户交互来启用音频
        setShowMobileAudioButton(true);
        // console.log('🍎 iOS设备：立即显示音频按钮');
      } else if (isAndroid) {
        // Android检查AudioContext状态
        if (!audioContext || audioContext.state === 'suspended') {
          setShowMobileAudioButton(true);
          // console.log('🤖 Android设备：AudioContext未初始化，显示音频按钮');
        }
      }
      
      // 播放开始后的延迟检测
      if (isPlaying && needsUserInteraction) {
        const timer = setTimeout(() => {
          setShowMobileAudioButton(true);
          // console.log('📱 播放中检测到需要用户交互，显示音频按钮');
        }, 500); // 减少延迟到500ms
        
        return () => clearTimeout(timer);
      }
    }
  }, [isPlaying, needsUserInteraction, audioContext]);

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
      // console.log('AudioContext初始化成功:', ctx.state);
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
    currentAudioRef.current = audio;
    
    audio.onended = onEnded;
    audio.onerror = () => onError(estimatedDuration);
    
    try {
      // 在iOS上确保AudioContext已启动
      if (audioContext && audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      
      await audio.play();
      // console.log('音频播放成功:', audioUrl);
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
        
        // 检查是否是移动端且需要用户交互
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const isNotAllowed = error.name === 'NotAllowedError' || error.name === 'AbortError';
        
        if (isMobile && isNotAllowed) {
          setShowMobileAudioButton(true);
          console.log('移动端需要用户手动启动音频播放, 错误:', error.name);
        } else {
          // 对于其他音频错误，也尝试显示手动播放按钮
          console.log('音频播放失败，显示手动播放按钮');
          setShowMobileAudioButton(true);
        }
        
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

  // 手动播放音频（移动端专用）
  const handleManualAudioPlay = async () => {
    try {
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      // console.log('🔊 用户手动启动音频播放, iOS:', isIOS);
      
      // iOS需要特殊的音频解锁序列
      if (isIOS) {
        // console.log('🍎 执行iOS音频解锁序列');
        
        // 1. 创建多个不同格式的测试音频
        const iosTestAudios = [
          { type: 'wav', src: 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAAAAAAAAAAAAAAAAAAAZGF0YQAAAAA=' },
          { type: 'mp3', src: 'data:audio/mpeg;base64,SUQzAwAAAAABClRJVDIAAAAOAAABVGVzdA==' },
          { type: 'wav-short', src: 'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmYcBz+S2fLNeSsFJHfH8N2QQAoUXrTp66hVFApGn+DyvmYcB' }
        ];
        
        for (const audioData of iosTestAudios) {
          try {
            const testAudio = new Audio();
            testAudio.src = audioData.src;
            testAudio.volume = 0.01; // 极低音量
            testAudio.muted = false;
            testAudio.preload = 'auto';
            
            // iOS需要先设置事件监听器
            const playPromise = new Promise<void>((resolve, reject) => {
              testAudio.oncanplay = () => {
                testAudio.play().then(() => {
                  // console.log(`✅ iOS ${audioData.type} 音频测试成功`);
                  testAudio.pause();
                  resolve();
                }).catch(reject);
              };
              testAudio.onerror = reject;
              setTimeout(reject, 2000); // 2秒超时
            });
            
            await playPromise;
            break; // 成功一个就够了
          } catch (e: any) {
            // console.log(`❌ iOS ${audioData.type} 音频测试失败:`, e.name);
          }
        }
        
        // 2. 初始化AudioContext（iOS特殊处理）
        try {
          if (!audioContext) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            
            // iOS需要在用户交互中初始化
            if (ctx.state === 'suspended') {
              await ctx.resume();
              // console.log('🍎 iOS AudioContext 恢复成功');
            }
            
            setAudioContext(ctx);
          } else if (audioContext.state === 'suspended') {
            await audioContext.resume();
            // console.log('🍎 iOS AudioContext 重新恢复');
          }
        } catch (e: any) {
          console.error('⚠️ iOS AudioContext 初始化失败:', e.name);
        }
        
      } else {
        // Android 和其他设备的处理
        // console.log('🤖 执行标准音频解锁序列');
        
        // 静音音频解锁
        const unlockAudio = new Audio();
        unlockAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAAAAAAAAAAAAAAAAAAAZGF0YQAAAAA=';
        unlockAudio.volume = 0;
        unlockAudio.muted = false;
        
        try {
          await unlockAudio.play();
          // console.log('✅ 标准音频权限解锁成功');
        } catch (e) {
          // console.log('❌ 静音音频播放失败:', e);
        }
        
        // 初始化音频上下文
        await initAudioContext();
      }
      
      // 隐藏音频按钮
      setShowMobileAudioButton(false);
      setNeedsUserInteraction(false);
      
      // 继续当前播放
      if (!isPlaying) {
        onPlayStateChange(true);
      }
      
      message.success('🎵 音频已启用，播放将继续进行');
      // console.log('🎉 音频手动启用完成');
    } catch (error) {
      console.error('💥 手动启动音频失败:', error);
      message.error('音频启动失败，请重试');
    }
  };

  const startPlayback = async () => {
    // console.log('🎬 开始播放前检查');
    
    // 确保3D模型已加载
    if (courseData?.coursewareData?.modifiedModelUrl) {
      // console.log('🎯 确保3D模型加载完成');
      if (!modelLoaded) {
        // 等待模型加载完成，最多等待10秒
        let waited = 0;
        while (!modelLoaded && waited < 10000) {
          await new Promise(resolve => setTimeout(resolve, 100));
          waited += 100;
        }
        if (!modelLoaded) {
          console.warn('模型加载超时，但继续播放');
        }
      }
    }
    
    // 首次播放时初始化音频上下文
    if (needsUserInteraction) {
      await initAudioContext();
    }
    
    const currentItem = getCurrentItem();
    if (!currentItem) return;

    // console.log('🎬 播放步骤:', currentItem);
    
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
    
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
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
    // console.log('执行talk步骤:', {
    //   type: item.type,
    //   say: item.say?.substring(0, 50) + '...',
    //   audioUrl: item.audioUrl,
    //   hasAudio: !!item.audioUrl
    // });
    
    setCurrentSubtitle(item.say || '');
    
    // 开始模型自转
    if (viewerControlsRef.current?.startAutoRotation) {
      viewerControlsRef.current.startAutoRotation();
    }
    
    // 播放音频（如果有）
    if (item.audioUrl) {
      // console.log('播放音频:', item.audioUrl);
      return new Promise((resolve) => {
        const audio = new Audio();
        
        // 使用当前域名作为基础URL（浏览器端始终使用 window.location.origin）
        // 不使用 NEXT_PUBLIC_API_URL，因为那可能是 Docker 内部地址
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        let audioUrl = item.audioUrl;
        
        // 处理相对路径
        if (audioUrl.startsWith('/')) {
          audioUrl = `${baseUrl}${audioUrl}`;
        }
        // 使用公开代理来解决CORS问题
        else if (audioUrl.startsWith('https://dl.yf-xr.com/')) {
          audioUrl = `${baseUrl}/api/public/proxy?url=${encodeURIComponent(audioUrl)}`;
        }
        
        audio.src = audioUrl;
        currentAudioRef.current = audio;
        
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
            // console.log('需要用户交互才能播放音频，显示文本替代');
            // 设置音频为预备状态，等待用户交互后播放
            currentAudioRef.current = audio;
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
    // console.log('执行image.explain步骤:', {
    //   type: item.type,
    //   say: item.say?.substring(0, 50) + '...',
    //   audioUrl: item.audioUrl,
    //   imageUrl: item.imageUrl,
    //   originalImageUrl: item.originalImageUrl,
    //   hasAudio: !!item.audioUrl,
    //   allKeys: Object.keys(item)
    // });
    
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
      // 处理图片URL：外部URL通过代理访问（避免热链保护、CORS等问题）
      let processedImageUrl = imageUrl;
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      if (imageUrl.startsWith('https://dl.yf-xr.com/') || imageUrl.startsWith('https://video.yf-xr.com/')) {
        processedImageUrl = `${baseUrl}/api/public/proxy?url=${encodeURIComponent(imageUrl)}`;
      } else if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // 其他外部图片URL也通过代理，避免热链保护和跨域问题
        processedImageUrl = `${baseUrl}/api/public/proxy?url=${encodeURIComponent(imageUrl)}`;
      }
        
      setCurrentImage({
        url: processedImageUrl,
        title: item.imageTitle || item.say || 'Course Image'
      });
      
      // console.log('设置图片显示:', {
      //   原始URL: imageUrl,
      //   处理后URL: processedImageUrl,
      //   来源: item.imageUrl ? 'imageUrl' : item.image?.src ? 'image.src' : 'originalImageUrl'
      // });
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
      // console.log('播放image.explain音频:', item.audioUrl);
      return new Promise((resolve) => {
        const audio = new Audio();
        
        // 使用当前域名作为基础URL（浏览器端始终使用 window.location.origin）
        // 不使用 NEXT_PUBLIC_API_URL，因为那可能是 Docker 内部地址
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        let audioUrl = item.audioUrl;
        
        // 处理相对路径
        if (audioUrl.startsWith('/')) {
          audioUrl = `${baseUrl}${audioUrl}`;
        }
        // 使用公开代理来解决CORS问题
        else if (audioUrl.startsWith('https://dl.yf-xr.com/')) {
          audioUrl = `${baseUrl}/api/public/proxy?url=${encodeURIComponent(audioUrl)}`;
        }
        
        audio.src = audioUrl;
        currentAudioRef.current = audio;
        
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
    // console.log('执行scene.action步骤:', {
    //   type: item.type,
    //   say: item.say?.substring(0, 50) + '...',
    //   audioUrl: item.audioUrl,
    //   actions: item.actions,
    //   hasAudio: !!item.audioUrl
    // });
    
    setCurrentSubtitle(item.say || '');
    
    // 执行3D动作并获取动画持续时间
    let animationDuration = 0;
    if (item.actions && viewerControlsRef.current) {
      animationDuration = executeActionsWithControls(item.actions, viewerControlsRef.current);
    }
    
    // 播放音频（如果有）
    if (item.audioUrl) {
      // console.log('播放scene.action音频:', item.audioUrl);
      return new Promise((resolve) => {
        const audio = new Audio();
        
        // 使用当前域名作为基础URL（浏览器端始终使用 window.location.origin）
        // 不使用 NEXT_PUBLIC_API_URL，因为那可能是 Docker 内部地址
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        let audioUrl = item.audioUrl;
        
        // 处理相对路径
        if (audioUrl.startsWith('/')) {
          audioUrl = `${baseUrl}${audioUrl}`;
        }
        // 使用公开代理来解决CORS问题
        else if (audioUrl.startsWith('https://dl.yf-xr.com/')) {
          audioUrl = `${baseUrl}/api/public/proxy?url=${encodeURIComponent(audioUrl)}`;
        }
        
        audio.src = audioUrl;
        currentAudioRef.current = audio;
        
        let audioEnded = false;
        let animationEnded = false;
        
        const checkBothEnded = () => {
          if (audioEnded && animationEnded) {
            setCurrentSubtitle('');
            resolve(0); // 音频和动画都完成，立即跳转
          }
        };
        
        audio.onended = () => {
          audioEnded = true;
          checkBothEnded();
        };
        
        // 如果有动画，等待动画完成
        if (animationDuration > 0) {
          setTimeout(() => {
            animationEnded = true;
            checkBothEnded();
          }, animationDuration * 1000);
        } else {
          // 没有动画，直接标记为完成
          animationEnded = true;
        }
        
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
      // 没有音频时，等待动画完成或使用估算时间
      return new Promise((resolve) => {
        const estimatedDuration = Math.max(3, (item.say?.length || 0) * 0.15);
        const waitDuration = Math.max(animationDuration, estimatedDuration);
        
        setTimeout(() => {
          setCurrentSubtitle('');
          resolve(0);
        }, waitDuration * 1000);
      });
    }
  };

  const executeActionsWithControls = (actions: any[], viewerControls: any): number => {
    let maxAnimationDuration = 0;
    let maxActionDelay = 0;
    
    // 先同步计算所有动画的持续时间和延迟（不实际播放）
    actions.forEach((action, index) => {
      const actionDelay = index * 300; // 动作间隔300ms
      if (actionDelay > maxActionDelay) {
        maxActionDelay = actionDelay;
      }
      
      if (action.type === 'animation.play') {
        // 优先使用animationName（更稳定），如果没有则使用animationId
        const animationIdentifier = action.animationName || action.animationId;
        if (animationIdentifier && viewerControls.getAnimationDuration) {
          // 只获取动画持续时间，不实际播放
          const duration = viewerControls.getAnimationDuration(animationIdentifier);
          // 总持续时间 = 延迟时间 + 动画时长
          const totalDuration = actionDelay / 1000 + duration;
          if (totalDuration > maxAnimationDuration) {
            maxAnimationDuration = totalDuration;
          }
        }
      }
    });
    
    // 然后异步执行所有动作
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
              viewerControls.showAnnotations(action.ids, action.labelScale);
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
            // 实际播放动画
            const animationIdentifier = action.animationName || action.animationId;
            if (animationIdentifier) {
              viewerControls.playAnimation(animationIdentifier, action.startTime, action.endTime);
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
    
    return maxAnimationDuration;
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

  // 跳转到指定段落和项目
  const jumpToItem = (segmentIndex: number, itemIndex: number) => {
    // 停止当前播放的音频
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
    }
    
    // 清除播放定时器
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
      playbackTimerRef.current = undefined;
    }
    
    // 设置新的播放位置
    setPlaybackState({
      currentSegmentIndex: segmentIndex,
      currentItemIndex: itemIndex,
      progress: 0
    });
    
    // 清除字幕和图片
    setCurrentSubtitle('');
    setCurrentImage(null);
    
    // 移动端自动关闭大纲
    if (isMobile) {
      setOutlineVisible(false);
    }
  };

  // 获取项目的全局索引
  const getGlobalItemIndex = (segmentIndex: number, itemIndex: number): number => {
    const outline = courseData?.courseData?.outline;
    if (!outline) return 0;
    
    let index = 0;
    for (let i = 0; i < segmentIndex; i++) {
      index += outline[i]?.items?.length || 0;
    }
    return index + itemIndex + 1;
  };

  // 检查项目是否已完成
  const isItemCompleted = (segmentIndex: number, itemIndex: number): boolean => {
    const currentGlobal = getGlobalItemIndex(playbackState.currentSegmentIndex, playbackState.currentItemIndex);
    const targetGlobal = getGlobalItemIndex(segmentIndex, itemIndex);
    return targetGlobal < currentGlobal;
  };

  // 检查是否是当前项目
  const isCurrentItem = (segmentIndex: number, itemIndex: number): boolean => {
    return segmentIndex === playbackState.currentSegmentIndex && itemIndex === playbackState.currentItemIndex;
  };

  return (
    <PlayerErrorBoundary>
    <>
      <style>{`
        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.05); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes start-glow {
          0%, 100% { box-shadow: 0 0 30px rgba(16, 185, 129, 0.4), 0 0 60px rgba(16, 185, 129, 0.2); }
          50% { box-shadow: 0 0 40px rgba(16, 185, 129, 0.6), 0 0 80px rgba(16, 185, 129, 0.3); }
        }
        
        /* 移动端横屏适配 */
        @media screen and (max-width: 768px) and (orientation: portrait) {
          .landscape-hint {
            display: flex !important;
          }
        }
        @media screen and (max-width: 768px) and (orientation: landscape) {
          .landscape-hint {
            display: none !important;
          }
        }
        @media screen and (min-width: 769px) {
          .landscape-hint {
            display: none !important;
          }
        }
        
        /* 移动端工具栏紧凑样式 */
        @media screen and (max-width: 768px) {
          .mobile-toolbar {
            padding: 0 12px !important;
            height: 50px !important;
          }
          .mobile-toolbar .ant-btn {
            padding: 2px 6px !important;
            font-size: 12px !important;
          }
        }
      `}</style>
      
      {/* 移动端竖屏提示 */}
      {isMobile && (
        <div 
          className="landscape-hint"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.98)',
            zIndex: 9999,
            display: 'none',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px'
          }}
        >
          <div style={{ fontSize: '60px' }}>📱</div>
          <div style={{ 
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '18px',
            fontWeight: 600
          }}>
            请横屏观看
          </div>
          <div style={{ 
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '14px',
            textAlign: 'center',
            padding: '0 40px'
          }}>
            为获得最佳学习体验，请将设备横向放置
          </div>
          <div style={{
            marginTop: '20px',
            animation: 'rotate-hint 1.5s ease-in-out infinite'
          }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5">
              <rect x="4" y="2" width="16" height="20" rx="2" />
              <path d="M12 18h.01" />
            </svg>
          </div>
          <style>{`
            @keyframes rotate-hint {
              0%, 100% { transform: rotate(0deg); }
              50% { transform: rotate(90deg); }
            }
          `}</style>
        </div>
      )}
      <div style={{ 
        width: '100%', 
        height: '100vh', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 顶部控制栏 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '60px',
          background: 'rgba(0, 0, 0, 0.9)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {/* 左侧：返回按钮和标题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {onBack && (
              <Button 
                type="text" 
                icon={<ArrowLeftOutlined />} 
                onClick={onBack}
                style={{ color: 'white', padding: '4px 8px' }}
              >
                返回
              </Button>
            )}
            <div style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
              {courseData.title || '课程播放中'}
            </div>
          </div>
          
          {/* 中间播放控制 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
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
              style={{ color: 'white', fontSize: '20px' }}
              size="large"
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
              fontSize: '14px', 
              minWidth: '80px',
              textAlign: 'center'
            }}>
              {currentItemNumber} / {totalItems}
            </div>
          </div>
          
          {/* 右侧按钮组 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* 移动端音频按钮 */}
            {showMobileAudioButton && (
              <Button 
                type="primary"
                danger
                icon={<SoundOutlined />} 
                onClick={handleManualAudioPlay}
                size="small"
                style={{
                  background: 'linear-gradient(45deg, #ff6b6b, #ff8e8e)',
                  border: 'none',
                  borderRadius: '20px',
                  animation: 'pulse 2s infinite',
                  boxShadow: '0 0 10px rgba(255, 107, 107, 0.5)'
                }}
              >
                启用音频
              </Button>
            )}
            
            <Button 
              type="text" 
              icon={<ShareAltOutlined />} 
              onClick={onShare}
              style={{ color: 'white' }}
              size="small"
            >
              {!isMobile && '分享'}
            </Button>
            
            {/* 大纲按钮 */}
            <Button 
              type="text" 
              icon={outlineVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />} 
              onClick={() => setOutlineVisible(!outlineVisible)}
              style={{ color: 'white' }}
              size="small"
            >
              {!isMobile && '大纲'}
            </Button>
          </div>
        </div>

        {/* 3D查看器 */}
        <div style={{ 
          width: '100%', 
          height: 'calc(100vh - 60px)', // 为顶部控制栏留出空间
          position: 'absolute', 
          top: '60px', 
          left: 0,
          overflow: 'hidden'
        }}>
          <PublicThreeDViewer
            ref={viewerControlsRef}
            coursewareData={courseData?.coursewareData}
            width={outlineVisible && !isMobile ? windowSize.width - 320 : windowSize.width}
            height={windowSize.height - 60}
            onModelLoaded={() => {
              console.log('✅ 3D模型加载完成');
              setModelLoaded(true);
            }}
          />
        </div>

        {/* 开始播放覆盖层 - 当未播放且尚未开始时显示 */}
        {!isPlaying && currentItemNumber === 0 && (
          <div style={{
            position: 'absolute',
            top: '60px',
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 500,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
          }}>
            <div
              onClick={() => onPlayStateChange(true)}
              style={{
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'transform 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <div style={{
                width: 100,
                height: 100,
                margin: '0 auto 20px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9) 0%, rgba(5, 150, 105, 0.9) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'start-glow 2.5s ease-in-out infinite',
                border: '3px solid rgba(52, 211, 153, 0.3)',
              }}>
                <PlayCircleOutlined style={{ fontSize: 52, color: 'white' }} />
              </div>
              <div style={{
                fontSize: 22,
                fontWeight: 700,
                color: 'rgba(255, 255, 255, 0.95)',
                marginBottom: 6,
                letterSpacing: 2,
              }}>
                开始播放
              </div>
              <div style={{
                fontSize: 13,
                color: 'rgba(110, 231, 183, 0.7)',
              }}>
                点击开始 AI 课程讲解
              </div>
            </div>
          </div>
        )}

        {/* 课程大纲面板 - 毛玻璃深色风格 */}
        <div 
          style={{
            position: 'absolute',
            top: '60px',
            right: outlineVisible ? 0 : '-320px',
            width: isMobile ? '85%' : '320px',
            maxWidth: isMobile ? '320px' : '320px',
            height: 'calc(100vh - 60px)',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
            transition: 'right 0.3s ease',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {/* 面板标题 */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}>
            <div style={{ 
              color: 'rgba(255, 255, 255, 0.95)', 
              fontWeight: 600,
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <MenuUnfoldOutlined style={{ color: '#06b6d4' }} />
              课程大纲
            </div>
            <Button 
              type="text" 
              size="small"
              onClick={() => setOutlineVisible(false)}
              style={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: '18px',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </Button>
          </div>

          {/* 大纲内容 */}
          <div style={{ 
            flex: 1,
            overflow: 'auto',
            padding: '12px 0'
          }}>
            {courseData?.courseData?.outline?.map((segment: any, segmentIndex: number) => (
              <div key={segmentIndex} style={{ marginBottom: '8px' }}>
                {/* 段落标题 */}
                <div style={{
                  padding: '10px 20px',
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: '14px',
                  fontWeight: 600,
                  background: playbackState.currentSegmentIndex === segmentIndex 
                    ? 'rgba(6, 182, 212, 0.15)' 
                    : 'transparent',
                  borderLeft: playbackState.currentSegmentIndex === segmentIndex 
                    ? '3px solid #06b6d4' 
                    : '3px solid transparent'
                }}>
                  {segment.title || `第 ${segmentIndex + 1} 章节`}
                </div>
                
                {/* 段落项目列表 */}
                <div style={{ paddingLeft: '20px' }}>
                  {segment.items?.map((item: any, itemIndex: number) => {
                    const isCurrent = isCurrentItem(segmentIndex, itemIndex);
                    const isCompleted = isItemCompleted(segmentIndex, itemIndex);
                    const globalIndex = getGlobalItemIndex(segmentIndex, itemIndex);
                    
                    return (
                      <div
                        key={itemIndex}
                        onClick={() => jumpToItem(segmentIndex, itemIndex)}
                        style={{
                          padding: '10px 16px',
                          marginRight: '12px',
                          marginBottom: '4px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          background: isCurrent 
                            ? 'rgba(139, 92, 246, 0.25)' 
                            : 'rgba(255, 255, 255, 0.03)',
                          border: isCurrent 
                            ? '1px solid rgba(139, 92, 246, 0.5)' 
                            : '1px solid transparent',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrent) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrent) {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                          }
                        }}
                      >
                        {/* 状态图标 */}
                        <div style={{
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          flexShrink: 0,
                          background: isCurrent 
                            ? '#8b5cf6' 
                            : isCompleted 
                              ? '#10b981' 
                              : 'rgba(255, 255, 255, 0.1)',
                          color: isCurrent || isCompleted ? 'white' : 'rgba(255, 255, 255, 0.5)'
                        }}>
                          {isCurrent ? (
                            <PlayCircleFilled style={{ fontSize: '12px' }} />
                          ) : isCompleted ? (
                            <CheckCircleOutlined style={{ fontSize: '12px' }} />
                          ) : (
                            globalIndex
                          )}
                        </div>
                        
                        {/* 项目内容 */}
                        <div style={{ 
                          flex: 1,
                          minWidth: 0
                        }}>
                          <div style={{
                            fontSize: '13px',
                            color: isCurrent 
                              ? 'rgba(255, 255, 255, 0.95)' 
                              : isCompleted 
                                ? 'rgba(255, 255, 255, 0.7)' 
                                : 'rgba(255, 255, 255, 0.8)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.say?.substring(0, 30) || item.type || `步骤 ${itemIndex + 1}`}
                            {item.say && item.say.length > 30 && '...'}
                          </div>
                          <div style={{
                            fontSize: '11px',
                            color: 'rgba(255, 255, 255, 0.4)',
                            marginTop: '2px'
                          }}>
                            {item.type === 'scene.action' ? '场景动作' : 
                             item.type === 'image.explain' ? '图片讲解' : 
                             item.type || '讲解'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* 底部进度信息 */}
          <div style={{
            padding: '12px 20px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.2)',
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}>
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                学习进度
              </span>
              <span style={{ color: '#06b6d4', fontSize: '13px', fontWeight: 600 }}>
                {currentItemNumber} / {totalItems}
              </span>
            </div>
            <Progress 
              percent={totalItems > 0 ? Math.round((currentItemNumber / totalItems) * 100) : 0}
              strokeColor={{ '0%': '#06b6d4', '100%': '#8b5cf6' }}
              trailColor="rgba(255, 255, 255, 0.1)"
              size="small"
              showInfo={false}
            />
          </div>
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
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.style.minHeight = '60px';
              e.currentTarget.parentElement!.style.display = 'flex';
              e.currentTarget.parentElement!.style.alignItems = 'center';
              e.currentTarget.parentElement!.style.justifyContent = 'center';
              e.currentTarget.parentElement!.style.color = '#888';
              e.currentTarget.parentElement!.style.fontSize = '12px';
              e.currentTarget.parentElement!.innerHTML = '🖼️ 图片加载失败';
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
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '25px',
          fontSize: '16px',
          maxWidth: '80%',
          textAlign: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          {currentSubtitle}
        </div>
      )}



      {/* 图片查看器：使用 Ant Design Portal，避免自定义弹层被 WebGL 覆盖 */}
      <Modal
        open={imageViewerVisible}
        onCancel={closeImageViewer}
        footer={null}
        centered
        width="100vw"
        zIndex={100000}
        destroyOnClose
        styles={{
          mask: { background: '#000' },
          wrapper: { overflow: 'hidden' },
          content: {
            width: '100vw',
            height: '100vh',
            maxWidth: 'none',
            padding: 0,
            borderRadius: 0,
            background: '#000',
            boxShadow: 'none'
          },
          body: {
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#000'
          }
        }}
      >
        {viewerImageSrc && (
          <img
            src={viewerImageSrc}
            alt="课程配图放大查看"
            style={{
              display: 'block',
              maxWidth: '94vw',
              maxHeight: '92vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain'
            }}
          />
        )}
      </Modal>
      </div>
    </>
    </PlayerErrorBoundary>
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
  const [imgError, setImgError] = useState(false);
  
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
      setImgError(false);
    }
  }, [visible, src]);

  // 部分浏览器会将 WebGL canvas 放在独立合成层，导致其错误覆盖普通 DOM 弹层。
  // 查看图片时临时隐藏页面中的 three.js 画布，关闭后恢复原状。
  useEffect(() => {
    if (!visible) return;

    const canvases = Array.from(document.querySelectorAll<HTMLCanvasElement>('canvas'));
    const previousVisibility = canvases.map(canvas => canvas.style.visibility);
    const previousOverflow = document.body.style.overflow;

    canvases.forEach(canvas => {
      canvas.style.visibility = 'hidden';
    });
    document.body.style.overflow = 'hidden';

    return () => {
      canvases.forEach((canvas, index) => {
        canvas.style.visibility = previousVisibility[index];
      });
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!visible) return null;

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#000',
        zIndex: 99999,
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
        zIndex: 2001,
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        maxWidth: '90vw',
        overflow: 'hidden'
      }}>
        <span>缩放: {Math.round(scale * 100)}%</span>
        {!isMobile && (
          <>
            <span>|</span>
            <span style={{ whiteSpace: 'nowrap' }}>
              滚轮缩放 • 拖拽移动 • 双击重置 • ESC关闭
            </span>
          </>
        )}
        {isMobile && (
          <span style={{ whiteSpace: 'nowrap' }}>
            拖拽移动 • 双击重置
          </span>
        )}
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
          zIndex: 2001,
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
        zIndex: 2001
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
      {imgError ? (
        <div style={{ textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🖼️</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>图片加载失败</div>
          <div style={{ fontSize: 12, color: '#555', maxWidth: 400, wordBreak: 'break-all' }}>
            {src || '无图片URL'}
          </div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
            可能是图片链接已过期或不可访问
          </div>
        </div>
      ) : (
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
          onError={() => setImgError(true)}
        />
      )}
    </div>,
    document.body
  );
};
