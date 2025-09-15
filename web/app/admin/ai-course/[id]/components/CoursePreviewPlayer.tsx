"use client";
import { useEffect, useRef, useState } from 'react';
import { Button, Progress, Space, message, Modal, Card } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, StepBackwardOutlined, StepForwardOutlined, SoundOutlined } from '@ant-design/icons';
import { authFetch } from '@/app/_lib/api';

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    isPlaying: false,
    currentSegmentIndex: 0,
    currentItemIndex: 0,
    progress: 0
  });
  const [coursewareData, setCoursewareData] = useState<any>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [currentImage, setCurrentImage] = useState<any>(null);
  const playbackTimerRef = useRef<NodeJS.Timeout>();

  // 加载课件数据
  useEffect(() => {
    if (visible && courseData?.coursewareId) {
      loadCourseware();
    }
  }, [visible, courseData?.coursewareId]);

  // 播放状态变化处理
  useEffect(() => {
    if (playbackState.isPlaying) {
      startPlayback();
    } else {
      stopPlayback();
    }
    return () => stopPlayback();
  }, [playbackState.isPlaying]);

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

  const startPlayback = () => {
    const currentItem = getCurrentItem();
    if (!currentItem) return;

    console.log('播放项目:', currentItem);
    setCurrentSubtitle(currentItem.say || '');

    // 执行当前项目
    executeCurrentItem(currentItem);

    // 设置播放定时器
    const duration = (currentItem.estimatedDuration || 5) * 1000;
    playbackTimerRef.current = setTimeout(() => {
      nextItem();
    }, duration);
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

  const executeCurrentItem = async (item: any) => {
    try {
      switch (item.type) {
        case 'talk':
          await executeTalkItem(item);
          break;
        case 'image.explain':
          await executeImageExplainItem(item);
          break;
        case 'scene.action':
          await executeSceneActionItem(item);
          break;
        default:
          console.warn('未知的项目类型:', item.type);
      }
    } catch (error) {
      console.error('执行项目失败:', error);
    }
  };

  const executeTalkItem = async (item: any) => {
    console.log('执行 talk 项目:', item.say);
    setCurrentImage(null); // 清除图片
    
    // 尝试播放TTS
    if (item.say && item.tts) {
      await playTTS(item.say, item.tts);
    }
  };

  const executeImageExplainItem = async (item: any) => {
    console.log('执行 image.explain 项目:', item.say);
    
    // 显示图片
    if (item.imageKeywords) {
      await searchAndShowImage(item.imageKeywords);
    }
    
    // 播放语音
    if (item.say && item.tts) {
      await playTTS(item.say, item.tts);
    }
  };

  const executeSceneActionItem = async (item: any) => {
    console.log('执行 scene.action 项目:', item.actions);
    setCurrentImage(null); // 清除图片
    
    // 执行三维动作
    if (item.actions && Array.isArray(item.actions)) {
      executeSceneActions(item.actions);
    }
    
    // 播放语音
    if (item.say && item.tts) {
      await playTTS(item.say, item.tts);
    }
  };

  const searchAndShowImage = async (keywords: string) => {
    try {
      const response = await authFetch<any>('/api/ai/search-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords })
      });
      
      if (response.images && response.images.length > 0) {
        // 显示第一张图片
        const firstImage = response.images[0];
        setCurrentImage({
          src: firstImage.url,
          title: firstImage.title || keywords,
          keywords
        });
      }
    } catch (error) {
      console.error('搜索图片失败:', error);
    }
  };

  const playTTS = async (text: string, ttsConfig: any) => {
    try {
      const provider = ttsConfig?.provider || 'azure';
      
      if (provider === 'azure') {
        // Azure TTS - 同步
        const response = await authFetch<any>('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: 'azure',
            text: text.slice(0, 200), // 限制长度
            voiceName: ttsConfig.voiceName || 'zh-CN-XiaoxiaoNeural',
            rate: ttsConfig.rate || '+0%',
            pitch: ttsConfig.pitch || '+0Hz',
            style: ttsConfig.style || 'general'
          })
        });
        
        if (response.audioUrl) {
          const audio = new Audio(response.audioUrl);
          setPlaybackState(prev => ({ ...prev, currentAudio: audio }));
          await audio.play();
        }
      } else {
        // Minimax TTS - 异步（暂时跳过，避免等待时间过长）
        console.log('Minimax TTS暂时跳过，避免播放中断');
      }
    } catch (error) {
      console.error('TTS播放失败:', error);
    }
  };

  const executeSceneActions = (actions: any[]) => {
    console.log('执行三维动作:', actions);
    
    actions.forEach((action, index) => {
      setTimeout(() => {
        switch (action.type) {
          case 'camera.focus':
            console.log(`[${index + 1}] 镜头对焦到:`, action.target?.nodeKey);
            break;
          case 'annotation.show':
            console.log(`[${index + 1}] 显示标注:`, action.ids);
            break;
          case 'annotation.hide':
            console.log(`[${index + 1}] 隐藏标注:`, action.ids);
            break;
          case 'animation.play':
            console.log(`[${index + 1}] 播放动画:`, action.animationId);
            break;
          case 'visibility.set':
            console.log(`[${index + 1}] 设置显隐:`, action.items);
            break;
          case 'highlight.show':
            console.log(`[${index + 1}] 显示高亮:`, action.target?.nodeKey);
            break;
          case 'highlight.hide':
            console.log(`[${index + 1}] 隐藏高亮:`, action.target?.nodeKey);
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
    
    if (playbackState.currentItemIndex < (currentSegment.items?.length || 0) - 1) {
      // 下一个项目
      setPlaybackState(prev => ({
        ...prev,
        currentItemIndex: prev.currentItemIndex + 1
      }));
    } else if (playbackState.currentSegmentIndex < segments.length - 1) {
      // 下一个段落
      setPlaybackState(prev => ({
        ...prev,
        currentSegmentIndex: prev.currentSegmentIndex + 1,
        currentItemIndex: 0
      }));
    } else {
      // 播放结束
      setPlaybackState(prev => ({ ...prev, isPlaying: false }));
      message.success('课程播放完成');
    }
  };

  const prevItem = () => {
    if (playbackState.currentItemIndex > 0) {
      // 上一个项目
      setPlaybackState(prev => ({
        ...prev,
        currentItemIndex: prev.currentItemIndex - 1,
        isPlaying: false
      }));
    } else if (playbackState.currentSegmentIndex > 0) {
      // 上一个段落的最后一项
      const prevSegment = courseData?.outline?.[playbackState.currentSegmentIndex - 1];
      setPlaybackState(prev => ({
        ...prev,
        currentSegmentIndex: prev.currentSegmentIndex - 1,
        currentItemIndex: (prevSegment?.items?.length || 1) - 1,
        isPlaying: false
      }));
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
      <div style={{ height: 700, display: 'flex', flexDirection: 'column' }}>
        {/* 播放器主体 */}
        <div style={{ flex: 1, display: 'flex', gap: 16 }}>
          {/* 左侧：三维视窗 */}
          <div style={{ flex: 2, background: '#f5f5f5', borderRadius: 6, position: 'relative' }}>
            <div 
              ref={containerRef}
              style={{ 
                width: '100%', 
                height: '100%',
                background: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* 三维内容占位 */}
              <div style={{ textAlign: 'center', color: '#666' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
                <div style={{ fontSize: 16, marginBottom: 8 }}>三维课件播放器</div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  {coursewareData ? '课件已加载' : '等待课件加载...'}
                </div>
                {currentItem && (
                  <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.9)', borderRadius: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
                      当前项目: {currentItem.type}
                    </div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      段落 {playbackState.currentSegmentIndex + 1} / 项目 {playbackState.currentItemIndex + 1}
                    </div>
                  </div>
                )}
              </div>

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
            </div>
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
          background: '#fafafa', 
          borderRadius: 6,
          borderTop: '1px solid #d9d9d9'
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
          </div>

          {/* 当前项目信息 */}
          {currentItem && (
            <div style={{ 
              marginTop: 12, 
              padding: 8, 
              background: '#fff', 
              borderRadius: 4,
              fontSize: 12,
              color: '#666'
            }}>
              <strong>当前播放:</strong> {currentItem.type} - {currentItem.say?.slice(0, 100)}...
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
