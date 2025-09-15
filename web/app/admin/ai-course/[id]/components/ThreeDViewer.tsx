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

  // 当课件数据变化时加载模型
  useEffect(() => {
    if (coursewareData?.modelUrl) {
      loadModel(coursewareData.modelUrl);
    }
  }, [coursewareData?.modelUrl]);

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

    // 清除旧标注
    annotationsRef.current.forEach(annotation => {
      sceneRef.current!.remove(annotation);
    });
    annotationsRef.current = [];

    // 创建新标注
    annotations.forEach(annotation => {
      const targetObject = nodeMapRef.current.get(annotation.nodeKey);
      if (targetObject) {
        const annotationMarker = createAnnotationMarker(annotation);
        if (annotationMarker) {
          // 获取目标对象的世界位置
          const box = new THREE.Box3().setFromObject(targetObject);
          const center = box.getCenter(new THREE.Vector3());
          annotationMarker.position.copy(center);
          
          sceneRef.current!.add(annotationMarker);
          annotationsRef.current.push(annotationMarker);
        }
      }
    });
  };

  const createAnnotationMarker = (annotation: any): THREE.Object3D | null => {
    // 创建标注球体
    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
    const material = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
    const sphere = new THREE.Mesh(geometry, material);
    
    // 创建文字精灵
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 128;
    
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'white';
    context.font = '24px Arial';
    context.textAlign = 'center';
    context.fillText(annotation.title || 'Annotation', canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(2, 1, 1);
    sprite.position.set(0, 0.5, 0);
    
    sphere.add(sprite);
    return sphere;
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
    const targetObject = nodeMapRef.current.get(nodeKey);
    if (targetObject && cameraRef.current && controlsRef.current) {
      const box = new THREE.Box3().setFromObject(targetObject);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3()).length();
      
      // 平滑移动相机
      const distance = size * 2;
      const targetPos = center.clone().add(new THREE.Vector3(distance, distance * 0.5, distance));
      
      // 简单的相机动画（可以使用Tween.js改进）
      const startPos = cameraRef.current.position.clone();
      const steps = 60;
      let currentStep = 0;
      
      const animateCamera = () => {
        if (currentStep < steps) {
          const progress = currentStep / steps;
          const newPos = startPos.clone().lerp(targetPos, progress);
          cameraRef.current!.position.copy(newPos);
          cameraRef.current!.lookAt(center);
          controlsRef.current!.target.copy(center);
          controlsRef.current!.update();
          currentStep++;
          requestAnimationFrame(animateCamera);
        }
      };
      
      animateCamera();
    }
  };

  const highlightNode = (nodeKey: string, highlight: boolean = true) => {
    const targetObject = nodeMapRef.current.get(nodeKey);
    if (targetObject && outlineRef.current) {
      if (highlight) {
        outlineRef.current.selectedObjects = [targetObject];
      } else {
        outlineRef.current.selectedObjects = [];
      }
    }
  };

  const setNodeVisibility = (nodeKey: string, visible: boolean) => {
    const targetObject = nodeMapRef.current.get(nodeKey);
    if (targetObject) {
      targetObject.visible = visible;
    }
  };

  const playAnimation = (animationId: string, startTime?: number, endTime?: number) => {
    if (!mixerRef.current || !animationsRef.current.length) return;

    // 查找动画
    const animation = animationsRef.current.find(anim => anim.name === animationId || anim.uuid === animationId);
    if (animation) {
      const action = mixerRef.current.clipAction(animation);
      
      if (startTime !== undefined && endTime !== undefined) {
        action.setLoop(THREE.LoopOnce, 1);
        action.time = startTime;
        action.setEffectiveTimeScale(1);
        action.play();
        
        // 在指定时间停止
        setTimeout(() => {
          action.stop();
        }, (endTime - startTime) * 1000);
      } else {
        action.play();
      }
    }
  };

  // 暴露控制方法给父组件
  useEffect(() => {
    if (containerRef.current) {
      (containerRef.current as any)._viewerControls = {
        focusOnNode,
        highlightNode,
        setNodeVisibility,
        playAnimation,
        getNodeMap: () => nodeMapRef.current
      };
    }
  }, []);

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
