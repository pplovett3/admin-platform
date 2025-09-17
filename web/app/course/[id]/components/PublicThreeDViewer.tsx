"use client";
import { useEffect, useRef, useState } from 'react';
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
  coursewareData: any;
  onControlsReady?: (controls: any) => void;
}

export default function PublicThreeDViewer({ coursewareData, onControlsReady }: PublicThreeDViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const outlineRef = useRef<OutlinePass | null>(null);
  const modelRootRef = useRef<THREE.Object3D | null>(null);
  const annotationsRef = useRef<THREE.Object3D[]>([]);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const nodeMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const autoRotationRef = useRef<boolean>(false);
  const rotationSpeedRef = useRef<number>(0.005);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [webglSupported, setWebglSupported] = useState(true);

  // WebGL支持检测
  const checkWebGLSupport = () => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    if (!checkWebGLSupport()) {
      setWebglSupported(false);
      setLoading(false);
      return;
    }

    initThreeJS();
    
    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (coursewareData?.modelUrl && sceneRef.current) {
      loadModel(coursewareData.modelUrl);
    }
  }, [coursewareData?.modelUrl]);

  const initThreeJS = () => {
    if (!containerRef.current) return;

    try {
      // 场景
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x919191);
      sceneRef.current = scene;

      // 相机
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
      camera.position.set(0, 2, 5);
      cameraRef.current = camera;

      // 渲染器
      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      rendererRef.current = renderer;

      // 控制器
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.05;
      controlsRef.current = controls;

      // 后处理
      const composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
      outline.edgeStrength = 3.0;
      outline.edgeGlow = 0.3;
      outline.edgeThickness = 1.0;
      outline.pulsePeriod = 2;
      outline.visibleEdgeColor.set('#ff6600');
      outline.hiddenEdgeColor.set('#ff6600');
      composer.addPass(outline);
      outlineRef.current = outline;
      composerRef.current = composer;

      // 添加到容器
      containerRef.current.appendChild(renderer.domElement);

      // 灯光
      setupLights();

      // 渲染循环
      startRenderLoop();

      // 调整大小处理
      const handleResize = () => {
        if (!containerRef.current || !renderer || !camera || !composer) return;
        
        const rect = containerRef.current.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        composer.setSize(width, height);
      };

      window.addEventListener('resize', handleResize);
      handleResize();

      // 暴露控制接口
      exposeControls();

    } catch (error) {
      console.error('初始化Three.js失败:', error);
      setLoadError('3D渲染器初始化失败');
      setLoading(false);
    }
  };

  const setupLights = () => {
    if (!sceneRef.current) return;

    // 环境光
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    sceneRef.current.add(ambientLight);

    // 主光源
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.setScalar(2048);
    sceneRef.current.add(directionalLight);

    // 补光
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x98FB98, 0.3);
    sceneRef.current.add(hemisphereLight);
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

      const manager = new THREE.LoadingManager();
      const ktx2 = new KTX2Loader(manager)
        .setTranscoderPath('https://unpkg.com/three@0.164.0/examples/jsm/libs/basis/')
        .detectSupport(rendererRef.current);
      const draco = new DRACOLoader(manager)
        .setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      const loader = new GLTFLoader(manager)
        .setKTX2Loader(ktx2)
        .setDRACOLoader(draco);

      // 使用简单的加载方式（公开页面不需要认证）
      console.log('Loading model from URL:', modelUrl);
      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(modelUrl, resolve, undefined, reject);
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

      // 创建标注
      if (coursewareData?.annotations) {
        createAnnotations(coursewareData.annotations);
      }

      // 设置动画
      if (gltf.animations && gltf.animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
      }

      // 适配相机到模型
      fitCameraToModel(model);

      setLoading(false);

    } catch (error) {
      console.error('模型加载失败:', error);
      setLoadError('模型加载失败');
      setLoading(false);
    }
  };

  const buildNodeMap = (root: THREE.Object3D) => {
    const nodeMap = new Map<string, THREE.Object3D>();
    
    root.traverse((object: THREE.Object3D) => {
      if (object.name) {
        nodeMap.set(object.name, object);
      }
      nodeMap.set(object.uuid, object);
    });
    
    nodeMapRef.current = nodeMap;
  };

  const createAnnotations = (annotations: any[]) => {
    annotations.forEach((annotation) => {
      const sprite = createLabelSprite(annotation.title || '标注', false);
      sprite.position.copy(new THREE.Vector3(
        annotation.position.x,
        annotation.position.y,
        annotation.position.z
      ));
      sprite.userData.annotationId = annotation.id;
      annotationsRef.current.push(sprite);
      sceneRef.current?.add(sprite);
    });
  };

  const createLabelSprite = (text: string, visible: boolean = true) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    const fontSize = 24;
    const padding = 12;
    
    context.font = `${fontSize}px Arial`;
    const textWidth = context.measureText(text).width;
    
    canvas.width = textWidth + padding * 2;
    canvas.height = fontSize + padding * 2;
    
    // 背景
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // 文字
    context.fillStyle = 'white';
    context.font = `${fontSize}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    
    sprite.scale.set(canvas.width / 100, canvas.height / 100, 1);
    sprite.visible = visible;
    
    return sprite;
  };

  const fitCameraToModel = (model: THREE.Object3D) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());

    const distance = size * 1.5;
    cameraRef.current.position.copy(center);
    cameraRef.current.position.z += distance;
    cameraRef.current.lookAt(center);

    controlsRef.current.target.copy(center);
    controlsRef.current.update();
  };

  const startRenderLoop = () => {
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      
      if (mixerRef.current) {
        mixerRef.current.update(clockRef.current.getDelta());
      }
      
      // 自转功能
      if (autoRotationRef.current && modelRootRef.current) {
        modelRootRef.current.rotation.y += rotationSpeedRef.current;
      }
      
      if (composerRef.current) {
        composerRef.current.render();
      }
    };
    animate();
  };

  const exposeControls = () => {
    const controls = {
      focusOnNode: (nodeKey: string) => {
        const object = nodeMapRef.current.get(nodeKey);
        if (object && cameraRef.current && controlsRef.current) {
          const box = new THREE.Box3().setFromObject(object);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3()).length();
          
          const distance = size * 2;
          const direction = new THREE.Vector3(1, 1, 1).normalize();
          const targetPosition = center.clone().add(direction.multiplyScalar(distance));
          
          cameraRef.current.position.copy(targetPosition);
          cameraRef.current.lookAt(center);
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
        }
      },
      
      highlightNode: (nodeKey: string, highlight: boolean) => {
        const object = nodeMapRef.current.get(nodeKey);
        if (object && outlineRef.current) {
          if (highlight) {
            outlineRef.current.selectedObjects = [object];
          } else {
            outlineRef.current.selectedObjects = [];
          }
        }
      },
      
      showAnnotations: (annotationIds: string[]) => {
        annotationsRef.current.forEach(annotation => {
          if (annotationIds.includes(annotation.userData.annotationId)) {
            annotation.visible = true;
          }
        });
      },
      
      hideAnnotations: (annotationIds: string[]) => {
        annotationsRef.current.forEach(annotation => {
          if (annotationIds.includes(annotation.userData.annotationId)) {
            annotation.visible = false;
          }
        });
      },
      
      setNodeVisibility: (nodeKey: string, visible: boolean) => {
        const object = nodeMapRef.current.get(nodeKey);
        if (object) {
          object.visible = visible;
        }
      },
      
      playAnimation: (animationId: string, startTime?: number, endTime?: number) => {
        // 简化的动画播放
        console.log('播放动画:', animationId);
      },
      
      resetAllStates: () => {
        if (outlineRef.current) {
          outlineRef.current.selectedObjects = [];
        }
        annotationsRef.current.forEach(annotation => {
          annotation.visible = false;
        });
        autoRotationRef.current = false;
      },
      
      startAutoRotation: (speed: number = 0.005) => {
        autoRotationRef.current = true;
        rotationSpeedRef.current = speed;
      },
      
      stopAutoRotation: () => {
        autoRotationRef.current = false;
      }
    };

    if (onControlsReady) {
      onControlsReady(controls);
    }
  };

  const cleanup = () => {
    if (rendererRef.current && containerRef.current) {
      containerRef.current.removeChild(rendererRef.current.domElement);
      rendererRef.current.dispose();
    }
  };

  if (!webglSupported) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        background: '#f5f5f5'
      }}>
        <Alert
          message="不支持WebGL"
          description="您的浏览器不支持WebGL，无法显示3D内容。请更新浏览器或使用支持WebGL的浏览器。"
          type="warning"
          showIcon
        />
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        background: '#f5f5f5'
      }}>
        <Alert
          message="加载失败"
          description={loadError}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        background: '#919191'
      }}
    >
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 100
        }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, textAlign: 'center', color: '#666' }}>
            正在加载3D模型...
          </div>
        </div>
      )}
    </div>
  );
}
