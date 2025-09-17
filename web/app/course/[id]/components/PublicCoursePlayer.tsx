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
import PublicThreeDViewer from './PublicThreeDViewer';

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
  const viewerControlsRef = useRef<any>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    currentSegmentIndex: 0,
    currentItemIndex: 0,
    progress: 0
  });
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [currentImage, setCurrentImage] = useState<any>(null);
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

  const startPlayback = async () => {
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
        
        // 使用代理来解决CORS问题
        let audioUrl = item.audioUrl;
        if (audioUrl.startsWith('https://dl.yf-xr.com/')) {
          audioUrl = `/api/files/proxy?url=${encodeURIComponent(audioUrl)}`;
        }
        
        audio.src = audioUrl;
        playbackState.currentAudio = audio;
        
        audio.onended = () => {
          setCurrentSubtitle('');
          // 停止模型自转
          if (viewerControlsRef.current?.stopAutoRotation) {
            viewerControlsRef.current.stopAutoRotation();
          }
          resolve(audio.duration || item.audioDuration || 3);
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
        
        audio.play().catch((error) => {
          console.error('音频播放启动失败:', error);
          // 回退到估算时长
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
    setCurrentSubtitle(item.say || '');
    
    // 显示图片
    if (item.imageUrl) {
      setCurrentImage({
        url: item.imageUrl,
        title: item.imageTitle || ''
      });
    }
    
    // 开始模型自转
    if (viewerControlsRef.current?.startAutoRotation) {
      viewerControlsRef.current.startAutoRotation();
    }
    
    // 模拟播放
    return new Promise((resolve) => {
      const estimatedDuration = Math.max(3, (item.say?.length || 0) * 0.15);
      setTimeout(() => {
        setCurrentSubtitle('');
        setCurrentImage(null);
        resolve(estimatedDuration);
      }, estimatedDuration * 1000);
    });
  };

  const executeSceneActionItem = async (item: any): Promise<number> => {
    setCurrentSubtitle(item.say || '');
    
    // 停止自转
    if (viewerControlsRef.current?.stopAutoRotation) {
      viewerControlsRef.current.stopAutoRotation();
    }
    
    // 执行3D动作
    if (item.actions && viewerControlsRef.current) {
      executeActionsWithControls(item.actions, viewerControlsRef.current);
    }
    
    return new Promise((resolve) => {
      const estimatedDuration = Math.max(3, (item.say?.length || 0) * 0.15);
      setTimeout(() => {
        setCurrentSubtitle('');
        resolve(estimatedDuration);
      }, estimatedDuration * 1000);
    });
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
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* 3D查看器 */}
      <div style={{ width: '100%', height: '100%' }}>
        <PublicThreeDViewer
          coursewareData={courseData?.coursewareData}
          onControlsReady={(controls) => {
            viewerControlsRef.current = controls;
          }}
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
          zIndex: 100
        }}>
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
              fontSize: '12px'
            }}>
              {currentImage.title}
            </div>
          )}
        </div>
      )}

      {/* 字幕 */}
      {currentSubtitle && (
        <div style={{
          position: 'absolute',
          bottom: isFullscreen ? '80px' : '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '20px',
          fontSize: '14px',
          maxWidth: '90%',
          textAlign: 'center',
          zIndex: 200
        }}>
          {currentSubtitle}
        </div>
      )}

      {/* 播放控制栏 */}
      <div style={{
        position: 'absolute',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '25px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 300
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
    </div>
  );
}
