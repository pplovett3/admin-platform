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
    type MaterialBackup = {
      emissive?: THREE.Color;
      emissiveIntensity?: number;
      originalMaterials?: any | any[];
    };
    const materialBackupRef = useRef<WeakMap<any, MaterialBackup>>(new WeakMap());
    const highlightedMatsRef = useRef<Set<any>>(new Set());
    const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
    const autoRotationRef = useRef<boolean>(false);
    const rotationSpeedRef = useRef<number>(0.0006); // 再降低速度（更慢）
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

    const setupLights = (scene: THREE.Scene) => {
      // 使用高强度定向光照，移除环境光避免模型过暗

      // 1. 主光源（Key Light）- 正面主要光照 (+30%强度)
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.95); // 1.5 * 1.3 = 1.95
      keyLight.position.set(10, 15, 10); // 正面稍偏右的位置
      keyLight.castShadow = true;
      
      // 阴影设置
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 50;
      keyLight.shadow.camera.left = -20;
      keyLight.shadow.camera.right = 20;
      keyLight.shadow.camera.top = 20;
      keyLight.shadow.camera.bottom = -20;
      keyLight.shadow.bias = -0.0001;
      
      scene.add(keyLight);

      // 2. 补光源（Fill Light）- 左侧补光，减少阴影对比度 (+30%强度)
      const fillLight = new THREE.DirectionalLight(0xffffff, 1.04); // 0.8 * 1.3 = 1.04
      fillLight.position.set(-15, 10, 5); // 左侧位置
      scene.add(fillLight);

      // 3. 背光源（Back Light）- 背面轮廓光 (+30%强度)
      const backLight = new THREE.DirectionalLight(0xffffff, 0.78); // 0.6 * 1.3 = 0.78
      backLight.position.set(-5, 8, -15); // 背面位置
      scene.add(backLight);

      // 4. 顶部光源 - 增强顶部细节 (+30%强度)
      const topLight = new THREE.DirectionalLight(0xffffff, 0.52); // 0.4 * 1.3 = 0.52
      topLight.position.set(0, 20, 0); // 正上方
      scene.add(topLight);

      // 5. 底部反射光 - 模拟地面反射 (+30%强度)
      const bottomLight = new THREE.DirectionalLight(0x4488ff, 0.39); // 0.3 * 1.3 = 0.39
      bottomLight.position.set(0, -10, 0); // 正下方
      scene.add(bottomLight);

      console.log('已设置高强度定向光照，共5个光源，无环境光和半球光');
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

    // 【新增】更新标注位置（跟随模型自转）
    const updateAnnotationPositions = () => {
      if (!modelRootRef.current) return;
      
      annotationsRef.current.forEach(annotationGroup => {
        const annotationData = annotationGroup.userData.annotationData;
        const targetKey = annotationGroup.userData.targetKey;
        
        if (!annotationData || !targetKey) return;
        
        // 找到目标对象
        const targetObject = nodeMapRef.current.get(targetKey);
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

    // 创建标签精灵 - 完全复制编辑器逻辑
    const createLabelSprite = (annotation: any): THREE.Sprite | null => {
      try {
        const title = annotation.title || annotation.label?.title || 'Annotation';
        
        // 根据文字长度动态计算画布尺寸
        const measureCanvas = document.createElement('canvas');
        const measureContext = measureCanvas.getContext('2d')!;
        measureContext.font = 'bold 32px Arial, Microsoft YaHei, sans-serif';
        const textMetrics = measureContext.measureText(title);
        
        const padding = 20;
        const minWidth = 120;
        const textWidth = Math.max(minWidth, textMetrics.width + padding * 2);
        const textHeight = 64;
        
        const canvas = document.createElement('canvas');
        canvas.width = textWidth;
        canvas.height = textHeight;
        const context = canvas.getContext('2d')!;
        
        // 绘制背景（圆角矩形） - 蓝色科技感
        context.fillStyle = 'rgba(30, 50, 80, 0.95)'; // 深蓝色半透明背景
        context.strokeStyle = '#1890ff';
        context.lineWidth = 2;
        
        const radius = 8;
        context.beginPath();
        context.moveTo(radius, 0);
        context.arcTo(textWidth, 0, textWidth, textHeight, radius);
        context.arcTo(textWidth, textHeight, 0, textHeight, radius);
        context.arcTo(0, textHeight, 0, 0, radius);
        context.arcTo(0, 0, textWidth, 0, radius);
        context.closePath();
        context.fill();
        context.stroke();
        
        // 绘制文字 - 白色文字
        context.fillStyle = 'white';
        context.font = 'bold 32px Arial, Microsoft YaHei, sans-serif';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(title, textWidth / 2, textHeight / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.LinearFilter;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        
        const material = new THREE.SpriteMaterial({ 
          map: texture,
          transparent: true,
          alphaTest: 0.1,
          depthTest: false, // 禁用深度测试，确保标签始终在最前面
          depthWrite: false,
          sizeAttenuation: false // 禁用尺寸衰减，保持标签大小一致
        });
        
        const sprite = new THREE.Sprite(material);
        
        // 确保标签在最顶层显示
        sprite.renderOrder = 999; // 高渲染顺序，确保最后渲染
        
        // 设置缩放和自适应标记
        const baseScale = 0.4;
        sprite.scale.set(textWidth * baseScale / 100, textHeight * baseScale / 100, 1);
        sprite.userData.isDistanceScaling = true;
        sprite.userData.originalScale = {
          x: textWidth * baseScale / 100,
          y: textHeight * baseScale / 100,
          z: 1
        };
        sprite.renderOrder = 10;
        
        return sprite;
      } catch (error) {
        console.error('创建标签精灵失败:', error);
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

    // 智能匹配节点 - 增强版
    const findNodeBySmartMatch = (nodeKey: string): THREE.Object3D | undefined => {
      const nodeMap = nodeMapRef.current;
      
      console.log('智能匹配节点:', nodeKey);
      console.log('可用节点总数:', nodeMap.size);
      
      // 1. 精确匹配
      if (nodeMap.has(nodeKey)) {
        console.log('精确匹配成功:', nodeKey);
        return nodeMap.get(nodeKey)!;
      }
      
      // 2. 提取最后的路径段进行匹配
      const targetSegments = nodeKey.split('/');
      const targetName = targetSegments[targetSegments.length - 1]; // 最后一段，如"左后轮"
      
      console.log('目标名称:', targetName);
      
      // 3. 按名称匹配
      for (const [key, object] of nodeMap.entries()) {
        if (object.name === targetName) {
          console.log('名称匹配成功:', object.name, '键:', key);
          return object;
        }
      }
      
      // 4. 路径末尾匹配
      for (const [key, object] of nodeMap.entries()) {
        if (key.endsWith(`/${targetName}`) || key.endsWith(targetName)) {
          console.log('路径末尾匹配成功:', key);
          return object;
        }
      }
      
      // 5. 如果是完整路径，尝试匹配路径结构（忽略UUID）
      if (targetSegments.length > 1) {
        const pathPattern = targetSegments.slice(1).join('/'); // 去掉第一个UUID部分
        console.log('路径模式:', pathPattern);
        
        for (const [key, object] of nodeMap.entries()) {
          if (key.includes(pathPattern)) {
            console.log('路径模式匹配成功:', key);
            return object;
          }
        }
      }
      
      // 6. 模糊匹配
      const lowerTargetName = targetName.toLowerCase();
      for (const [key, object] of nodeMap.entries()) {
        if (key.toLowerCase().includes(lowerTargetName) || 
            object.name.toLowerCase().includes(lowerTargetName)) {
          console.log('模糊匹配成功:', key, '目标:', targetName);
          return object;
        }
      }
      
      console.warn('所有匹配方式都失败，节点未找到:', nodeKey);
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
            try {
              const backup = { 
                emissive: mat.emissive ? mat.emissive.clone() : undefined, 
                emissiveIntensity: mat.emissiveIntensity 
              };
              materialBackupRef.current.set(mat, backup);
              if (mat.emissive) mat.emissive.set(0x22d3ee);
              if ('emissiveIntensity' in mat) mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0.2, 0.6);
              highlightedMatsRef.current.add(mat);
            } catch {}
          });
        }
      });
    };

    // 高亮节点 - 使用编辑器相同的自发光效果
    const highlightNode = (nodeKey: string, highlight: boolean) => {
      console.log('🔆 发布页设置高亮:', nodeKey, highlight);
      
      let targetObject = nodeMapRef.current.get(nodeKey);
      if (!targetObject) {
        targetObject = findNodeBySmartMatch(nodeKey);
        console.log('🔍 智能匹配结果:', targetObject?.name || targetObject?.uuid || 'null');
      }
      
      if (!targetObject) {
        console.warn('❌ 发布页未找到要高亮的节点:', nodeKey);
        console.log('📋 可用节点:', Array.from(nodeMapRef.current.keys()).slice(0, 10));
        return;
      }

      console.log('🎯 发布页找到目标对象:', targetObject.name || targetObject.uuid);

      if (highlight) {
        // 清除之前的高亮
        clearEmissiveHighlight();
        
        // 应用自发光高亮（使用三维课件编辑器的算法）
        console.log('✨ 发布页应用高亮效果');
        applyEmissiveHighlight(targetObject);
        
        // 同时使用轮廓高亮
        if (outlineRef.current) {
          outlineRef.current.selectedObjects = [targetObject];
          console.log('🟡 发布页设置轮廓高亮');
        }
        
        console.log('✅ 发布页已高亮节点:', targetObject.name || targetObject.uuid);
      } else {
        // 清除高亮
        console.log('🧹 发布页清除高亮');
        clearEmissiveHighlight();
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

    // 播放动画 - 增强智能匹配
    const playAnimation = (animationId: string) => {
      console.log('播放动画:', animationId);
      
      if (!mixerRef.current || !animationsRef.current.length) {
        console.warn('没有可用的动画');
        return;
      }

      // 停止所有当前动画
      mixerRef.current.stopAllAction();

      console.log('可用动画:', animationsRef.current.map(clip => ({ name: clip.name, uuid: clip.uuid })));

      // 1. 精确UUID匹配
      let targetAnimation = animationsRef.current.find(clip => clip.uuid === animationId);
      if (targetAnimation) {
        console.log('UUID精确匹配成功:', targetAnimation.name);
      } else {
        // 2. 精确名称匹配
        targetAnimation = animationsRef.current.find(clip => clip.name === animationId);
        if (targetAnimation) {
          console.log('名称精确匹配成功:', targetAnimation.name);
        } else {
          // 3. 模糊名称匹配（根据关键词）
          const lowerAnimationId = animationId.toLowerCase();
          
          // 根据UUID中的关键词尝试匹配已知动画类型
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
          
          // 4. 如果还没找到，使用第一个非"All Animations"的动画
          if (!targetAnimation) {
            targetAnimation = animationsRef.current.find(clip => clip.name !== 'All Animations');
            if (targetAnimation) {
              console.log('使用第一个可用动画:', targetAnimation.name);
            }
          }
        }
      }

      if (targetAnimation) {
        const action = mixerRef.current.clipAction(targetAnimation);
        action.reset();
        action.play();
        console.log('开始播放动画:', targetAnimation.name, 'UUID:', targetAnimation.uuid);
      } else {
        console.warn('未找到动画:', animationId);
        console.log('尝试播放第一个动画作为回退');
        if (animationsRef.current.length > 0) {
          const fallbackAnimation = animationsRef.current[0];
          const action = mixerRef.current.clipAction(fallbackAnimation);
          action.reset();
          action.play();
          console.log('回退播放动画:', fallbackAnimation.name);
        }
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