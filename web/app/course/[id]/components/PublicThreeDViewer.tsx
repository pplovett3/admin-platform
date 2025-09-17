"use client";
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Spin, Alert } from 'antd';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';

interface PublicThreeDViewerProps {
  coursewareData?: any;
  width?: number;
  height?: number;
}

export interface PublicThreeDViewerControls {
  focusOnNode: (nodeKey: string) => void;
  highlightNode: (nodeKey: string, highlight: boolean) => void;
  showAnnotations: (ids: string[]) => void;
  hideAnnotations: (ids: string[]) => void;
  resetAllStates: () => void;
  startAutoRotation: () => void;
  stopAutoRotation: () => void;
  playAnimation: (animationId: string) => void;
}

const PublicThreeDViewer = forwardRef<PublicThreeDViewerControls, PublicThreeDViewerProps>(
  ({ coursewareData, width = 800, height = 600 }, ref) => {
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
    const materialBackupRef = useRef<WeakMap<any, { emissive?: THREE.Color, emissiveIntensity?: number }>>(new WeakMap());
    const highlightedMatsRef = useRef<Set<any>>(new Set());
    const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
    const autoRotationRef = useRef<boolean>(false);
    const rotationSpeedRef = useRef<number>(0.005);
    const cameraAnimationRef = useRef<any>(null);
    
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [webglSupported, setWebglSupported] = useState<boolean | null>(null);

    // WebGL支持检测
    const checkWebGLSupport = (): boolean => {
      try {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!context;
      } catch (e) {
        return false;
      }
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
      
      // 应用渐变背景
      const gradientTexture = createGradientTexture();
      scene.background = gradientTexture;
      
      sceneRef.current = scene;

      // 创建相机
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      camera.position.set(5, 5, 5);
      cameraRef.current = camera;

      // 创建渲染器，添加错误处理
      try {
        const renderer = new THREE.WebGLRenderer({ 
          antialias: true,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false
        });
        
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;   // 启用阴影系统
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;  // 软阴影
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1;
        
        // 监听WebGL上下文丢失事件
        renderer.domElement.addEventListener('webglcontextlost', (event) => {
          event.preventDefault();
          console.warn('WebGL上下文丢失');
          setLoadError('3D渲染上下文丢失，请刷新页面重试');
        });

        renderer.domElement.addEventListener('webglcontextrestored', () => {
          console.log('WebGL上下文已恢复');
          setLoadError(null);
        });
        
        rendererRef.current = renderer;
        
        // 创建控制器
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controlsRef.current = controls;

        // 将渲染器添加到DOM
        containerRef.current.appendChild(renderer.domElement);

        // 创建后处理
        const composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        composer.addPass(renderPass);
        
        const outlinePass = new OutlinePass(new THREE.Vector2(width, height), scene, camera);
        outlinePass.edgeStrength = 3;
        outlinePass.edgeGlow = 0.5;
        outlinePass.edgeThickness = 1;
        outlinePass.pulsePeriod = 2;
        outlinePass.visibleEdgeColor.set('#ffff00');
        outlinePass.hiddenEdgeColor.set('#ffff00');
        composer.addPass(outlinePass);
        
        composerRef.current = composer;
        outlineRef.current = outlinePass;

      } catch (error) {
        console.error('WebGL渲染器创建失败:', error);
        throw new Error('WebGL渲染器创建失败');
      }

      // 添加光照
      setupLights(scene);
      
      // 创建透明阴影接收平面
      const shadowPlane = createInvisibleShadowPlane(scene);
      shadowPlaneRef.current = shadowPlane;
      
      // 启动渲染循环
      startRenderLoop();
    };

    // 渲染循环
    const startRenderLoop = () => {
      const animate = () => {
        // 模型自转
        if (autoRotationRef.current && modelRootRef.current) {
          modelRootRef.current.rotation.y += rotationSpeedRef.current;
        }
        
        // 动画混合器更新
        if (mixerRef.current) {
          mixerRef.current.update(0.01);
        }
        
        // 标注缩放更新
        updateAnnotationScaling();
        
        // 相机动画更新
        if (cameraAnimationRef.current) {
          cameraAnimationRef.current.update();
        }
        
        // 控制器更新
        if (controlsRef.current) {
          controlsRef.current.update();
        }
        
        // 渲染场景
        if (composerRef.current) {
          composerRef.current.render();
        } else if (rendererRef.current && sceneRef.current && cameraRef.current) {
          rendererRef.current.render(sceneRef.current, cameraRef.current);
        }
        
        requestAnimationFrame(animate);
      };
      animate();
    };

    const setupLights = (scene: THREE.Scene) => {
      // 环境光 - 调整以配合渐变背景
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      scene.add(ambientLight);

      // 主光源 - 启用阴影投射
      const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
      directionalLight.position.set(15, 20, 10);
      directionalLight.castShadow = true;
      
      // 阴影设置
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      directionalLight.shadow.camera.near = 0.5;
      directionalLight.shadow.camera.far = 50;
      directionalLight.shadow.camera.left = -20;
      directionalLight.shadow.camera.right = 20;
      directionalLight.shadow.camera.top = 20;
      directionalLight.shadow.camera.bottom = -20;
      directionalLight.shadow.bias = -0.0001;
      
      scene.add(directionalLight);

      // 补光源 - 无阴影，增强细节可见性
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
      fillLight.position.set(-5, 5, -5);
      scene.add(fillLight);

      // 半球光 - 配合渐变背景
      const hemisphereLight = new THREE.HemisphereLight(0x555555, 0x333333, 0.4);
      scene.add(hemisphereLight);
    };

    // 自适应缩放标注
    const updateAnnotationScaling = () => {
      if (!cameraRef.current) return;
      
      annotationsRef.current.forEach(annotationGroup => {
        annotationGroup.traverse((child) => {
          if (child instanceof THREE.Sprite && child.userData.isDistanceScaling) {
            // 计算到相机的距离
            const distance = child.position.distanceTo(cameraRef.current!.position);
            
            // 基于距离调整缩放（保持固定像素大小）
            const scaleFactor = Math.max(0.5, Math.min(3.0, distance / 10)); // 限制缩放范围
            const originalScale = child.userData.originalScale;
            
            if (originalScale) {
              child.scale.set(
                originalScale.x * scaleFactor,
                originalScale.y * scaleFactor,
                originalScale.z * scaleFactor
              );
            }
          }
        });
      });
    };

    const loadModel = async (modelUrl: string) => {
      if (!sceneRef.current) return;

      setLoading(true);
      setLoadError(null);

      try {
        const manager = new THREE.LoadingManager();
        
        const ktx2 = new KTX2Loader(manager)
          .setTranscoderPath('https://unpkg.com/three@0.168.0/examples/jsm/libs/basis/');
        
        const draco = new DRACOLoader(manager)
          .setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        
        const loader = new GLTFLoader(manager)
          .setKTX2Loader(ktx2)
          .setDRACOLoader(draco);

        // 对于NAS的文件，使用公开代理来解决CORS问题
        let loadUrl = modelUrl;
        if (modelUrl.startsWith('https://dl.yf-xr.com/')) {
          loadUrl = `/api/public/proxy?url=${encodeURIComponent(modelUrl)}`;
        }
        
        console.log('Loading model from URL:', modelUrl);
        console.log('Actual load URL:', loadUrl);
        
        const gltf = await new Promise<any>((resolve, reject) => {
          loader.load(loadUrl, resolve, undefined, reject);
        });

        const model = gltf.scene;
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
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;
          animationsRef.current = gltf.animations;
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
        
      } catch (error) {
        console.error('模型加载失败:', error);
        setLoadError('模型加载失败，请检查网络连接');
        setLoading(false);
      }
    };

    // 构建节点映射
    const buildNodeMap = (model: THREE.Object3D) => {
      const nodeMap = new Map<string, THREE.Object3D>();
      
      model.traverse((child) => {
        if (child.name) {
          nodeMap.set(child.name, child);
          
          // 也按路径存储
          const path = getObjectPath(child);
          nodeMap.set(path.join('/'), child);
        }
        
        if (child.uuid) {
          nodeMap.set(child.uuid, child);
        }
      });
      
      nodeMapRef.current = nodeMap;
      console.log('节点映射构建完成:', Array.from(nodeMap.keys()));
    };

    // 获取对象路径
    const getObjectPath = (obj: THREE.Object3D): string[] => {
      const path: string[] = [];
      let current: THREE.Object3D | null = obj;
      
      while (current && current.name) {
        path.unshift(current.name);
        current = current.parent;
      }
      
      return path;
    };

    // 创建标注
    const createAnnotations = (annotations: any[]) => {
      annotations.forEach((annotation) => {
        const annotationGroup = createAnnotation(annotation);
        if (annotationGroup) {
          annotationsRef.current.push(annotationGroup);
          sceneRef.current!.add(annotationGroup);
          // 默认隐藏标注
          annotationGroup.visible = false;
        }
      });
    };

    // 创建单个标注
    const createAnnotation = (annotation: any): THREE.Object3D | null => {
      try {
        // 创建标注组
        const group = new THREE.Group();
        group.userData.annotationId = annotation.id;
        group.userData.nodeKey = annotation.nodeKey;
        
        // 设置位置
        if (annotation.position) {
          group.position.set(
            annotation.position.x,
            annotation.position.y,
            annotation.position.z
          );
        }

        // 创建标注图标
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext('2d')!;
        
        // 绘制圆形背景
        context.fillStyle = '#ff6b35';
        context.beginPath();
        context.arc(32, 32, 28, 0, Math.PI * 2);
        context.fill();
        
        // 绘制边框
        context.strokeStyle = '#ffffff';
        context.lineWidth = 3;
        context.stroke();
        
        // 绘制问号
        context.fillStyle = '#ffffff';
        context.font = 'bold 24px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText('?', 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
          map: texture,
          transparent: true,
          alphaTest: 0.1
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(1, 1, 1);
        sprite.userData.isDistanceScaling = true;
        sprite.userData.originalScale = { x: 1, y: 1, z: 1 };
        
        group.add(sprite);
        
        return group;
        
      } catch (error) {
        console.error('创建标注失败:', error, annotation);
        return null;
      }
    };

    // 应用设置
    const applySettings = (settings: any) => {
      if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;

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

      controlsRef.current.update();
    };

    // 智能匹配节点
    const findNodeBySmartMatch = (nodeKey: string): THREE.Object3D | undefined => {
      const nodeMap = nodeMapRef.current;
      
      // 1. 精确匹配
      if (nodeMap.has(nodeKey)) {
        return nodeMap.get(nodeKey)!;
      }
      
      // 2. 名称匹配
      for (const [key, object] of nodeMap.entries()) {
        if (object.name === nodeKey) {
          return object;
        }
      }
      
      // 3. 路径末尾匹配
      for (const [key, object] of nodeMap.entries()) {
        if (key.endsWith(`/${nodeKey}`) || key.endsWith(nodeKey)) {
          return object;
        }
      }
      
      // 4. 模糊匹配
      const lowerNodeKey = nodeKey.toLowerCase();
      for (const [key, object] of nodeMap.entries()) {
        if (key.toLowerCase().includes(lowerNodeKey) || 
            object.name.toLowerCase().includes(lowerNodeKey)) {
          return object;
        }
      }
      
      return undefined;
    };

    // 对焦到节点
    const focusOnNode = (nodeKey: string) => {
      console.log('正在对焦节点:', nodeKey);
      let targetObject = nodeMapRef.current.get(nodeKey);
      
      // 如果直接找不到，尝试智能匹配
      if (!targetObject) {
        targetObject = findNodeBySmartMatch(nodeKey);
      }
      
      if (!targetObject) {
        console.warn('未找到节点:', nodeKey);
        console.log('可用节点:', Array.from(nodeMapRef.current.keys()));
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

    // 高亮节点
    const highlightNode = (nodeKey: string, highlight: boolean) => {
      console.log('设置高亮:', nodeKey, highlight);
      
      let targetObject = nodeMapRef.current.get(nodeKey);
      if (!targetObject) {
        targetObject = findNodeBySmartMatch(nodeKey);
      }
      
      if (!targetObject) {
        console.warn('未找到要高亮的节点:', nodeKey);
        return;
      }

      if (highlight) {
        // 添加到高亮列表
        if (outlineRef.current) {
          outlineRef.current.selectedObjects = [targetObject];
        }
      } else {
        // 从高亮列表移除
        if (outlineRef.current) {
          outlineRef.current.selectedObjects = [];
        }
      }
    };

    // 显示标注
    const showAnnotations = (ids: string[]) => {
      console.log('显示标注:', ids);
      annotationsRef.current.forEach(annotation => {
        const annotationId = annotation.userData.annotationId;
        if (ids.includes(annotationId)) {
          annotation.visible = true;
        }
      });
    };

    // 隐藏标注
    const hideAnnotations = (ids: string[]) => {
      console.log('隐藏标注:', ids);
      annotationsRef.current.forEach(annotation => {
        const annotationId = annotation.userData.annotationId;
        if (ids.includes(annotationId)) {
          annotation.visible = false;
        }
      });
    };

    // 重置所有状态
    const resetAllStates = () => {
      console.log('重置所有状态');
      
      // 清除高亮
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
    };

    // 开始自转
    const startAutoRotation = () => {
      console.log('开始模型自转');
      autoRotationRef.current = true;
    };

    // 停止自转
    const stopAutoRotation = () => {
      console.log('停止模型自转');
      autoRotationRef.current = false;
    };

    // 播放动画
    const playAnimation = (animationId: string) => {
      console.log('播放动画:', animationId);
      
      if (!mixerRef.current || !animationsRef.current.length) {
        console.warn('没有可用的动画');
        return;
      }

      // 停止所有当前动画
      mixerRef.current.stopAllAction();

      // 查找动画
      let targetAnimation = animationsRef.current.find(clip => clip.uuid === animationId);
      if (!targetAnimation) {
        targetAnimation = animationsRef.current.find(clip => clip.name === animationId);
      }

      if (targetAnimation) {
        const action = mixerRef.current.clipAction(targetAnimation);
        action.reset();
        action.play();
        console.log('开始播放动画:', targetAnimation.name);
      } else {
        console.warn('未找到动画:', animationId);
        console.log('可用动画:', animationsRef.current.map(clip => ({ name: clip.name, uuid: clip.uuid })));
      }
    };

    // 暴露控制方法
    useImperativeHandle(ref, () => ({
      focusOnNode,
      highlightNode,
      showAnnotations,
      hideAnnotations,
      resetAllStates,
      startAutoRotation,
      stopAutoRotation,
      playAnimation
    }));

    // 初始化和清理
    useEffect(() => {
      // 检查WebGL支持
      if (!checkWebGLSupport()) {
        setWebglSupported(false);
        return;
      }
      setWebglSupported(true);

      initThreeJS();

      return () => {
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
    }, [width, height]);

    // 加载模型
    useEffect(() => {
      if (coursewareData?.modelUrl && sceneRef.current) {
        loadModel(coursewareData.modelUrl);
      }
    }, [coursewareData?.modelUrl]);

    // WebGL不支持的提示
    if (webglSupported === false) {
      return (
        <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Alert
            message="WebGL不支持"
            description="您的浏览器不支持WebGL，无法显示3D内容。请使用现代浏览器如Chrome、Firefox、Safari或Edge。"
            type="error"
            showIcon
          />
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