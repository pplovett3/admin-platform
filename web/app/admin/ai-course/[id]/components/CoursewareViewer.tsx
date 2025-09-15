"use client";
import { useEffect, useRef, useState } from 'react';
import { Button, Space, message } from 'antd';

interface CoursewareViewerProps {
  coursewareId: string;
  selectedItem?: any;
}

export default function CoursewareViewer({ coursewareId, selectedItem }: CoursewareViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
      // 这里应该加载课件数据和初始化三维查看器
      // 暂时显示占位内容
      setCoursewareData({ id: coursewareId, loaded: true });
      message.success('课件加载成功');
    } catch (error) {
      message.error('课件加载失败');
    } finally {
      setLoading(false);
    }
  };

  const simulateSceneActions = (actions: any[]) => {
    console.log('模拟执行三维动作:', actions);
    // 这里应该实际执行三维动作
    actions.forEach((action, index) => {
      setTimeout(() => {
        switch (action.type) {
          case 'camera.focus':
            console.log(`对焦到: ${action.target?.nodeKey}`);
            break;
          case 'highlight.show':
            console.log(`高亮显示: ${action.target?.nodeKey}`);
            break;
          case 'annotation.show':
            console.log(`显示标注: ${action.ids?.join(', ')}`);
            break;
          case 'animation.play':
            console.log(`播放动画: ${action.animationId} (${action.startTime}s - ${action.endTime}s)`);
            break;
          case 'visibility.set':
            console.log(`设置显隐: ${JSON.stringify(action.items)}`);
            break;
        }
      }, index * 500);
    });
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
      {/* 工具栏 */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #d9d9d9', background: '#fff' }}>
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
          position: 'relative',
          background: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px'
        }}
      >
        {/* 占位内容 */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#666'
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚗</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>三维课件查看器</div>
          <div style={{ fontSize: 12, color: '#999' }}>
            {coursewareData ? '课件已加载，集成开发中...' : '等待课件加载...'}
          </div>
          {selectedItem && (
            <div style={{ marginTop: 16, padding: 12, background: 'rgba(255,255,255,0.9)', borderRadius: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>
                当前选中: {selectedItem.type}
              </div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {selectedItem.say?.slice(0, 50)}...
              </div>
            </div>
          )}
        </div>

        {/* 信息叠加层 */}
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
        borderTop: '1px solid #d9d9d9', 
        background: '#fff',
        fontSize: 12,
        color: '#666'
      }}>
        课件ID: {coursewareId} | 
        状态: {coursewareData ? '已加载' : '未加载'} |
        选中项: {selectedItem ? `${selectedItem.type} - ${selectedItem.id}` : '无'}
      </div>
    </div>
  );
}


