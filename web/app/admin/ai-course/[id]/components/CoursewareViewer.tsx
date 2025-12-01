"use client";
import { useEffect, useRef, useState } from 'react';
import { Button, Space, message } from 'antd';
import { authFetch } from '@/app/_lib/api';
import ThreeDViewer from './ThreeDViewer';

interface CoursewareViewerProps {
  coursewareId: string;
  selectedItem?: any;
}

export default function CoursewareViewer({ coursewareId, selectedItem }: CoursewareViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerControlsRef = useRef<any>(null);
  const [loading, setLoading] = useState(false);
  const [coursewareData, setCoursewareData] = useState<any>(null);

  useEffect(() => {
    if (coursewareId) {
      loadCourseware();
    }
  }, [coursewareId]);

  useEffect(() => {
    if (selectedItem && selectedItem.type === 'scene.action') {
      simulateSceneActions(selectedItem.actions || []);
    }
  }, [selectedItem]);

  const loadCourseware = async () => {
    setLoading(true);
    try {
      const data = await authFetch<any>(`/api/coursewares/${coursewareId}`);
      setCoursewareData(data);
      message.success('课件加载成功');
    } catch (error) {
      console.error('加载课件失败:', error);
      message.error('课件加载失败');
    } finally {
      setLoading(false);
    }
  };

  const simulateSceneActions = (actions: any[]) => {
    console.log('执行三维动作:', actions);
    
    const viewerControls = viewerControlsRef.current;
    if (!viewerControls) {
      console.error('无法获取三维控制接口，请等待模型加载完成');
      return;
    }

    // 【新增】重置所有状态（高亮、标注、动画）
    if (viewerControls.resetAllStates) {
      viewerControls.resetAllStates();
    }

    actions.forEach((action, index) => {
      setTimeout(() => {
        switch (action.type) {
          case 'camera.focus':
            console.log(`对焦到: ${action.target?.nodeKey}`);
            if (action.target?.nodeKey) {
              viewerControls.focusOnNode(action.target.nodeKey);
            }
            break;
          case 'highlight.show':
            console.log(`高亮显示: ${action.target?.nodeKey}`);
            if (action.target?.nodeKey) {
              viewerControls.highlightNode(action.target.nodeKey, true);
            }
            break;
          case 'highlight.hide':
            console.log(`隐藏高亮: ${action.target?.nodeKey}`);
            if (action.target?.nodeKey) {
              viewerControls.highlightNode(action.target.nodeKey, false);
            }
            break;
          case 'annotation.show':
            console.log(`显示标注: ${action.ids?.join(', ')}`);
            if (action.ids) {
              viewerControls.showAnnotations(action.ids, action.labelScale);
            }
            break;
          case 'annotation.hide':
            console.log(`隐藏标注: ${action.ids?.join(', ')}`);
            if (action.ids) {
              viewerControls.hideAnnotations(action.ids);
            }
            break;
          case 'annotation.highlight':
            // 【修复】将 annotation.highlight 统一处理为高亮显示
            console.log(`高亮显示: ${action.target?.nodeKey}`);
            if (action.target?.nodeKey) {
              viewerControls.highlightNode(action.target.nodeKey, true);
            }
            break;
          case 'animation.play':
            console.log(`播放动画: ${action.animationId} (${action.startTime}s - ${action.endTime}s)`);
            if (action.animationId) {
              viewerControls.playAnimation(action.animationId, action.startTime, action.endTime);
            }
            break;
          case 'visibility.set':
            console.log(`设置显隐: ${JSON.stringify(action.items)}`);
            if (action.items) {
              action.items.forEach((item: any) => {
                viewerControls.setNodeVisibility(item.nodeKey, item.visible);
              });
            }
            break;
        }
      }, index * 500);
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {/* 工具栏 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #2b2b2b', background: '#0f0f10' }}>
        <Space>
          <Button onClick={loadCourseware} loading={loading}>
            重新加载
          </Button>
          <Button onClick={() => message.info('重置视角功能开发中...')}>
            重置视角
          </Button>
          <Button onClick={() => message.info('全屏查看功能开发中...')}>
            全屏
          </Button>
          {selectedItem?.type === 'scene.action' && (
            <Button 
              type="primary" 
              onClick={() => simulateSceneActions(selectedItem.actions || [])}
            >
              预览动作
            </Button>
          )}
        </Space>
      </div>

      {/* 三维视窗 */}
      <div 
        ref={containerRef}
        style={{ 
          flex: 1, 
          position: 'relative'
        }}
      >
        <ThreeDViewer 
          coursewareData={coursewareData}
          width={containerRef.current?.clientWidth || 800}
          height={containerRef.current?.clientHeight || 600}
          onModelLoaded={(model) => {
            console.log('编辑器中的三维模型加载完成:', model);
          }}
          onControlsReady={(controls) => {
            console.log('编辑器接收到三维控制接口:', Object.keys(controls));
            viewerControlsRef.current = controls;
          }}
        />

        {/* 信息叠加层 */}
        {selectedItem && (
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
            <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
              当前选中: {selectedItem.type}
            </div>
            <div style={{ fontSize: 11 }}>
              {selectedItem.say?.slice(0, 50)}...
            </div>
          </div>
        )}

        {selectedItem?.type === 'image.explain' && selectedItem.image?.src && (
          <div style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 200,
            background: 'rgba(255,255,255,0.95)',
            padding: 12,
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}>
            <img 
              src={selectedItem.image.src} 
              alt={selectedItem.image.title || '配图'}
              style={{ width: '100%', borderRadius: 4, marginBottom: 8 }}
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjEwMCIgeT0iNjAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPuWbvueJh+WKoOi9veWksei0pTwvdGV4dD48L3N2Zz4=';
              }}
            />
            <div style={{ fontSize: 12, fontWeight: 'bold' }}>
              {selectedItem.image.title || '配图'}
            </div>
          </div>
        )}
      </div>

      {/* 状态栏 */}
      <div style={{ 
        padding: '8px 16px', 
        borderTop: '1px solid #2b2b2b', 
        background: '#0f0f10',
        fontSize: 12,
        color: '#9aa0a6'
      }}>
        课件ID: {coursewareId} | 
        状态: {coursewareData ? '已加载' : '未加载'} |
        选中项: {selectedItem ? `${selectedItem.type} - ${selectedItem.id}` : '无'}
      </div>
    </div>
  );
}


