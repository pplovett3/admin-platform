"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { XRManager, XRMode } from './XRManager';
import { XRControllers } from './XRControllers';
import { XRHitTest, ARPlacementMode } from './XRHitTest';
import { XRUIPanel, createQuizPanel, createResultPanel } from './XRUIPanel';
import XRButton from './XRButton';

export interface XRIntegrationProps {
  renderer: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.PerspectiveCamera | null;
  modelRoot: THREE.Object3D | null;
  interactableObjects: THREE.Object3D[];
  
  // 回调
  onNodeSelect?: (nodeKey: string) => void;
  onSessionStart?: (mode: XRMode) => void;
  onSessionEnd?: () => void;
  
  // 样式
  buttonStyle?: React.CSSProperties;
}

export interface XRIntegrationHandle {
  enterVR: () => Promise<boolean>;
  enterAR: () => Promise<boolean>;
  exitXR: () => Promise<void>;
  isInSession: () => boolean;
  getCurrentMode: () => XRMode;
  
  // 答题面板
  showQuizPanel: (
    question: string,
    options: { key: string; text: string }[],
    onAnswer: (key: string) => void,
    currentAnswer?: string,
    result?: { correctAnswer: string; correct: boolean }
  ) => void;
  hideQuizPanel: () => void;
  updateQuizPanel: (currentAnswer: string, result?: { correctAnswer: string; correct: boolean }) => void;
  
  // 结果面板
  showResultPanel: (
    score: number,
    correctCount: number,
    totalQuestions: number,
    onRetry: () => void,
    onExit: () => void
  ) => void;
  hideResultPanel: () => void;
  
  // AR放置
  setARPlacementMode: (mode: ARPlacementMode) => void;
  confirmARPlacement: () => void;
  resetARPlacement: () => void;
}

/**
 * XR集成组件
 * 整合XR管理器、控制器、UI面板等所有XR功能
 */
