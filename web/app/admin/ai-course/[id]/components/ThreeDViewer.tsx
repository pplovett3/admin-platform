"use client";
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { getToken } from '@/app/_lib/api';

interface ThreeDViewerProps {
  coursewareData?: any;
  width?: number;
  height?: number;
  onModelLoaded?: (model: THREE.Object3D) => void;
  onControlsReady?: (controls: any) => void;
}

export default function ThreeDViewer({ coursewareData, width = 800, height = 600, onModelLoaded, onControlsReady }: ThreeDViewerProps) {
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
      // 创建一个临时canvas来测试WebGL
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      
      if (!gl) {
        console.warn('WebGL不被支持');
        return false;
      }

      // 类型断言为WebGL上下文
      const webglContext = gl as WebGLRenderingContext;

      // 检查WebGL扩展
      const renderer = webglContext.getParameter(webglContext.RENDERER);
      const vendor = webglContext.getParameter(webglContext.VENDOR);
      
      console.log('WebGL信息:', { renderer, vendor });
      
      // 检查是否被软件渲染阻止
      if (renderer && renderer.toLowerCase().includes('software')) {
        console.warn('WebGL使用软件渲染，性能可能较差');
      }

      return true;
    } catch (error) {
      console.error('WebGL检测失败:', error);
      return false;
    }
  };

  // 初始化Three.js场景
  useEffect(() => {
    if (!containerRef.current) return;

    // 先检查WebGL支持
    const supported = checkWebGLSupport();
    setWebglSupported(supported);
    
    if (!supported) {
      setLoadError('您的浏览器不支持WebGL，无法显示3D内容。请尝试：\n1. 更新浏览器到最新版本\n2. 启用硬件加速\n3. 使用Chrome、Firefox、Edge等现代浏览器');
      return;
    }

    try {
      initThreeJS();
      animate();
    } catch (error) {
      console.error('Three.js初始化失败:', error);
      setWebglSupported(false);
      setLoadError('3D渲染器初始化失败，请刷新页面重试');
    }

    return () => {
      cleanup();
    };
  }, []);

  // 当课件数据变化时加载模型和应用设置
  useEffect(() => {
    // 优先使用修改后的模型URL，否则使用原始URL
    const modelUrl = coursewareData?.modifiedModelUrl || coursewareData?.modelUrl;
    if (modelUrl) {
      console.log('加载模型URL:', modelUrl);
      console.log('课件数据:', {
        originalUrl: coursewareData?.modelUrl,
        modifiedUrl: coursewareData?.modifiedModelUrl,
        finalUrl: modelUrl
      });
      loadModel(modelUrl);
    }
    if (coursewareData?.settings) {
      applySettings(coursewareData.settings);
    }
  }, [coursewareData]);

  // 窗口大小变化时调整视图
  useEffect(() => {
    if (rendererRef.current && cameraRef.current) {
      rendererRef.current.setSize(width, height);
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      if (composerRef.current) {
        composerRef.current.setSize(width, height);
      }
    }
  }, [width, height]);

  // 【新增】创建渐变背景纹理 - 参考图片效果
  const createGradientTexture = (): THREE.Texture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    
    const context = canvas.getContext('2d');
    if (!context) throw new Error('无法创建Canvas上下文');
    
    // 创建垂直渐变 - 参考图片中的渐变色调
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#1a1a1a');    // 顶部更深的灰色
    gradient.addColorStop(0.3, '#2a2a2a');  // 上中部分
    gradient.addColorStop(0.6, '#3a3a3a');  // 中部分
    gradient.addColorStop(0.8, '#4a4a4a');  // 下中部分  
    gradient.addColorStop(1, '#5a5a5a');    // 底部较亮的灰色
    
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    
    return texture;
  };

  // 【新增】创建透明阴影接收平面 - 只显示阴影，不显示地面
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
    
    // 添加到场景
    scene.add(shadowPlane);
    
    return shadowPlane;
  };

  // 【新增】基于模型包围盒调整阴影平面位置
  const adjustShadowPlanePosition = (model: THREE.Object3D, shadowPlane: THREE.Mesh) => {
    const box = new THREE.Box3().setFromObject(model);
    
    // 将阴影平面放置在模型底部稍下方
    const shadowY = box.min.y - 0.05;
    shadowPlane.position.y = shadowY;
    
    console.log('阴影平面位置调整:', {
      modelBounds: { min: box.min, max: box.max },
      shadowY: shadowY
    });
  };

  const initThreeJS = () => {
    if (!containerRef.current) return;

    // 创建场景
    const scene = new THREE.Scene();
    
    // 【新增】创建渐变背景纹理 - 参考图片效果
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
      renderer.shadowMap.enabled = true;   // 重新启用阴影系统
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
    
    // 【新增】创建透明阴影接收平面
    const shadowPlane = createInvisibleShadowPlane(scene);
    shadowPlaneRef.current = shadowPlane;
    
    // 启动渲染循环
    startRenderLoop();
  };

  // 【新增】渲染循环
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
      
      // 渲染场景
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
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

  const applySettings = (settings: any) => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;

    // 【注释】跳过背景色设置，使用渐变背景
    // if (settings.background) {
    //   sceneRef.current.background = new THREE.Color(settings.background);
    // }

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

    // 应用灯光设置
    if (settings.lighting) {
      applyLightingSettings(settings.lighting);
    }

    controlsRef.current.update();
  };

  const applyLightingSettings = (lighting: any) => {
    if (!sceneRef.current) return;

    // 清除现有灯光（除了环境光）
    const lightsToRemove = sceneRef.current.children.filter(child => 
      child instanceof THREE.DirectionalLight || 
      child instanceof THREE.HemisphereLight ||
      child instanceof THREE.PointLight
    );
    lightsToRemove.forEach(light => sceneRef.current!.remove(light));

    // 重新设置灯光
    if (lighting.ambient) {
      const ambientLight = new THREE.AmbientLight(lighting.ambient.color || 0x404040, lighting.ambient.intensity || 0.4);
      sceneRef.current.add(ambientLight);
    }

    if (lighting.directional) {
      const directionalLight = new THREE.DirectionalLight(
        lighting.directional.color || 0xffffff, 
        lighting.directional.intensity || 1
      );
      if (lighting.directional.position) {
        directionalLight.position.set(
          lighting.directional.position.x || 10,
          lighting.directional.position.y || 10,
          lighting.directional.position.z || 5
        );
      }
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      sceneRef.current.add(directionalLight);
    }

    if (lighting.hemisphere) {
      const hemisphereLight = new THREE.HemisphereLight(
        lighting.hemisphere.skyColor || 0xffffff,
        lighting.hemisphere.groundColor || 0x444444,
        lighting.hemisphere.intensity || 0.3
      );
      sceneRef.current.add(hemisphereLight);
    }
  };

  const loadModel = async (modelUrl: string) => {
    if (!sceneRef.current || !rendererRef.current || !cameraRef.current) return;

    setLoading(true);
    setLoadError(null);

    try {
      // 清除旧模型
      if (modelRootRef.current) {
        sceneRef.current.remove(modelRootRef.current);
        modelRootRef.current = null;
      }

      // 构建加载URL（处理认证和代理）
      let finalUrl = modelUrl;
      if (modelUrl.startsWith('/api/files/')) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
        finalUrl = `${baseUrl}${modelUrl}`;
      } else if (modelUrl.startsWith('https://dl.yf-xr.com/') || modelUrl.startsWith('https://video.yf-xr.com/')) {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
        finalUrl = `${baseUrl}/api/files/proxy?url=${encodeURIComponent(modelUrl)}`;
      }

      // 配置加载器
      const manager = new THREE.LoadingManager();
      const ktx2 = new KTX2Loader(manager)
        .setTranscoderPath('https://unpkg.com/three@0.164.0/examples/jsm/libs/basis/')
        .detectSupport(rendererRef.current);
      const draco = new DRACOLoader(manager)
        .setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      const loader = new GLTFLoader(manager)
        .setKTX2Loader(ktx2)
        .setDRACOLoader(draco);

      // 使用fetch加载（支持认证）
      const token = getToken();
      const response = await fetch(finalUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      
      // 加载GLTF
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.parse(arrayBuffer, '', resolve, reject);
      });

      const model = gltf.scene;
      modelRootRef.current = model;
      sceneRef.current.add(model);

      // 设置模型阴影投射
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;  // 投射阴影
        }
      });

      // 构建节点映射
      buildNodeMap(model);

      // 设置动画
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        animationsRef.current = gltf.animations;
      }

      // 自动调整相机视角
      fitCameraToModel(model);

      // 【新增】调整阴影平面位置
      if (shadowPlaneRef.current) {
        adjustShadowPlanePosition(model, shadowPlaneRef.current);
      }

      // 处理标注
      if (coursewareData?.annotations) {
        createAnnotations(coursewareData.annotations);
      }

      console.log('模型加载成功:', model);
      onModelLoaded?.(model);

    } catch (error) {
      console.error('模型加载失败:', error);
      setLoadError(error instanceof Error ? error.message : '模型加载失败');
    } finally {
      setLoading(false);
    }
  };

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
    console.log('节点映射构建完成，总数:', map.size);
    console.log('样例节点键:', Array.from(map.keys()).slice(0, 10));
  };

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

  const fitCameraToModel = (model: THREE.Object3D) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    // 设置相机位置
    const distance = size * 1.5;
    cameraRef.current.position.copy(center);
    cameraRef.current.position.x += distance;
    cameraRef.current.position.y += distance * 0.5;
    cameraRef.current.position.z += distance;
    cameraRef.current.lookAt(center);

    // 设置控制器
    controlsRef.current.target.copy(center);
    controlsRef.current.maxDistance = distance * 3;
    controlsRef.current.minDistance = distance * 0.1;
    controlsRef.current.update();
  };

  const findNodeBySmartMatch = (nodeKey: string): THREE.Object3D | undefined => {
    console.log('智能匹配节点:', nodeKey);
    
    // 方案1: 尝试按路径拆分匹配
    if (nodeKey.includes('/')) {
      // 提取最后一部分作为目标名称
      const targetName = nodeKey.split('/').pop();
      if (targetName) {
        // 寻找包含目标名称的路径
        for (const [key, obj] of nodeMapRef.current) {
          if (key.includes(targetName) && key.includes('/')) {
            console.log(`通过路径匹配找到: ${key} -> ${targetName}`);
            return obj;
          }
        }
        
        // 直接匹配名称
        const directMatch = nodeMapRef.current.get(targetName);
        if (directMatch) {
          console.log(`通过名称直接匹配找到: ${targetName}`);
          return directMatch;
        }
      }
    }

    // 方案2: 模糊匹配（部分包含）
    for (const [key, obj] of nodeMapRef.current) {
      if (key.includes(nodeKey) || nodeKey.includes(key)) {
        console.log(`通过模糊匹配找到: ${key} 匹配 ${nodeKey}`);
        return obj;
      }
    }

    // 方案3: 按节点名称搜索
    for (const [key, obj] of nodeMapRef.current) {
      if (obj.name && (obj.name === nodeKey || nodeKey.includes(obj.name))) {
        console.log(`通过对象名称匹配找到: ${obj.name}`);
        return obj;
      }
    }

    console.log('智能匹配失败');
    return undefined;
  };

  const findAnimationBySmartMatch = (animationId: string): THREE.AnimationClip | undefined => {
    const animations = animationsRef.current;
    console.log('查找动画:', animationId);
    console.log('可用动画:', animations.map(a => ({ name: a.name, uuid: a.uuid, duration: a.duration })));
    
    // 0. 如果传入的是课件动画的 id，尝试用课件数据里的名称进行转换
    if (coursewareData?.animations && !animations.find(a => a.uuid === animationId || a.name === animationId)) {
      const metaAnim = (coursewareData.animations as any[]).find(a => a.id === animationId);
      if (metaAnim?.name) {
        console.log('把课件动画ID映射为名称:', animationId, '->', metaAnim.name);
        animationId = metaAnim.name;
      }
    }

    // 1. 精确匹配UUID（优先，因为AI生成的是UUID）
    for (const animation of animations) {
      if (animation.uuid === animationId) {
        console.log('精确匹配动画UUID:', animation.uuid);
        return animation;
      }
    }

    // 2. 精确匹配名称
    for (const animation of animations) {
      if (animation.name === animationId) {
        console.log('精确匹配动画名称:', animation.name);
        return animation;
      }
    }

    // 3. 部分匹配UUID（兼容部分UUID）
    for (const animation of animations) {
      if (animation.uuid && animation.uuid.includes(animationId)) {
        console.log('部分匹配动画UUID:', animation.uuid);
        return animation;
      }
    }

    // 4. 关键词匹配（兼容中文名称）
    const keywords = ['拆装', '旋转', '轮胎', '安装', '移动', '转动'];
    for (const keyword of keywords) {
      if (animationId.includes(keyword)) {
        for (const animation of animations) {
          if (animation.name && animation.name.includes(keyword)) {
            console.log(`通过关键词"${keyword}"匹配找到动画:`, animation.name);
            return animation;
          }
        }
      }
    }

    // 5. 模糊匹配名称
    for (const animation of animations) {
      if (animation.name && (animation.name.includes(animationId) || animationId.includes(animation.name))) {
        console.log('模糊匹配动画名称:', animation.name);
        return animation;
      }
    }

    console.log('动画智能匹配失败');
    return undefined;
  };

  const createAnnotations = (annotations: any[]) => {
    if (!sceneRef.current) return;

    console.log('创建标注:', annotations.length, '个');

    // 清除旧标注
    annotationsRef.current.forEach(annotation => {
      sceneRef.current!.remove(annotation);
    });
    annotationsRef.current = [];

    // 创建新标注
    annotations.forEach((annotation, index) => {
      console.log(`处理标注 ${index + 1}:`, annotation.title, 'nodeKey:', annotation.nodeKey);
      
      // 尝试多种nodeKey匹配方式
      let targetObject = nodeMapRef.current.get(annotation.nodeKey);
      
      // 如果没找到，尝试用targetKey（UUID格式）
      if (!targetObject && annotation.targetKey) {
        targetObject = nodeMapRef.current.get(annotation.targetKey);
      }
      
      // 如果还是没找到，使用智能匹配
      if (!targetObject) {
        targetObject = findNodeBySmartMatch(annotation.nodeKey);
      }
      
      if (targetObject) {
        console.log('为对象创建标注:', targetObject.name || targetObject.uuid);
        const annotationGroup = createAnnotationWithOffset(annotation, targetObject);
        if (annotationGroup) {
          annotationGroup.userData.annotationId = annotation.id;
          annotationGroup.visible = false; // 默认隐藏，等待显示动作触发
          sceneRef.current!.add(annotationGroup);
          annotationsRef.current.push(annotationGroup);
          console.log('标注创建成功（默认隐藏）:', annotation.title);
        }
      } else {
        console.warn('未找到标注目标对象:', annotation.nodeKey);
        console.log('可用nodeKey:', Array.from(nodeMapRef.current.keys()).slice(0, 10));
      }
    });
    
    console.log('标注创建完成，总计:', annotationsRef.current.length, '个');
  };

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
        
        // 【修复】考虑模型根节点的坐标偏移
        if (modelRootRef.current) {
          modelRootRef.current.updateWorldMatrix(true, true);
          const rootPosition = new THREE.Vector3();
          modelRootRef.current.matrixWorld.decompose(rootPosition, new THREE.Quaternion(), new THREE.Vector3());
          // 如果根节点不在原点，添加根节点的位置偏移
          if (rootPosition.length() > 0.001) {
            console.log('检测到模型根节点偏移:', rootPosition.toArray(), '为标注添加根节点偏移');
            anchorWorld.add(rootPosition);
          }
        }
      } else if (annotation.position) {
        // 兼容格式：直接使用position
        anchorWorld = new THREE.Vector3(
          annotation.position.x || annotation.position[0], 
          annotation.position.y || annotation.position[1], 
          annotation.position.z || annotation.position[2]
        );
        
        // 【修复】为兼容格式也添加根节点偏移
        if (modelRootRef.current) {
          modelRootRef.current.updateWorldMatrix(true, true);
          const rootPosition = new THREE.Vector3();
          modelRootRef.current.matrixWorld.decompose(rootPosition, new THREE.Quaternion(), new THREE.Vector3());
          if (rootPosition.length() > 0.001) {
            anchorWorld.add(rootPosition);
          }
        }
      } else {
        // 默认：使用对象中心
        const box = new THREE.Box3().setFromObject(targetObject);
        anchorWorld = box.getCenter(new THREE.Vector3());
      }

      // 2. 计算标签位置（使用保存的固定偏移量）
      let labelWorld: THREE.Vector3;
      
      if (annotation.label && annotation.label.offset) {
        // 根据偏移的坐标系生成世界位置
        if (annotation.label.offsetSpace === 'local') {
          const offsetLocal = new THREE.Vector3(
            annotation.label.offset[0], 
            annotation.label.offset[1], 
            annotation.label.offset[2]
          );
          // 将局部向量变换到世界（考虑旋转与缩放）
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scl = new THREE.Vector3();
          targetObject.matrixWorld.decompose(pos, quat, scl);
          const offsetWorld = offsetLocal.clone().multiply(scl).applyQuaternion(quat);
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
        console.warn('标注缺少偏移信息，使用默认固定偏移:', annotation.id);
      }

      // 创建标注组
      const annotationGroup = new THREE.Group();
      annotationGroup.userData.annotationId = annotation.id;
      annotationGroup.userData.targetKey = annotation.targetKey || annotation.nodeKey;
      
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

      console.log('标注创建成功:', {
        id: annotation.id,
        title: annotation.title,
        anchorWorld: anchorWorld.toArray(),
        labelWorld: labelWorld.toArray()
      });

      return annotationGroup;
    } catch (error) {
      console.error('创建标注失败:', error);
      return null;
    }
  };

  const createLabelSprite = (annotation: any): THREE.Sprite | null => {
    try {
      const title = annotation.title || annotation.label?.title || 'Annotation';
      
      // 【自适应1】根据文字长度动态计算画布尺寸
      const measureCanvas = document.createElement('canvas');
      const measureContext = measureCanvas.getContext('2d')!;
      measureContext.font = 'bold 32px Arial, Microsoft YaHei, sans-serif';
      const textMetrics = measureContext.measureText(title);
      
      // 计算合适的画布尺寸
      const padding = 24;
      const minWidth = 120;
      const textWidth = Math.max(textMetrics.width, minWidth);
      const canvasWidth = Math.ceil(textWidth + padding * 2);
      const canvasHeight = 64;
      
      // 创建实际画布
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // 清空画布
      context.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制背景（圆角矩形）
      const cornerRadius = 8;
      context.fillStyle = 'rgba(30, 50, 80, 0.95)';
      context.beginPath();
      context.roundRect(4, 4, canvas.width - 8, canvas.height - 8, cornerRadius);
      context.fill();

      // 绘制边框
      context.strokeStyle = '#1890ff';
      context.lineWidth = 2;
      context.beginPath();
      context.roundRect(4, 4, canvas.width - 8, canvas.height - 8, cornerRadius);
      context.stroke();

      // 绘制文字
      context.fillStyle = 'white';
      context.font = 'bold 32px Arial, Microsoft YaHei, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(title, canvas.width / 2, canvas.height / 2);

      // 创建纹理和精灵
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.needsUpdate = true;
      
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        alphaTest: 0.1,
        transparent: true,
        depthTest: false, // 设为false确保标签在最前面
        depthWrite: false
      });
      
      const sprite = new THREE.Sprite(spriteMaterial);
      
      // 【自适应2】根据画布尺寸设置合适的世界尺寸（固定像素大小）
      const baseScale = 0.002; // 基础缩放，控制像素到世界单位的转换
      const scaledWidth = canvasWidth * baseScale;
      const scaledHeight = canvasHeight * baseScale;
      
      sprite.scale.set(scaledWidth, scaledHeight, 1);
      sprite.renderOrder = 10000; // 确保在最前面渲染
      
      // 【自适应3】添加距离自适应缩放功能
      sprite.userData.originalScale = { x: scaledWidth, y: scaledHeight };
      sprite.userData.isDistanceScaling = true;
      
      return sprite;
    } catch (error) {
      console.error('创建标签精灵失败:', error);
      return null;
    }
  };

  // 【自适应缩放】更新标注距离自适应缩放
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
              1
            );
          }
        }
      });
    });
  };

  const animate = () => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    requestAnimationFrame(animate);

    // 更新控制器
    if (controlsRef.current) {
      controlsRef.current.update();
    }

    // 更新动画混合器
    if (mixerRef.current) {
      mixerRef.current.update(0.016); // 假设60fps
    }

    // 【自适应缩放】更新标注距离自适应缩放
    updateAnnotationScaling();

    // 渲染
    if (composerRef.current) {
      composerRef.current.render();
    } else {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  const cleanup = () => {
    if (containerRef.current && rendererRef.current) {
      containerRef.current.removeChild(rendererRef.current.domElement);
    }
    
    if (rendererRef.current) {
      rendererRef.current.dispose();
    }
    
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
    }

    // 清理纹理和几何体
    sceneRef.current?.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material?.dispose();
        }
      }
    });
  };

  // 清除自发光高亮
  const clearEmissiveHighlight = () => {
    for (const m of Array.from(highlightedMatsRef.current)) {
      const backup = materialBackupRef.current.get(m);
      if (backup) {
        if ('emissive' in m && backup.emissive) m.emissive.copy(backup.emissive);
        if ('emissiveIntensity' in m && typeof backup.emissiveIntensity === 'number') m.emissiveIntensity = backup.emissiveIntensity;
      }
    }
    highlightedMatsRef.current.clear();
  };

  // 应用自发光高亮
  const applyEmissiveHighlight = (obj: THREE.Object3D) => {
    clearEmissiveHighlight();
    obj.traverse(o => {
      if ((o as any).material) {
        const mats = Array.isArray((o as any).material) ? (o as any).material : [(o as any).material];
        mats.forEach((mat: any) => {
          try {
            if (!materialBackupRef.current.has(mat)) {
              materialBackupRef.current.set(mat, { 
                emissive: mat.emissive ? mat.emissive.clone() : undefined, 
                emissiveIntensity: mat.emissiveIntensity 
              });
            }
            if (mat.emissive) mat.emissive.set(0x22d3ee); // 青色高亮
            if ('emissiveIntensity' in mat) mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0.2, 0.6);
            highlightedMatsRef.current.add(mat);
          } catch {}
        });
      }
    });
  };

  // 公开的控制方法
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
      console.log('找到目标对象:', targetObject.name || targetObject.uuid);
      
      // 使用三维课件编辑器的focusObject算法
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      const box = new THREE.Box3().setFromObject(targetObject);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      let dist = Math.abs(maxDim / Math.tan(fov / 2));
      dist = dist * 1.5; // 1.5倍距离确保对象完全可见
      
      // 设置观察方向（右上前方）
      const dir = new THREE.Vector3(1, 0.8, 1).normalize();
      const targetPos = center.clone().add(dir.multiplyScalar(dist));
      
      console.log('对焦中心:', center, '距离:', dist);
      
      // 调整近远平面
      camera.near = Math.max(0.01, dist / 1000);
      camera.far = dist * 100;
      camera.updateProjectionMatrix();
      
      // 【修改】使用平滑动画过渡到目标位置
      console.log('开始平滑相机动画 - 目标位置:', targetPos, '目标中心:', center);
      animateCameraToPosition(targetPos, center, 1500); // 1.5秒动画
    }
  };

  const highlightNode = (nodeKey: string, highlight: boolean = true) => {
    console.log('高亮节点:', nodeKey, highlight);
    let targetObject = nodeMapRef.current.get(nodeKey);
    
    // 如果直接找不到，尝试智能匹配
    if (!targetObject) {
      targetObject = findNodeBySmartMatch(nodeKey);
    }
    
    if (!targetObject) {
      console.warn('未找到要高亮的节点:', nodeKey);
      return;
    }

    if (outlineRef.current) {
      console.log('找到目标对象进行高亮:', targetObject.name || targetObject.uuid);
      
      if (highlight) {
        // 清除之前的高亮
        clearEmissiveHighlight();
        
        // 应用自发光高亮（使用三维课件编辑器的算法）
        applyEmissiveHighlight(targetObject);
        
        // 同时使用轮廓高亮
        outlineRef.current.selectedObjects = [targetObject];
        
        console.log('已高亮节点:', targetObject.name || targetObject.uuid);
      } else {
        // 清除高亮
        clearEmissiveHighlight();
        outlineRef.current.selectedObjects = [];
        console.log('已取消高亮');
      }
    }
  };

  const setNodeVisibility = (nodeKey: string, visible: boolean) => {
    console.log('设置节点显隐:', nodeKey, visible);
    let targetObject = nodeMapRef.current.get(nodeKey);
    
    // 如果直接找不到，尝试智能匹配
    if (!targetObject) {
      targetObject = findNodeBySmartMatch(nodeKey);
    }
    
    if (!targetObject) {
      console.warn('未找到要设置显隐的节点:', nodeKey);
      return;
    }

    console.log('设置对象显隐:', targetObject.name || targetObject.uuid, visible);
    targetObject.visible = visible;
    
    // 递归设置子对象
    targetObject.traverse((child) => {
      child.visible = visible;
    });
  };

  const playAnimation = (animationId: string, startTime?: number, endTime?: number) => {
    console.log('播放动画:', animationId, '时间:', startTime, '-', endTime);
    
    if (!mixerRef.current || !animationsRef.current.length) {
      console.warn('动画系统未初始化');
      return;
    }

    // 查找动画（支持多种匹配方式）
    let animation = animationsRef.current.find(anim => 
      anim.name === animationId || 
      anim.uuid === animationId ||
      anim.name?.includes(animationId)
    );

    // 如果找不到，尝试智能匹配
    if (!animation) {
      animation = findAnimationBySmartMatch(animationId);
    }
    
    if (!animation) {
      console.warn('未找到动画:', animationId);
      console.log('可用动画:', animationsRef.current.map(anim => ({
        name: anim.name,
        uuid: anim.uuid,
        duration: anim.duration
      })));
      return;
    }

    console.log('找到动画:', animation.name, '时长:', animation.duration);
    
    // 停止所有当前动画
    mixerRef.current.stopAllAction();
    
    const action = mixerRef.current.clipAction(animation);
    action.reset();
    
    if (startTime !== undefined && endTime !== undefined) {
      // 播放指定时间段
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.time = startTime;
      action.play();
      
      // 在指定时间停止
      const duration = endTime - startTime;
      setTimeout(() => {
        action.stop();
        console.log('动画播放完成');
      }, duration * 1000);
    } else {
      // 播放完整动画
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
      
      console.log('开始播放完整动画，时长:', animation.duration, '秒');
    }
  };

  // 标注显示/隐藏控制
  const showAnnotations = (annotationIds: string[]) => {
    console.log('显示标注:', annotationIds);
    annotationsRef.current.forEach(annotation => {
      const annotationId = annotation.userData.annotationId;
      if (annotationId && annotationIds.includes(annotationId)) {
        annotation.visible = true;
        console.log('显示标注:', annotationId);
      }
    });
  };

  const hideAnnotations = (annotationIds: string[]) => {
    console.log('隐藏标注:', annotationIds);
    annotationsRef.current.forEach(annotation => {
      const annotationId = annotation.userData.annotationId;
      if (annotationId && annotationIds.includes(annotationId)) {
        annotation.visible = false;
        console.log('隐藏标注:', annotationId);
      }
    });
  };

  const showAllAnnotations = () => {
    annotationsRef.current.forEach(annotation => {
      annotation.visible = true;
    });
  };

  const hideAllAnnotations = () => {
    console.log('隐藏所有标注，当前标注数量:', annotationsRef.current.length);
    annotationsRef.current.forEach((annotation, index) => {
      console.log(`隐藏标注 ${index}:`, annotation.userData.annotationId);
      annotation.visible = false;
    });
  };

  // 【别名】重置所有标注为隐藏状态（步骤切换时调用）
  const resetAnnotationVisibility = hideAllAnnotations;

  // 【新增】重置所有状态（步骤切换时调用）
  const resetAllStates = () => {
    console.log('重置所有状态：清除高亮、隐藏标注、停止动画');
    
    // 1. 清除高亮状态
    clearEmissiveHighlight();
    if (outlineRef.current) {
      outlineRef.current.selectedObjects = [];
    }
    
    // 2. 隐藏所有标注
    hideAllAnnotations();
    
    // 3. 停止所有动画
    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
    }
    
    // 4. 停止自转
    stopAutoRotation();
    
    console.log('所有状态已重置');
  };

  // 【新增】开始自转
  const startAutoRotation = (speed: number = 0.005) => {
    autoRotationRef.current = true;
    rotationSpeedRef.current = speed;
    console.log('开始模型自转，速度:', speed);
  };

  // 【新增】停止自转
  const stopAutoRotation = () => {
    autoRotationRef.current = false;
    console.log('停止模型自转');
  };

  // 【新增】平滑相机动画函数
  const animateCameraToPosition = (targetPosition: THREE.Vector3, targetLookAt: THREE.Vector3, duration: number = 1000) => {
    if (!cameraRef.current || !controlsRef.current) return;

    // 停止之前的动画
    if (cameraAnimationRef.current) {
      cameraAnimationRef.current.stop();
    }

    const camera = cameraRef.current;
    const controls = controlsRef.current;
    
    const startPosition = camera.position.clone();
    const startTarget = controls.target.clone();
    
    const animationData = {
      t: 0,
      position: { x: startPosition.x, y: startPosition.y, z: startPosition.z },
      target: { x: startTarget.x, y: startTarget.y, z: startTarget.z }
    };

    // 使用简单的补间动画
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用缓动函数
      const easeInOutCubic = (t: number) => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      
      const easedProgress = easeInOutCubic(progress);
      
      // 插值位置
      camera.position.lerpVectors(startPosition, targetPosition, easedProgress);
      controls.target.lerpVectors(startTarget, targetLookAt, easedProgress);
      
      controls.update();
      
      if (progress < 1) {
        cameraAnimationRef.current = requestAnimationFrame(animate);
      } else {
        cameraAnimationRef.current = null;
        console.log('相机动画完成');
      }
    };
    
    animate();
  };

  // 调试模型位置和标注
  const debugModelPosition = () => {
    if (!modelRootRef.current) {
      console.log('模型未加载');
      return;
    }

    const model = modelRootRef.current;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    console.log('模型调试信息:');
    console.log('模型位置:', model.position);
    console.log('模型旋转:', model.rotation);
    console.log('模型缩放:', model.scale);
    console.log('包围盒中心:', center);
    console.log('包围盒大小:', size);
    console.log('模型矩阵:', model.matrix);

    // 检查标注位置
    if (coursewareData?.annotations) {
      console.log('标注数据:');
      coursewareData.annotations.forEach((annotation: any, index: number) => {
        console.log(`标注 ${index + 1}:`, {
          title: annotation.title,
          nodeKey: annotation.nodeKey,
          position: annotation.position,
          labelOffset: annotation.labelOffset
        });
      });
    }
  };

  // 暴露控制方法给父组件
  useEffect(() => {
    const controls = {
      focusOnNode,
      highlightNode,
      setNodeVisibility,
      playAnimation,
      showAnnotations,
      hideAnnotations,
      showAllAnnotations,
      hideAllAnnotations,
      resetAnnotationVisibility,
      resetAllStates,  // 【新增】重置所有状态
      startAutoRotation,  // 【新增】开始自转
      stopAutoRotation,   // 【新增】停止自转
      getNodeMap: () => nodeMapRef.current,
      getAnnotations: () => annotationsRef.current,
      debugModelPosition,  // 添加调试功能
      resetView: () => {
        if (modelRootRef.current) fitCameraToModel(modelRootRef.current);
      },
      // 一次性拾取节点，返回可用于 nodeMap 的 key（优先 name 路径，其次 uuid）
      pickNodeKeyOnce: () => new Promise<string | null>((resolve) => {
        if (!rendererRef.current || !cameraRef.current || !sceneRef.current) return resolve(null);
        const dom = rendererRef.current.domElement;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2();
        
        // 创建悬停提示
        const hoverTooltip = document.createElement('div');
        hoverTooltip.style.cssText = `
          position: absolute;
          background: rgba(0, 0, 0, 0.8);
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          pointer-events: none;
          z-index: 1000;
          white-space: nowrap;
        `;
        document.body.appendChild(hoverTooltip);
        hoverTooltip.style.display = 'none';
        
        let currentHoverObject: THREE.Object3D | null = null;
        
        // 辅助函数：检查对象是否有实际几何体（非空对象）
        const hasGeometry = (obj: THREE.Object3D): boolean => {
          // 检查对象本身是否是Mesh且有几何体
          if (obj instanceof THREE.Mesh && obj.geometry) {
            const geometry = obj.geometry;
            // 检查几何体是否有顶点
            if (geometry.attributes.position && geometry.attributes.position.count > 0) {
              return true;
            }
          }
          return false;
        };

        // 查找有效的可选取对象（向上遍历父级，找到有几何体的对象）
        const findSelectableObject = (obj: THREE.Object3D): THREE.Object3D | null => {
          let current = obj;
          // 向上遍历10层，找到有几何体的对象
          for (let i = 0; i < 10 && current; i++) {
            if (hasGeometry(current)) {
              return current;
            }
            // 检查直接子级是否有几何体
            for (const child of current.children) {
              if (hasGeometry(child)) {
                return child;
              }
            }
            current = current.parent as THREE.Object3D;
          }
          return null;
        };

        // 鼠标移动事件：显示悬停预览
        const onMouseMove = (event: MouseEvent) => {
          const rect = dom.getBoundingClientRect();
          mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, cameraRef.current!);
          const intersects = raycaster.intersectObject(sceneRef.current!, true);
          
          let validObject: THREE.Object3D | null = null;
          
          // 查找第一个有效的可选取对象
          for (const intersect of intersects) {
            const selectableObj = findSelectableObject(intersect.object);
            if (selectableObj) {
              validObject = selectableObj;
              break;
            }
          }
          
          if (validObject) {
            const obj = validObject;
            
            // 如果悬停的是新对象，更新高亮和提示
            if (obj !== currentHoverObject) {
              // 清除之前的高亮
              if (currentHoverObject && outlineRef.current) {
                outlineRef.current.selectedObjects = [];
              }
              
              // 设置新的高亮
              currentHoverObject = obj;
              if (outlineRef.current) {
                outlineRef.current.selectedObjects = [obj];
              }
              
              // 显示对象名称（只显示最后一层级）
              const objName = obj.name || `Object_${obj.uuid.slice(0, 8)}`;
              const displayName = objName.split('/').pop() || objName;
              hoverTooltip.textContent = displayName;
              hoverTooltip.style.display = 'block';
            }
            
            // 更新提示位置
            hoverTooltip.style.left = (event.clientX + 10) + 'px';
            hoverTooltip.style.top = (event.clientY - 25) + 'px';
          } else {
            // 鼠标不在任何对象上，清除高亮和提示
            if (currentHoverObject && outlineRef.current) {
              outlineRef.current.selectedObjects = [];
              currentHoverObject = null;
            }
            hoverTooltip.style.display = 'none';
          }
        };
        
        // 点击事件：确认选择
        const onClick = (event: MouseEvent) => {
          // 清理事件监听器和提示
          dom.removeEventListener('click', onClick, true);
          dom.removeEventListener('mousemove', onMouseMove);
          document.body.removeChild(hoverTooltip);
          
          // 清除高亮
          if (outlineRef.current) {
            outlineRef.current.selectedObjects = [];
          }
          
          if (!currentHoverObject) return resolve(null);
          
          const obj = currentHoverObject;
          // 生成与 nodeMap 对齐的 key：优先完整路径，其次名称，最后 uuid
          const fullPath = getFullObjectPath(obj);
          if (fullPath && nodeMapRef.current.has(fullPath)) return resolve(fullPath);
          if (obj.name && nodeMapRef.current.has(obj.name)) return resolve(obj.name);
          return resolve(obj.uuid || null);
        };
        
        // 取消选择（按ESC键或右键）
        const onCancel = (event: KeyboardEvent | MouseEvent) => {
          if ((event instanceof KeyboardEvent && event.key === 'Escape') || 
              (event instanceof MouseEvent && event.button === 2)) {
            // 清理事件监听器和提示
            dom.removeEventListener('click', onClick, true);
            dom.removeEventListener('mousemove', onMouseMove);
            dom.removeEventListener('contextmenu', onCancel as EventListener);
            document.removeEventListener('keydown', onCancel as EventListener);
            document.body.removeChild(hoverTooltip);
            
            // 清除高亮
            if (outlineRef.current) {
              outlineRef.current.selectedObjects = [];
            }
            
            resolve(null);
          }
        };
        
        // 添加事件监听器
        dom.addEventListener('click', onClick, true);
        dom.addEventListener('mousemove', onMouseMove);
        dom.addEventListener('contextmenu', onCancel as EventListener);
        document.addEventListener('keydown', onCancel as EventListener);
        
        // 改变鼠标样式提示
        dom.style.cursor = 'crosshair';
        
        // 清理时恢复鼠标样式
        const cleanup = () => {
          dom.style.cursor = '';
        };
        setTimeout(cleanup, 100); // 延迟一点确保样式应用
      })
    };

    if (containerRef.current) {
      (containerRef.current as any)._viewerControls = controls;
      console.log('三维查看器控制接口已暴露到容器:', Object.keys(controls));
    }

    // 通过回调也暴露控制接口
    if (onControlsReady) {
      onControlsReady(controls);
      console.log('三维查看器控制接口已通过回调暴露:', Object.keys(controls));
    }

    // 同时挂到全局，便于其它面板调用（编辑器模式）
    try {
      (window as any).__threeViewerControls = controls;
    } catch {}
  }, [coursewareData, onControlsReady]); // 依赖于coursewareData，确保模型加载后重新暴露接口

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width, 
        height, 
        position: 'relative',
        background: '#f0f0f0',
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        overflow: 'hidden'
      }}
    >
      {webglSupported === false && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255,255,255,0.95)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ textAlign: 'center', padding: '20px', maxWidth: '80%' }}>
            <div style={{ fontSize: 20, marginBottom: 16, color: '#ff4d4f' }}>
              ⚠️ WebGL不支持
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: '#666', whiteSpace: 'pre-line', marginBottom: 16 }}>
              {loadError}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>
              技术提示：您的浏览器或显卡可能不支持硬件加速
            </div>
            <button 
              onClick={() => window.location.reload()}
              style={{
                marginTop: 16,
                background: '#1890ff',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 14
              }}
            >
              刷新页面重试
            </button>
          </div>
        </div>
      )}

      {webglSupported !== false && loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255,255,255,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, marginBottom: 8 }}>正在加载模型...</div>
            <div style={{ fontSize: 12, color: '#666' }}>请稍候</div>
          </div>
        </div>
      )}
      
      {webglSupported !== false && loadError && !loading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255,255,255,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{ textAlign: 'center', color: '#ff4d4f' }}>
            <div style={{ fontSize: 16, marginBottom: 8 }}>模型加载失败</div>
            <div style={{ fontSize: 12, marginBottom: 16 }}>{loadError}</div>
            <button 
              onClick={() => window.location.reload()}
              style={{
                background: '#ff4d4f',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              刷新页面重试
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
