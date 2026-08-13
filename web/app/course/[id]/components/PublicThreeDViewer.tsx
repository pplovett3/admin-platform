"use client";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Spin, Alert } from 'antd';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

interface PublicThreeDViewerProps {
  coursewareData?: any;
  width?: number;
  height?: number;
  onModelLoaded?: () => void;
  onXRSessionStart?: () => void;
  onXRSessionEnd?: () => void;
}

export interface PublicThreeDViewerControls {
  focusOnNode: (nodeKey: string) => void;
  highlightNode: (nodeKey: string, highlight: boolean) => void;
  setNodeVisibility: (nodeKey: string, visible: boolean) => void;
  showAnnotations: (ids: string[], labelScale?: number) => void;
  hideAnnotations: (ids: string[]) => void;
  resetAllStates: () => void;
  startAutoRotation: () => void;
  stopAutoRotation: () => void;
  playAnimation: (animationId: string, startTime?: number, endTime?: number) => number; // 返回动画持续时间（秒）
  getAnimationDuration: (animationId: string) => number; // 获取动画持续时间但不播放
  // WebXR 支持
  getRenderer: () => THREE.WebGLRenderer | null;
  getScene: () => THREE.Scene | null;
  getCamera: () => THREE.PerspectiveCamera | null;
  getModelRoot: () => THREE.Object3D | null;
  getInteractableObjects: () => THREE.Object3D[];
}