export function useXRIntegration({
  renderer,
  scene,
  camera,
  modelRoot,
  interactableObjects,
  onNodeSelect,
  onSessionStart,
  onSessionEnd
}: Omit<XRIntegrationProps, 'buttonStyle'>): XRIntegrationHandle & { xrManager: XRManager | null } {
  const xrManagerRef = useRef<XRManager | null>(null);
  const xrControllersRef = useRef<XRControllers | null>(null);
  const xrHitTestRef = useRef<XRHitTest | null>(null);
  const quizPanelRef = useRef<XRUIPanel | null>(null);
  const resultPanelRef = useRef<XRUIPanel | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  
  const [currentMode, setCurrentMode] = useState<XRMode>('none');
  const [xrManagerReady, setXrManagerReady] = useState<XRManager | null>(null);

  // 初始化XR管理器 - 当renderer准备好后创建
  useEffect(() => {
    if (!renderer) {
      console.log('[XRIntegration] Waiting for renderer...');
      setXrManagerReady(null);
      return;
    }
    
    console.log('[XRIntegration] Renderer ready, creating XRManager...');
    const xrManager = new XRManager(renderer);
    xrManagerRef.current = xrManager;
    
    // 立即检查XR能力，然后更新状态
    xrManager.checkCapabilities().then(caps => {
      console.log('[XRIntegration] XR capabilities checked:', caps);
      // 触发状态更新，让XRButton重新渲染
      setXrManagerReady(xrManager);
    });
    
    return () => {
      xrManager.dispose();
      xrManagerRef.current = null;
      setXrManagerReady(null);
    };
  }, [renderer]);

  // 初始化XR控制器 - 在XR会话开始时创建
  useEffect(() => {
    if (!renderer || !scene) {
      console.log('[XRIntegration] Waiting for renderer/scene for controllers...');
      return;
    }
    
    if (currentMode === 'none') {
      // 不在XR模式，清理控制器
      if (xrControllersRef.current) {
        console.log('[XRIntegration] Exiting XR, disposing controllers');
        xrControllersRef.current.dispose();
        xrControllersRef.current = null;
      }
      return;
    }
    
    console.log('[XRIntegration] Creating XR controllers for mode:', currentMode);
    const controllers = new XRControllers(renderer, scene);
    xrControllersRef.current = controllers;
    
    // 设置可交互对象
    controllers.setInteractableObjects(interactableObjects);
    
    // 设置目标模型
    if (modelRoot) {
      controllers.setTargetModel(modelRoot);
    }
    
    // 设置交互处理器
    controllers.setHandlers({
      onSelect: (controller, intersection) => {
        console.log('[XRIntegration] Select event, intersection:', intersection);
        if (intersection) {
          // 找到选中的节点
          let current: THREE.Object3D | null = intersection.object;
          while (current && current !== modelRoot) {
            if (current.name) {
              onNodeSelect?.(current.name);
              break;
            }
            current = current.parent;
          }
          
          // 震动反馈
          controllers.hapticFeedback(1, 0.5, 50);
        }
        
        // 检查是否点击了UI面板按钮
        if (quizPanelRef.current) {
          quizPanelRef.current.triggerButtonClick();
        }
        if (resultPanelRef.current) {
          resultPanelRef.current.triggerButtonClick();
        }
      },
      onHover: (intersection) => {
        // 可以添加悬停高亮效果
      }
    });
    
    return () => {
      console.log('[XRIntegration] Cleaning up controllers');
      controllers.dispose();
      xrControllersRef.current = null;
    };
  }, [renderer, scene, currentMode, interactableObjects, modelRoot, onNodeSelect]);

  // 初始化AR Hit Test
  useEffect(() => {
    if (!renderer || !scene || currentMode !== 'ar') return;
    
    const hitTest = new XRHitTest(renderer, scene);
    xrHitTestRef.current = hitTest;
    
    // 设置放置回调
    hitTest.setOnPlacement((position, rotation) => {
      if (modelRoot) {
        modelRoot.position.copy(position);
        modelRoot.quaternion.copy(rotation);
      }
    });
    
    return () => {
      hitTest.dispose();
      xrHitTestRef.current = null;
    };
  }, [renderer, scene, currentMode, modelRoot]);

  // XR帧更新循环
  useEffect(() => {
    if (!renderer || currentMode === 'none') return;
    
    let animationId: number | null = null;
    
    const updateXR = () => {
      // 更新控制器状态
      if (xrControllersRef.current) {
        xrControllersRef.current.update();
      }
      
      // 更新UI面板朝向相机
      if (camera && renderer.xr.isPresenting) {
        // 获取XR相机
        const xrCamera = renderer.xr.getCamera();
        
        if (quizPanelRef.current) {
          quizPanelRef.current.faceCamera(xrCamera);
        }
        if (resultPanelRef.current) {
          resultPanelRef.current.faceCamera(xrCamera);
        }
      }
      
      // 继续下一帧
      if (currentMode !== 'none') {
        animationId = requestAnimationFrame(updateXR);
      }
    };
    
    // 启动更新循环
    console.log('[XRIntegration] Starting XR update loop');
    animationId = requestAnimationFrame(updateXR);
    
    return () => {
      console.log('[XRIntegration] Stopping XR update loop');
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [renderer, camera, currentMode]);

  // 进入VR
  const enterVR = useCallback(async (): Promise<boolean> => {
    if (!xrManagerRef.current) return false;
    
    const success = await xrManagerRef.current.enterVR({
      onSessionStart: (session) => {
        setCurrentMode('vr');
        onSessionStart?.('vr');
      },
      onSessionEnd: () => {
        setCurrentMode('none');
        onSessionEnd?.();
      }
    });
    
    return success;
  }, [onSessionStart, onSessionEnd]);

  // 进入AR
  const enterAR = useCallback(async (): Promise<boolean> => {
    if (!xrManagerRef.current) return false;
    
    const success = await xrManagerRef.current.enterAR({
      onSessionStart: (session) => {
        setCurrentMode('ar');
        onSessionStart?.('ar');
      },
      onSessionEnd: () => {
        setCurrentMode('none');
        onSessionEnd?.();
      }
    });
    
    return success;
  }, [onSessionStart, onSessionEnd]);

  // 退出XR
  const exitXR = useCallback(async (): Promise<void> => {
    await xrManagerRef.current?.endSession();
  }, []);

  // 显示答题面板
  const showQuizPanel = useCallback((
    question: string,
    options: { key: string; text: string }[],
    onAnswer: (key: string) => void,
    currentAnswer?: string,
    result?: { correctAnswer: string; correct: boolean }
  ) => {
    if (!scene || !camera) return;
    
    // 移除旧面板
    if (quizPanelRef.current) {
      quizPanelRef.current.dispose();
    }
    
    // 创建新面板
    const panel = createQuizPanel(question, options, onAnswer, currentAnswer, result);
    quizPanelRef.current = panel;
    
    // 设置位置（相机右侧）
    const panelGroup = panel.getGroup();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    const rightVector = new THREE.Vector3();
    rightVector.crossVectors(cameraDirection, new THREE.Vector3(0, 1, 0)).normalize();
    
    const position = new THREE.Vector3();
    position.copy(camera.position);
    position.add(cameraDirection.multiplyScalar(1.5)); // 前方1.5米
    position.add(rightVector.multiplyScalar(0.5)); // 右侧0.5米
    
    panelGroup.position.copy(position);
    panel.faceCamera(camera);
    
    scene.add(panelGroup);
  }, [scene, camera]);

  // 隐藏答题面板
  const hideQuizPanel = useCallback(() => {
    if (quizPanelRef.current) {
      quizPanelRef.current.dispose();
      quizPanelRef.current = null;
    }
  }, []);

  // 更新答题面板
  const updateQuizPanel = useCallback((
    currentAnswer: string,
    result?: { correctAnswer: string; correct: boolean }
  ) => {
    if (!quizPanelRef.current) return;
    
    // 更新选中状态
    quizPanelRef.current.updateButton(currentAnswer, { selected: true });
    
    // 如果有结果，更新正确/错误状态
    if (result) {
      quizPanelRef.current.updateButton(result.correctAnswer, { correct: true });
      if (currentAnswer !== result.correctAnswer) {
        quizPanelRef.current.updateButton(currentAnswer, { wrong: true });
      }
    }
  }, []);

  // 显示结果面板
  const showResultPanel = useCallback((
    score: number,
    correctCount: number,
    totalQuestions: number,
    onRetry: () => void,
    onExit: () => void
  ) => {
    if (!scene || !camera) return;
    
    // 移除旧面板
    if (resultPanelRef.current) {
      resultPanelRef.current.dispose();
    }
    
    // 创建新面板
    const panel = createResultPanel(score, correctCount, totalQuestions, onRetry, onExit);
    resultPanelRef.current = panel;
    
    // 设置位置（相机前方）
    const panelGroup = panel.getGroup();
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    const position = new THREE.Vector3();
    position.copy(camera.position);
    position.add(cameraDirection.multiplyScalar(1.2)); // 前方1.2米
    
    panelGroup.position.copy(position);
    panel.faceCamera(camera);
    
    scene.add(panelGroup);
  }, [scene, camera]);

  // 隐藏结果面板
  const hideResultPanel = useCallback(() => {
    if (resultPanelRef.current) {
      resultPanelRef.current.dispose();
      resultPanelRef.current = null;
    }
  }, []);

  // AR放置模式
  const setARPlacementMode = useCallback((mode: ARPlacementMode) => {
    xrHitTestRef.current?.setPlacementMode(mode);
  }, []);

  const confirmARPlacement = useCallback(() => {
    xrHitTestRef.current?.confirmPlacement();
  }, []);

  const resetARPlacement = useCallback(() => {
    xrHitTestRef.current?.resetPlacement();
  }, []);

  return {
    xrManager: xrManagerReady, // 使用状态值，确保组件能响应变化
    enterVR,
    enterAR,
    exitXR,
    isInSession: () => currentMode !== 'none',
    getCurrentMode: () => currentMode,
    showQuizPanel,
    hideQuizPanel,
    updateQuizPanel,
    showResultPanel,
    hideResultPanel,
    setARPlacementMode,
    confirmARPlacement,
    resetARPlacement
  };
}

/**
 * XR按钮容器组件
 */
export function XRButtonContainer({ 
  xrManager, 
  onSessionStart, 
  onSessionEnd,
  style 
}: {
  xrManager: XRManager | null;
  onSessionStart?: (mode: XRMode) => void;
  onSessionEnd?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <XRButton
      xrManager={xrManager}
      onSessionStart={onSessionStart}
      onSessionEnd={onSessionEnd}
      style={style}
    />
  );
}

