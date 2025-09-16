"use client";
import { useEffect, useRef, useState } from 'react';
import { Button, Progress, Space, message, Modal, Card, Switch, Radio } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, StepBackwardOutlined, StepForwardOutlined, SoundOutlined } from '@ant-design/icons';
import { authFetch } from '@/app/_lib/api';
import ThreeDViewer from './ThreeDViewer';

interface CoursePreviewPlayerProps {
  courseData: any;
  visible: boolean;
  onClose: () => void;
}

interface PlaybackState {
  isPlaying: boolean;
  currentSegmentIndex: number;
  currentItemIndex: number;
  progress: number;
  currentAudio?: HTMLAudioElement;
}

export default function CoursePreviewPlayer({ courseData, visible, onClose }: CoursePreviewPlayerProps) {
  const threeDViewerRef = useRef<HTMLDivElement>(null);
  const viewerControlsRef = useRef<any>(null);

  // 【新增】添加CSS动画样式
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideInFromRight {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes slideOutToRight {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentSegmentIndex: 0,
    currentItemIndex: 0,
    progress: 0
  });
  const [coursewareData, setCoursewareData] = useState<any>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [currentImage, setCurrentImage] = useState<any>(null);
  const [isPreparingPreview, setIsPreparingPreview] = useState<boolean>(false);
  const [preparationProgress, setPreparationProgress] = useState<string>('');
  const [preloadedAudios, setPreloadedAudios] = useState<Map<string, { audio: HTMLAudioElement, duration: number }>>(new Map());
  const playbackTimerRef = useRef<NodeJS.Timeout>();
  const [autoPlay, setAutoPlay] = useState<boolean>(true); // 自动/手动模式

  // 加载课件数据
  useEffect(() => {
    if (visible && courseData?.coursewareId) {
      loadCourseware();
    }
  }, [visible, courseData?.coursewareId]);

  // 播放状态变化处理
  useEffect(() => {
    if (playbackState.isPlaying) {
      startPlayback().catch(error => {
        console.error('播放启动失败:', error);
      });
    } else {
      stopPlayback();
    }
    return () => stopPlayback();
  }, [playbackState.isPlaying]);

  // 【修复】监听播放状态和步骤改变，自动播放内容
  useEffect(() => {
    if (playbackState.isPlaying && courseData?.outline) {
      const currentItem = getCurrentItem();
      if (currentItem) {
        console.log('播放状态变化或步骤改变，执行内容:', currentItem);
        
        // 清除之前的定时器
        if (playbackTimerRef.current) {
          clearTimeout(playbackTimerRef.current);
        }
        
        executeCurrentItem(currentItem).then(duration => {
          // 自动模式：语音播放结束后立即切换
          if (autoPlay && playbackState.isPlaying) {
            console.log('语音播放完成，立即切换到下一步');
            // 不再设置额外延迟，语音结束即切换
            playbackTimerRef.current = setTimeout(() => {
              if (playbackState.isPlaying) {
                nextItem();
              }
            }, 100); // 只有很小的延迟确保状态更新
          }
        }).catch(error => {
          console.error('执行步骤失败:', error);
        });
      }
    }
  }, [playbackState.isPlaying, playbackState.currentSegmentIndex, playbackState.currentItemIndex]);

  const loadCourseware = async () => {
    try {
      const data = await authFetch<any>(`/api/coursewares/${courseData.coursewareId}`);
      setCoursewareData(data);
      message.success('课件数据加载成功');
    } catch (error) {
      console.error('加载课件失败:', error);
      message.error('课件数据加载失败');
    }
  };

  const getCurrentItem = () => {
    const segments = courseData?.outline || [];
    const segment = segments[playbackState.currentSegmentIndex];
    if (!segment) return null;
    return segment.items?.[playbackState.currentItemIndex] || null;
  };

  const getTotalItems = () => {
    return courseData?.outline?.reduce((total: number, segment: any) => total + (segment.items?.length || 0), 0) || 0;
  };

  const getCurrentPosition = () => {
    let position = 0;
    const segments = courseData?.outline || [];
    for (let i = 0; i < playbackState.currentSegmentIndex; i++) {
      position += segments[i]?.items?.length || 0;
    }
    return position + playbackState.currentItemIndex;
  };

  const startPlayback = async () => {
    // 【优化】静默预加载，避免多次提示
    if (preloadedAudios.size === 0) {
      console.log('开始预加载语音...');
      await preloadAllTTS();
      if (preloadedAudios.size > 0) {
        console.log(`预加载完成：${preloadedAudios.size} 个语音片段`);
      } else {
        console.log('预加载失败，将使用实时语音生成');
      }
    }
    console.log('播放准备完成，即将开始播放');
  };

  const stopPlayback = () => {
    if (playbackTimerRef.current) {
      clearTimeout(playbackTimerRef.current);
    }
    if (playbackState.currentAudio) {
      playbackState.currentAudio.pause();
      playbackState.currentAudio.currentTime = 0;
    }
  };

  const executeCurrentItem = async (item: any): Promise<number> => {
    try {
      // 生成当前项目的key，用于查找预加载音频
      const itemKey = `${playbackState.currentSegmentIndex}-${playbackState.currentItemIndex}`;
      
      switch (item.type) {
        case 'talk':
          return await executeTalkItem(item, itemKey);
        case 'image.explain':
          return await executeImageExplainItem(item, itemKey);
        case 'scene.action':
          return await executeSceneActionItem(item, itemKey);
        default:
          console.warn('未知的项目类型:', item.type);
          return 3; // 默认时长
      }
    } catch (error) {
      console.error('执行项目失败:', error);
      return 3; // 出错时返回默认时长
    }
  };

  const executeTalkItem = async (item: any, itemKey: string): Promise<number> => {
    console.log('执行 talk 项目:', item.say);
    setCurrentImage(null); // 清除图片
    
    // 【新增】纯讲解时启动模型自转
    const viewerControls = viewerControlsRef.current;
    if (viewerControls && viewerControls.startAutoRotation) {
      viewerControls.startAutoRotation(0.003); // 较慢的自转速度
    }
    
    // 尝试播放TTS并返回播放时长，使用预加载音频
    if (item.say && item.tts) {
      return await playTTS(item.say, item.tts, itemKey);
    } else if (item.say) {
      // 没有TTS配置，使用全局配置
      const ttsConfig = courseData?.ttsConfig || {};
      return await playTTS(item.say, ttsConfig, itemKey);
    }
    return 3; // 默认时长
  };

  const executeImageExplainItem = async (item: any, itemKey: string): Promise<number> => {
    console.log('执行 image.explain 项目:', item.say);
    
    // 【新增】图片讲解时启动模型自转
    const viewerControls = viewerControlsRef.current;
    if (viewerControls && viewerControls.startAutoRotation) {
      viewerControls.startAutoRotation(0.003); // 较慢的自转速度
    }
    
    // 显示图片
    if (item.imageKeywords) {
      await searchAndShowImage(item.imageKeywords);
    }
    
    // 播放语音并返回播放时长，使用预加载音频
    if (item.say && item.tts) {
      return await playTTS(item.say, item.tts, itemKey);
    } else if (item.say) {
      // 没有TTS配置，使用全局配置
      const ttsConfig = courseData?.ttsConfig || {};
      return await playTTS(item.say, ttsConfig, itemKey);
    }
    return 3; // 默认时长
  };

  const executeSceneActionItem = async (item: any, itemKey: string): Promise<number> => {
    console.log('执行 scene.action 项目:', item.actions);
    setCurrentImage(null); // 清除图片
    
    // 执行三维动作
    if (item.actions && Array.isArray(item.actions)) {
      executeSceneActions(item.actions);
    }
    
    // 播放语音并返回播放时长，使用预加载音频
    if (item.say && item.tts) {
      return await playTTS(item.say, item.tts, itemKey);
    } else if (item.say) {
      // 没有TTS配置，使用全局配置
      const ttsConfig = courseData?.ttsConfig || {};
      return await playTTS(item.say, ttsConfig, itemKey);
    }
    return 3; // 默认时长
  };

  const searchAndShowImage = async (keywords: string) => {
    try {
      const response = await authFetch<any>('/api/ai/search-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords })
      });
      
      if (response.images && response.images.length > 0) {
        console.log(`搜索到 ${response.images.length} 张图片`);
        
        // 【简化】直接使用第一张图片
        if (response.images[0]) {
          setCurrentImage({
            src: response.images[0].url,
            title: response.images[0].title || keywords,
            keywords
          });
        } else {
          setCurrentImage(null);
        }
      }
    } catch (error) {
      console.error('搜索图片失败:', error);
    }
  };

  // 【新增】预加载所有TTS音频
  const preloadAllTTS = async () => {
    if (!courseData?.outline) return;
    
    setIsPreparingPreview(true);
    setPreparationProgress('正在分析课程内容...');
    
    // 收集所有需要TTS的文本
    const ttsItems: Array<{ key: string, text: string, ttsConfig: any }> = [];
    const globalTtsConfig = courseData?.ttsConfig || {};
    
    courseData.outline.forEach((segment: any, segmentIndex: number) => {
      segment.items?.forEach((item: any, itemIndex: number) => {
        if (item.say) {
          const key = `${segmentIndex}-${itemIndex}`;
          const itemTtsConfig = item.tts || globalTtsConfig;
          ttsItems.push({ key, text: item.say, ttsConfig: itemTtsConfig });
        }
      });
    });
    
    console.log('需要预加载的TTS项目:', ttsItems.length, '个');
    
    if (ttsItems.length === 0) {
      setIsPreparingPreview(false);
      return;
    }
    
    const newPreloadedAudios = new Map();
    
    // 并发预加载音频（限制并发数量避免过载）
    const concurrencyLimit = 3;
    for (let i = 0; i < ttsItems.length; i += concurrencyLimit) {
      const batch = ttsItems.slice(i, i + concurrencyLimit);
      setPreparationProgress(`正在生成语音 ${i + 1}-${Math.min(i + concurrencyLimit, ttsItems.length)} / ${ttsItems.length}...`);
      
      const promises = batch.map(async (item) => {
        try {
          const audioData = await preloadSingleTTS(item.text, item.ttsConfig);
          if (audioData) {
            newPreloadedAudios.set(item.key, audioData);
            console.log(`TTS预加载完成: ${item.key}`);
          }
        } catch (error) {
          console.error(`TTS预加载失败: ${item.key}`, error);
        }
      });
      
      await Promise.all(promises);
    }
    
    setPreloadedAudios(newPreloadedAudios);
    setPreparationProgress('语音生成完成，准备开始预览...');
    
    setTimeout(() => {
      setIsPreparingPreview(false);
      message.success(`已预加载 ${newPreloadedAudios.size} 个语音片段，开始预览！`);
    }, 500);
  };
  
  // 【新增】预加载单个TTS音频
  const preloadSingleTTS = async (text: string, ttsConfig: any): Promise<{ audio: HTMLAudioElement, duration: number } | null> => {
    if (!text) return null;
    
    return new Promise((resolve) => {
      const provider = ttsConfig?.provider || 'azure';
      
      if (provider === 'azure') {
        authFetch<any>('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'azure',
            text: text.slice(0, 500),
            voiceName: ttsConfig.voiceName || 'zh-CN-XiaoxiaoNeural',
            rate: ttsConfig.rate || '+0%',
            pitch: ttsConfig.pitch || '+0Hz',
            style: ttsConfig.style || 'general'
          })
        }).then(response => {
          if (response.audioUrl) {
            const audio = new Audio(response.audioUrl);
            audio.addEventListener('loadedmetadata', () => {
              resolve({ audio, duration: audio.duration || 3 });
            });
            audio.addEventListener('error', () => {
              resolve(null);
            });
            // 预加载音频
            audio.load();
          } else {
            resolve(null);
          }
        }).catch(() => {
          resolve(null);
        });
      } else if (provider === 'minimax') {
        authFetch<any>('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'minimax',
            text: text,
            voice_id: ttsConfig.voice_id || 'presenter_female',
            speed: ttsConfig.speed || 1,
            vol: ttsConfig.vol || 1,
            pitch: ttsConfig.pitch || 0
          })
        }).then(response => {
          if (response.audioUrl) {
            const audio = new Audio(response.audioUrl);
            audio.addEventListener('loadedmetadata', () => {
              resolve({ audio, duration: audio.duration || 3 });
            });
            audio.addEventListener('error', () => {
              resolve(null);
            });
            audio.load();
          } else {
            resolve(null);
          }
        }).catch(() => {
          resolve(null);
        });
      } else {
        resolve(null);
      }
    });
  };

  const playTTS = async (text: string, ttsConfig: any, itemKey?: string): Promise<number> => {
    if (!text) return 0;

    return new Promise((resolve) => {
      setCurrentSubtitle(text);
      
      // 停止之前的音频
      if (playbackState.currentAudio) {
        playbackState.currentAudio.pause();
        playbackState.currentAudio.currentTime = 0;
      }

      // 【优化】优先使用预加载的音频
      if (itemKey && preloadedAudios.has(itemKey)) {
        const preloadedAudio = preloadedAudios.get(itemKey)!;
        const audio = preloadedAudio.audio.cloneNode() as HTMLAudioElement;
        
        setPlaybackState(prev => ({ ...prev, currentAudio: audio }));
        
        audio.addEventListener('ended', () => {
          setCurrentSubtitle('');
          resolve(preloadedAudio.duration);
        });
        
        audio.addEventListener('error', () => {
          console.error('预加载音频播放错误');
          setCurrentSubtitle('');
          resolve(3);
        });
        
        audio.play().catch(error => {
          console.error('预加载音频播放失败:', error);
          setCurrentSubtitle('');
          resolve(3);
        });
        
        return; // 使用预加载音频，直接返回
      }

      const provider = ttsConfig?.provider || 'azure';

      if (provider === 'azure') {
        // Azure TTS - 同步
        authFetch<any>('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'azure',
            text: text.slice(0, 500), // 增加文本长度限制
            voiceName: ttsConfig.voiceName || 'zh-CN-XiaoxiaoNeural',
            rate: ttsConfig.rate || '+0%',
            pitch: ttsConfig.pitch || '+0Hz',
            style: ttsConfig.style || 'general'
          })
        }).then(response => {
          if (response.audioUrl) {
            const audio = new Audio(response.audioUrl);
            setPlaybackState(prev => ({ ...prev, currentAudio: audio }));
            
            // 监听音频加载完成和播放结束
            audio.addEventListener('loadedmetadata', () => {
              console.log('音频时长:', audio.duration, '秒');
            });
            
            audio.addEventListener('ended', () => {
              setCurrentSubtitle('');
              resolve(audio.duration || 3); // 返回实际播放时长
            });
            
            audio.addEventListener('error', () => {
              console.error('音频播放错误');
              setCurrentSubtitle('');
              resolve(3); // 出错时返回默认时长
            });
            
            audio.play().catch(error => {
              console.error('音频播放失败:', error);
              setCurrentSubtitle('');
              resolve(3);
            });
          } else {
            setCurrentSubtitle('');
            resolve(3);
          }
        }).catch(error => {
          console.error('TTS API调用失败:', error);
          setCurrentSubtitle('');
          resolve(3);
        });
      } else if (provider === 'minimax') {
        // Minimax TTS - 异步
        authFetch<any>('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'minimax',
            text: text,
            voice_id: ttsConfig.voice_id || 'presenter_female',
            speed: ttsConfig.speed || 1,
            vol: ttsConfig.vol || 1,
            pitch: ttsConfig.pitch || 0
          })
        }).then(response => {
          if (response.audioUrl) {
            const audio = new Audio(response.audioUrl);
            setPlaybackState(prev => ({ ...prev, currentAudio: audio }));
            
            audio.addEventListener('ended', () => {
              setCurrentSubtitle('');
              resolve(audio.duration || 3);
            });
            
            audio.addEventListener('error', () => {
              console.error('音频播放错误');
              setCurrentSubtitle('');
              resolve(3);
            });
            
            audio.play().catch(error => {
              console.error('音频播放失败:', error);
              setCurrentSubtitle('');
              resolve(3);
            });
          } else {
            setCurrentSubtitle('');
            resolve(3);
          }
        }).catch(error => {
          console.error('TTS API调用失败:', error);
          setCurrentSubtitle('');
          resolve(3);
        });
      } else {
        // 默认：无音频，返回基于文字长度的估算时长
        const estimatedDuration = Math.max(2, text.length * 0.1); // 每个字符0.1秒，最少2秒
        setTimeout(() => {
          setCurrentSubtitle('');
          resolve(estimatedDuration);
        }, estimatedDuration * 1000);
      }
    });
  };

  const executeSceneActions = (actions: any[]) => {
    console.log('执行三维动作:', actions);

    // 获取三维查看器的控制方法
    const viewerControls = viewerControlsRef.current || (threeDViewerRef.current as any)?._viewerControls;
    
    if (!viewerControls) {
      console.error('无法获取三维查看器控制接口，可能模型未加载完成');
      // 延迟重试，尝试多种方式获取控制接口
      setTimeout(() => {
        const retryControls = viewerControlsRef.current || (threeDViewerRef.current as any)?._viewerControls;
        if (retryControls) {
          console.log('重试成功，执行三维动作');
          executeActionsWithControls(actions, retryControls);
        } else {
          console.error('重试失败，无法执行三维动作');
          console.log('尝试查找控制接口:');
          console.log('viewerControlsRef.current:', viewerControlsRef.current);
          console.log('threeDViewerRef.current:', threeDViewerRef.current);
          console.log('_viewerControls:', (threeDViewerRef.current as any)?._viewerControls);
        }
      }, 2000); // 增加延迟时间到2秒
      return;
    }
    
    console.log('获得三维查看器控制接口:', Object.keys(viewerControls));
    executeActionsWithControls(actions, viewerControls);
  };

  const executeActionsWithControls = (actions: any[], viewerControls: any) => {
    
    actions.forEach((action, index) => {
      setTimeout(() => {
        switch (action.type) {
          case 'camera.focus':
            console.log(`[${index + 1}] 镜头对焦到:`, action.target?.nodeKey);
            if (action.target?.nodeKey) {
              viewerControls.focusOnNode(action.target.nodeKey);
            }
            break;
          case 'annotation.show':
            console.log(`[${index + 1}] 显示标注:`, action.ids);
            if (action.ids) {
              viewerControls.showAnnotations(action.ids);
            }
            break;
          case 'annotation.hide':
            console.log(`[${index + 1}] 隐藏标注:`, action.ids);
            if (action.ids) {
              viewerControls.hideAnnotations(action.ids);
            }
            break;
          case 'animation.play':
            console.log(`[${index + 1}] 播放动画:`, action.animationId);
            if (action.animationId) {
              viewerControls.playAnimation(action.animationId, action.startTime, action.endTime);
            }
            break;
          case 'visibility.set':
            console.log(`[${index + 1}] 设置显隐:`, action.items);
            if (action.items) {
              action.items.forEach((item: any) => {
                viewerControls.setNodeVisibility(item.nodeKey, item.visible);
              });
            }
            break;
          case 'highlight.show':
            console.log(`[${index + 1}] 显示高亮:`, action.target?.nodeKey);
            if (action.target?.nodeKey) {
              viewerControls.highlightNode(action.target.nodeKey, true);
            }
            break;
          case 'highlight.hide':
            console.log(`[${index + 1}] 隐藏高亮:`, action.target?.nodeKey);
            if (action.target?.nodeKey) {
              viewerControls.highlightNode(action.target.nodeKey, false);
            }
            break;
          default:
            console.log(`[${index + 1}] 未知动作:`, action.type);
        }
      }, index * 300); // 动作间隔300ms
    });
  };

  const nextItem = () => {
    const segments = courseData?.outline || [];
    const currentSegment = segments[playbackState.currentSegmentIndex];
    
    if (!currentSegment) return;
    
    // 【修复】步骤切换前重置所有状态（高亮、标注、动画）
    const viewerControls = viewerControlsRef.current;
    if (viewerControls && viewerControls.resetAllStates) {
      viewerControls.resetAllStates();
    }
    
    if (playbackState.currentItemIndex < (currentSegment.items?.length || 0) - 1) {
      // 下一个项目
      setPlaybackState(prev => ({
        ...prev,
        currentItemIndex: prev.currentItemIndex + 1
      }));
      
      // 【修复】步骤改变将由useEffect处理播放
      
    } else if (playbackState.currentSegmentIndex < segments.length - 1) {
      // 下一个段落
      const nextSegment = segments[playbackState.currentSegmentIndex + 1];
      setPlaybackState(prev => ({
        ...prev,
        currentSegmentIndex: prev.currentSegmentIndex + 1,
        currentItemIndex: 0
      }));
      
      // 【修复】步骤改变将由useEffect处理播放
      
    } else {
      // 播放结束
      setPlaybackState(prev => ({ ...prev, isPlaying: false }));
      message.success('课程播放完成');
    }
  };

  const prevItem = () => {
    // 【修复】步骤切换前重置所有状态（高亮、标注、动画）
    const viewerControls = viewerControlsRef.current;
    if (viewerControls && viewerControls.resetAllStates) {
      viewerControls.resetAllStates();
    }
    
    if (playbackState.currentItemIndex > 0) {
      // 上一个项目
      const segments = courseData?.outline || [];
      const currentSegment = segments[playbackState.currentSegmentIndex];
      
      setPlaybackState(prev => ({
        ...prev,
        currentItemIndex: prev.currentItemIndex - 1
      }));
      
      // 【修复】步骤改变将由useEffect处理播放
      
    } else if (playbackState.currentSegmentIndex > 0) {
      // 上一个段落的最后一项
      const prevSegment = courseData?.outline?.[playbackState.currentSegmentIndex - 1];
      const targetItemIndex = (prevSegment?.items?.length || 1) - 1;
      
      setPlaybackState(prev => ({
        ...prev,
        currentSegmentIndex: prev.currentSegmentIndex - 1,
        currentItemIndex: targetItemIndex
      }));
      
      // 【修复】步骤改变将由useEffect处理播放
    }
  };

  const togglePlayback = () => {
    setPlaybackState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  };

  const resetPlayback = () => {
    setPlaybackState({
      isPlaying: false,
      currentSegmentIndex: 0,
      currentItemIndex: 0,
      progress: 0
    });
    setCurrentSubtitle('');
    setCurrentImage(null);
  };

  // 调试：测试相机对焦功能
  const testCameraFocus = () => {
    console.log('测试相机对焦功能...');
    const viewerControls = viewerControlsRef.current || (threeDViewerRef.current as any)?._viewerControls;
    
    if (!viewerControls) {
      console.error('无法获取控制接口进行测试');
      return;
    }

    console.log('可用控制方法:', Object.keys(viewerControls));
    
    // 获取节点映射
    const nodeMap = viewerControls.getNodeMap();
    const availableNodes = Array.from(nodeMap.keys()).slice(0, 5);
    console.log('可用节点 (前5个):', availableNodes);
    
    // 测试对焦到第一个可用节点
    if (availableNodes.length > 0) {
      const testNode = availableNodes[0];
      console.log('测试对焦到节点:', testNode);
      viewerControls.focusOnNode(testNode);
    }
  };

  // 调试模型位置
  const debugModel = () => {
    const viewerControls = viewerControlsRef.current || (threeDViewerRef.current as any)?._viewerControls;
    
    if (!viewerControls || !viewerControls.debugModelPosition) {
      console.error('无法获取调试功能');
      return;
    }

    viewerControls.debugModelPosition();
  };

  const currentItem = getCurrentItem();
  const currentPosition = getCurrentPosition();
  const totalItems = getTotalItems();
  const progressPercent = totalItems > 0 ? Math.round((currentPosition / totalItems) * 100) : 0;

  return (
    <Modal
      title="课程预览播放"
      open={visible}
      onCancel={onClose}
      width={1200}
      height={800}
      footer={null}
      destroyOnClose
    >
      <div style={{ height: 700, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* 准备状态显示 */}
        {isPreparingPreview && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            color: 'white',
            borderRadius: 8
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, marginBottom: 16 }}>🎬 正在准备预览</div>
              <div style={{ fontSize: 14, marginBottom: 20 }}>{preparationProgress}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>正在生成所有语音片段，请耐心等待...</div>
            </div>
          </div>
        )}
        
        {/* 播放器主体 */}
        <div style={{ flex: 1, display: 'flex', gap: 16 }}>
          {/* 左侧：三维视窗 */}
          <div style={{ flex: 2, position: 'relative' }}>
            <div ref={threeDViewerRef}>
              <ThreeDViewer 
                coursewareData={coursewareData}
                width={800}
                height={500}
                onModelLoaded={(model) => {
                  console.log('三维模型加载完成:', model);
                }}
                onControlsReady={(controls) => {
                  console.log('接收到三维控制接口:', Object.keys(controls));
                  viewerControlsRef.current = controls;
                }}
              />
            </div>

            {/* 状态叠加 */}
            {currentItem && (
              <div style={{
                position: 'absolute',
                top: 16,
                left: 16,
                background: 'rgba(0,0,0,0.7)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: 6,
                fontSize: 12
              }}>
                <div style={{ fontWeight: 'bold' }}>
                  {currentItem.type} - 段落 {playbackState.currentSegmentIndex + 1} / 项目 {playbackState.currentItemIndex + 1}
                </div>
              </div>
            )}

            {/* 字幕叠加 */}
            {currentSubtitle && (
              <div style={{
                position: 'absolute',
                bottom: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: 6,
                maxWidth: '80%',
                textAlign: 'center',
                fontSize: 14,
                lineHeight: 1.5
              }}>
                <SoundOutlined style={{ marginRight: 8 }} />
                {currentSubtitle}
              </div>
            )}

            {/* 【新增】配图叠加 - 展开缩回效果 */}
            {currentImage && (
              <div style={{
                position: 'absolute',
                top: 16,
                right: 16,
                width: '300px',
                height: '200px',
                background: 'rgba(0,0,0,0.9)',
                borderRadius: 8,
                overflow: 'hidden',
                border: '2px solid #1890ff',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                animation: 'slideInFromRight 0.3s ease-out',
                zIndex: 100
              }}>
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%'
                }}>
                  <img 
                    src={currentImage.src}
                    alt={currentImage.title}
                    style={{
                      width: '100%',
                      height: '80%',
                      objectFit: 'cover'
                    }}
                    onError={(e) => {
                      console.error('图片加载失败:', currentImage.src);
                      setCurrentImage(null);
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.8)',
                    color: 'white',
                    padding: '4px 8px',
                    fontSize: 12,
                    height: '20%',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {currentImage.title || '配图说明'}
                  </div>
                  <button 
                    onClick={() => setCurrentImage(null)}
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: 'rgba(0,0,0,0.6)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '50%',
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 右侧：图片和信息 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* 图片显示区域 */}
            {currentImage ? (
              <Card title="配图说明" size="small" style={{ flex: 1 }}>
                <img 
                  src={currentImage.src}
                  alt={currentImage.title}
                  style={{ width: '100%', borderRadius: 4, marginBottom: 12 }}
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjE1MCIgeT0iMTAwIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTYiIGZpbGw9IiM5OTkiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj7lm77niYfnvZHmtIE8L3RleHQ+PC9zdmc+';
                  }}
                />
                <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
                  {currentImage.title}
                </div>
                <div style={{ fontSize: 12, color: '#666' }}>
                  关键词: {currentImage.keywords}
                </div>
              </Card>
            ) : (
              <div style={{ 
                flex: 1, 
                border: '2px dashed #d9d9d9', 
                borderRadius: 6, 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#999',
                fontSize: 14
              }}>
                等待图片内容...
              </div>
            )}

            {/* 当前段落信息 */}
            <Card title="当前段落" size="small">
              {courseData?.outline?.[playbackState.currentSegmentIndex] && (
                <div>
                  <div style={{ fontWeight: 'bold', marginBottom: 8 }}>
                    {courseData.outline[playbackState.currentSegmentIndex].title}
                  </div>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                    模式: {courseData.outline[playbackState.currentSegmentIndex].mode === 'sequence' ? '顺序播放' : '并行播放'}
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    项目进度: {playbackState.currentItemIndex + 1} / {courseData.outline[playbackState.currentSegmentIndex].items?.length || 0}
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* 底部控制栏 */}
        <div style={{ 
          marginTop: 16, 
          padding: 16, 
          background: '#0f0f10', 
          borderRadius: 6,
          borderTop: '1px solid #2b2b2b'
        }}>
          {/* 进度条 */}
          <div style={{ marginBottom: 12 }}>
            <Progress 
              percent={progressPercent} 
              showInfo={false}
              strokeColor="#1890ff"
            />
            <div style={{ fontSize: 12, color: '#666', textAlign: 'center', marginTop: 4 }}>
              {currentPosition + 1} / {totalItems} 项目 ({progressPercent}%)
            </div>
          </div>

          {/* 控制按钮 */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
            <Radio.Group
              value={autoPlay ? 'auto' : 'manual'}
              onChange={(e) => setAutoPlay(e.target.value === 'auto')}
              optionType="button"
              buttonStyle="solid"
            >
              <Radio.Button value="auto">自动播放</Radio.Button>
              <Radio.Button value="manual">手动播放</Radio.Button>
            </Radio.Group>

            <Button 
              icon={<StepBackwardOutlined />} 
              onClick={prevItem}
              disabled={playbackState.currentSegmentIndex === 0 && playbackState.currentItemIndex === 0}
            >
              上一步
            </Button>
            
            <Button 
              type="primary"
              size="large"
              icon={playbackState.isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              onClick={togglePlayback}
            >
              {playbackState.isPlaying ? '暂停' : '播放'}
            </Button>
            
            <Button 
              icon={<StepForwardOutlined />} 
              onClick={nextItem}
              disabled={playbackState.currentSegmentIndex >= (courseData?.outline?.length || 0) - 1 && 
                       playbackState.currentItemIndex >= ((courseData?.outline?.[playbackState.currentSegmentIndex]?.items?.length || 0) - 1)}
            >
              下一步
            </Button>

            <Button onClick={resetPlayback}>
              重置
            </Button>

            <Button onClick={testCameraFocus} type="dashed">
              测试对焦
            </Button>

            <Button onClick={debugModel} type="dashed">
              调试模型
            </Button>
          </div>

          {/* 当前项目信息 */}
          {currentItem && (
            <div style={{ 
              marginTop: 12, 
              padding: 8, 
              background: '#1a1b1e', 
              borderRadius: 4,
              fontSize: 12,
              color: '#9aa0a6'
            }}>
              <strong>当前播放:</strong> {currentItem.type} - {currentItem.say?.slice(0, 100)}...
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