const PublicThreeDViewer = forwardRef<PublicThreeDViewerControls, PublicThreeDViewerProps>(
  ({ coursewareData, width = 800, height = 600, onModelLoaded, onXRSessionStart, onXRSessionEnd }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const controlsRef = useRef<OrbitControls | null>(null);
    const composerRef = useRef<EffectComposer | null>(null);
    const outlineRef = useRef<OutlinePass | null>(null);
    const modelRootRef = useRef<THREE.Object3D | null>(null);
    const mixerRef = useRef<THREE.AnimationMixer | null>(null);
    const animationsRef = useRef<THREE.AnimationClip[]>([]);
    const nodeMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
    const annotationsRef = useRef<THREE.Object3D[]>([]);
    // 【已删除】MaterialBackup 类型和相关 refs（自发光高亮已废弃，使用边界框高亮）
    const boxHelperRef = useRef<THREE.BoxHelper | null>(null); // 轻量级边界框高亮
    const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
    const autoRotationRef = useRef<boolean>(false);
    const rotationSpeedRef = useRef<number>(0.0006); // 再降低速度（更慢）
    const cameraAnimationRef = useRef<any>(null);
    const backgroundTextureRef = useRef<THREE.Texture | null>(null);
    const environmentMapRef = useRef<THREE.Texture | null>(null);
    const pmremGeneratorRef = useRef<THREE.PMREMGenerator | null>(null);
    const hiddenObjectsRef = useRef<Map<string, boolean>>(new Map()); // 记录对象的初始可见性状态
    const animationFrameIdRef = useRef<number | null>(null); // 渲染循环ID
    const isXRPresentingRef = useRef<boolean>(false); // XR会话状态
    const splatViewerRef = useRef<any>(null); // 高斯泼溅查看器
    
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [webglSupported, setWebglSupported] = useState<boolean | null>(null);
    const [splatLoading, setSplatLoading] = useState(false);

    // WebGL 2 支持检测（Three.js r163+ 只支持 WebGL 2）
    const checkWebGLSupport = (): boolean => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('webgl2');
        return !!context;
      } catch (e) {
        return false;
      }
    };
    
    // 移动端检测（用于高斯模型性能优化）
    const isMobileDevice = (): boolean => {
      if (typeof window === 'undefined') return false;
      const ua = navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod|android|mobile|tablet/.test(ua);
    };
    
    // 检测是否为低端移动设备（如 iPhone X 系列）
    const isLowEndMobile = (): boolean => {
      if (typeof window === 'undefined') return false;
      const ua = navigator.userAgent.toLowerCase();
      // iPhone X/XS/XR/11 等使用 A11-A13 芯片，内存相对较少
      const isOlderIPhone = /iphone/.test(ua) && window.devicePixelRatio >= 2;
      // 检测设备内存（如果可用）
      const deviceMemory = (navigator as any).deviceMemory;
      const isLowMemory = deviceMemory && deviceMemory < 6; // 小于 6GB
      // 屏幕尺寸也可以作为参考
      const isSmallScreen = window.screen.width < 500 || window.screen.height < 900;
      return isOlderIPhone || isLowMemory || (isMobileDevice() && isSmallScreen);
    };

    // 创建渐变背景纹理
    const createGradientTexture = (): THREE.Texture => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      
      const context = canvas.getContext('2d')!;
      
      // 创建从上到下的渐变
      const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#2c2c2c');    // 顶部深灰
      gradient.addColorStop(0.4, '#4a4a4a');  // 中上浅灰
      gradient.addColorStop(0.6, '#666666');  // 中下更浅
      gradient.addColorStop(1, '#787373');    // 底部接近地面色
      
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
      
      const texture = new THREE.CanvasTexture(canvas);
      texture.mapping = THREE.EquirectangularReflectionMapping;
      
      return texture;
    };

    // 创建透明阴影接收平面 - 只显示阴影，不显示地面
    const createInvisibleShadowPlane = (scene: THREE.Scene): THREE.Mesh => {
      // 创建阴影接收平面几何体
      const shadowGeometry = new THREE.PlaneGeometry(100, 100);
      
      // 创建阴影材质 - 使用 ShadowMaterial 只显示阴影
      const shadowMaterial = new THREE.ShadowMaterial({
        opacity: 0.3,  // 阴影透明度
        color: 0x000000  // 阴影颜色（黑色）
      });
      
      const shadowPlane = new THREE.Mesh(shadowGeometry, shadowMaterial);
      
      // 旋转平面使其水平
      shadowPlane.rotation.x = -Math.PI / 2;
      shadowPlane.receiveShadow = true;  // 接收阴影
      shadowPlane.name = 'InvisibleShadowPlane';
      
      // 设置渲染顺序，确保在其他对象之前渲染
      shadowPlane.renderOrder = -1;
      
      scene.add(shadowPlane);
      return shadowPlane;
    };

    // 自动调整阴影平面位置
    const adjustShadowPlanePosition = () => {
      if (!shadowPlaneRef.current || !modelRootRef.current) return;
      
      // 计算模型的边界框
      const box = new THREE.Box3().setFromObject(modelRootRef.current);
      const minY = box.min.y;
      
      // 将阴影平面放置在模型底部稍下方
      shadowPlaneRef.current.position.set(0, minY - 0.1, 0);
    };

    const initThreeJS = () => {
      if (!containerRef.current) return;

      // 创建场景
      const scene = new THREE.Scene();
      
      // 初始背景设置为null，等待applySettings设置（避免默认渐变背景覆盖HDR背景）
      scene.background = null;
      
      sceneRef.current = scene;

      // 创建相机
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.001, 1000);
      camera.position.set(5, 5, 5);
      cameraRef.current = camera;

      // 创建渲染器
      try {
        // 步骤1：先创建 canvas 并添加到 DOM
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        containerRef.current.appendChild(canvas);
        
        // 步骤2：让 Three.js 自己创建 WebGL 2 上下文
        const renderer = new THREE.WebGLRenderer({ 
          canvas: canvas,
          antialias: false,
          alpha: true,
          powerPreference: 'default',
          preserveDrawingBuffer: true
        });
        
        renderer.setSize(width, height);
        renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // 尝试启用阴影
        try {
          renderer.shadowMap.enabled = true;
          renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        } catch (shadowError) {
          // 阴影初始化失败，继续运行
        }
        
        // 监听WebGL上下文丢失事件
        canvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          setLoadError('3D渲染上下文丢失，请刷新页面重试');
        });

        canvas.addEventListener('webglcontextrestored', () => {
          setLoadError(null);
        });
        
        rendererRef.current = renderer;
        
        // 启用WebXR支持（预配置，实际会话由XRManager控制）
        try {
          renderer.xr.enabled = true;
          renderer.xr.setReferenceSpaceType('local-floor');
          
          // 监听XR会话开始/结束
          renderer.xr.addEventListener('sessionstart', () => {
            console.log('[PublicThreeDViewer] XR Session Started!');
            isXRPresentingRef.current = true;
            
            // VR交互系统
            if (sceneRef.current && cameraRef.current && rendererRef.current) {
              const scene = sceneRef.current;
              const currentRenderer = rendererRef.current;
              const xrSession = currentRenderer.xr.getSession();
              
              // 主题色（参考网页版）
              const THEME = {
                primary: 0x3b82f6,      // 蓝色
                accent: 0xff6600,       // 橙色（高亮）
                hover: 0xffa500,        // 橙黄色（悬停）
                bg: 'rgba(15, 23, 42, 0.95)',  // 深蓝灰背景
                border: '#3b82f6',      // 蓝色边框
                text: '#ffffff',
                textMuted: '#94a3b8'
              };
              
              // ========== 控制器设置 ==========
              const controller1 = currentRenderer.xr.getController(0); // 右手
              const controller2 = currentRenderer.xr.getController(1); // 左手
              
              // 右手射线（用于选中）
              const rightRayGeom = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -5)
              ]);
              const rightRay = new THREE.Line(rightRayGeom, new THREE.LineBasicMaterial({ color: THEME.primary }));
              rightRay.name = 'VR_RIGHT_RAY';
              controller1.add(rightRay);
              
              // 左手射线（用于传送）
              const leftRayGeom = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -5)
              ]);
              const leftRay = new THREE.Line(leftRayGeom, new THREE.LineBasicMaterial({ color: THEME.primary, transparent: true, opacity: 0.8 }));
              leftRay.name = 'VR_LEFT_RAY';
              controller2.add(leftRay);
              
              // 控制器指示球
              const rightSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 16, 16),
                new THREE.MeshBasicMaterial({ color: THEME.primary })
              );
              controller1.add(rightSphere);
              
              const leftSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 16, 16),
                new THREE.MeshBasicMaterial({ color: THEME.primary })
              );
              controller2.add(leftSphere);
              
              controller1.name = 'VR_CONTROLLER_RIGHT';
              controller2.name = 'VR_CONTROLLER_LEFT';
              scene.add(controller1);
              scene.add(controller2);
              
              // ========== 存储 InputSource 引用 ==========
              let rightInputSource: XRInputSource | null = null;
              let leftInputSource: XRInputSource | null = null;
              
              // 监听控制器连接事件获取 inputSource
              controller1.addEventListener('connected', (event: any) => {
                const inputSource = event.data as XRInputSource;
                console.log('[VR] Controller 1 connected:', inputSource.handedness, inputSource.gamepad);
                controller1.userData.inputSource = inputSource;
                if (inputSource.handedness === 'right') {
                  rightInputSource = inputSource;
                } else if (inputSource.handedness === 'left') {
                  leftInputSource = inputSource;
                }
              });
              controller1.addEventListener('disconnected', () => {
                console.log('[VR] Controller 1 disconnected');
                controller1.userData.inputSource = null;
                rightInputSource = null;
              });
              
              controller2.addEventListener('connected', (event: any) => {
                const inputSource = event.data as XRInputSource;
                console.log('[VR] Controller 2 connected:', inputSource.handedness, inputSource.gamepad);
                controller2.userData.inputSource = inputSource;
                if (inputSource.handedness === 'right') {
                  rightInputSource = inputSource;
                } else if (inputSource.handedness === 'left') {
                  leftInputSource = inputSource;
                }
              });
              controller2.addEventListener('disconnected', () => {
                console.log('[VR] Controller 2 disconnected');
                controller2.userData.inputSource = null;
                leftInputSource = null;
              });
              
              // ========== 贝塞尔曲线传送射线 ==========
              const curveSegments = 30;
              const curveGeometry = new THREE.BufferGeometry();
              const curveVertices = new Float32Array(curveSegments * 3);
              curveGeometry.setAttribute('position', new THREE.BufferAttribute(curveVertices, 3));
              const curveMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
              const teleportCurve = new THREE.Line(curveGeometry, curveMaterial);
              teleportCurve.visible = false;
              teleportCurve.frustumCulled = false; // 防止视锥剔除导致的闪烁
              scene.add(teleportCurve);

              // 辅助向量
              const _p = new THREE.Vector3();
              const _v = new THREE.Vector3();
              const _g = new THREE.Vector3(0, -9.8, 0); // 重力
              const _tempTarget = new THREE.Vector3();
              const _floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // 地面平面 y=0

              // 更新贝塞尔曲线和传送点
              const updateTeleportCurve = (controller: THREE.Group) => {
                // 强制更新控制器矩阵，确保位置是最新的
                controller.updateMatrixWorld(true);
                const startPos = controller.getWorldPosition(new THREE.Vector3());
                const dir = controller.getWorldDirection(new THREE.Vector3()).negate();
                
                // 方法1: 抛物线视觉效果
                _v.copy(dir).multiplyScalar(8); // 降低速度，让弧度更明显
                _p.copy(startPos);

                let hitGround = false;
                let hitPoint = new THREE.Vector3();
                const positions = teleportCurve.geometry.attributes.position.array as Float32Array;
                
                // 计算抛物线顶点
                for (let i = 0; i < curveSegments; i++) {
                  positions[i * 3] = _p.x;
                  positions[i * 3 + 1] = _p.y;
                  positions[i * 3 + 2] = _p.z;

                  _v.addScaledVector(_g, 0.015); // 增加重力步长
                  _p.addScaledVector(_v, 0.015);

                  if (!hitGround && _p.y <= 0) {
                     hitGround = true;
                     // 简单插值计算交点
                     const prevY = positions[i * 3 + 1];
                     const t = prevY / (prevY - _p.y);
                     hitPoint.set(
                       positions[i * 3] + (_p.x - positions[i * 3]) * t,
                       0,
                       positions[i * 3 + 2] + (_p.z - positions[i * 3 + 2]) * t
                     );
                     // 将后续点都拉到地面，形成落地效果
                     for (let j = i; j < curveSegments; j++) {
                        positions[j * 3] = hitPoint.x;
                        positions[j * 3 + 1] = 0;
                        positions[j * 3 + 2] = hitPoint.z;
                     }
                     break;
                  }
                }
                (teleportCurve.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
                teleportCurve.visible = true;

                // 方法2: 射线检测作为逻辑备份 (确保一定能传送到地面)
                let finalTarget: THREE.Vector3 | null = null;

                if (hitGround) {
                  finalTarget = hitPoint;
                } else {
                  // 几何计算: 强制投射到 y=0 平面
                  if (dir.y < -0.1) { // 只要稍微向下
                     const t = -startPos.y / dir.y;
                     if (t > 0 && t < 20) { // 距离限制
                        finalTarget = startPos.clone().add(dir.clone().multiplyScalar(t));
                     }
                  }
                  
                  if (!finalTarget) {
                     // Raycaster 检测
                     raycaster.ray.origin.copy(startPos);
                     raycaster.ray.direction.copy(dir);
                     const intersectPoint = new THREE.Vector3();
                     const intersect = raycaster.ray.intersectPlane(_floorPlane, intersectPoint);
                     if (intersect && intersectPoint.distanceTo(startPos) < 20) {
                        finalTarget = intersectPoint;
                     }
                  }
                }

                if (finalTarget) {
                  teleportIndicator.position.copy(finalTarget);
                  teleportIndicator.visible = true;
                  return finalTarget;
                } else {
                  // 强制显示逻辑 (Fallback): 如果都没检测到，显示在前方1.5米处 (跟随手柄方向)
                  // 将手柄方向投影到水平面
                  const flatDir = new THREE.Vector3(dir.x, 0, dir.z).normalize();
                  const forwardPoint = startPos.clone().add(flatDir.multiplyScalar(1.5));
                  forwardPoint.y = 0; // 强制地面
                  
                  teleportIndicator.position.copy(forwardPoint);
                  teleportIndicator.visible = true;
                  return forwardPoint;
                }
              };
              
              // 创建名称标签
              const createNameLabel = (text: string, position: THREE.Vector3) => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = 512;
                canvas.height = 128;
                
                // 背景
                ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                ctx.strokeStyle = '#ff6600';
                ctx.lineWidth = 4;
                
                // 圆角矩形
                const x=4, y=4, w=504, h=120, r=20;
                ctx.beginPath();
                ctx.moveTo(x+r, y);
                ctx.arcTo(x+w, y, x+w, y+h, r);
                ctx.arcTo(x+w, y+h, x, y+h, r);
                ctx.arcTo(x, y+h, x, y, r);
                ctx.arcTo(x, y, x+w, y, r);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = 'white';
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(text, 256, 64);
                
                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
                const sprite = new THREE.Sprite(material);
                sprite.scale.set(0.5, 0.125, 1);
                sprite.position.copy(position).add(new THREE.Vector3(0, 0.3, 0));
                sprite.name = 'VR_NAME_LABEL';
                sprite.renderOrder = 999; // 确保在最前面
                return sprite;
              };

              // ========== 通用交互处理函数 ==========
              const handleTriggerStart = (controller: THREE.Group, isC1: boolean) => {
                if (isC1) buttonState.rightTrigger = true;
                else buttonState.leftTrigger = true;

                // 双手缩放检测
                if (buttonState.rightTrigger && buttonState.leftTrigger) {
                  console.log('[VR] 双手触发 -> 进入缩放模式');
                  isScaling = true;
                  teleportActive = false;
                  teleportCurve.visible = false;
                  teleportIndicator.visible = false;
                  
                  // 恢复两只手的射线颜色
                  (rightRay.material as THREE.LineBasicMaterial).color.setHex(THEME.primary);
                  (leftRay.material as THREE.LineBasicMaterial).color.setHex(THEME.primary);
                  
                  if (modelRootRef.current) {
                    initialPinchDistance = getPinchDistance();
                    initialModelScale.copy(modelRootRef.current.scale);
                  }
                  return;
                }

                // ========== 1. 优先检测模型树面板点击 ==========
                if (modelTreeVisible && modelTreePanel) {
                  tempMatrix.identity().extractRotation(controller.matrixWorld);
                  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
                  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
                  
                  const panelHits = raycaster.intersectObject(modelTreePanel);
                  if (panelHits.length > 0 && panelHits[0].uv) {
                    const clickX = panelHits[0].uv.x * 512;  // canvas 宽度
                    const clickY = (1 - panelHits[0].uv.y) * 700; // canvas 高度
                    console.log('[VR] 面板点击 X:', clickX.toFixed(0), 'Y:', clickY.toFixed(0));
                    
                    // 检查滚动按钮 (右侧 462-502 区域)
                    if (clickX >= 462 && clickX <= 502) {
                      // 上滚动按钮 (Y: 60-120)
                      if (clickY >= 60 && clickY <= 120 && treeScrollOffset > 0) {
                        treeScrollOffset = Math.max(0, treeScrollOffset - 5);
                        renderModelTree();
                        console.log('[VR] 向上滚动, offset:', treeScrollOffset);
                        return;
                      }
                      // 下滚动按钮 (Y: 620-680)
                      if (clickY >= 620 && clickY <= 680 && treeScrollOffset < treeItems.length - maxVisibleItems) {
                        treeScrollOffset = Math.min(treeItems.length - maxVisibleItems, treeScrollOffset + 5);
                        renderModelTree();
                        console.log('[VR] 向下滚动, offset:', treeScrollOffset);
                        return;
                      }
                    }
                    
                    // 检查列表项目点击 (左侧区域)
                    if (clickX < 462) {
                      const visibleItems = treeItems.slice(treeScrollOffset, treeScrollOffset + maxVisibleItems);
                      const itemH = 28;
                      const startY = 60;
                      
                      for (let i = 0; i < visibleItems.length; i++) {
                        const item = visibleItems[i];
                        const itemY = startY + i * itemH;
                        
                        if (clickY >= itemY - 4 && clickY <= itemY + itemH) {
                          // 选中这个模型对象
                          removeHighlight(selectedObject, 'VR_SELECT_HIGHLIGHT');
                          const oldLabel = scene.getObjectByName('VR_NAME_LABEL');
                          if (oldLabel) oldLabel.parent?.remove(oldLabel);
                          
                          selectedObject = item.object;
                          addOutlineHighlight(selectedObject, THEME.accent, 'VR_SELECT_HIGHLIGHT');
                          
                          // 添加标签
                          const box = new THREE.Box3().setFromObject(item.object);
                          const center = box.getCenter(new THREE.Vector3());
                          center.y = box.max.y;
                          const label = createNameLabel(item.name || '未命名对象', center);
                          scene.add(label);
                          
                          renderModelTree();
                          console.log('[VR] 从面板选中:', item.name, '(index:', treeScrollOffset + i, ')');
                          break;
                        }
                      }
                    }
                    // 面板被点击，不进入传送模式
                    return;
                  }
                }
                
                // ========== 2. 检测是否击中 3D 模型 ==========
                const intersected = getIntersected(controller);
                if (intersected) {
                  // 击中物体 -> 选中模式
                  console.log('[VR] 击中物体 -> 选中:', intersected.name);
                  removeHighlight(selectedObject, 'VR_SELECT_HIGHLIGHT');
                  const oldLabel = scene.getObjectByName('VR_NAME_LABEL');
                  if (oldLabel) oldLabel.parent?.remove(oldLabel);
                  
                  selectedObject = intersected;
                  addOutlineHighlight(selectedObject, THEME.accent, 'VR_SELECT_HIGHLIGHT');
                  
                  // 添加新标签
                  const box = new THREE.Box3().setFromObject(intersected);
                  const center = box.getCenter(new THREE.Vector3());
                  center.y = box.max.y;
                  const label = createNameLabel(intersected.name || '未命名对象', center);
                  scene.add(label);
                  
                  renderModelTree();
                  
                  const ray = isC1 ? rightRay : leftRay;
                  (ray.material as THREE.LineBasicMaterial).color.setHex(THEME.accent);
                  return;
                }
                
                // ========== 3. 未击中任何物体 -> 传送模式 ==========
                // 面板打开时禁止传送
                if (modelTreeVisible) {
                  console.log('[VR] 面板打开，禁止传送');
                  return;
                }
                
                console.log('[VR] 进入传送瞄准模式');
                teleportActive = true;
                teleportController = controller;
                
                // 射线变紫，表示传送模式
                const ray = isC1 ? rightRay : leftRay;
                (ray.material as THREE.LineBasicMaterial).color.setHex(0xaa00ff);
                
                // 立即更新一次传送曲线
                updateTeleportCurve(controller);
              };

              const handleTriggerEnd = (controller: THREE.Group, isC1: boolean) => {
                if (isC1) buttonState.rightTrigger = false;
                else buttonState.leftTrigger = false;

                // 恢复射线显示
                const ray = isC1 ? rightRay : leftRay;
                ray.visible = true;
                (ray.material as THREE.LineBasicMaterial).color.setHex(THEME.primary);

                // 缩放结束检测
                if (isScaling) {
                   if (!buttonState.rightTrigger && !buttonState.leftTrigger) {
                     isScaling = false;
                     console.log('[VR] 缩放结束');
                   }
                   // 如果松开了一只手，保持 isScaling 为 true 直到两只手都松开? 
                   // 或者松开一只手就退出缩放? 现在的逻辑是松开任一就退出
                   if (!buttonState.rightTrigger || !buttonState.leftTrigger) {
                     isScaling = false;
                   }
                   return;
                }

                // 传送执行
                if (teleportActive && teleportController === controller) {
                   if (teleportIndicator.visible) {
                      console.log('[VR] 执行传送');
                      const target = teleportIndicator.position;
                      
                      // 相对移动算法 (无需维护 accumulatedOffset)
                      if (cameraRef.current) {
                        const camera = cameraRef.current;
                        // 计算位移向量: 目标点 - 当前相机位置 (忽略高度)
                        const offsetX = target.x - camera.position.x;
                        const offsetZ = target.z - camera.position.z;
                        
                        const currentRefSpace = currentRenderer.xr.getReferenceSpace();
                        if (currentRefSpace) {
                           // 这里的 transform 是 ReferenceSpace 的逆变换
                           // 如果我们要让相机移动 (+x, +z)，我们需要把 ReferenceSpace 移动 (-x, -z)
                           // 注意：WebXR 坐标系方向可能需要微调，通常是取反
                           const transform = new XRRigidTransform({ 
                             x: -offsetX, 
                             y: 0, 
                             z: -offsetZ, 
                             w: 1 
                           });
                           const newSpace = currentRefSpace.getOffsetReferenceSpace(transform);
                           currentRenderer.xr.setReferenceSpace(newSpace);
                           
                           // 维护累积偏移，用于位置重置
                           accumulatedOffset.x += offsetX;
                           accumulatedOffset.z += offsetZ;
                        }
                      }
                   }
                   teleportActive = false;
                   teleportCurve.visible = false;
                   teleportIndicator.visible = false;
                   teleportController = null;
                }
              };

              let teleportController: THREE.Group | null = null;

              // ========== 绑定事件 (对称逻辑) ==========
              // C1 (可能是右手也可能是左手)
              controller1.addEventListener('selectstart', () => handleTriggerStart(controller1, true));
              controller1.addEventListener('selectend', () => handleTriggerEnd(controller1, true));
              controller1.addEventListener('squeezestart', () => toggleModelTree());

              // C2 (可能是左手也可能是右手)
              controller2.addEventListener('selectstart', () => handleTriggerStart(controller2, false));
              controller2.addEventListener('selectend', () => handleTriggerEnd(controller2, false));
              controller2.addEventListener('squeezestart', () => toggleModelTree());

              
              // ========== 传送系统 ==========
              const teleportIndicator = new THREE.Group();
              const ringGeom = new THREE.RingGeometry(0.25, 0.35, 32);
              const ringMat = new THREE.MeshBasicMaterial({ color: THEME.primary, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
              const ring = new THREE.Mesh(ringGeom, ringMat);
              ring.rotation.x = -Math.PI / 2;
              teleportIndicator.add(ring);
              
              const centerGeom = new THREE.CircleGeometry(0.1, 16);
              const centerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
              const center = new THREE.Mesh(centerGeom, centerMat);
              center.rotation.x = -Math.PI / 2;
              center.position.y = 0.01;
              teleportIndicator.add(center);
              
              teleportIndicator.visible = false;
              teleportIndicator.name = 'VR_TELEPORT_INDICATOR';
              scene.add(teleportIndicator);
              
              // 隐形地板（用于传送检测）
              const teleportFloor = new THREE.Mesh(
                new THREE.PlaneGeometry(100, 100),
                new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
              );
              teleportFloor.rotation.x = -Math.PI / 2;
              teleportFloor.position.y = 0;
              teleportFloor.name = 'VR_TELEPORT_FLOOR';
              scene.add(teleportFloor);
              
              // ========== 选中标签 ==========
              let selectionLabel: THREE.Sprite | null = null;
              const updateSelectionLabel = (obj: THREE.Object3D | null) => {
                // 移除旧标签
                if (selectionLabel) {
                  scene.remove(selectionLabel);
                  selectionLabel = null;
                }
                
                if (!obj) return;
                
                // 创建新标签
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d')!;
                canvas.width = 512;
                canvas.height = 128;
                
                // 背景
                context.fillStyle = 'rgba(15, 23, 42, 0.9)';
                context.fillRect(0, 0, 512, 128);
                // 边框
                context.strokeStyle = '#f97316'; // Orange-500
                context.lineWidth = 8;
                context.strokeRect(4, 4, 504, 120);
                // 文字
                context.fillStyle = '#ffffff';
                context.font = 'bold 48px monospace';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(obj.name || '未命名对象', 256, 64);
                
                const texture = new THREE.CanvasTexture(canvas);
                const material = new THREE.SpriteMaterial({ map: texture, depthTest: false, depthWrite: false });
                selectionLabel = new THREE.Sprite(material);
                selectionLabel.scale.set(0.5, 0.125, 1);
                selectionLabel.name = 'VR_SELECTION_LABEL';
                selectionLabel.renderOrder = 999; // 确保在最上层
                
                // 计算位置：包围盒上方
                const box = new THREE.Box3().setFromObject(obj);
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                selectionLabel.position.copy(center);
                selectionLabel.position.y += size.y / 2 + 0.2;
                
                scene.add(selectionLabel);
              };

              // ========== 按钮状态追踪 ==========
              // Pico 4 按钮映射:
              // buttons[0] = Trigger
              // buttons[1] = Grip/Squeeze  
              // buttons[3] = Thumbstick press
              // buttons[4] = A/X 按钮
              // buttons[5] = B/Y 按钮
              const buttonState = {
                rightTrigger: false, rightGrip: false, rightA: false, rightB: false, rightStick: false,
                leftTrigger: false, leftGrip: false, leftX: false, leftY: false, leftStick: false,
                leftStickX: 0, leftStickY: 0,
                rightStickX: 0, rightStickY: 0
              };
              const prevButtonState = { ...buttonState };
              let lastSnapTurnTime = 0; // 防止连续转向
              
              // ========== 状态变量 ==========
              let selectedObject: THREE.Object3D | null = null;
              let hoveredObject: THREE.Object3D | null = null;
              let modelTreeVisible = false;
              let modelTreePanel: THREE.Mesh | null = null;
              let modelTreeCanvas: HTMLCanvasElement | null = null;
              let modelTreeTexture: THREE.CanvasTexture | null = null;
              let treeItems: { name: string; depth: number; object: THREE.Object3D; y: number }[] = [];
              let treeScrollOffset = 0;
              const maxVisibleItems = 20;
              
              // 缩放状态
              let isScaling = false;
              let initialPinchDistance = 0;
              let initialModelScale = new THREE.Vector3(1, 1, 1);
              
              // 传送状态
              let teleportActive = false;
              let accumulatedOffset = new THREE.Vector3(0, 0, 0);
              
              // ========== 射线检测 ==========
              const raycaster = new THREE.Raycaster();
              const tempMatrix = new THREE.Matrix4();
              
              const addOutlineHighlight = (obj: THREE.Object3D | null, color: number, namePrefix: string) => {
                if (!obj) return;
                obj.traverse((child) => {
                  if (child instanceof THREE.Mesh && !child.name.startsWith('VR_')) {
                    const edges = new THREE.EdgesGeometry(child.geometry, 15);
                    const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 });
                    const wireframe = new THREE.LineSegments(edges, lineMat);
                    wireframe.name = namePrefix;
                    wireframe.scale.setScalar(1.002);
                    child.add(wireframe);
                  }
                });
              };
              
              const removeHighlight = (obj: THREE.Object3D | null, namePrefix: string) => {
                if (!obj) return;
                const toRemove: THREE.Object3D[] = [];
                obj.traverse((child) => { if (child.name === namePrefix) toRemove.push(child); });
                toRemove.forEach(c => c.parent?.remove(c));
              };
              
              const getIntersected = (ctrl: THREE.Group): THREE.Object3D | null => {
                tempMatrix.identity().extractRotation(ctrl.matrixWorld);
                raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
                raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
                if (!modelRootRef.current) return null;
                const intersects = raycaster.intersectObject(modelRootRef.current, true);
                if (intersects.length > 0) {
                  let obj: THREE.Object3D | null = intersects[0].object;
                  while (obj && !obj.name && obj.parent && obj.parent !== scene) obj = obj.parent;
                  return obj;
                }
                return null;
              };
              
              const getTeleportTarget = (ctrl: THREE.Group): THREE.Vector3 | null => {
                tempMatrix.identity().extractRotation(ctrl.matrixWorld);
                raycaster.ray.origin.setFromMatrixPosition(ctrl.matrixWorld);
                raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
                const intersects = raycaster.intersectObject(teleportFloor);
                return intersects.length > 0 ? intersects[0].point : null;
              };
              
              const getPinchDistance = () => {
                const pos1 = new THREE.Vector3();
                const pos2 = new THREE.Vector3();
                controller1.getWorldPosition(pos1);
                controller2.getWorldPosition(pos2);
                return pos1.distanceTo(pos2);
              };
              
              // ========== 模型树 ==========
              const buildTreeData = () => {
                treeItems = [];
                if (!modelRootRef.current) return;
                const traverse = (obj: THREE.Object3D, depth: number) => {
                  if (obj.name.startsWith('VR_') || obj.name.startsWith('XR_')) return;
                  let displayName = obj.name;
                  if (!displayName) {
                    if (obj instanceof THREE.Mesh) displayName = `[Mesh_${treeItems.length}]`;
                    else if (obj instanceof THREE.Group) displayName = `[Group_${treeItems.length}]`;
                    else if (obj.children.length > 0) displayName = `[Node_${treeItems.length}]`;
                    else return;
                  }
                  treeItems.push({ name: displayName, depth, object: obj, y: 0 });
                  if (depth < 8) obj.children.forEach(child => traverse(child, depth + 1));
                };
                traverse(modelRootRef.current, 0);
                if (treeItems.length > 100) treeItems = treeItems.slice(0, 100);
              };
              
              const renderModelTree = () => {
                if (!modelTreeCanvas) return;
                const ctx = modelTreeCanvas.getContext('2d')!;
                const w = 512, h = 700;
                ctx.fillStyle = THEME.bg;
                ctx.fillRect(0, 0, w, h);
                ctx.strokeStyle = THEME.border;
                ctx.lineWidth = 3;
                ctx.strokeRect(3, 3, w - 6, h - 6);
                ctx.fillStyle = THEME.text;
                ctx.font = 'bold 22px Arial';
                ctx.fillText('📋 模型树 (' + treeItems.length + ')', 20, 38);
                
                const itemH = 28;
                const startY = 60;
                ctx.font = '14px monospace';
                const visible = treeItems.slice(treeScrollOffset, treeScrollOffset + maxVisibleItems);
                visible.forEach((item, i) => {
                  const y = startY + i * itemH;
                  item.y = y;
                  const indent = Math.min(item.depth * 8, 60) + 15;
                  if (selectedObject && item.object === selectedObject) {
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
                    ctx.fillRect(10, y - 4, w - 20, itemH - 2);
                    ctx.fillStyle = '#ff6600';
                  } else {
                    ctx.fillStyle = item.object.visible ? THEME.text : THEME.textMuted;
                  }
                  const prefix = item.depth > 0 ? '·'.repeat(Math.min(item.depth, 4)) + ' ' : '● ';
                  const displayName = item.name.length > 28 ? item.name.substring(0, 25) + '...' : item.name;
                  ctx.fillText(prefix + displayName, indent, y + 12);
                });
                
                // 滚动按钮区域 (右侧)
                if (treeItems.length > maxVisibleItems) {
                  // 上滚动按钮
                  ctx.fillStyle = treeScrollOffset > 0 ? THEME.border : THEME.textMuted;
                  ctx.fillRect(w - 50, 60, 40, 60);
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 24px Arial';
                  ctx.fillText('▲', w - 40, 100);
                  
                  // 下滚动按钮
                  ctx.fillStyle = treeScrollOffset < treeItems.length - maxVisibleItems ? THEME.border : THEME.textMuted;
                  ctx.fillRect(w - 50, h - 80, 40, 60);
                  ctx.fillStyle = '#ffffff';
                  ctx.fillText('▼', w - 40, h - 40);
                  
                  // 页码显示
                  ctx.fillStyle = THEME.textMuted;
                  ctx.font = '11px Arial';
                  ctx.fillText(`${treeScrollOffset + 1}-${Math.min(treeScrollOffset + maxVisibleItems, treeItems.length)} / ${treeItems.length}`, 20, h - 15);
                }
                if (modelTreeTexture) modelTreeTexture.needsUpdate = true;
              };
              
              const createModelTreePanel = () => {
                modelTreeCanvas = document.createElement('canvas');
                modelTreeCanvas.width = 512;
                modelTreeCanvas.height = 700;
                buildTreeData();
                modelTreeTexture = new THREE.CanvasTexture(modelTreeCanvas);
                modelTreePanel = new THREE.Mesh(
                  new THREE.PlaneGeometry(0.8, 1.1),
                  new THREE.MeshBasicMaterial({ map: modelTreeTexture, transparent: true, side: THREE.DoubleSide })
                );
                modelTreePanel.position.set(-1.0, 1.3, -1.2);
                modelTreePanel.rotation.y = 0.25;
                modelTreePanel.name = 'VR_MODEL_TREE';
                modelTreePanel.visible = false;
                scene.add(modelTreePanel);
                renderModelTree();
              };
              createModelTreePanel();
              
              // 切换模型树显示（跟随相机）
              const toggleModelTree = () => {
                if (!modelTreePanel) createModelTreePanel();
                
                modelTreeVisible = !modelTreeVisible;
                if (modelTreePanel) {
                  modelTreePanel.visible = modelTreeVisible;
                  if (modelTreeVisible) {
                    // 每次打开时重新构建数据
                    buildTreeData();
                    treeScrollOffset = 0;
                    renderModelTree();
                    
                    if (cameraRef.current) {
                      const camera = cameraRef.current;
                      // 计算面前位置 (忽略 pitch)
                      const forward = new THREE.Vector3(0, 0, -1);
                      forward.applyQuaternion(camera.quaternion);
                      forward.y = 0;
                      forward.normalize();
                      
                      const targetPos = camera.position.clone().add(forward.multiplyScalar(0.8));
                      modelTreePanel.position.copy(targetPos);
                      modelTreePanel.lookAt(camera.position.x, modelTreePanel.position.y, camera.position.z);
                    }
                    console.log('[VR] Model tree: ON, items:', treeItems.length);
                  } else {
                    console.log('[VR] Model tree: OFF');
                  }
                }
              };
              
              // ========== 帮助面板 ==========
              const helpCanvas = document.createElement('canvas');
              helpCanvas.width = 500;
              helpCanvas.height = 380;
              const hctx = helpCanvas.getContext('2d')!;
              hctx.fillStyle = THEME.bg;
              hctx.fillRect(0, 0, 500, 380);
              hctx.strokeStyle = THEME.border;
              hctx.lineWidth = 2;
              hctx.strokeRect(3, 3, 494, 374);
              hctx.fillStyle = THEME.text;
              hctx.font = 'bold 24px Arial';
              hctx.fillText('VR 操作说明', 20, 38);
              hctx.font = '16px Arial';
              hctx.fillStyle = '#60a5fa';
              hctx.fillText('右手 Trigger → 选中模型部件', 20, 80);
              hctx.fillStyle = '#a78bfa';
              hctx.fillText('右手 A键 → 显示/隐藏模型树', 20, 110);
              hctx.fillStyle = '#34d399';
              hctx.fillText('右手 B键 → 开始/结束缩放模式', 20, 140);
              hctx.fillStyle = '#fbbf24';
              hctx.fillText('左手 Trigger → 瞄准传送位置', 20, 180);
              hctx.fillStyle = '#f472b6';
              hctx.fillText('左手 X键 → 确认传送', 20, 210);
              hctx.fillStyle = '#fb923c';
              hctx.fillText('左手 Y键 → 重置位置', 20, 240);
              hctx.fillStyle = '#94a3b8';
              hctx.fillText('左手摇杆上下 → 滚动模型树', 20, 280);
              hctx.fillText('缩放模式下移动双手 → 放大/缩小', 20, 310);
              hctx.fillStyle = '#64748b';
              hctx.font = '13px Arial';
              hctx.fillText('橙色边框 = 选中  |  黄色边框 = 悬停', 20, 355);
              
              const helpTexture = new THREE.CanvasTexture(helpCanvas);
              const helpPanel = new THREE.Mesh(
                new THREE.PlaneGeometry(1.0, 0.76),
                new THREE.MeshBasicMaterial({ map: helpTexture, transparent: true, side: THREE.DoubleSide })
              );
              helpPanel.position.set(0, 2.0, -2.5);
              helpPanel.name = 'VR_HELP_PANEL';
              scene.add(helpPanel);
              
              // ========== 调试面板已隐藏（生产环境不显示）==========
              // VR调试面板已移除以提升性能
              
              // ========== Gamepad轮询函数 (仅作为补充) ==========
              const pollGamepadState = () => {
                const session = currentRenderer.xr.getSession();
                if (!session) return;
                
                // 只有当确实有 gamepad 数据时才更新状态
                for (const source of session.inputSources) {
                  if (!source.gamepad) continue;
                  
                  const gp = source.gamepad;
                  
                  if (source.handedness === 'right') {
                    // 只读取 A/B 键和摇杆，Trigger/Grip 由事件驱动 (作为 fallback)
                    if (gp.buttons[0]?.pressed) buttonState.rightTrigger = true;
                    if (gp.buttons[1]?.pressed) buttonState.rightGrip = true;
                    buttonState.rightStick = gp.buttons[3]?.pressed || false;
                    buttonState.rightA = gp.buttons[4]?.pressed || false;
                    buttonState.rightB = gp.buttons[5]?.pressed || false;
                  } else if (source.handedness === 'left') {
                    // Trigger/Grip fallback
                    if (gp.buttons[0]?.pressed) buttonState.leftTrigger = true;
                    if (gp.buttons[1]?.pressed) buttonState.leftGrip = true;
                    buttonState.leftStick = gp.buttons[3]?.pressed || false;
                    buttonState.leftX = gp.buttons[4]?.pressed || false;
                    buttonState.leftY = gp.buttons[5]?.pressed || false;
                    buttonState.leftStickX = gp.axes[2] || 0;
                    buttonState.leftStickY = gp.axes[3] || 0;
                  }
                  
                  // 右手摇杆也读取（用于转向）
                  if (source.handedness === 'right' && gp.axes.length >= 4) {
                    buttonState.rightStickX = gp.axes[2] || 0;
                    buttonState.rightStickY = gp.axes[3] || 0;
                  }
                }
              };
              
              // 检测按钮按下（边沿检测）
              const wasJustPressed = (key: keyof typeof buttonState) => {
                return buttonState[key] && !prevButtonState[key];
              };
              
              // ========== 主循环 ==========
              const vrUpdateLoop = () => {
                if (!isXRPresentingRef.current) return;
                
                // 保存上一帧状态
                Object.assign(prevButtonState, buttonState);
                
                // 尝试从 Gamepad API 更新额外按钮 (A/B/X/Y/Stick)
                pollGamepadState();
                
                // === 右手 A键: 切换模型树 (备用) ===
                if (wasJustPressed('rightA')) {
                  toggleModelTree();
                }
                
                // === 右手 B键: 重置位置 (新增) ===
                if (wasJustPressed('rightB')) {
                   accumulatedOffset.set(0, 0, 0);
                   if (modelRootRef.current) modelRootRef.current.scale.set(1, 1, 1);
                   const baseRefSpace = currentRenderer.xr.getReferenceSpace();
                   if (baseRefSpace) {
                     const transform = new XRRigidTransform({ x: 0, y: 0, z: 0, w: 1 });
                     const newSpace = baseRefSpace.getOffsetReferenceSpace(transform);
                     currentRenderer.xr.setReferenceSpace(newSpace);
                   }
                }

                // === 摇杆转向 (Snap Turn) ===
                const now = performance.now();
                const stickX = buttonState.rightStickX || buttonState.leftStickX; // 任意一个摇杆
                if (Math.abs(stickX) > 0.7 && now - lastSnapTurnTime > 300) { // 300ms 冷却
                  lastSnapTurnTime = now;
                  const turnAngle = stickX > 0 ? -Math.PI / 2 : Math.PI / 2; // 左推转右，右推转左
                  
                  const currentRefSpace = currentRenderer.xr.getReferenceSpace();
                  if (currentRefSpace && cameraRef.current) {
                    // 创建绕 Y 轴旋转的变换
                    const cos = Math.cos(turnAngle);
                    const sin = Math.sin(turnAngle);
                    // XRRigidTransform 的 orientation 是四元数 [x, y, z, w]
                    // 绕 Y 轴旋转 θ: [0, sin(θ/2), 0, cos(θ/2)]
                    const halfAngle = turnAngle / 2;
                    const transform = new XRRigidTransform(
                      { x: 0, y: 0, z: 0, w: 1 },
                      { x: 0, y: Math.sin(halfAngle), z: 0, w: Math.cos(halfAngle) }
                    );
                    const newSpace = currentRefSpace.getOffsetReferenceSpace(transform);
                    currentRenderer.xr.setReferenceSpace(newSpace);
                    console.log('[VR] Snap turn:', stickX > 0 ? '右转90°' : '左转90°');
                  }
                }
                
                // === 传送射线更新 (基于 teleportActive 标志) ===
                // teleportActive 在 handleTriggerStart 中设置为 true (当未击中物体时)
                // 在 handleTriggerEnd 中设置为 false
                if (teleportActive && teleportController && !isScaling && !modelTreeVisible) {
                  // 更新传送曲线和光圈
                  teleportController.updateMatrixWorld(true);
                  
                  const startPos = teleportController.getWorldPosition(new THREE.Vector3());
                  const dir = teleportController.getWorldDirection(new THREE.Vector3()).negate();
                  
                  // 计算抛物线
                  const tempP = startPos.clone();
                  const tempV = dir.clone().multiplyScalar(8);
                  const grav = new THREE.Vector3(0, -9.8, 0);
                  const positions = teleportCurve.geometry.attributes.position.array as Float32Array;
                  
                  let hitGround = false;
                  let hitPoint = new THREE.Vector3();
                  
                  for (let i = 0; i < curveSegments; i++) {
                    positions[i * 3] = tempP.x;
                    positions[i * 3 + 1] = tempP.y;
                    positions[i * 3 + 2] = tempP.z;
                    
                    tempV.addScaledVector(grav, 0.015);
                    tempP.addScaledVector(tempV, 0.015);
                    
                    if (!hitGround && tempP.y <= 0) {
                      hitGround = true;
                      const prevY = positions[i * 3 + 1];
                      const t = prevY / (prevY - tempP.y);
                      hitPoint.set(
                        positions[i * 3] + (tempP.x - positions[i * 3]) * t,
                        0,
                        positions[i * 3 + 2] + (tempP.z - positions[i * 3 + 2]) * t
                      );
                      for (let j = i; j < curveSegments; j++) {
                        positions[j * 3] = hitPoint.x;
                        positions[j * 3 + 1] = 0;
                        positions[j * 3 + 2] = hitPoint.z;
                      }
                      break;
                    }
                  }
                  
                  (teleportCurve.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
                  teleportCurve.visible = true;
                  
                  // 设置光圈位置
                  if (hitGround) {
                    teleportIndicator.position.copy(hitPoint);
                    teleportIndicator.visible = true;
                  } else if (dir.y < -0.1) {
                    const t = -startPos.y / dir.y;
                    if (t > 0 && t < 20) {
                      const target = startPos.clone().add(dir.clone().multiplyScalar(t));
                      target.y = 0;
                      teleportIndicator.position.copy(target);
                      teleportIndicator.visible = true;
                    }
                  } else {
                    const flatDir = new THREE.Vector3(dir.x, 0, dir.z).normalize();
                    const target = startPos.clone().add(flatDir.multiplyScalar(1.5));
                    target.y = 0;
                    teleportIndicator.position.copy(target);
                    teleportIndicator.visible = true;
                  }
                }
                
                // === 缩放模式 ===
                if (isScaling && modelRootRef.current && initialPinchDistance > 0) {
                  const currentDist = getPinchDistance();
                  const scaleFactor = currentDist / initialPinchDistance;
                  modelRootRef.current.scale.copy(initialModelScale).multiplyScalar(scaleFactor);
                  modelRootRef.current.scale.clampScalar(0.1, 10);
                }
                
                // === 模型树滚动 (左手摇杆) ===
                if (modelTreeVisible && Math.abs(buttonState.leftStickY) > 0.5) {
                  const scrollSpeed = buttonState.leftStickY > 0 ? 1 : -1;
                  treeScrollOffset = Math.max(0, Math.min(treeItems.length - maxVisibleItems, treeScrollOffset + scrollSpeed));
                  renderModelTree();
                }
                
                // === 悬停高亮 (使用 C1/C2 中激活射线的那个) ===
                // 简单起见，两只手都做悬停检测? 还是只检测没在传送的那只手?
                // 这里简单处理，两只手都可以高亮
                const c1Hover = getIntersected(controller1);
                const c2Hover = getIntersected(controller2);
                const newHovered = c1Hover || c2Hover;
                
                if (newHovered !== hoveredObject) {
                  removeHighlight(hoveredObject, 'VR_HOVER_HIGHLIGHT');
                  hoveredObject = newHovered;
                  if (hoveredObject && hoveredObject !== selectedObject) {
                    addOutlineHighlight(hoveredObject, THEME.hover, 'VR_HOVER_HIGHLIGHT');
                  }
                }
                
                requestAnimationFrame(vrUpdateLoop);
              };
              vrUpdateLoop();
              
              console.log('[VR] 交互系统启动完成!');
            }
            
            onXRSessionStart?.();
          });
          
          renderer.xr.addEventListener('sessionend', () => {
            console.log('[PublicThreeDViewer] XR Session Ended!');
            isXRPresentingRef.current = false;
            
            // 移除VR相关对象和高亮
            if (sceneRef.current) {
              const toRemove: THREE.Object3D[] = [];
              sceneRef.current.traverse((child) => {
                if (child.name.startsWith('VR_') || 
                    child.name.startsWith('XR_') || 
                    child.name === 'VR_SELECT_HIGHLIGHT' ||
                    child.name === 'VR_HOVER_HIGHLIGHT') {
                  toRemove.push(child);
                }
              });
              toRemove.forEach(obj => {
                if (obj.parent) {
                  obj.parent.remove(obj);
                }
              });
            }
            
            onXRSessionEnd?.();
          });
        } catch (xrError) {
          console.warn('WebXR initialization skipped:', xrError);
        }
        
        // 初始化PMREMGenerator用于HDR环境贴图
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        pmremGeneratorRef.current = pmremGenerator;
        
        // 创建控制器
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controlsRef.current = controls;

        // 创建后处理（可能会失败，不影响基本渲染）
        try {
          const composer = new EffectComposer(renderer);
          const renderPass = new RenderPass(scene, camera);
          composer.addPass(renderPass);
          
          const outlinePass = new OutlinePass(new THREE.Vector2(width, height), scene, camera);
          outlinePass.edgeStrength = 5;
          outlinePass.edgeGlow = 1.0;
          outlinePass.edgeThickness = 2;
          outlinePass.pulsePeriod = 1.5;
          outlinePass.visibleEdgeColor.set('#ff6600');
          outlinePass.hiddenEdgeColor.set('#ff6600');
          composer.addPass(outlinePass);
          
          composerRef.current = composer;
          outlineRef.current = outlinePass;
        } catch (postError) {
          // 后处理效果初始化失败，使用基础渲染
        }

      } catch (error) {
        const errorDetail = error instanceof Error ? error.message : String(error);
        
        // 设置详细错误信息用于显示
        setLoadError(`创建失败: ${errorDetail}`);
        setWebglSupported(false);
        return;
      }

      // 光照将在applySettings中根据三维课件编辑器的设置应用
      // 不再使用硬编码的setupLights
      
      // 创建透明阴影接收平面
      const shadowPlane = createInvisibleShadowPlane(scene);
      shadowPlaneRef.current = shadowPlane;
      
      // 启动渲染循环
      startRenderLoop();
    };

    // 渲染循环
    const startRenderLoop = () => {
      const animate = (time?: number, frame?: XRFrame) => {
        // 动画混合器更新
        if (mixerRef.current) {
          mixerRef.current.update(0.01);
        }
        
        // 标注位置更新（跟随模型自转）
        updateAnnotationPositions();
        
        // 相机动画更新
        if (cameraAnimationRef.current) {
          cameraAnimationRef.current.update();
        }
        
        // 控制器更新（仅在非XR模式下）
        if (controlsRef.current && !isXRPresentingRef.current) {
          controlsRef.current.update();
        }
        
        // 更新高斯泼溅查看器（对WebXR至关重要）
        if (splatViewerRef.current && splatViewerRef.current.update) {
          try {
            splatViewerRef.current.update();
          } catch (e) {
            // 静默处理更新错误
          }
        }
        
        // 渲染场景
        // 在XR模式下或高斯泼溅模式下，使用基础渲染
        // OutlinePass等后处理效果会严重影响高斯泼溅的渲染性能
        if (isXRPresentingRef.current || splatViewerRef.current) {
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        } else {
          if (composerRef.current) {
            composerRef.current.render();
          } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        }
      };
      
      // 使用setAnimationLoop支持WebXR
      // 在XR会话中，Three.js会自动使用XR帧率
      if (rendererRef.current) {
        rendererRef.current.setAnimationLoop(animate);
      }
    };

    // 应用光照设置（从三维课件编辑器读取）
    const applyLightingSettings = (lighting: any) => {
      if (!sceneRef.current) return;

      // 清除所有现有灯光（除了阴影平面）
      const lightsToRemove = sceneRef.current.children.filter(child => 
        child instanceof THREE.DirectionalLight || 
        child instanceof THREE.HemisphereLight ||
        child instanceof THREE.AmbientLight ||
        child instanceof THREE.PointLight
      );
      lightsToRemove.forEach(light => sceneRef.current!.remove(light));

      // 如果没有光照设置，使用默认值（与三维课件编辑器一致）
      if (!lighting) {
        lighting = {
          directional: { color: '#ffffff', intensity: 1.2, position: { x: 3, y: 5, z: 2 } },
          ambient: { color: '#ffffff', intensity: 0.6 },
          hemisphere: { skyColor: '#ffffff', groundColor: '#404040', intensity: 0.6 }
        };
      }

      // 重新设置灯光（严格按照三维课件编辑器的设置）
      if (lighting.ambient) {
        const ambientLight = new THREE.AmbientLight(
          new THREE.Color(lighting.ambient.color || '#ffffff'), 
          lighting.ambient.intensity || 0.6
        );
        sceneRef.current.add(ambientLight);
      }

      if (lighting.directional) {
        const directionalLight = new THREE.DirectionalLight(
          new THREE.Color(lighting.directional.color || '#ffffff'), 
          lighting.directional.intensity || 1.2
        );
        if (lighting.directional.position) {
          directionalLight.position.set(
            lighting.directional.position.x || 3,
            lighting.directional.position.y || 5,
            lighting.directional.position.z || 2
          );
        }
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        sceneRef.current.add(directionalLight);
      }

      if (lighting.hemisphere) {
        const hemisphereLight = new THREE.HemisphereLight(
          new THREE.Color(lighting.hemisphere.skyColor || '#ffffff'),
          new THREE.Color(lighting.hemisphere.groundColor || '#404040'),
          lighting.hemisphere.intensity || 0.6
        );
        hemisphereLight.position.set(0, 1, 0);
        sceneRef.current.add(hemisphereLight);
      }

    };


    // 【新增】更新标注位置（跟随模型自转）
    const updateAnnotationPositions = () => {
      if (!modelRootRef.current) return;
      
      annotationsRef.current.forEach(annotationGroup => {
        const annotationData = annotationGroup.userData.annotationData;
        const targetKey = annotationGroup.userData.targetKey;
        
        if (!annotationData || !targetKey) return;
        
        // 找到目标对象（使用智能匹配）
        let targetObject = nodeMapRef.current.get(targetKey);
        if (!targetObject) {
          targetObject = findNodeBySmartMatch(targetKey);
        }
        if (!targetObject) return;
        
        try {
          // 重新计算标注点的世界坐标
          let anchorWorld: THREE.Vector3;
          
          if (annotationData.anchor && annotationData.anchor.offset) {
            const anchorLocal = new THREE.Vector3(
              annotationData.anchor.offset[0],
              annotationData.anchor.offset[1],
              annotationData.anchor.offset[2]
            );
            targetObject.updateWorldMatrix(true, true);
            anchorWorld = anchorLocal.clone().applyMatrix4(targetObject.matrixWorld);
          } else if (annotationData.position) {
            const posLocal = new THREE.Vector3(
              annotationData.position.x || annotationData.position[0], 
              annotationData.position.y || annotationData.position[1], 
              annotationData.position.z || annotationData.position[2]
            );
            targetObject.updateWorldMatrix(true, true);
            anchorWorld = posLocal.clone().applyMatrix4(targetObject.matrixWorld);
          } else {
            return; // 没有位置信息，跳过更新
          }
          
          // 重新计算标签位置
          let labelWorld: THREE.Vector3;
          
          if (annotationData.label && annotationData.label.offset) {
            if (annotationData.label.offsetSpace === 'local') {
              const offsetLocal = new THREE.Vector3(
                annotationData.label.offset[0],
                annotationData.label.offset[1],
                annotationData.label.offset[2]
              );
              const pos = new THREE.Vector3();
              const quat = new THREE.Quaternion();
              const scl = new THREE.Vector3();
              targetObject.matrixWorld.decompose(pos, quat, scl);
              const offsetWorld = offsetLocal.clone().applyQuaternion(quat);
              labelWorld = anchorWorld.clone().add(offsetWorld);
            } else {
              labelWorld = new THREE.Vector3(
                anchorWorld.x + annotationData.label.offset[0],
                anchorWorld.y + annotationData.label.offset[1], 
                anchorWorld.z + annotationData.label.offset[2]
              );
            }
          } else if (annotationData.labelOffset) {
            labelWorld = anchorWorld.clone().add(new THREE.Vector3(
              annotationData.labelOffset.x || 0,
              annotationData.labelOffset.y || 0,
              annotationData.labelOffset.z || 0
            ));
          } else {
            labelWorld = new THREE.Vector3(
              anchorWorld.x + 0.2,
              anchorWorld.y + 0.1,
              anchorWorld.z + 0.0
            );
          }
          
          // 更新标注组中各个元素的位置
          annotationGroup.traverse((child) => {
            if (child instanceof THREE.Mesh && child.userData.annotationId) {
              // 更新标注点位置
              child.position.copy(anchorWorld);
            } else if (child instanceof THREE.Line) {
              // 更新连接线
              const lineGeom = new THREE.BufferGeometry().setFromPoints([anchorWorld, labelWorld]);
              child.geometry.dispose();
              child.geometry = lineGeom;
            } else if (child instanceof THREE.Sprite) {
              // 更新标签位置
              child.position.copy(labelWorld);
            }
          });
          
        } catch (error) {
          // 静默处理错误，避免影响渲染
        }
      });
    };

    // 从文件二进制头部检测文件格式
    const detectFileFormat = (arrayBuffer: ArrayBuffer): string => {
      if (arrayBuffer.byteLength < 4) {
        return '';
      }
      
      const bytes = new Uint8Array(arrayBuffer);
      
      // 检查 GLB 格式 (magic: 'glTF', version: 2)
      if (bytes.length >= 12) {
        const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
        if (magic === 'glTF') {
          const version = new DataView(arrayBuffer, 4, 4).getUint32(0, true);
          if (version === 2) {
            return 'glb';
          }
        }
      }
      
      // 检查 FBX 格式 (通常以 "Kaydara FBX Binary" 开头)
      if (bytes.length >= 18) {
        const header = String.fromCharCode(...bytes.slice(0, 18));
        if (header.includes('Kaydara FBX')) {
          return 'fbx';
        }
      }
      
      // 检查 OBJ 格式 (文本文件，通常以 # 或 v 开头)
      if (bytes.length >= 100) {
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 100));
          if (/^(#|v |vn |vt |f |o |g |mtllib |usemtl )/m.test(text)) {
            return 'obj';
          }
        } catch {
          // 不是有效的 UTF-8 文本
        }
      }
      
      return '';
    };

    // 🔧 将 FBX 的 Phong/Lambert 材质转换为 PBR Standard 材质
    const convertPhongToPBR = (root: THREE.Object3D) => {
      let convertedCount = 0;
      root.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          const newMaterials = materials.map((mat) => {
            if (mat instanceof THREE.MeshPhongMaterial || mat instanceof THREE.MeshLambertMaterial) {
              const pbrMat = new THREE.MeshStandardMaterial({
                name: mat.name,
                color: mat.color ? mat.color.clone() : new THREE.Color(0xcccccc),
                map: mat.map || null,
                normalMap: (mat as any).normalMap || null,
                aoMap: (mat as any).aoMap || null,
                transparent: mat.transparent,
                opacity: mat.opacity,
                side: mat.side,
                alphaTest: mat.alphaTest,
                metalness: 0.0,
                roughness: 0.6,
              });
              if ((mat as THREE.MeshPhongMaterial).emissive) {
                pbrMat.emissive = (mat as THREE.MeshPhongMaterial).emissive.clone();
                pbrMat.emissiveMap = (mat as THREE.MeshPhongMaterial).emissiveMap || null;
                pbrMat.emissiveIntensity = (mat as THREE.MeshPhongMaterial).emissiveIntensity || 1.0;
              }
              if (mat instanceof THREE.MeshPhongMaterial && mat.shininess !== undefined) {
                pbrMat.roughness = Math.max(0.1, 1.0 - Math.min(mat.shininess / 100, 0.9));
              }
              convertedCount++;
              return pbrMat;
            }
            return mat;
          });
          object.material = Array.isArray(object.material) ? newMaterials : newMaterials[0];
        }
      });
      if (convertedCount > 0) {
        console.log(`✅ FBX 材质已自动转换为 PBR Standard: ${convertedCount} 个材质`);
      }
    };

    const loadModel = async (modelUrl: string) => {
      if (!sceneRef.current) return;

      setLoading(true);
      setLoadError(null);

      try {
        const manager = new THREE.LoadingManager();
        // 使用当前域名作为基础URL（浏览器端始终使用 window.location.origin）
        // 不使用 NEXT_PUBLIC_API_URL，因为那可能是 Docker 内部地址（如 server:4000）
        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
        let finalUrl = modelUrl;
        let useProxy = false;
        
        // 处理相对路径和公开API路径
        if (modelUrl.startsWith('/')) {
          finalUrl = `${baseUrl}${modelUrl}`;
        }
        // 处理 ./api/public/courseware-file 这种相对路径
        else if (modelUrl.startsWith('./api/public/')) {
          finalUrl = `${baseUrl}${modelUrl.substring(1)}`; // 去掉开头的 ./
        }
        // 对于NAS的文件，使用公开代理来解决CORS问题
        else if (modelUrl.startsWith('https://dl.yf-xr.com/')) {
          finalUrl = `${baseUrl}/api/public/proxy?url=${encodeURIComponent(modelUrl)}`;
          useProxy = true;
        }

        // 使用fetch加载（支持公开API）
        const response = await fetch(finalUrl, {
          headers: {} // 公开API不需要认证
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 从响应头 Content-Disposition 中提取文件名和扩展名
        let fileExt = '';
        const contentDisposition = response.headers.get('Content-Disposition');
        
        if (contentDisposition) {
          // 解析 Content-Disposition: inline; filename="model.glb" 或 filename*=UTF-8''model.glb
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=(["']?)([^"'\n]*)\1/i);
          const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;\n]*)/i);
          
          let filename = '';
          if (filenameStarMatch && filenameStarMatch[1]) {
            filename = decodeURIComponent(filenameStarMatch[1]);
          } else if (filenameMatch && filenameMatch[2]) {
            filename = decodeURIComponent(filenameMatch[2]);
          }
          
          if (filename) {
            fileExt = filename.toLowerCase().split('.').pop() || '';
          }
        }
        
        // 如果响应头中没有文件名，则回退到从 URL 中提取
        if (!fileExt) {
          const urlPath = modelUrl.split('?')[0];
          const urlParts = urlPath.split('/');
          const lastPart = urlParts[urlParts.length - 1];
          if (lastPart && lastPart.includes('.')) {
            fileExt = lastPart.toLowerCase().split('.').pop() || '';
          }
        }

        const arrayBuffer = await response.arrayBuffer();
        
        // 最后的回退：尝试从文件二进制头部识别格式
        if (!fileExt) {
          fileExt = detectFileFormat(arrayBuffer);
          
          if (!fileExt) {
            throw new Error('无法识别文件格式。请确保文件是有效的 GLB、FBX 或 OBJ 格式。');
          }
        }
        
        const isGLTF = fileExt === 'glb' || fileExt === 'gltf';
        const isFBX = fileExt === 'fbx';
        const isOBJ = fileExt === 'obj';
        
        let model: THREE.Object3D;
        let animations: THREE.AnimationClip[] = [];

        // 根据格式使用不同的加载器
        if (isGLTF) {
          const ktx2 = new KTX2Loader(manager)
            .setTranscoderPath('https://unpkg.com/three@0.168.0/examples/jsm/libs/basis/');
          const draco = new DRACOLoader(manager)
            .setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
          const loader = new GLTFLoader(manager)
            .setKTX2Loader(ktx2)
            .setDRACOLoader(draco);
          const gltf = await new Promise<any>((resolve, reject) => {
            loader.parse(arrayBuffer, '', resolve, reject);
          });
          model = gltf.scene;
          animations = gltf.animations || [];
        } else if (isFBX) {
          const loader = new FBXLoader(manager);
          model = loader.parse(arrayBuffer, '');
          animations = (model as any).animations || [];
          // 🔧 自动将 Phong/Lambert 材质转换为 PBR Standard
          convertPhongToPBR(model);
        } else if (isOBJ) {
          const loader = new OBJLoader(manager);
          const textDecoder = new TextDecoder();
          const text = textDecoder.decode(arrayBuffer);
          model = loader.parse(text);
          animations = [];
        } else {
          throw new Error(`不支持的文件格式: .${fileExt || '未知'}`);
        }

        modelRootRef.current = model;
        sceneRef.current.add(model);

        // 设置模型阴影
        model.traverse((child: THREE.Object3D) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // 构建节点映射
        buildNodeMap(model);

        // 处理动画
        if (animations && animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          animationsRef.current = animations;
        }

        // 自动调整阴影平面位置
        adjustShadowPlanePosition();

        // 加载标注
        if (coursewareData?.annotations) {
          createAnnotations(coursewareData.annotations);
        }

        // 应用设置
        if (coursewareData?.settings) {
          applySettings(coursewareData.settings);
        }

        setLoading(false);
        
        // 调用模型加载完成回调
        if (onModelLoaded) {
          onModelLoaded();
        }
        
      } catch (error) {
        console.error('模型加载失败:', error);
        setLoadError('模型加载失败，请检查网络连接');
        setLoading(false);
      }
    };

    // 构建节点映射 - 完全复制编辑器逻辑
    const buildNodeMap = (model: THREE.Object3D) => {
      const map = new Map<string, THREE.Object3D>();
      
      model.traverse((child) => {
        // 添加name映射
        if (child.name) {
          map.set(child.name, child);
        }
        
        // 添加UUID映射
        if (child.uuid) {
          map.set(child.uuid, child);
        }
        
        // 生成完整路径（包括UUID前缀）
        const fullPath = getFullObjectPath(child);
        if (fullPath) {
          map.set(fullPath, child);
        }
        
        // 生成名称路径
        const namePath = getObjectPath(child);
        if (namePath) {
          map.set(namePath, child);
        }
      });
      
      nodeMapRef.current = map;
    };

    // 获取对象名称路径 - 完全复制编辑器逻辑
    const getObjectPath = (object: THREE.Object3D): string => {
      const path = [];
      let current = object;
      
      while (current && current !== modelRootRef.current) {
        if (current.name) {
          path.unshift(current.name);
        }
        current = current.parent!;
      }
      
      return path.join('/');
    };

    // 获取完整对象路径 - 完全复制编辑器逻辑
    const getFullObjectPath = (object: THREE.Object3D): string => {
      const path = [];
      let current = object;
      
      while (current && current !== modelRootRef.current) {
        // 使用UUID/name组合格式
        if (current.uuid && current.name) {
          path.unshift(`${current.uuid}/${current.name}`);
        } else if (current.name) {
          path.unshift(current.name);
        } else if (current.uuid) {
          path.unshift(current.uuid);
        }
        current = current.parent!;
      }
      
      return path.join('/');
    };

    // 创建标注 - 完全复制编辑器逻辑
    const createAnnotations = (annotations: any[]) => {
      if (!sceneRef.current) return;

      // 清除旧标注
      annotationsRef.current.forEach(annotation => {
        sceneRef.current!.remove(annotation);
      });
      annotationsRef.current = [];

      // 创建新标注
      annotations.forEach((annotation) => {
        // 尝试多种nodeKey匹配方式
        let targetObject = nodeMapRef.current.get(annotation.nodeKey);
        
        // 如果没找到，尝试智能匹配
        if (!targetObject) {
          targetObject = findNodeBySmartMatch(annotation.nodeKey);
        }
        
        if (targetObject) {
          const annotationGroup = createAnnotationWithOffset(annotation, targetObject);
          if (annotationGroup) {
            annotationGroup.userData.annotationId = annotation.id;
            annotationGroup.visible = false; // 默认隐藏，等待显示动作触发
            sceneRef.current!.add(annotationGroup);
            annotationsRef.current.push(annotationGroup);
          }
        }
      });
    };

    // 创建带偏移的标注 - 完全复制编辑器逻辑
    const createAnnotationWithOffset = (annotation: any, targetObject: THREE.Object3D): THREE.Group | null => {
      try {
        // 使用三维课件编辑器的完整算法
        
        // 1. 计算标注点的世界坐标（基于anchor.offset）
        let anchorWorld: THREE.Vector3;
        
        if (annotation.anchor && annotation.anchor.offset) {
          // 标准格式：使用anchor.offset（局部坐标）
          const anchorLocal = new THREE.Vector3(
            annotation.anchor.offset[0],
            annotation.anchor.offset[1],
            annotation.anchor.offset[2]
          );
          targetObject.updateWorldMatrix(true, true);
          anchorWorld = anchorLocal.clone().applyMatrix4(targetObject.matrixWorld);
        } else if (annotation.position) {
          // 兼容格式：与编辑器一致，按局部坐标乘以目标世界矩阵
          const posLocal = new THREE.Vector3(
            annotation.position.x || annotation.position[0], 
            annotation.position.y || annotation.position[1], 
            annotation.position.z || annotation.position[2]
          );
          targetObject.updateWorldMatrix(true, true);
          anchorWorld = posLocal.clone().applyMatrix4(targetObject.matrixWorld);
        } else {
          // 如果没有偏移信息，计算对象边界框中心点并添加固定偏移
          const box = new THREE.Box3().setFromObject(targetObject);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          anchorWorld = center.clone().add(
            new THREE.Vector3(0, size.y * 0.6, 0) // 向上偏移
          );
        }

        // 2. 计算标签位置（基于完整的label.offset逻辑）
        let labelWorld: THREE.Vector3;
        
        if (annotation.label && annotation.label.offset) {
          // 标准格式：使用label.offset
          if (annotation.label.offsetSpace === 'local') {
            // 新数据：局部偏移（相对于标注点的局部坐标）
            const offsetLocal = new THREE.Vector3(
              annotation.label.offset[0],
              annotation.label.offset[1],
              annotation.label.offset[2]
            );
            // 应用目标对象的变换
            const pos = new THREE.Vector3();
            const quat = new THREE.Quaternion();
            const scl = new THREE.Vector3();
            targetObject.matrixWorld.decompose(pos, quat, scl);
            // 仅应用旋转，忽略缩放，避免非均匀缩放导致偏移接近 0
            const offsetWorld = offsetLocal.clone().applyQuaternion(quat);
            labelWorld = anchorWorld.clone().add(offsetWorld);
          } else {
            // 旧数据：世界偏移
            labelWorld = new THREE.Vector3(
              anchorWorld.x + annotation.label.offset[0],
              anchorWorld.y + annotation.label.offset[1], 
              anchorWorld.z + annotation.label.offset[2]
            );
          }
        } else if (annotation.labelOffset) {
          // 兼容格式
          labelWorld = anchorWorld.clone().add(new THREE.Vector3(
            annotation.labelOffset.x || 0,
            annotation.labelOffset.y || 0,
            annotation.labelOffset.z || 0
          ));
        } else {
          // 默认偏移
          labelWorld = new THREE.Vector3(
            anchorWorld.x + 0.2,
            anchorWorld.y + 0.1,
            anchorWorld.z + 0.0
          );
        }

        // 创建标注组
        const annotationGroup = new THREE.Group();
        annotationGroup.userData.annotationId = annotation.id;
        annotationGroup.userData.targetKey = annotation.targetKey || annotation.nodeKey;
        annotationGroup.userData.annotationData = annotation; // 保存原始数据用于实时更新
        
        // 1. 创建标注点（蓝色圆点）
        const pointGeom = new THREE.SphereGeometry(0.012, 16, 16);
        const pointMat = new THREE.MeshBasicMaterial({ 
          color: 0x1890ff,
          depthTest: true,
          transparent: true,
          opacity: 1.0
        });
        const pointMesh = new THREE.Mesh(pointGeom, pointMat);
        pointMesh.position.copy(anchorWorld);
        pointMesh.renderOrder = 0;
        pointMesh.userData.annotationId = annotation.id;
        annotationGroup.add(pointMesh);
        
        // 2. 创建连接线
        const lineGeom = new THREE.BufferGeometry().setFromPoints([anchorWorld, labelWorld]);
        const lineMat = new THREE.LineBasicMaterial({ 
          color: 0x1890ff,
          transparent: true,
          opacity: 0.8,
          depthTest: true
        });
        const line = new THREE.Line(lineGeom, lineMat);
        annotationGroup.add(line);

        // 3. 创建文字标签
        const labelSprite = createLabelSprite(annotation);
        if (labelSprite) {
          labelSprite.position.copy(labelWorld);
          annotationGroup.add(labelSprite);
        }

        return annotationGroup;
      } catch (error) {
        return null;
      }
    };

    // 创建标签精灵 - 使用固定大小（与三维编辑器保持一致）
    const createLabelSprite = (annotation: any): THREE.Sprite | null => {
      try {
        const title = annotation.title || annotation.label?.title || 'Annotation';
        
        // 使用固定画布尺寸（与三维编辑器保持一致）
        const fontSize = 32;
        const padding = 20;
        const minWidth = 120;
        const textHeight = 64;
        
        // 测量文字宽度
        const measureCanvas = document.createElement('canvas');
        const measureContext = measureCanvas.getContext('2d')!;
        measureContext.font = `bold ${fontSize}px Arial, Microsoft YaHei, sans-serif`;
        const textMetrics = measureContext.measureText(title);
        
        // 计算画布尺寸（固定高度，宽度根据文字长度）
        const textWidth = Math.max(minWidth, textMetrics.width + padding * 2);
        const canvasWidth = textWidth;
        const canvasHeight = textHeight;
        
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const context = canvas.getContext('2d')!;
        
        // 重新设置字体（canvas resize后会丢失）
        context.font = `bold ${fontSize}px Arial, Microsoft YaHei, sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // 绘制背景（圆角矩形） - 蓝色科技感
        const borderRadius = 8;
        context.fillStyle = 'rgba(30, 50, 80, 0.95)'; // 深蓝色半透明背景
        context.strokeStyle = '#1890ff';
        context.lineWidth = 2;
        
        const radius = borderRadius;
        context.beginPath();
        context.moveTo(radius, 0);
        context.arcTo(canvasWidth, 0, canvasWidth, canvasHeight, radius);
        context.arcTo(canvasWidth, canvasHeight, 0, canvasHeight, radius);
        context.arcTo(0, canvasHeight, 0, 0, radius);
        context.arcTo(0, 0, canvasWidth, 0, radius);
        context.closePath();
        context.fill();
        context.stroke();
        
        // 绘制文字 - 白色文字
        context.fillStyle = 'white';
        context.fillText(title, canvasWidth / 2, canvasHeight / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.needsUpdate = true;
        
        const material = new THREE.SpriteMaterial({ 
          map: texture,
          transparent: true,
          alphaTest: 0.1,
          depthTest: true, // 启用深度测试
          depthWrite: false,
          sizeAttenuation: true // 启用尺寸衰减，实现近大远小（与三维编辑器一致）
        });
        
        const sprite = new THREE.Sprite(material);
        
        // 使用固定大小，随距离变化（近大远小，与三维编辑器一致）
        const fixedScale = 0.002; // 基础缩放
        const defaultLabelScale = 1; // 默认标签大小
        sprite.scale.set(canvasWidth * fixedScale * defaultLabelScale, canvasHeight * fixedScale * defaultLabelScale, 1);
        // 保存标签大小和尺寸信息，以便后续更新
        sprite.userData.annotationId = annotation.id; // 设置annotationId以便查找
        sprite.userData.labelScale = defaultLabelScale;
        sprite.userData.baseScale = fixedScale;
        sprite.userData.canvasWidth = canvasWidth;
        sprite.userData.canvasHeight = canvasHeight;
        sprite.renderOrder = 999; // 高渲染顺序，确保最后渲染
        
        return sprite;
      } catch (error) {
        return null;
      }
    };

    // 更新场景中所有材质的环境贴图
    const updateMaterialsEnvMap = (envMap: THREE.Texture | null, intensity: number = 1.0) => {
      const scene = sceneRef.current;
      if (!scene) return;
      
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          const material = Array.isArray(object.material) ? object.material : [object.material];
          material.forEach((mat) => {
            if (mat instanceof THREE.MeshStandardMaterial || 
                mat instanceof THREE.MeshPhysicalMaterial ||
                mat instanceof THREE.MeshPhongMaterial) {
              mat.envMap = envMap;
              // 设置环境贴图强度
              if ('envMapIntensity' in mat) {
                (mat as any).envMapIntensity = intensity;
              }
              mat.needsUpdate = true;
            }
          });
        }
      });
    };

    // 应用设置
    const applySettings = (settings: any) => {
      if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;

      // 如果没有背景设置，使用默认纯色背景
      const backgroundType = settings?.backgroundType || 'color';
      const backgroundPanorama = settings?.backgroundPanorama || '/360background_7.hdr';
      const backgroundSplat = settings?.backgroundSplat || '/garden.splat';
      const bgPanoramaBrightness = settings?.backgroundPanoramaBrightness || 1.0;
      const useHDREnvironment = settings?.useHDREnvironment !== undefined ? settings.useHDREnvironment : true;

      // 在高斯泼溅模式下隐藏阴影平面（性能优化）
      if (shadowPlaneRef.current) {
        shadowPlaneRef.current.visible = backgroundType !== 'splat';
      }

      // 清理函数：移除旧的高斯泼溅查看器
      const cleanupSplatViewer = () => {
        if (splatViewerRef.current) {
          try {
            scene.remove(splatViewerRef.current);
            if (splatViewerRef.current.dispose) {
              splatViewerRef.current.dispose();
            }
          } catch (e) {
            console.warn('清理高斯泼溅查看器时出错:', e);
          }
          splatViewerRef.current = null;
        }
      };

      // 应用高斯泼溅背景
      if (backgroundType === 'splat' && backgroundSplat) {
        // 【修复】处理 world 场景路径：/world/world_1 -> /world/world_1/world_1.spz
        const isWorldScene = backgroundSplat.startsWith('/world/') && !backgroundSplat.endsWith('.spz') && !backgroundSplat.endsWith('.splat');
        const splatPath = isWorldScene 
          ? `${backgroundSplat}/${backgroundSplat.split('/').pop()}.spz`
          : backgroundSplat;
        const hdrPath = isWorldScene 
          ? `${backgroundSplat}/${backgroundSplat.split('/').pop()}.hdr`
          : backgroundPanorama;
        
        console.log('🌌 [PublicThreeDViewer/Splat] 开始加载高斯泼溅模型:', { originalPath: backgroundSplat, splatPath, hdrPath, isWorldScene });
        setSplatLoading(true);
        
        // 移除背景球体
        const oldSphere = scene.getObjectByName('__background_sphere__');
        if (oldSphere) scene.remove(oldSphere);
        scene.background = null;
        
        // 【优化】在高斯泼溅模式下，仍然加载HDR作为环境光照（提升材质反射效果）
        // 使用设置中的全景图或默认HDR作为环境光照源
        const envHDR = hdrPath || '/360background_7.hdr';
        if (envHDR.toLowerCase().endsWith('.hdr') || envHDR.toLowerCase().endsWith('.exr')) {
          const envLoader = envHDR.toLowerCase().endsWith('.hdr') ? new RGBELoader() : new EXRLoader();
          envLoader.load(envHDR, (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            const pmremGenerator = pmremGeneratorRef.current;
            if (pmremGenerator) {
              const envMap = pmremGenerator.fromEquirectangular(texture).texture;
              environmentMapRef.current = envMap;
              scene.environment = envMap; // 只设置环境光照，不设置背景
              updateMaterialsEnvMap(envMap, useHDREnvironment ? bgPanoramaBrightness : 0.5);
              console.log('✅ [PublicThreeDViewer/Splat] HDR环境光照已应用（用于材质反射）:', envHDR);
            }
          }, undefined, (error) => {
            console.warn('⚠️ [PublicThreeDViewer/Splat] 加载HDR环境光照失败:', error);
          });
        }
        
        // 移动端性能检测
        const isMobile = isMobileDevice();
        const isLowEnd = isLowEndMobile();
        
        // 低端移动设备（如 iPhone X）跳过高斯模型，使用HDR背景代替
        if (isLowEnd) {
          console.warn('⚠️ [PublicThreeDViewer/Splat] 检测到低端移动设备，跳过高斯模型加载以避免崩溃');
          setSplatLoading(false);
          // 使用HDR全景图作为背景替代
          if (envHDR) {
            const envLoader = new RGBELoader();
            envLoader.load(envHDR, (texture) => {
              texture.mapping = THREE.EquirectangularReflectionMapping;
              scene.background = texture;
              scene.environment = texture;
              console.log('✅ [PublicThreeDViewer/Splat] 低端设备使用HDR全景图替代高斯模型');
            });
          } else if (settings.background) {
            scene.background = new THREE.Color(settings.background);
          }
          return;
        }
        
        // 动态导入高斯泼溅库
        import('@mkkellogg/gaussian-splats-3d').then((GaussianSplats3D) => {
          // 清理旧的查看器
          cleanupSplatViewer();
          
          try {
            // 移动端优化配置
            const viewerConfig: any = {
              sharedMemoryForWorkers: false,
              dynamicScene: true,
              selfDrivenMode: false // 我们自己控制渲染，这对WebXR很重要
            };
            
            // 移动端额外优化
            if (isMobile) {
              viewerConfig.gpuAcceleratedSort = false; // 禁用GPU排序，减少内存占用
              viewerConfig.halfPrecisionCovariancesOnGPU = true; // 使用半精度，减少内存
              viewerConfig.integerBasedSort = true; // 使用整数排序，更快
              console.log('📱 [PublicThreeDViewer/Splat] 移动端优化已启用');
            }
            
            // 创建DropInViewer（WebXR兼容）
            const viewer = new GaussianSplats3D.DropInViewer(viewerConfig);
            
            splatViewerRef.current = viewer;
            scene.add(viewer);
            
            // 获取变换参数
            const splatTransform = settings?.splatTransform || {};
            const splatPos = splatTransform.position || { x: 0, y: 0, z: 0 };
            const splatRot = splatTransform.rotation || { x: 0, y: 0, z: 0 };
            const splatScl = splatTransform.scale !== undefined ? splatTransform.scale : 1.0;
            
            // 将角度转换为四元数
            const euler = new THREE.Euler(
              splatRot.x * Math.PI / 180,
              splatRot.y * Math.PI / 180,
              splatRot.z * Math.PI / 180,
              'XYZ'
            );
            const quaternion = new THREE.Quaternion().setFromEuler(euler);
            
            // 移动端降低质量参数
            const splatConfig: any = {
              showLoadingUI: false,
              splatAlphaRemovalThreshold: isMobile ? 10 : 5, // 移动端更积极地移除透明点
              position: [splatPos.x, splatPos.y, splatPos.z],
              rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
              scale: [splatScl, splatScl, splatScl]
            };
            
            // 加载splat文件（使用转换后的路径）
            viewer.addSplatScene(splatPath, splatConfig).then(() => {
              console.log('✅ [PublicThreeDViewer/Splat] 高斯泼溅模型加载成功（支持WebXR）', { splatPath, position: splatPos, rotation: splatRot, scale: splatScl, isMobile });
              setSplatLoading(false);
            }).catch((error: any) => {
              console.error('❌ [PublicThreeDViewer/Splat] 加载高斯泼溅模型失败:', error);
              setSplatLoading(false);
              // 加载失败时尝试使用HDR背景
              if (envHDR) {
                const envLoader = new RGBELoader();
                envLoader.load(envHDR, (texture) => {
                  texture.mapping = THREE.EquirectangularReflectionMapping;
                  scene.background = texture;
                  console.log('✅ [PublicThreeDViewer/Splat] 高斯加载失败，使用HDR背景替代');
                });
              } else if (settings.background) {
                scene.background = new THREE.Color(settings.background);
              }
            });
          } catch (error) {
            console.error('❌ [PublicThreeDViewer/Splat] 创建高斯泼溅查看器失败:', error);
            setSplatLoading(false);
            if (settings.background) {
              scene.background = new THREE.Color(settings.background);
            }
          }
        }).catch((error) => {
          console.error('❌ [PublicThreeDViewer/Splat] 导入高斯泼溅库失败:', error);
          setSplatLoading(false);
          if (settings.background) {
            scene.background = new THREE.Color(settings.background);
          }
        });
      } else if (backgroundType === 'panorama' && backgroundPanorama) {
        // 清理高斯泼溅查看器
        cleanupSplatViewer();
        let bgPanorama = backgroundPanorama;
        
        // 处理相对路径（如 /360background_7.hdr）
        if (bgPanorama.startsWith('/') && !bgPanorama.startsWith('http')) {
          // 相对路径，使用public目录
          bgPanorama = bgPanorama;
        }
        
        // 检测是否为HDR或EXR文件
        const lowerPath = bgPanorama.toLowerCase();
        const isHDR = lowerPath.endsWith('.hdr');
        const isEXR = lowerPath.endsWith('.exr');
        
        if (isHDR || isEXR) {
          // 根据文件类型选择加载器
          const loader = isHDR ? new RGBELoader() : new EXRLoader();
          loader.load(
            bgPanorama,
            (texture) => {
              texture.mapping = THREE.EquirectangularReflectionMapping;
              backgroundTextureRef.current = texture;
              
              // 生成环境贴图（需要翻转以修正反射方向）
              const pmremGenerator = pmremGeneratorRef.current;
              if (pmremGenerator) {
                // 创建翻转后的纹理用于环境贴图（通过repeat.x = -1实现水平翻转）
                const flippedTexture = texture.clone();
                flippedTexture.wrapS = THREE.RepeatWrapping;
                flippedTexture.repeat.x = -1; // 水平翻转环境贴图
                const envMap = pmremGenerator.fromEquirectangular(flippedTexture).texture;
                environmentMapRef.current = envMap;
                
                // 如果启用HDR环境光照，应用到场景
                if (useHDREnvironment) {
                  scene.environment = envMap;
                  updateMaterialsEnvMap(envMap, bgPanoramaBrightness);
                  // 应用亮度到环境光照
                  if (renderer) {
                    renderer.toneMappingExposure = 1.2 * bgPanoramaBrightness;
                  }
                }
              }
              
              // 创建自定义shader材质来显示HDR/EXR背景
              const material = new THREE.ShaderMaterial({
                uniforms: {
                  tBackground: { value: texture },
                  brightness: { value: bgPanoramaBrightness }
                },
                vertexShader: `
                  varying vec2 vUv;
                  void main() {
                    vUv = uv;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    // 将深度值设置为最远（1.0），确保背景始终在最后渲染
                    gl_Position.z = gl_Position.w * 0.999999;
                  }
                `,
                fragmentShader: `
                  uniform sampler2D tBackground;
                  uniform float brightness;
                  varying vec2 vUv;
                  void main() {
                    // 翻转水平方向（左右反转）以修正HDR贴图方向
                    vec2 flippedUv = vec2(1.0 - vUv.x, vUv.y);
                    vec4 texColor = texture2D(tBackground, flippedUv);
                    gl_FragColor = vec4(texColor.rgb * brightness, texColor.a);
                  }
                `,
                side: THREE.BackSide,
                toneMapped: false, // HDR/EXR不需要色调映射
                depthWrite: false, // 不写入深度缓冲区，避免遮挡其他物体
                depthTest: true // 启用深度测试，但通过shader将深度设置为最远
              });
              
              // 创建球体几何体来显示背景
              const cameraDistance = camera.position.length();
              const minRadiusForCamera = cameraDistance * 1.5;
              const maxRadiusForFar = camera.far * 0.95;
              const sphereRadius = Math.max(10000, Math.max(minRadiusForCamera, maxRadiusForFar));
              
              const geometry = new THREE.SphereGeometry(sphereRadius, 64, 64);
              const sphere = new THREE.Mesh(geometry, material);
              sphere.name = '__background_sphere__';
              sphere.renderOrder = Infinity;
              sphere.frustumCulled = false;
              sphere.position.set(0, 0, 0);
              
              // 移除旧的背景球体
              const oldSphere = scene.getObjectByName('__background_sphere__');
              if (oldSphere) {
                scene.remove(oldSphere);
              }
              
              scene.add(sphere);
              scene.background = null; // 清除默认背景
              
              // 强制重新渲染
              if (composerRef.current) {
                composerRef.current.render();
              } else if (renderer && scene && camera) {
                renderer.render(scene, camera);
              }
            },
            undefined,
            (error) => {
              // 失败时使用默认背景
              if (settings.background) {
                scene.background = new THREE.Color(settings.background);
              }
            }
          );
        } else {
          // 加载普通全景图
          const loader = new THREE.TextureLoader();
          loader.load(
            bgPanorama,
            (texture) => {
              texture.mapping = THREE.EquirectangularReflectionMapping;
              backgroundTextureRef.current = texture;
              
              // 如果启用HDR环境光照，生成环境贴图
              if (useHDREnvironment) {
                const pmremGenerator = pmremGeneratorRef.current;
                if (pmremGenerator) {
                  const envMap = pmremGenerator.fromEquirectangular(texture).texture;
                  environmentMapRef.current = envMap;
                  scene.environment = envMap;
                  updateMaterialsEnvMap(envMap, bgPanoramaBrightness);
                  if (renderer) {
                    renderer.toneMappingExposure = 1.2 * bgPanoramaBrightness;
                  }
                }
              } else {
                scene.environment = null;
                updateMaterialsEnvMap(null, 1.0);
              }
              
              // 创建自定义shader材质来调整亮度
              const material = new THREE.ShaderMaterial({
                uniforms: {
                  tBackground: { value: texture },
                  brightness: { value: bgPanoramaBrightness }
                },
                vertexShader: `
                  varying vec2 vUv;
                  void main() {
                    vUv = uv;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mvPosition;
                    gl_Position.z = gl_Position.w * 0.999999;
                  }
                `,
                fragmentShader: `
                  uniform sampler2D tBackground;
                  uniform float brightness;
                  varying vec2 vUv;
                  void main() {
                    // 翻转水平方向（左右反转）以修正HDR贴图方向
                    vec2 flippedUv = vec2(1.0 - vUv.x, vUv.y);
                    vec4 texColor = texture2D(tBackground, flippedUv);
                    gl_FragColor = vec4(texColor.rgb * brightness, texColor.a);
                  }
                `,
                side: THREE.BackSide,
                depthWrite: false,
                depthTest: true
              });
              
              const cameraDistance = camera.position.length();
              const minRadiusForCamera = cameraDistance * 1.5;
              const maxRadiusForFar = camera.far * 0.95;
              const sphereRadius = Math.max(10000, Math.max(minRadiusForCamera, maxRadiusForFar));
              
              const geometry = new THREE.SphereGeometry(sphereRadius, 64, 64);
              const sphere = new THREE.Mesh(geometry, material);
              sphere.name = '__background_sphere__';
              sphere.renderOrder = Infinity;
              sphere.frustumCulled = false;
              sphere.position.set(0, 0, 0);
              
              const oldSphere = scene.getObjectByName('__background_sphere__');
              if (oldSphere) {
                scene.remove(oldSphere);
              }
              
              scene.add(sphere);
              scene.background = null;
            },
            undefined,
            (error) => {
              if (settings.background) {
                scene.background = new THREE.Color(settings.background);
              }
            }
          );
        }
      } else {
        // 纯色背景
        // 移除背景球体，使用默认背景
        const oldSphere = scene.getObjectByName('__background_sphere__');
        if (oldSphere) {
          scene.remove(oldSphere);
        }
        // 清理高斯泼溅查看器
        if (splatViewerRef.current) {
          try {
            scene.remove(splatViewerRef.current);
            if (splatViewerRef.current.dispose) {
              splatViewerRef.current.dispose();
            }
          } catch (e) {
            console.warn('清理高斯泼溅查看器时出错:', e);
          }
          splatViewerRef.current = null;
        }
        if (settings.background) {
          scene.background = new THREE.Color(settings.background);
        } else {
          // 使用渐变背景
          const gradientTexture = createGradientTexture();
          scene.background = gradientTexture;
        }
        scene.environment = null;
        updateMaterialsEnvMap(null, 1.0);
      }

      // 应用相机位置
      if (settings.cameraPosition) {
        cameraRef.current.position.set(
          settings.cameraPosition.x,
          settings.cameraPosition.y,
          settings.cameraPosition.z
        );
      }

      // 应用相机目标
      if (settings.cameraTarget) {
        const target = new THREE.Vector3(
          settings.cameraTarget.x,
          settings.cameraTarget.y,
          settings.cameraTarget.z
        );
        controlsRef.current.target.copy(target);
        cameraRef.current.lookAt(target);
      }

      // 应用灯光设置（严格按照三维课件编辑器的设置）
      if (settings.lighting) {
        applyLightingSettings(settings.lighting);
      } else {
        // 如果没有光照设置，使用默认值
        applyLightingSettings(null);
      }

      controlsRef.current.update();
    };

    // 智能匹配节点 - 增强版
    const findNodeBySmartMatch = (nodeKey: string): THREE.Object3D | undefined => {
      const nodeMap = nodeMapRef.current;
      
      // console.log('智能匹配节点:', nodeKey);
      // console.log('可用节点总数:', nodeMap.size);
      
      // 1. 精确匹配
      if (nodeMap.has(nodeKey)) {
        // console.log('精确匹配成功:', nodeKey);
        return nodeMap.get(nodeKey)!;
      }
      
      // 2. 提取最后的路径段进行匹配
      const targetSegments = nodeKey.split('/');
      const targetName = targetSegments[targetSegments.length - 1]; // 最后一段，如"左后轮"
      
      // console.log('目标名称:', targetName);
      
      // 3. 按名称匹配
      for (const [key, object] of nodeMap.entries()) {
        if (object.name === targetName) {
          // console.log('名称匹配成功:', object.name, '键:', key);
          return object;
        }
      }
      
      // 4. 路径末尾匹配
      for (const [key, object] of nodeMap.entries()) {
        if (key.endsWith(`/${targetName}`) || key.endsWith(targetName)) {
          // console.log('路径末尾匹配成功:', key);
          return object;
        }
      }
      
      // 5. 如果是完整路径，尝试匹配路径结构（忽略UUID）
      if (targetSegments.length > 1) {
        const pathPattern = targetSegments.slice(1).join('/'); // 去掉第一个UUID部分
        // console.log('路径模式:', pathPattern);
        
        for (const [key, object] of nodeMap.entries()) {
          if (key.includes(pathPattern)) {
            // console.log('路径模式匹配成功:', key);
            return object;
          }
        }
      }
      
      // 6. 模糊匹配
      const lowerTargetName = targetName.toLowerCase();
      for (const [key, object] of nodeMap.entries()) {
        if (key.toLowerCase().includes(lowerTargetName) || 
            object.name.toLowerCase().includes(lowerTargetName)) {
          // console.log('模糊匹配成功:', key, '目标:', targetName);
          return object;
        }
      }
      
      return undefined;
    };

    // 对焦到节点
    const focusOnNode = (nodeKey: string) => {
      // console.log('正在对焦节点:', nodeKey);
      let targetObject = nodeMapRef.current.get(nodeKey);
      
      // 如果直接找不到，尝试智能匹配
      if (!targetObject) {
        targetObject = findNodeBySmartMatch(nodeKey);
      }
      
      if (!targetObject) {
        // console.warn('未找到节点:', nodeKey);
        // console.log('可用节点:', Array.from(nodeMapRef.current.keys()));
        return;
      }

      if (cameraRef.current && controlsRef.current) {
        // 计算目标对象的边界框
        const box = new THREE.Box3().setFromObject(targetObject);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // 计算合适的距离
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 2;
        
        // 计算新的相机位置
        const direction = new THREE.Vector3()
          .subVectors(cameraRef.current.position, controlsRef.current.target)
          .normalize();
        
        const newPosition = new THREE.Vector3()
          .copy(center)
          .add(direction.multiplyScalar(distance));

        // 创建平滑动画
        const startPosition = cameraRef.current.position.clone();
        const startTarget = controlsRef.current.target.clone();
        const duration = 1000; // 1秒
        const startTime = Date.now();

        const animateCamera = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // 使用缓动函数
          const easeProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic
          
          // 插值位置
          cameraRef.current!.position.lerpVectors(startPosition, newPosition, easeProgress);
          controlsRef.current!.target.lerpVectors(startTarget, center, easeProgress);
          
          controlsRef.current!.update();
          
          if (progress < 1) {
            requestAnimationFrame(animateCamera);
          }
        };

        animateCamera();
      }
    };

    // 【已废弃】自发光高亮相关代码已删除，现在统一使用边界框高亮（高斯泼溅模式）或轮廓高亮（普通模式）

    // 高亮节点 - 在高斯泼溅模式下使用轻量级边界框，否则使用橙色边框高亮
    const highlightNode = (nodeKey: string, highlight: boolean) => {
      // console.log('🔆 设置高亮:', nodeKey, highlight);
      
      let targetObject = nodeMapRef.current.get(nodeKey);
      if (!targetObject) {
        targetObject = findNodeBySmartMatch(nodeKey);
      }
      
      if (!targetObject) {
        // console.warn('❌ 未找到要高亮的节点:', nodeKey);
        return;
      }

      // console.log('🎯 找到目标对象:', targetObject.name || targetObject.uuid);

      // 清除之前的边界框高亮
      if (boxHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(boxHelperRef.current);
        boxHelperRef.current.dispose();
        boxHelperRef.current = null;
      }

      if (highlight) {
        // 在高斯泼溅模式下使用轻量级边界框高亮（不修改材质，零性能开销）
        if (splatViewerRef.current) {
          const boxHelper = new THREE.BoxHelper(targetObject, 0xff6600); // 橙色边界框
          boxHelper.name = '__highlight_box__';
          sceneRef.current?.add(boxHelper);
          boxHelperRef.current = boxHelper;
        } else {
          // 普通模式使用橙色边框轮廓高亮
          if (outlineRef.current) {
            outlineRef.current.selectedObjects = [targetObject];
          }
        }
        
        // console.log('✅ 高亮设置完成');
      } else {
        // 清除高亮
        // console.log('🧹 清除高亮');
        if (outlineRef.current) {
          outlineRef.current.selectedObjects = [];
        }
      }
    };

    // 显示标注
    const showAnnotations = (ids: string[], labelScale?: number) => {
      // console.log('显示标注:', ids, '标签大小:', labelScale);
      annotationsRef.current.forEach(annotationGroup => {
        const annotationId = annotationGroup.userData.annotationId;
        if (ids.includes(annotationId)) {
          annotationGroup.visible = true;
          // 如果提供了标签大小，只更新标签sprite的缩放（不影响原点和线束）
          if (labelScale !== undefined) {
            // 查找annotationGroup中的sprite子对象
            annotationGroup.traverse((child) => {
              if (child instanceof THREE.Sprite && child.userData.annotationId === annotationId) {
                const baseScale = child.userData.baseScale || 0.002;
                const canvasWidth = child.userData.canvasWidth || 120;
                const canvasHeight = child.userData.canvasHeight || 64;
                // 等比例缩放：使用相同的缩放因子
                const scaleFactor = labelScale;
                child.scale.set(
                  canvasWidth * baseScale * scaleFactor, 
                  canvasHeight * baseScale * scaleFactor, 
                  1
                );
                child.userData.labelScale = labelScale;
              }
            });
          }
        }
      });
    };

    // 隐藏标注
    const hideAnnotations = (ids: string[]) => {
      // console.log('隐藏标注:', ids);
      annotationsRef.current.forEach(annotation => {
        const annotationId = annotation.userData.annotationId;
        if (ids.includes(annotationId)) {
          annotation.visible = false;
        }
      });
    };

    // 设置节点显隐
    const setNodeVisibility = (nodeKey: string, visible: boolean) => {
      let targetObject = nodeMapRef.current.get(nodeKey);
      
      // 如果直接找不到，尝试智能匹配（优先精确匹配）
      if (!targetObject) {
        // 先尝试精确匹配路径的最后一部分
        if (nodeKey.includes('/')) {
          const targetName = nodeKey.split('/').pop();
          if (targetName) {
            // 寻找路径以目标名称结尾的对象
            for (const [key, obj] of nodeMapRef.current) {
              if (key.endsWith('/' + targetName) || key === targetName) {
                targetObject = obj;
                break;
              }
            }
          }
        }
        
        // 如果还是找不到，尝试模糊匹配
        if (!targetObject) {
          for (const [key, obj] of nodeMapRef.current) {
            if (key === nodeKey || key.endsWith('/' + nodeKey) || nodeKey.endsWith('/' + key)) {
              targetObject = obj;
              break;
            }
          }
        }
      }
      
      if (!targetObject) return;

      // 记录初始可见性状态（只在第一次设置时记录）
      if (!hiddenObjectsRef.current.has(nodeKey)) {
        hiddenObjectsRef.current.set(nodeKey, targetObject.visible);
      }

      // 只设置目标对象本身，不递归设置子对象（避免隐藏所有对象）
      targetObject.visible = visible;
    };

    // 恢复所有对象的显示状态
    const restoreAllVisibility = () => {
      hiddenObjectsRef.current.forEach((initialVisible, nodeKey) => {
        let targetObject = nodeMapRef.current.get(nodeKey);
        if (!targetObject) {
          // 尝试智能匹配
          for (const [key, obj] of nodeMapRef.current) {
            if (key.includes(nodeKey) || nodeKey.includes(key)) {
              targetObject = obj;
              break;
            }
          }
        }
        if (targetObject) {
          targetObject.visible = initialVisible;
          targetObject.traverse((child) => {
            child.visible = initialVisible;
          });
        }
      });
      hiddenObjectsRef.current.clear();
    };

    // 重置所有状态
    const resetAllStates = () => {
      // console.log('重置所有状态');
      
      // 清除高亮（边界框或轮廓）
      if (boxHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(boxHelperRef.current);
        boxHelperRef.current.dispose();
        boxHelperRef.current = null;
      }
      if (outlineRef.current) {
        outlineRef.current.selectedObjects = [];
      }
      
      // 隐藏所有标注
      annotationsRef.current.forEach(annotation => {
        annotation.visible = false;
      });
      
      // 停止动画
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
      }
      
      // 停止自转
      autoRotationRef.current = false;
      
      // 恢复所有对象的显示状态
      restoreAllVisibility();
    };

    // 开始自转 - 已禁用（保持接口兼容）
    const startAutoRotation = () => {
      // 自转功能已取消，保持空函数
    };

    // 停止自转 - 已禁用（保持接口兼容）
    const stopAutoRotation = () => {
      // 自转功能已取消，保持空函数
    };

    // 播放动画 - 增强智能匹配，返回动画持续时间（秒）
    const playAnimation = (animationId: string, startTime?: number, endTime?: number): number => {
      if (!mixerRef.current || !animationsRef.current.length) {
        return 3; // 默认3秒
      }

      // 停止所有当前动画
      mixerRef.current.stopAllAction();

      // 历史UUID到动画名称的映射（修复旧版本保存的UUID问题）
      const uuidToNameMap: { [key: string]: string } = {
        'f647ea39-a47a-4dcb-af5e-94e118807950': 'Anim_SimpleArcWeldLayout'  // 焊接产线动画
      };
      
      // 如果是已知的历史UUID，转换为动画名称
      let searchId = animationId;
      if (uuidToNameMap[animationId]) {
        searchId = uuidToNameMap[animationId];
      }
      
      // 首先尝试从 coursewareData.animations 中查找对应的动画名称
      let animationNameFromData: string | null = null;
      if (coursewareData?.animations) {
        const coursewareAnim = (coursewareData.animations as any[]).find(
          (anim: any) => anim.id === animationId || anim.id === searchId
        );
        if (coursewareAnim?.name) {
          animationNameFromData = coursewareAnim.name;
        }
      }
      
      // 优先使用从课件数据中找到的动画名称
      if (animationNameFromData) {
        searchId = animationNameFromData;
      }
      
      // 1. 精确名称匹配（优先，因为用户选择的是名称）
      let targetAnimation = animationsRef.current.find(clip => clip.name === searchId || clip.name === animationId);
      if (!targetAnimation) {
        // 2. 精确UUID匹配
        targetAnimation = animationsRef.current.find(clip => clip.uuid === searchId || clip.uuid === animationId);
      }
      if (!targetAnimation) {
        // 3. 部分名称匹配（包含关系）
        targetAnimation = animationsRef.current.find(clip => 
          clip.name.includes(searchId) || searchId.includes(clip.name) ||
          clip.name.includes(animationId) || animationId.includes(clip.name)
        );
      }
      if (!targetAnimation) {
        // 4. 模糊名称匹配（根据关键词）
        const lowerAnimationId = searchId.toLowerCase();
        
        // 根据关键词尝试匹配已知动画类型
        if (lowerAnimationId.includes('71361f28') || lowerAnimationId.includes('拆装') || lowerAnimationId.includes('assembly')) {
          // 查找拆装相关动画
          targetAnimation = animationsRef.current.find(clip => 
            clip.name.includes('拆装') || clip.name.includes('assembly') || clip.name.includes('安装')
          );
        }
        
        if (!targetAnimation && (lowerAnimationId.includes('旋转') || lowerAnimationId.includes('rotate'))) {
          // 查找旋转相关动画
          targetAnimation = animationsRef.current.find(clip => 
            clip.name.includes('旋转') || clip.name.includes('rotate') || clip.name.includes('转动')
          );
        }
        
        // 5. 如果还没找到，返回默认值
        if (!targetAnimation) {
          return 3; // 返回默认3秒，但不播放动画
        }
      }

      // 查找三维课件动画数据（包含相机轨道关键帧）
      // 优先使用 animationId 匹配，如果没有则使用动画名称匹配
      let coursewareAnimation: any = null;
      if (coursewareData?.animations) {
        // 首先尝试通过 animationId 匹配
        coursewareAnimation = (coursewareData.animations as any[]).find(
          (anim: any) => anim.id === animationId || anim.id === searchId
        );
        // 如果找不到，尝试通过名称匹配
        if (!coursewareAnimation && targetAnimation) {
          coursewareAnimation = (coursewareData.animations as any[]).find(
            (anim: any) => anim.name === targetAnimation.name || anim.name === animationId || anim.name === searchId
          );
        }
      }
      
      // 读取相机轨道关键帧
      let cameraKeys: any[] = [];
      if (coursewareAnimation?.timeline?.cameraKeys) {
        cameraKeys = [...coursewareAnimation.timeline.cameraKeys].sort((a: any, b: any) => a.time - b.time);
      }
      
      // 辅助函数：检查是否是有效的三维向量
      const isVec3 = (v: any): v is [number, number, number] => 
        Array.isArray(v) && v.length === 3 && v.every((x: any) => typeof x === 'number' && isFinite(x));
      
      // 辅助函数：线性插值
      const lerp = (a: number, b: number, s: number) => a + (b - a) * s;
      
      // 更新相机位置的函数
      const updateCamera = (currentTime: number) => {
        if (cameraKeys.length === 0 || !cameraRef.current || !controlsRef.current) return;
        
        const camera = cameraRef.current;
        const controls = controlsRef.current;
        
        // 找到当前时间对应的关键帧
        let k0 = cameraKeys[0];
        let k1 = cameraKeys[cameraKeys.length - 1];
        for (let i = 0; i < cameraKeys.length; i++) {
          if (cameraKeys[i].time <= currentTime) k0 = cameraKeys[i];
          if (cameraKeys[i].time >= currentTime) { k1 = cameraKeys[i]; break; }
        }
        
        // 计算插值系数
        let s = Math.max(0, Math.min(1, (k1.time === k0.time) ? 0 : (currentTime - k0.time) / (k1.time - k0.time)));
        const ease = k0.easing || 'easeInOut';
        if (ease === 'easeInOut') {
          // easeInOutCubic
          s = s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
        }
        
        // 插值相机位置
        const pos0 = isVec3(k0.position) ? k0.position : [camera.position.x, camera.position.y, camera.position.z] as [number, number, number];
        const pos1 = isVec3(k1.position) ? k1.position : pos0;
        const tar0 = isVec3(k0.target) ? k0.target : [controls.target.x, controls.target.y, controls.target.z] as [number, number, number];
        const tar1 = isVec3(k1.target) ? k1.target : tar0;
        
        const pos: [number, number, number] = [
          lerp(pos0[0], pos1[0], s),
          lerp(pos0[1], pos1[1], s),
          lerp(pos0[2], pos1[2], s)
        ];
        const tar: [number, number, number] = [
          lerp(tar0[0], tar1[0], s),
          lerp(tar0[1], tar1[1], s),
          lerp(tar0[2], tar1[2], s)
        ];
        
        camera.position.set(pos[0], pos[1], pos[2]);
        controls.target.set(tar[0], tar[1], tar[2]);
        camera.updateProjectionMatrix();
        controls.update();
      };
      
      // 动画循环引用
      let animationFrameId: number | null = null;
      const startTimeMs = Date.now();
      const baseTime = startTime !== undefined ? startTime : 0;
      const duration = endTime !== undefined ? (endTime - startTime!) : (targetAnimation?.duration || 3);
      
      // 动画更新循环
      const animateLoop = () => {
        if (!targetAnimation || !mixerRef.current) return;
        
        const action = mixerRef.current.clipAction(targetAnimation);
        
        // 更新动画混合器（必须调用，否则动画不会播放）
        const delta = 0.016; // 假设60fps
        mixerRef.current.update(delta);
        
        if (!action.isRunning()) {
          if (animationFrameId !== null) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
          }
          return;
        }
        
        const elapsed = (Date.now() - startTimeMs) / 1000;
        // 相机轨道关键帧的时间是相对于动画开始时间的，所以使用 elapsed 而不是 baseTime + elapsed
        const currentTime = elapsed;
        
        // 更新相机位置（如果有相机轨道关键帧）
        if (cameraKeys.length > 0) {
          updateCamera(currentTime);
        }
        
        animationFrameId = requestAnimationFrame(animateLoop);
      };

      if (targetAnimation) {
        const action = mixerRef.current.clipAction(targetAnimation);
        action.reset();
        
        if (startTime !== undefined && endTime !== undefined) {
          // 播放指定时间段
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.time = startTime;
          action.play();
          
          // 初始相机位置
          if (cameraKeys.length > 0) {
            updateCamera(startTime);
          }
          
          // 开始动画循环
          animateLoop();
          
          // 在指定时间停止
          setTimeout(() => {
            action.stop();
            if (animationFrameId !== null) {
              cancelAnimationFrame(animationFrameId);
              animationFrameId = null;
            }
            // 设置最终相机位置
            if (cameraKeys.length > 0) {
              updateCamera(endTime);
            }
          }, duration * 1000);
        } else {
          // 播放完整动画
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          action.play();
          
          // 初始相机位置
          if (cameraKeys.length > 0) {
            updateCamera(0);
          }
          
          // 开始动画循环
          animateLoop();
        }
        
        return targetAnimation.duration || 3; // 返回动画持续时间（秒）
      } else {
        if (animationsRef.current.length > 0) {
          const fallbackAnimation = animationsRef.current[0];
          const action = mixerRef.current.clipAction(fallbackAnimation);
          action.reset();
          action.play();
          
          // 初始相机位置
          if (cameraKeys.length > 0) {
            updateCamera(0);
          }
          
          // 开始动画循环
          animateLoop();
          
          return fallbackAnimation.duration || 3; // 返回动画持续时间（秒）
        }
      }
      
      return 3; // 如果没有动画，返回默认3秒
    };

    // 获取动画持续时间（不播放）
    const getAnimationDuration = (animationId: string): number => {
      if (!animationsRef.current.length) {
        return 3; // 默认3秒
      }

      // 历史UUID到动画名称的映射（与playAnimation保持一致）
      const uuidToNameMap: { [key: string]: string } = {
        'f647ea39-a47a-4dcb-af5e-94e118807950': 'Anim_SimpleArcWeldLayout'
      };
      
      let searchId = animationId;
      if (uuidToNameMap[animationId]) {
        searchId = uuidToNameMap[animationId];
      }
      
      // 查找动画（逻辑与playAnimation一致）
      let targetAnimation = animationsRef.current.find(clip => clip.uuid === searchId);
      
      if (!targetAnimation) {
        targetAnimation = animationsRef.current.find(clip => clip.name === searchId);
      }
      
      if (!targetAnimation) {
        const lowerAnimationId = searchId.toLowerCase();
        
        if (lowerAnimationId.includes('71361f28') || lowerAnimationId.includes('拆装') || lowerAnimationId.includes('assembly')) {
          targetAnimation = animationsRef.current.find(clip => 
            clip.name.includes('拆装') || clip.name.includes('assembly') || clip.name.includes('安装')
          );
        }
        
        if (!targetAnimation && (lowerAnimationId.includes('旋转') || lowerAnimationId.includes('rotate'))) {
          targetAnimation = animationsRef.current.find(clip => 
            clip.name.includes('旋转') || clip.name.includes('rotate') || clip.name.includes('转动')
          );
        }
        
        if (!targetAnimation) {
          targetAnimation = animationsRef.current.find(clip => clip.name !== 'All Animations');
        }
      }
      
      if (targetAnimation) {
        return targetAnimation.duration || 3;
      }
      
      return 3; // 默认3秒
    };

    // 暴露控制方法
    // 获取所有可交互对象（用于XR射线检测）
    const getInteractableObjects = (): THREE.Object3D[] => {
      const objects: THREE.Object3D[] = [];
      if (modelRootRef.current) {
        modelRootRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            objects.push(child);
          }
        });
      }
      // 添加标注
      annotationsRef.current.forEach(annotation => {
        objects.push(annotation);
      });
      return objects;
    };

    useImperativeHandle(ref, () => ({
      focusOnNode,
      highlightNode,
      setNodeVisibility,
      showAnnotations,
      hideAnnotations,
      resetAllStates,
      startAutoRotation,
      stopAutoRotation,
      playAnimation,
      getAnimationDuration,
      // WebXR 支持
      getRenderer: () => rendererRef.current,
      getScene: () => sceneRef.current,
      getCamera: () => cameraRef.current,
      getModelRoot: () => modelRootRef.current,
      getInteractableObjects
    }));

    // 初始化和清理（只在组件挂载时执行一次）
    useEffect(() => {
      // 检查WebGL支持
      if (!checkWebGLSupport()) {
        setWebglSupported(false);
        return;
      }
      setWebglSupported(true);

      initThreeJS();

      return () => {
        // 停止渲染循环
        if (rendererRef.current) {
          rendererRef.current.setAnimationLoop(null);
        }
        
        // 清理高斯泼溅查看器
        if (splatViewerRef.current) {
          try {
            if (sceneRef.current) {
              sceneRef.current.remove(splatViewerRef.current);
            }
            if (splatViewerRef.current.dispose) {
              splatViewerRef.current.dispose();
            }
          } catch (e) {
            console.warn('清理高斯泼溅查看器时出错:', e);
          }
          splatViewerRef.current = null;
        }
        
        // 清理资源
        if (containerRef.current && rendererRef.current) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
        
        if (rendererRef.current) {
          rendererRef.current.dispose();
        }
        
        if (mixerRef.current) {
          mixerRef.current.stopAllAction();
        }
      };
    }, []); // 只在挂载时初始化，尺寸变化由下面的 useEffect 处理

    // 监听尺寸变化，更新渲染器和相机
    useEffect(() => {
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.setSize(width, height);
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        
        // 更新后处理composer
        if (composerRef.current) {
          composerRef.current.setSize(width, height);
        }
      }
    }, [width, height]);

    // 加载模型和应用设置
    useEffect(() => {
      if (coursewareData?.modelUrl && sceneRef.current) {
        // 先应用背景设置（在模型加载前），即使没有settings也使用默认值
        applySettings(coursewareData?.settings || {});
        // 然后加载模型（模型加载完成后会再次应用设置以确保正确）
        loadModel(coursewareData.modelUrl).then(() => {
          // 模型加载完成后再次应用设置，确保背景正确显示
          applySettings(coursewareData?.settings || {});
        }).catch(() => {
          // 加载失败时也应用设置
          applySettings(coursewareData?.settings || {});
        });
      } else {
        // 如果没有模型URL，直接应用设置（使用默认值）
        applySettings(coursewareData?.settings || {});
      }
    }, [coursewareData?.modelUrl, coursewareData?.settings]);

    // WebGL不支持的提示
    if (webglSupported === false) {
      return (
        <div style={{ 
          width, 
          height, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: 'white',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>🎮</div>
          <div style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px' }}>
            3D 功能暂不可用
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: 'rgba(255,255,255,0.7)',
            maxWidth: '400px',
            lineHeight: 1.6
          }}>
            您的设备或浏览器暂不支持 WebGL 3D 渲染。课程音频讲解仍可正常播放。
          </div>
          {loadError && (
            <div style={{
              marginTop: '16px',
              padding: '10px 16px',
              background: 'rgba(255,100,100,0.2)',
              borderRadius: '8px',
              fontSize: '11px',
              color: 'rgba(255,200,200,0.8)',
              maxWidth: '90%',
              wordBreak: 'break-all'
            }}>
              错误详情: {loadError}
            </div>
          )}
          <div style={{
            marginTop: '20px',
            padding: '12px 20px',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)'
          }}>
            💡 提示：请关闭其他标签页后刷新，或尝试使用 Chrome 浏览器
          </div>
        </div>
      );
    }

    return (
      <div style={{ position: 'relative', width, height }}>
        <div 
          ref={containerRef} 
          style={{ 
            width, 
            height, 
            background: '#2c2c2c',
            borderRadius: '8px',
            overflow: 'hidden'
          }} 
        />
        
        {loading && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Spin size="large" />
            <span style={{ marginLeft: 16 }}>加载3D模型中...</span>
          </div>
        )}
        
        {loadError && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Alert
              message="加载失败"
              description={loadError}
              type="error"
              showIcon
            />
          </div>
        )}
      </div>
    );
  }
);

PublicThreeDViewer.displayName = 'PublicThreeDViewer';

export default PublicThreeDViewer;