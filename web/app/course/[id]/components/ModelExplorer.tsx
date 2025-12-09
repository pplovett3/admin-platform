"use client";
import { useEffect, useRef, useState, Component, ReactNode } from 'react';
import { Button, Drawer, Tree, Input, Space, Tooltip, message } from 'antd';
import { 
  ArrowLeftOutlined, MenuOutlined, EyeOutlined, EyeInvisibleOutlined,
  SearchOutlined, AimOutlined, ReloadOutlined
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import PublicThreeDViewer, { PublicThreeDViewerControls } from './PublicThreeDViewer';
import { useXRIntegration, XRButtonContainer, XRMode } from './xr';

// 错误边界组件
class ErrorBoundary extends Component<{ children: ReactNode, onError?: (error: Error) => void }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ModelExplorer Error:', error, errorInfo);
    this.props.onError?.(error);
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
          background: '#1a1a1a',
          color: 'white',
          padding: '20px'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px' }}>模型查看器加载失败</div>
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

interface ModelExplorerProps {
  coursewareData: any;
  onBack: () => void;
}

interface TreeNodeData extends DataNode {
  nodeKey: string;
  visible: boolean;
  children?: TreeNodeData[];
}

export default function ModelExplorer({ coursewareData, onBack }: ModelExplorerProps) {
  const viewerRef = useRef<PublicThreeDViewerControls>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [hiddenNodes, setHiddenNodes] = useState<Set<string>>(new Set());
  const [isXRMode, setIsXRMode] = useState(false);
  const [xrDebugLogs, setXrDebugLogs] = useState<string[]>([]);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // 检测移动端（安全检查）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkMobile = () => {
      const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
      setIsMobile(mobile);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // XR相关状态 - 需要在modelLoaded后才能获取renderer
  const [xrRenderer, setXrRenderer] = useState<any>(null);
  const [xrScene, setXrScene] = useState<any>(null);
  const [xrCamera, setXrCamera] = useState<any>(null);

  // 当模型加载完成后，获取Three.js对象并检测XR
  useEffect(() => {
    if (modelLoaded && viewerRef.current) {
      const renderer = viewerRef.current.getRenderer();
      setXrRenderer(renderer);
      setXrScene(viewerRef.current.getScene());
      setXrCamera(viewerRef.current.getCamera());
      
      // 直接检测XR能力并记录到调试面板
      const checkXRDirectly = async () => {
        const logs: string[] = [];
        logs.push(`[${new Date().toLocaleTimeString()}] 开始XR检测...`);
        logs.push(`User Agent: ${navigator.userAgent.substring(0, 80)}...`);
        
        if (!('xr' in navigator)) {
          logs.push('❌ navigator.xr 不存在 - 浏览器不支持WebXR');
          logs.push('💡 如果是Vision Pro，请在Safari设置中启用WebXR');
          setXrDebugLogs(logs);
          return;
        }
        
        logs.push('✅ navigator.xr 存在');
        
        try {
          const vrSupported = await navigator.xr!.isSessionSupported('immersive-vr');
          logs.push(`VR (immersive-vr): ${vrSupported ? '✅ 支持' : '❌ 不支持'}`);
        } catch (e: any) {
          logs.push(`VR 检测失败: ${e.message}`);
        }
        
        try {
          const arSupported = await navigator.xr!.isSessionSupported('immersive-ar');
          logs.push(`AR (immersive-ar): ${arSupported ? '✅ 支持' : '❌ 不支持'}`);
        } catch (e: any) {
          logs.push(`AR 检测失败: ${e.message}`);
        }
        
        try {
          const inlineSupported = await navigator.xr!.isSessionSupported('inline');
          logs.push(`Inline: ${inlineSupported ? '✅ 支持' : '❌ 不支持'}`);
        } catch (e: any) {
          logs.push(`Inline 检测失败: ${e.message}`);
        }
        
        logs.push(`Renderer XR enabled: ${renderer?.xr?.enabled ? '✅' : '❌'}`);
        logs.push('---');
        logs.push('💡 进入VR后如果看不到手柄，请挥动手柄触发连接');
        setXrDebugLogs(logs);
      };
      
      checkXRDirectly();
    }
  }, [modelLoaded]);

  // XR集成 - 使用状态中的renderer
  const xrIntegration = useXRIntegration({
    renderer: xrRenderer,
    scene: xrScene,
    camera: xrCamera,
    modelRoot: viewerRef.current?.getModelRoot() || null,
    interactableObjects: viewerRef.current?.getInteractableObjects() || [],
    onNodeSelect: (nodeKey) => {
      // 选中节点
      setSelectedKeys([nodeKey]);
      viewerRef.current?.focusOnNode(nodeKey);
      viewerRef.current?.highlightNode(nodeKey, true);
    },
    onSessionStart: (mode: XRMode) => {
      setIsXRMode(true);
      message.success(`已进入${mode.toUpperCase()}模式`);
    },
    onSessionEnd: () => {
      setIsXRMode(false);
      message.info('已退出XR模式');
    }
  });

  // 从 modelStructure 构建树形数据
  useEffect(() => {
    if (coursewareData?.modelStructure) {
      const structure = coursewareData.modelStructure;
      
      // 支持新旧两种格式
      let objects: any[] = [];
      if (Array.isArray(structure)) {
        objects = structure;
      } else if (structure.objects && Array.isArray(structure.objects)) {
        objects = structure.objects;
      }

      if (objects.length > 0) {
        const tree = buildTreeFromStructure(objects);
        setTreeData(tree);
        // 默认展开第一层
        if (tree.length > 0) {
          setExpandedKeys([tree[0].key as string]);
        }
      }
    }
  }, [coursewareData?.modelStructure]);

  // 从扁平结构构建树
  const buildTreeFromStructure = (objects: any[]): TreeNodeData[] => {
    const nodeMap = new Map<string, TreeNodeData>();
    const roots: TreeNodeData[] = [];

    // 先创建所有节点
    objects.forEach((obj) => {
      const key = obj.uuid || obj.path?.join('/') || obj.name;
      const node: TreeNodeData = {
        key,
        title: obj.name || 'Unknown',
        nodeKey: obj.path?.join('/') || obj.name || key,
        visible: obj.visible !== false,
        children: []
      };
      nodeMap.set(key, node);
    });

    // 建立父子关系
    objects.forEach((obj) => {
      const key = obj.uuid || obj.path?.join('/') || obj.name;
      const node = nodeMap.get(key);
      if (!node) return;

      if (obj.path && obj.path.length > 1) {
        // 尝试找到父节点
        const parentPath = obj.path.slice(0, -1);
        const parentKey = parentPath.join('/');
        
        // 查找父节点
        let parentNode: TreeNodeData | undefined;
        for (const [k, n] of nodeMap) {
          if (n.nodeKey === parentKey || k === parentKey) {
            parentNode = n;
            break;
          }
        }
        
        if (parentNode) {
          parentNode.children = parentNode.children || [];
          parentNode.children.push(node);
        } else {
          roots.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  };

  // 过滤树节点
  const filterTree = (nodes: TreeNodeData[], searchValue: string): TreeNodeData[] => {
    if (!searchValue) return nodes;
    
    const lowerSearch = searchValue.toLowerCase();
    
    const filter = (nodes: TreeNodeData[]): TreeNodeData[] => {
      return nodes.reduce<TreeNodeData[]>((acc, node) => {
        const title = String(node.title).toLowerCase();
        const children = node.children ? filter(node.children) : [];
        
        if (title.includes(lowerSearch) || children.length > 0) {
          acc.push({
            ...node,
            children: children.length > 0 ? children : node.children
          });
        }
        
        return acc;
      }, []);
    };
    
    return filter(nodes);
  };

  // 选中节点
  const handleSelect = (keys: React.Key[], info: any) => {
    setSelectedKeys(keys as string[]);
    
    if (keys.length > 0 && viewerRef.current && modelLoaded) {
      const nodeKey = info.node.nodeKey;
      // 对焦并高亮
      viewerRef.current.focusOnNode(nodeKey);
      viewerRef.current.highlightNode(nodeKey, true);
    }
  };

  // 切换节点显隐
  const toggleVisibility = (nodeKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const newHidden = new Set(hiddenNodes);
    const isCurrentlyHidden = newHidden.has(nodeKey);
    
    if (isCurrentlyHidden) {
      newHidden.delete(nodeKey);
    } else {
      newHidden.add(nodeKey);
    }
    
    setHiddenNodes(newHidden);
    
    // 调用3D查看器API
    if (viewerRef.current && modelLoaded) {
      viewerRef.current.setNodeVisibility(nodeKey, isCurrentlyHidden);
    }
  };

  // 对焦到节点
  const focusOnNode = (nodeKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewerRef.current && modelLoaded) {
      viewerRef.current.focusOnNode(nodeKey);
    }
  };

  // 重置所有状态
  const handleReset = () => {
    setHiddenNodes(new Set());
    setSelectedKeys([]);
    if (viewerRef.current && modelLoaded) {
      viewerRef.current.resetAllStates();
    }
    message.success('已重置所有状态');
  };

  // 渲染树节点标题
  const renderTreeTitle = (node: TreeNodeData) => {
    const isHidden = hiddenNodes.has(node.nodeKey);
    const isSelected = selectedKeys.includes(node.key as string);
    
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '4px 0'
      }}>
        <span style={{ 
          flex: 1, 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          opacity: isHidden ? 0.4 : 1,
          color: 'rgba(255, 255, 255, 0.85)',
          fontSize: '13px'
        }}>
          {node.title as string}
        </span>
        <Space size={4} onClick={(e) => e.stopPropagation()}>
          <Tooltip title={isHidden ? '显示' : '隐藏'}>
            <Button 
              type="text" 
              size="small"
              icon={isHidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              onClick={(e) => toggleVisibility(node.nodeKey, e)}
              style={{ 
                color: isHidden ? 'rgba(255, 255, 255, 0.3)' : '#06b6d4',
                padding: '0 4px'
              }}
            />
          </Tooltip>
          <Tooltip title="对焦">
            <Button 
              type="text" 
              size="small"
              icon={<AimOutlined />}
              onClick={(e) => focusOnNode(node.nodeKey, e)}
              style={{ 
                padding: '0 4px',
                color: '#8b5cf6'
              }}
            />
          </Tooltip>
        </Space>
      </div>
    );
  };

  const filteredTreeData = filterTree(treeData, searchText);

  return (
    <ErrorBoundary>
    <div style={{ width: '100%', height: '100vh', position: 'relative', background: '#1a1a1a' }}>
      {/* 移动端横屏提示样式和组件 */}
      <style>{`
        @media screen and (max-width: 768px) and (orientation: portrait) {
          .model-landscape-hint { display: flex !important; }
        }
        @media screen and (max-width: 768px) and (orientation: landscape) {
          .model-landscape-hint { display: none !important; }
        }
        @media screen and (min-width: 769px) {
          .model-landscape-hint { display: none !important; }
        }
        @media screen and (max-width: 768px) {
          .model-toolbar { padding: 0 10px !important; height: 45px !important; }
          .model-toolbar .ant-btn { padding: 2px 8px !important; }
        }
      `}</style>
      
      {isMobile && (
        <div 
          className="model-landscape-hint"
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
          <div style={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '18px', fontWeight: 600 }}>
            请横屏查看
          </div>
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '14px', textAlign: 'center', padding: '0 40px' }}>
            为获得最佳模型查看体验，请将设备横向放置
          </div>
        </div>
      )}

      {/* 顶部工具栏 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50px',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        zIndex: 100,
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={onBack}
          style={{ color: 'white', marginRight: '16px' }}
        >
          返回
        </Button>
        
        <div style={{ flex: 1, color: 'white', fontWeight: 'bold', fontSize: '16px' }}>
          模型查看
        </div>
        
        <Space>
          {/* WebXR VR/AR 按钮 */}
          {modelLoaded && (
            <XRButtonContainer
              xrManager={xrIntegration.xrManager}
              onSessionStart={(mode) => {
                setIsXRMode(true);
              }}
              onSessionEnd={() => {
                setIsXRMode(false);
              }}
            />
          )}
          <Button 
            type="text"
            icon={<ReloadOutlined />}
            onClick={handleReset}
            style={{ color: 'white' }}
          >
            重置
          </Button>
          <Button 
            type="primary"
            icon={<MenuOutlined />}
            onClick={() => setDrawerVisible(true)}
          >
            层级树
          </Button>
        </Space>
      </div>

      {/* 3D查看器 */}
      <div style={{ width: '100%', height: '100%', paddingTop: '50px' }}>
        <PublicThreeDViewer
          ref={viewerRef}
          coursewareData={coursewareData}
          width={typeof window !== 'undefined' ? window.innerWidth : 1920}
          height={typeof window !== 'undefined' ? window.innerHeight - 50 : 1030}
          onModelLoaded={() => setModelLoaded(true)}
        />
      </div>

      {/* 模型层级树面板 - 毛玻璃深色风格 */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          right: drawerVisible ? 0 : '-320px',
          width: '320px',
          height: '100%',
          background: 'rgba(15, 23, 42, 0.9)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.5)',
          transition: 'right 0.3s ease',
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* 面板标题 */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ 
            color: 'rgba(255, 255, 255, 0.95)', 
            fontWeight: 600,
            fontSize: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <MenuOutlined style={{ color: '#06b6d4' }} />
            模型层级树
          </div>
          <Button 
            type="text" 
            size="small"
            onClick={() => setDrawerVisible(false)}
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

        {/* 搜索框 */}
        <div style={{ padding: '12px 16px' }}>
          <Input
            placeholder="搜索节点..."
            prefix={<SearchOutlined style={{ color: 'rgba(255, 255, 255, 0.4)' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'rgba(255, 255, 255, 0.9)'
            }}
          />
        </div>
        
        {/* 树形列表 */}
        <div style={{ 
          flex: 1,
          margin: '0 16px',
          overflow: 'auto',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '8px'
        }}>
          {filteredTreeData.length > 0 ? (
            <Tree
              treeData={filteredTreeData}
              expandedKeys={expandedKeys}
              selectedKeys={selectedKeys}
              onExpand={(keys) => setExpandedKeys(keys as string[])}
              onSelect={handleSelect}
              titleRender={renderTreeTitle}
              showLine={{ showLeafIcon: false }}
              blockNode
              className="dark-tree"
            />
          ) : (
            <div style={{ 
              textAlign: 'center', 
              color: 'rgba(255, 255, 255, 0.4)', 
              padding: '40px 0' 
            }}>
              {searchText ? '未找到匹配的节点' : '暂无模型结构数据'}
            </div>
          )}
        </div>
        
        {/* 操作提示 */}
        <div style={{ 
          margin: '12px 16px 16px',
          padding: '12px 14px',
          background: 'rgba(6, 182, 212, 0.1)',
          border: '1px solid rgba(6, 182, 212, 0.2)',
          borderRadius: '10px',
          fontSize: '12px',
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          <div style={{ color: '#06b6d4', marginBottom: '6px', fontWeight: 500 }}>💡 操作提示</div>
          <div style={{ lineHeight: 1.8 }}>
            • 点击节点名称可对焦并高亮<br/>
            • 点击眼睛图标可显示/隐藏<br/>
            • 点击靶心图标可快速对焦
          </div>
        </div>
      </div>

      {/* 树节点样式覆盖 */}
      <style jsx global>{`
        .dark-tree .ant-tree {
          background: transparent;
          color: rgba(255, 255, 255, 0.85);
        }
        .dark-tree .ant-tree-node-content-wrapper {
          color: rgba(255, 255, 255, 0.85);
        }
        .dark-tree .ant-tree-node-content-wrapper:hover {
          background: rgba(255, 255, 255, 0.08) !important;
        }
        .dark-tree .ant-tree-node-selected .ant-tree-node-content-wrapper {
          background: rgba(6, 182, 212, 0.2) !important;
        }
        .dark-tree .ant-tree-switcher {
          color: rgba(255, 255, 255, 0.5);
        }
        .dark-tree .ant-tree-indent-unit::before {
          border-color: rgba(255, 255, 255, 0.1) !important;
        }
        .dark-tree .ant-tree-switcher-line-icon {
          color: rgba(255, 255, 255, 0.3);
        }
      `}</style>

      {/* XR调试面板已隐藏 - 生产环境不显示 */}
    </div>
    </ErrorBoundary>
  );
}

