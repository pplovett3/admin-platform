"use client";

import { useState, useEffect } from 'react';
import { Button, Tooltip, Space } from 'antd';
import { XRManager, XRCapabilities, XRMode } from './XRManager';

interface XRButtonProps {
  xrManager: XRManager | null;
  onSessionStart?: (mode: XRMode) => void;
  onSessionEnd?: () => void;
  style?: React.CSSProperties;
}

/**
 * WebXR VR/AR 入口按钮组件
 * 自动检测设备支持情况，显示相应的入口按钮
 */
export default function XRButton({ 
  xrManager, 
  onSessionStart, 
  onSessionEnd,
  style 
}: XRButtonProps) {
  const [capabilities, setCapabilities] = useState<XRCapabilities>({
    vrSupported: false,
    arSupported: false,
    handTrackingSupported: false
  });
  const [currentMode, setCurrentMode] = useState<XRMode>('none');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // 检测XR能力
  useEffect(() => {
    if (!xrManager) {
      setChecking(false);
      return;
    }

    const checkXR = async () => {
      setChecking(true);
      try {
        // 首先检查navigator.xr是否存在
        if (!('xr' in navigator)) {
          console.warn('[WebXR] navigator.xr not available. WebXR not supported in this browser.');
          console.warn('[WebXR] If on Vision Pro, please enable WebXR in Safari Settings > Apps > Safari > Advanced > Feature Flags');
          setChecking(false);
          return;
        }
        
        console.log('[WebXR] navigator.xr available, checking capabilities...');
        const caps = await xrManager.checkCapabilities();
        console.log('[WebXR] Capabilities:', caps);
        setCapabilities(caps);
      } catch (e) {
        console.error('[WebXR] Capability check failed:', e);
      } finally {
        setChecking(false);
      }
    };

    checkXR();
  }, [xrManager]);

  // 进入VR模式
  const handleEnterVR = async () => {
    if (!xrManager) return;
    
    setLoading(true);
    try {
      const success = await xrManager.enterVR({
        onSessionStart: () => {
          setCurrentMode('vr');
          onSessionStart?.('vr');
        },
        onSessionEnd: () => {
          setCurrentMode('none');
          onSessionEnd?.();
        }
      });
      
      if (!success) {
        console.error('Failed to enter VR');
      }
    } finally {
      setLoading(false);
    }
  };

  // 进入AR模式
  const handleEnterAR = async () => {
    if (!xrManager) return;
    
    setLoading(true);
    try {
      const success = await xrManager.enterAR({
        onSessionStart: () => {
          setCurrentMode('ar');
          onSessionStart?.('ar');
        },
        onSessionEnd: () => {
          setCurrentMode('none');
          onSessionEnd?.();
        }
      });
      
      if (!success) {
        console.error('Failed to enter AR');
      }
    } finally {
      setLoading(false);
    }
  };

  // 退出XR
  const handleExitXR = async () => {
    if (!xrManager) return;
    await xrManager.endSession();
  };

  // 如果正在检测，显示加载状态
  if (checking) {
    return (
      <div style={{ 
        padding: '8px 12px', 
        background: 'rgba(255,255,255,0.1)', 
        borderRadius: '8px',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.6)',
        ...style 
      }}>
        检测XR...
      </div>
    );
  }

  // 不支持XR时，显示提示（可选，便于调试）
  if (!capabilities.vrSupported && !capabilities.arSupported) {
    // 在开发模式下显示调试信息
    if (process.env.NODE_ENV === 'development') {
      return (
        <Tooltip title="WebXR未检测到支持。如在Vision Pro上，请在Safari设置中启用WebXR Device API">
          <div style={{ 
            padding: '8px 12px', 
            background: 'rgba(255,100,100,0.2)', 
            borderRadius: '8px',
            fontSize: '11px',
            color: 'rgba(255,200,200,0.8)',
            cursor: 'help',
            ...style 
          }}>
            XR不可用
          </div>
        </Tooltip>
      );
    }
    return null;
  }

  // 如果在XR会话中，显示退出按钮
  if (currentMode !== 'none') {
    return (
      <Button
        type="primary"
        danger
        onClick={handleExitXR}
        loading={loading}
        style={{
          background: 'rgba(239, 68, 68, 0.9)',
          border: 'none',
          height: '40px',
          borderRadius: '20px',
          fontWeight: 600,
          boxShadow: '0 4px 15px rgba(239, 68, 68, 0.4)',
          ...style
        }}
      >
        退出 {currentMode.toUpperCase()}
      </Button>
    );
  }

  // 显示VR/AR入口按钮
  return (
    <Space size={8} style={style}>
      {capabilities.vrSupported && (
        <Tooltip title="进入VR沉浸式模式（需VR头显）">
          <Button
            type="primary"
            onClick={handleEnterVR}
            loading={loading}
            style={{
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              border: 'none',
              height: '40px',
              borderRadius: '20px',
              fontWeight: 600,
              boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <VRIcon />
            进入VR
          </Button>
        </Tooltip>
      )}
      
      {capabilities.arSupported && (
        <Tooltip title="进入AR透视模式（Vision Pro等）">
          <Button
            type="primary"
            onClick={handleEnterAR}
            loading={loading}
            style={{
              background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
              border: 'none',
              height: '40px',
              borderRadius: '20px',
              fontWeight: 600,
              boxShadow: '0 4px 15px rgba(6, 182, 212, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ARIcon />
            进入AR
          </Button>
        </Tooltip>
      )}
    </Space>
  );
}

// VR图标
function VRIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.5 6h-17C2.67 6 2 6.67 2 7.5v9c0 .83.67 1.5 1.5 1.5h4.17c.69 0 1.33-.44 1.55-1.09l.59-1.82c.22-.65.86-1.09 1.55-1.09h1.28c.69 0 1.33.44 1.55 1.09l.59 1.82c.22.65.86 1.09 1.55 1.09h4.17c.83 0 1.5-.67 1.5-1.5v-9c0-.83-.67-1.5-1.5-1.5zM8 13c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm8 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
    </svg>
  );
}

// AR图标
function ARIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 4v6h2V6h4V4H3zm18 0h-6v2h4v4h2V4zM3 20v-6h2v4h4v2H3zm18 0h-6v-2h4v-4h2v6z"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 6l1.5 3h3l-2.25 2.25L15.5 15 12 13l-3.5 2 1.25-3.75L7.5 9h3z" opacity="0.5"/>
    </svg>
  );
}

