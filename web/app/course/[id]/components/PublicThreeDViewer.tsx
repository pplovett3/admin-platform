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
}

const PublicThreeDViewer = forwardRef<PublicThreeDViewerControls, PublicThreeDViewerProps>(
  ({ coursewareData, width = 800, height = 600, onModelLoaded }, ref) => {
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
    type MaterialBackup = {
      emissive?: THREE.Color;
      emissiveIntensity?: number;
    };
    const materialBackupRef = useRef<WeakMap<any, MaterialBackup>>(new WeakMap());
    const highlightedMatsRef = useRef<Set<any>>(new Set());
    const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
    const autoRotationRef = useRef<boolean>(false);
    const rotationSpeedRef = useRef<number>(0.0006); // 再降低速度（更慢）
    const cameraAnimationRef = useRef<any>(null);
    const backgroundTextureRef = useRef<THREE.Texture | null>(null);
    const environmentMapRef = useRef<THREE.Texture | null>(null);
    const pmremGeneratorRef = useRef<THREE.PMREMGenerator | null>(null);
    const hiddenObjectsRef = useRef<Map<string, boolean>>(new Map()); // 记录对象的初始可见性状态
    
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
      
      // 初始背景设置为null，等待applySettings设置（避免默认渐变背景覆盖HDR背景）
      scene.background = null;
      
      sceneRef.current = scene;

      // 创建相机
      const camera = new THREE.PerspectiveCamera(75, width / height, 0.001, 1000);
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
        
        // 初始化PMREMGenerator用于HDR环境贴图
        const pmremGenerator = new THREE.PMREMGenerator(renderer);
        pmremGenerator.compileEquirectangularShader();
        pmremGeneratorRef.current = pmremGenerator;
        
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
        outlinePass.edgeStrength = 5;        // 增强边缘强度
        outlinePass.edgeGlow = 1.0;          // 增强发光效果
        outlinePass.edgeThickness = 2;       // 增加边缘厚度
        outlinePass.pulsePeriod = 1.5;       // 加快呼吸频率（更明显）
        outlinePass.visibleEdgeColor.set('#ff6600');  // 橙色
        outlinePass.hiddenEdgeColor.set('#ff6600');   // 橙色
        composer.addPass(outlinePass);
        
        composerRef.current = composer;
        outlineRef.current = outlinePass;

      } catch (error) {
        console.error('WebGL渲染器创建失败:', error);
        throw new Error('WebGL渲染器创建失败');
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
      const animate = () => {
        // 模型自转 - 已取消
        // if (autoRotationRef.current && modelRootRef.current) {
        //   modelRootRef.current.rotation.y += rotationSpeedRef.current;
        // }
        
        // 动画混合器更新
        if (mixerRef.current) {
          mixerRef.current.update(0.01);
        }
        
        // 标注使用固定大小，无需更新缩放
        
        // 标注位置更新（跟随模型自转）
        updateAnnotationPositions();
        
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

      console.log('✅ 已应用三维课件编辑器的光照设置:', lighting);
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
        if (!targetObject) {
          console.warn('🔴 标注更新：找不到目标对象', targetKey);
          return;
        }
        
        // 标注位置更新（静默）
        
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
            console.log('✅ 检测到 GLB 格式 (glTF 2.0)');
            return 'glb';
          }
        }
      }
      
      // 检查 FBX 格式 (通常以 "Kaydara FBX Binary" 开头)
      if (bytes.length >= 18) {
        const header = String.fromCharCode(...bytes.slice(0, 18));
        if (header.includes('Kaydara FBX')) {
          console.log('✅ 检测到 FBX 格式');
          return 'fbx';
        }
      }
      
      // 检查 OBJ 格式 (文本文件，通常以 # 或 v 开头)
      if (bytes.length >= 100) {
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 100));
          if (/^(#|v |vn |vt |f |o |g |mtllib |usemtl )/m.test(text)) {
            console.log('✅ 检测到 OBJ 格式');
            return 'obj';
          }
        } catch {
          // 不是有效的 UTF-8 文本
        }
      }
      
      console.log('❌ 无法识别文件格式');
      return '';
    };

    const loadModel = async (modelUrl: string) => {
      if (!sceneRef.current) return;

      setLoading(true);
      setLoadError(null);

      try {
        const manager = new THREE.LoadingManager();
        // 检测是否为公网域名，如果是则使用相对路径
        let baseUrl = '';
        if (typeof window !== 'undefined') {
          const hostname = window.location.hostname;
          if (hostname.includes('yf-xr.com') || hostname.includes('platform')) {
            baseUrl = '';
          } else {
            baseUrl = process.env.NEXT_PUBLIC_API_URL || window.location.origin;
          }
        } else {
          baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        }
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
        console.log('📋 Content-Disposition 响应头:', contentDisposition);
        
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
            console.log('✅ 从 Content-Disposition 提取文件扩展名:', fileExt, '文件名:', filename);
          }
        }
        
        // 如果响应头中没有文件名，则回退到从 URL 中提取
        if (!fileExt) {
          const urlPath = modelUrl.split('?')[0];
          const urlParts = urlPath.split('/');
          const lastPart = urlParts[urlParts.length - 1];
          if (lastPart && lastPart.includes('.')) {
            fileExt = lastPart.toLowerCase().split('.').pop() || '';
            console.log('⚠️ 从 URL 路径提取文件扩展名:', fileExt);
          }
        }

        const arrayBuffer = await response.arrayBuffer();
        
        // 最后的回退：尝试从文件二进制头部识别格式
        if (!fileExt) {
          fileExt = detectFileFormat(arrayBuffer);
          console.log('🔍 从文件头部识别格式:', fileExt || '未识别');
          
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
      console.log('节点映射构建完成，总数:', map.size);
      console.log('样例节点键:', Array.from(map.keys()).slice(0, 10));
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
        
        // 如果没找到，尝试智能匹配
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
          console.warn('标注缺少偏移信息，使用默认固定偏移:', annotation.id);
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
          console.warn('标注缺少偏移信息，使用默认固定偏移:', annotation.id);
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
        console.error('创建标签精灵失败:', error);
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

      // 如果没有背景设置，使用默认HDR背景
      const backgroundType = settings?.backgroundType || 'panorama';
      const backgroundPanorama = settings?.backgroundPanorama || '/360background_7.hdr';
      const bgPanoramaBrightness = settings?.backgroundPanoramaBrightness || 1.0;
      const useHDREnvironment = settings?.useHDREnvironment !== undefined ? settings.useHDREnvironment : true;

      // 应用HDR全景背景
      if (backgroundType === 'panorama' && backgroundPanorama) {
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
          console.log(`🌐 开始加载${isHDR ? 'HDR' : 'EXR'}全景图:`, bgPanorama);
          loader.load(
            bgPanorama,
            (texture) => {
              console.log(`✅ ${isHDR ? 'HDR' : 'EXR'}全景图加载成功:`, bgPanorama);
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
              
              console.log(`🌐 创建HDR背景球体: 半径=${sphereRadius.toFixed(2)}, 相机距离=${cameraDistance.toFixed(2)}`);
              
              // 移除旧的背景球体
              const oldSphere = scene.getObjectByName('__background_sphere__');
              if (oldSphere) {
                scene.remove(oldSphere);
                console.log('🗑️ 移除旧的HDR背景球体');
              }
              
              scene.add(sphere);
              scene.background = null; // 清除默认背景
              console.log('✅ HDR背景球体已添加到场景');
              
              // 强制重新渲染
              if (composerRef.current) {
                composerRef.current.render();
              } else if (renderer && scene && camera) {
                renderer.render(scene, camera);
              }
            },
            undefined,
            (error) => {
              console.error(`❌ 加载${isHDR ? 'HDR' : 'EXR'}全景图失败:`, error);
              // 失败时使用默认背景
              if (settings.background) {
                scene.background = new THREE.Color(settings.background);
              }
            }
          );
        } else {
          // 加载普通全景图
          const loader = new THREE.TextureLoader();
          console.log('🖼️ 开始加载普通全景图:', bgPanorama);
          loader.load(
            bgPanorama,
            (texture) => {
              console.log('✅ 普通全景图加载成功:', bgPanorama);
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
              console.error('❌ 加载普通全景图失败:', error);
              if (settings.background) {
                scene.background = new THREE.Color(settings.background);
              }
            }
          );
        }
      } else {
        // 移除背景球体，使用默认背景
        const oldSphere = scene.getObjectByName('__background_sphere__');
        if (oldSphere) {
          scene.remove(oldSphere);
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
      
      console.warn('⚠️ 节点未找到:', nodeKey);
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

    // 清除自发光高亮（与编辑器完全一致）
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

    // 应用自发光高亮（与编辑器完全一致）
    const applyEmissiveHighlight = (obj: THREE.Object3D) => {
      clearEmissiveHighlight();
      obj.traverse((o: THREE.Object3D) => {
        const mesh = o as any;
        if (mesh.material) {
          const materials: any[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach((mat: any) => {
            const backup = { 
              emissive: (mat.emissive ? mat.emissive.clone() : undefined), 
              emissiveIntensity: mat.emissiveIntensity 
            };
            materialBackupRef.current.set(mat, backup);
            try {
              if (mat.emissive) mat.emissive.set(0x22d3ee);
              if ('emissiveIntensity' in mat) mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0.2, 0.6);
              highlightedMatsRef.current.add(mat);
            } catch {}
          });
        }
      });
    };

    // 高亮节点 - 只使用橙色边框高亮（带呼吸效果）
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

      if (highlight) {
        // 只使用橙色边框轮廓高亮（不改变材质颜色）
        if (outlineRef.current) {
          outlineRef.current.selectedObjects = [targetObject];
        }
        
        // console.log('✅ 橙色边框高亮设置完成');
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
      console.log('设置节点显隐:', nodeKey, visible);
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
                console.log('通过路径匹配找到:', key);
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
              console.log('通过模糊匹配找到:', key);
              break;
            }
          }
        }
      }
      
      if (!targetObject) {
        console.warn('未找到要设置显隐的节点:', nodeKey);
        return;
      }

      // 记录初始可见性状态（只在第一次设置时记录）
      if (!hiddenObjectsRef.current.has(nodeKey)) {
        hiddenObjectsRef.current.set(nodeKey, targetObject.visible);
      }

      console.log('设置对象显隐:', targetObject.name || targetObject.uuid, visible);
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
      console.log('播放动画:', animationId, 'startTime:', startTime, 'endTime:', endTime);
      
      if (!mixerRef.current || !animationsRef.current.length) {
        console.warn('没有可用的动画');
        return 3; // 默认3秒
      }

      // 停止所有当前动画
      mixerRef.current.stopAllAction();

      console.log('可用动画:', animationsRef.current.map(clip => ({ name: clip.name, uuid: clip.uuid })));

      // 历史UUID到动画名称的映射（修复旧版本保存的UUID问题）
      const uuidToNameMap: { [key: string]: string } = {
        'f647ea39-a47a-4dcb-af5e-94e118807950': 'Anim_SimpleArcWeldLayout'  // 焊接产线动画
      };
      
      // 如果是已知的历史UUID，转换为动画名称
      let searchId = animationId;
      if (uuidToNameMap[animationId]) {
        searchId = uuidToNameMap[animationId];
        console.log('历史UUID映射:', animationId, '->', searchId);
      }
      
      // 首先尝试从 coursewareData.animations 中查找对应的动画名称
      let animationNameFromData: string | null = null;
      if (coursewareData?.animations) {
        const coursewareAnim = (coursewareData.animations as any[]).find(
          (anim: any) => anim.id === animationId || anim.id === searchId
        );
        if (coursewareAnim?.name) {
          animationNameFromData = coursewareAnim.name;
          console.log('从课件数据中找到动画名称:', animationNameFromData);
        }
      }
      
      // 优先使用从课件数据中找到的动画名称
      if (animationNameFromData) {
        searchId = animationNameFromData;
      }
      
      // 1. 精确名称匹配（优先，因为用户选择的是名称）
      let targetAnimation = animationsRef.current.find(clip => clip.name === searchId || clip.name === animationId);
      if (targetAnimation) {
        console.log('名称精确匹配成功:', targetAnimation.name);
      } else {
        // 2. 精确UUID匹配
        targetAnimation = animationsRef.current.find(clip => clip.uuid === searchId || clip.uuid === animationId);
        if (targetAnimation) {
          console.log('UUID精确匹配成功:', targetAnimation.name);
        } else {
          // 3. 部分名称匹配（包含关系）
          targetAnimation = animationsRef.current.find(clip => 
            clip.name.includes(searchId) || searchId.includes(clip.name) ||
            clip.name.includes(animationId) || animationId.includes(clip.name)
          );
          if (targetAnimation) {
            console.log('部分名称匹配成功:', targetAnimation.name);
          } else {
            // 4. 模糊名称匹配（根据关键词）
            const lowerAnimationId = searchId.toLowerCase();
            
            // 根据关键词尝试匹配已知动画类型
            if (lowerAnimationId.includes('71361f28') || lowerAnimationId.includes('拆装') || lowerAnimationId.includes('assembly')) {
              // 查找拆装相关动画
              targetAnimation = animationsRef.current.find(clip => 
                clip.name.includes('拆装') || clip.name.includes('assembly') || clip.name.includes('安装')
              );
              if (targetAnimation) {
                console.log('关键词匹配成功（拆装）:', targetAnimation.name);
              }
            }
            
            if (!targetAnimation && (lowerAnimationId.includes('旋转') || lowerAnimationId.includes('rotate'))) {
              // 查找旋转相关动画
              targetAnimation = animationsRef.current.find(clip => 
                clip.name.includes('旋转') || clip.name.includes('rotate') || clip.name.includes('转动')
              );
              if (targetAnimation) {
                console.log('关键词匹配成功（旋转）:', targetAnimation.name);
              }
            }
            
            // 5. 如果还没找到，不要回退到第一个动画，而是返回错误
            if (!targetAnimation) {
              console.warn('⚠️ 未找到匹配的动画:', animationId, 'searchId:', searchId);
              console.log('可用动画列表:', animationsRef.current.map(clip => clip.name));
              return 3; // 返回默认3秒，但不播放动画
            }
          }
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
      
      console.log('找到课件动画数据:', coursewareAnimation ? {
        id: coursewareAnimation.id,
        name: coursewareAnimation.name,
        hasCameraKeys: !!coursewareAnimation?.timeline?.cameraKeys
      } : '未找到');
      
      // 读取相机轨道关键帧
      let cameraKeys: any[] = [];
      if (coursewareAnimation?.timeline?.cameraKeys) {
        cameraKeys = [...coursewareAnimation.timeline.cameraKeys].sort((a: any, b: any) => a.time - b.time);
        console.log('找到相机轨道关键帧:', cameraKeys.length, '个');
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
        
        // console.log('开始播放动画:', targetAnimation.name, 'UUID:', targetAnimation.uuid, '持续时间:', targetAnimation.duration);
        return targetAnimation.duration || 3; // 返回动画持续时间（秒）
      } else {
        console.warn('⚠️ 未找到动画:', animationId);
        // console.log('尝试播放第一个动画作为回退');
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
          
          // console.log('回退播放动画:', fallbackAnimation.name);
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
      getAnimationDuration
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
        
        console.log('ThreeDViewer尺寸更新:', { width, height });
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