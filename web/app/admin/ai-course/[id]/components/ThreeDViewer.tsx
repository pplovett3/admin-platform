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
}

export default function ThreeDViewer({ coursewareData, width = 800, height = 600, onModelLoaded }: ThreeDViewerProps) {
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
  
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 初始化Three.js场景
  useEffect(() => {
    if (!containerRef.current) return;

    initThreeJS();
    animate();

    return () => {
      cleanup();
    };
  }, []);

  // 当课件数据变化时加载模型和应用设置
  useEffect(() => {
    if (coursewareData?.modelUrl) {
      loadModel(coursewareData.modelUrl);
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

  const initThreeJS = () => {
    if (!containerRef.current) return;

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(5, 5, 5);
    cameraRef.current = camera;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    rendererRef.current = renderer;

    // 创建控制器
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

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

    // 添加光照
    setupLights(scene);

    // 添加到容器
    containerRef.current.appendChild(renderer.domElement);
  };

  const setupLights = (scene: THREE.Scene) => {
    // 环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    // 主光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    scene.add(directionalLight);

    // 补光
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.add(hemisphereLight);
  };

  const applySettings = (settings: any) => {
    if (!sceneRef.current || !cameraRef.current || !controlsRef.current) return;

    // 应用背景色
    if (settings.background) {
      sceneRef.current.background = new THREE.Color(settings.background);
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

      // 设置阴影
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
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
      if (child.name) {
        map.set(child.name, child);
      }
      if (child.uuid) {
        map.set(child.uuid, child);
      }
      // 生成nodeKey（路径）
      const path = getObjectPath(child);
      if (path) {
        map.set(path, child);
      }
    });
    
    nodeMapRef.current = map;
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
      
      if (!targetObject) {
        // 尝试通过名称查找
        const matchingKeys = Array.from(nodeMapRef.current.keys()).filter(key => 
          key.includes(annotation.nodeKey) || annotation.nodeKey.includes(key)
        );
        if (matchingKeys.length > 0) {
          targetObject = nodeMapRef.current.get(matchingKeys[0]);
          console.log('通过模糊匹配找到对象:', matchingKeys[0]);
        }
      }
      
      if (targetObject) {
        console.log('为对象创建标注:', targetObject.name || targetObject.uuid);
        const annotationGroup = createAnnotationWithOffset(annotation, targetObject);
        if (annotationGroup) {
          sceneRef.current!.add(annotationGroup);
          annotationsRef.current.push(annotationGroup);
          console.log('标注创建成功');
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
      // 1. 获取目标对象的世界位置（锚点位置）
      targetObject.updateMatrixWorld(true);
      
      // 使用保存的position或计算中心点
      let anchorWorld: THREE.Vector3;
      if (annotation.position) {
        anchorWorld = new THREE.Vector3(
          annotation.position.x, 
          annotation.position.y, 
          annotation.position.z
        );
      } else {
        const box = new THREE.Box3().setFromObject(targetObject);
        anchorWorld = box.getCenter(new THREE.Vector3());
      }

      // 2. 计算标签位置（使用保存的偏移量）
      let labelWorld: THREE.Vector3;
      
      // 优先使用新格式的偏移量
      let offset = annotation.labelOffset;
      let offsetSpace = annotation.labelOffsetSpace || 'local';
      
      // 兼容旧格式
      if (!offset && annotation.label?.offset) {
        offset = {
          x: annotation.label.offset[0],
          y: annotation.label.offset[1], 
          z: annotation.label.offset[2]
        };
        offsetSpace = annotation.label.offsetSpace || 'local';
      }
      
      if (offset) {
        if (offsetSpace === 'local') {
          // 局部坐标系偏移
          const offsetLocal = new THREE.Vector3(offset.x, offset.y, offset.z);
          
          // 获取目标对象的世界变换
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scl = new THREE.Vector3();
          targetObject.matrixWorld.decompose(pos, quat, scl);
          
          // 将局部偏移变换到世界坐标系
          const offsetWorld = offsetLocal.clone().multiply(scl).applyQuaternion(quat);
          labelWorld = anchorWorld.clone().add(offsetWorld);
        } else {
          // 世界坐标系偏移
          labelWorld = new THREE.Vector3(
            anchorWorld.x + offset.x,
            anchorWorld.y + offset.y,
            anchorWorld.z + offset.z
          );
        }
      } else {
        // 没有偏移信息，使用默认偏移
        labelWorld = new THREE.Vector3(
          anchorWorld.x + 0.2,
          anchorWorld.y + 0.3,
          anchorWorld.z + 0.0
        );
        console.warn('标注缺少偏移信息，使用默认偏移:', annotation.id || annotation.title);
      }

      // 3. 创建标注组
      const annotationGroup = new THREE.Group();
      
      // 4. 创建锚点球体
      const anchorGeometry = new THREE.SphereGeometry(0.02, 8, 8);
      const anchorMaterial = new THREE.MeshLambertMaterial({ 
        color: 0xff4444,
        emissive: 0x221111
      });
      const anchorSphere = new THREE.Mesh(anchorGeometry, anchorMaterial);
      anchorSphere.position.copy(anchorWorld);
      annotationGroup.add(anchorSphere);

      // 5. 创建连接线
      const lineGeometry = new THREE.BufferGeometry().setFromPoints([anchorWorld, labelWorld]);
      const lineMaterial = new THREE.LineBasicMaterial({ 
        color: 0x1890ff,
        transparent: true,
        opacity: 0.7
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      annotationGroup.add(line);

      // 6. 创建标签
      const labelSprite = createLabelSprite(annotation);
      if (labelSprite) {
        labelSprite.position.copy(labelWorld);
        annotationGroup.add(labelSprite);
      }

      // 7. 添加用户数据
      annotationGroup.userData = {
        isAnnotation: true,
        annotationData: annotation,
        anchorPosition: anchorWorld.clone(),
        labelPosition: labelWorld.clone()
      };

      return annotationGroup;
    } catch (error) {
      console.error('创建标注失败:', error);
      return null;
    }
  };

  const createLabelSprite = (annotation: any): THREE.Sprite | null => {
    try {
      // 创建画布
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = 512;
      canvas.height = 128;

      // 清空画布
      context.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制背景
      context.fillStyle = 'rgba(30, 50, 80, 0.9)';
      context.fillRect(8, 8, canvas.width - 16, canvas.height - 16);

      // 绘制边框
      context.strokeStyle = '#1890ff';
      context.lineWidth = 2;
      context.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

      // 绘制文字
      context.fillStyle = 'white';
      context.font = 'bold 28px Arial, sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      const title = annotation.title || annotation.label?.title || 'Annotation';
      context.fillText(title, canvas.width / 2, canvas.height / 2);

      // 创建纹理和精灵
      const texture = new THREE.CanvasTexture(canvas);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        alphaTest: 0.001
      });

      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.scale.set(1.0, 0.25, 1); // 调整标签大小

      return sprite;
    } catch (error) {
      console.error('创建标签精灵失败:', error);
      return null;
    }
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

  // 公开的控制方法
  const focusOnNode = (nodeKey: string) => {
    console.log('正在对焦节点:', nodeKey);
    const targetObject = nodeMapRef.current.get(nodeKey);
    
    if (!targetObject) {
      console.warn('未找到节点:', nodeKey);
      console.log('可用节点:', Array.from(nodeMapRef.current.keys()));
      return;
    }

    if (cameraRef.current && controlsRef.current) {
      console.log('找到目标对象:', targetObject.name || targetObject.uuid);
      
      const box = new THREE.Box3().setFromObject(targetObject);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      
      // 确保有合理的距离
      const distance = Math.max(size * 1.5, 2);
      
      // 计算更好的相机位置（从当前位置移动到目标）
      const currentPos = cameraRef.current.position.clone();
      const direction = currentPos.clone().sub(center).normalize();
      const targetPos = center.clone().add(direction.multiplyScalar(distance));
      
      console.log('相机移动: 从', currentPos, '到', targetPos);
      console.log('对焦中心:', center);
      
      // 使用更平滑的动画
      const startPos = currentPos.clone();
      const startTarget = controlsRef.current.target.clone();
      const duration = 1000; // 1秒动画
      const startTime = Date.now();
      
      const animateCamera = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 使用缓动函数
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        
        const newPos = startPos.clone().lerp(targetPos, eased);
        const newTarget = startTarget.clone().lerp(center, eased);
        
        cameraRef.current!.position.copy(newPos);
        controlsRef.current!.target.copy(newTarget);
        cameraRef.current!.lookAt(newTarget);
        controlsRef.current!.update();
        
        if (progress < 1) {
          requestAnimationFrame(animateCamera);
        } else {
          console.log('相机对焦完成');
        }
      };
      
      animateCamera();
    }
  };

  const highlightNode = (nodeKey: string, highlight: boolean = true) => {
    console.log('高亮节点:', nodeKey, highlight);
    const targetObject = nodeMapRef.current.get(nodeKey);
    
    if (!targetObject) {
      console.warn('未找到要高亮的节点:', nodeKey);
      return;
    }

    if (outlineRef.current) {
      console.log('找到目标对象进行高亮:', targetObject.name || targetObject.uuid);
      
      if (highlight) {
        // 收集所有Mesh对象进行高亮
        const meshesToHighlight: THREE.Mesh[] = [];
        targetObject.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            meshesToHighlight.push(child);
          }
        });
        
        console.log('高亮对象数量:', meshesToHighlight.length);
        outlineRef.current.selectedObjects = meshesToHighlight;
        
        // 设置高亮颜色和强度
        outlineRef.current.visibleEdgeColor.set('#ffff00'); // 黄色
        outlineRef.current.hiddenEdgeColor.set('#ffff00');
        outlineRef.current.edgeStrength = 5;
        outlineRef.current.edgeGlow = 0.8;
        outlineRef.current.edgeThickness = 2;
        outlineRef.current.pulsePeriod = 1.5;
      } else {
        outlineRef.current.selectedObjects = [];
        console.log('清除高亮');
      }
    }
  };

  const setNodeVisibility = (nodeKey: string, visible: boolean) => {
    console.log('设置节点显隐:', nodeKey, visible);
    const targetObject = nodeMapRef.current.get(nodeKey);
    
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
    const animation = animationsRef.current.find(anim => 
      anim.name === animationId || 
      anim.uuid === animationId ||
      anim.name?.includes(animationId)
    );
    
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
      const data = annotation.userData?.annotationData;
      if (data && annotationIds.includes(data.id)) {
        annotation.visible = true;
        console.log('显示标注:', data.title);
      }
    });
  };

  const hideAnnotations = (annotationIds: string[]) => {
    console.log('隐藏标注:', annotationIds);
    annotationsRef.current.forEach(annotation => {
      const data = annotation.userData?.annotationData;
      if (data && annotationIds.includes(data.id)) {
        annotation.visible = false;
        console.log('隐藏标注:', data.title);
      }
    });
  };

  const showAllAnnotations = () => {
    annotationsRef.current.forEach(annotation => {
      annotation.visible = true;
    });
  };

  const hideAllAnnotations = () => {
    annotationsRef.current.forEach(annotation => {
      annotation.visible = false;
    });
  };

  // 暴露控制方法给父组件
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any)._viewerControls = {
        focusOnNode,
        highlightNode,
        setNodeVisibility,
        playAnimation,
        showAnnotations,
        hideAnnotations,
        showAllAnnotations,
        hideAllAnnotations,
        getNodeMap: () => nodeMapRef.current,
        getAnnotations: () => annotationsRef.current
      };
      
      console.log('三维查看器控制接口已暴露:', Object.keys((containerRef.current as any)._viewerControls));
    }
  }, [coursewareData]); // 依赖于coursewareData，确保模型加载后重新暴露接口

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
      {loading && (
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
      
      {loadError && (
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
            <div style={{ fontSize: 12 }}>{loadError}</div>
          </div>
        </div>
      )}
    </div>
  );
}
