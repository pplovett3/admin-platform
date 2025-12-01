"use client";
import { useEffect, useRef, useState } from 'react';
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
import { getToken, getAPI_URL } from '@/app/_lib/api';

// 记录材质/对象的高亮前状态
type MaterialBackup = {
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  // 当对对象进行高亮时，缓存其原始材质（单个或数组）
  originalMaterials?: any | any[];
};

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
  const materialBackupRef = useRef<WeakMap<any, MaterialBackup>>(new WeakMap());
  const highlightedMatsRef = useRef<Set<any>>(new Set());
  const shadowPlaneRef = useRef<THREE.Mesh | null>(null);
  const autoRotationRef = useRef<boolean>(false);
  const rotationSpeedRef = useRef<number>(0.005);
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
      // 先应用背景设置（在模型加载前），即使没有settings也使用默认值
      applySettings(coursewareData?.settings || {});
      // 然后加载模型（模型加载完成后会再次应用设置以确保正确）
      loadModel(modelUrl).then(() => {
        // 模型加载完成后再次应用设置，确保背景正确显示
        applySettings(coursewareData?.settings || {});
      });
    } else {
      // 如果没有模型URL，直接应用设置（使用默认值）
      applySettings(coursewareData?.settings || {});
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
      
      // 标注缩放更新（已移除自适应缩放，使用固定大小）
      
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
      let useProxy = false;
      
      if (modelUrl.startsWith('/api/files/')) {
        // 使用动态获取的API URL，如果是公网域名则使用相对路径（通过 Next.js rewrites）
        const baseUrl = getAPI_URL();
        finalUrl = `${baseUrl}${modelUrl}`;
      } else if (modelUrl.startsWith('https://dl.yf-xr.com/') || modelUrl.startsWith('https://video.yf-xr.com/')) {
        // 公网URL：使用代理避免CORS问题
        const baseUrl = getAPI_URL();
        finalUrl = `${baseUrl}/api/files/proxy?url=${encodeURIComponent(modelUrl)}`;
        useProxy = true;
      }

      // 配置加载器
      const manager = new THREE.LoadingManager();

      // 使用fetch加载（支持认证）
      const token = getToken();
      const response = await fetch(finalUrl, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
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
          .setTranscoderPath('https://unpkg.com/three@0.164.0/examples/jsm/libs/basis/')
          .detectSupport(rendererRef.current);
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

      // 设置模型阴影投射
      model.traverse((child: THREE.Object3D) => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;  // 投射阴影
        }
      });

      // 构建节点映射
      buildNodeMap(model);

      // 设置动画
      if (animations && animations.length > 0) {
        const mixer = new THREE.AnimationMixer(model);
        mixerRef.current = mixer;
        animationsRef.current = animations;
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
        
        // 【修复】移除根节点偏移逻辑，与三维编辑器保持一致
        // 标注位置应该基于目标对象的世界矩阵，不需要额外的根节点偏移
        console.log('标注位置计算 - anchor.offset:', annotation.anchor.offset, '世界位置:', anchorWorld.toArray());
      } else if (annotation.position) {
        // 兼容格式：应用与三维编辑器相同的变换逻辑
        const posLocal = new THREE.Vector3(
          annotation.position.x || annotation.position[0], 
          annotation.position.y || annotation.position[1], 
          annotation.position.z || annotation.position[2]
        );
        targetObject.updateWorldMatrix(true, true);
        anchorWorld = posLocal.clone().applyMatrix4(targetObject.matrixWorld);
        
        console.log('标注位置计算 - position:', annotation.position, '局部位置:', posLocal.toArray(), '世界位置:', anchorWorld.toArray());
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
          // 仅应用旋转，忽略缩放，避免非均匀缩放导致偏移接近 0
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scl = new THREE.Vector3();
          targetObject.matrixWorld.decompose(pos, quat, scl);
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

  const createLabelSprite = (annotation: any, labelScale: number = 1): THREE.Sprite | null => {
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
      
      // 创建实际画布
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      // 重新设置字体（canvas resize后会丢失）
      context.font = `bold ${fontSize}px Arial, Microsoft YaHei, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';

      // 绘制背景（圆角矩形）
      const borderRadius = 8;
      context.fillStyle = 'rgba(30, 50, 80, 0.95)';
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

      // 绘制文字
      context.fillStyle = 'white';
      context.fillText(title, canvasWidth / 2, canvasHeight / 2);

      // 创建纹理和精灵
      const texture = new THREE.CanvasTexture(canvas);
      texture.magFilter = THREE.LinearFilter;
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      texture.needsUpdate = true;
      
      const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        alphaTest: 0.1,
        depthTest: true, // 启用深度测试
        depthWrite: false,
        sizeAttenuation: true // 启用尺寸衰减，实现近大远小（与三维编辑器一致）
      });
      
      const sprite = new THREE.Sprite(spriteMaterial);
      
      // 使用固定大小，随距离变化（近大远小，与三维编辑器一致）
      const fixedScale = 0.002; // 基础缩放
      sprite.scale.set(canvasWidth * fixedScale * labelScale, canvasHeight * fixedScale * labelScale, 1);
      // 保存标签大小和尺寸信息，以便后续更新
      sprite.userData.annotationId = annotation.id; // 设置annotationId以便查找
      sprite.userData.labelScale = labelScale;
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

    // 标注使用固定大小，无需更新缩放

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
    // 兼容两种记录方式：
    // 1) 记录的是对象（obj），需要恢复其 originalMaterials
    // 2) 旧逻辑记录的是材质（mat），需要恢复发光参数
    for (const item of Array.from(highlightedMatsRef.current)) {
      const backup = materialBackupRef.current.get(item as any);

      // 优先：如果备份了原始材质数组，则恢复
      if (backup && (backup as any).originalMaterials) {
        try {
          const originals = (backup as any).originalMaterials;
          (item as any).material = Array.isArray(originals) && originals.length === 1 ? originals[0] : originals;
          continue;
        } catch {}
      }

      // 兼容：如果记录的是材质，恢复其发光参数
      const mat = item as any;
      const matBackup = materialBackupRef.current.get(mat);
      if (matBackup) {
        if ('emissive' in mat && matBackup.emissive) mat.emissive.copy(matBackup.emissive);
        if ('emissiveIntensity' in mat && typeof matBackup.emissiveIntensity === 'number') mat.emissiveIntensity = matBackup.emissiveIntensity;
      }
    }
    highlightedMatsRef.current.clear();
  };

  // 应用自发光高亮 - 克隆材质避免影响其他对象
  const applyEmissiveHighlight = (obj: THREE.Object3D) => {
    clearEmissiveHighlight();
    
    // 【修复】克隆材质，避免共享材质导致其他对象也被高亮
    if ((obj as any).material) {
      const mats = Array.isArray((obj as any).material) ? (obj as any).material : [(obj as any).material];
      
      // 为当前对象创建材质副本
      const clonedMats = mats.map((mat: any) => {
        const clonedMat = mat.clone();
        // 备份原始材质
        if (!materialBackupRef.current.has(obj)) {
          materialBackupRef.current.set(obj, { 
            originalMaterials: mats,
            emissive: mat.emissive ? mat.emissive.clone() : undefined, 
            emissiveIntensity: mat.emissiveIntensity 
          });
        }
        
        // 应用高亮效果到克隆材质
        if (clonedMat.emissive) clonedMat.emissive.set(0x22d3ee); // 青色高亮
        if ('emissiveIntensity' in clonedMat) clonedMat.emissiveIntensity = Math.max(clonedMat.emissiveIntensity || 0.2, 0.6);
        
        console.log('克隆并高亮材质:', clonedMat.name || clonedMat.uuid);
        return clonedMat;
      });
      
      // 应用克隆的高亮材质
      (obj as any).material = clonedMats.length === 1 ? clonedMats[0] : clonedMats;
      highlightedMatsRef.current.add(obj); // 记录对象而不是材质
    } else {
      console.log('选中的对象没有材质，只使用轮廓高亮');
    }
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
    console.log('恢复所有对象的显示状态');
    hiddenObjectsRef.current.forEach((initialVisible, nodeKey) => {
      let targetObject = nodeMapRef.current.get(nodeKey);
      if (!targetObject) {
        targetObject = findNodeBySmartMatch(nodeKey);
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
    
    // 查找三维课件动画数据（包含相机轨道关键帧）
    // 优先使用 animationId 匹配，如果没有则使用动画名称匹配
    let coursewareAnimation: any = null;
    if (coursewareData?.animations) {
      // 首先尝试通过 animationId 匹配
      coursewareAnimation = (coursewareData.animations as any[]).find(
        (anim: any) => anim.id === animationId
      );
      // 如果找不到，尝试通过名称匹配
      if (!coursewareAnimation && animation) {
        coursewareAnimation = (coursewareData.animations as any[]).find(
          (anim: any) => anim.name === animation.name || anim.name === animationId
        );
      }
    }
    
    console.log('找到课件动画数据:', coursewareAnimation ? {
      id: coursewareAnimation.id,
      name: coursewareAnimation.name,
      hasCameraKeys: !!coursewareAnimation?.timeline?.cameraKeys,
      cameraKeysCount: coursewareAnimation?.timeline?.cameraKeys?.length || 0
    } : '未找到');
    
    // 读取相机轨道关键帧
    let cameraKeys: any[] = [];
    if (coursewareAnimation?.timeline?.cameraKeys) {
      cameraKeys = [...coursewareAnimation.timeline.cameraKeys].sort((a: any, b: any) => a.time - b.time);
      console.log('找到相机轨道关键帧:', cameraKeys.length, '个');
    }
    
    // 停止所有当前动画
    mixerRef.current.stopAllAction();
    
    const action = mixerRef.current.clipAction(animation);
    action.reset();
    
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
    const duration = endTime !== undefined ? (endTime - startTime!) : animation.duration;
    
    // 动画更新循环
    const animateLoop = () => {
      if (!mixerRef.current) return;
      
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
        console.log('动画播放完成');
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
      
      console.log('开始播放完整动画，时长:', animation.duration, '秒');
    }
  };

  // 标注显示/隐藏控制
  const showAnnotations = (annotationIds: string[], labelScale?: number) => {
    console.log('显示标注:', annotationIds, '标签大小:', labelScale);
    annotationsRef.current.forEach(annotationGroup => {
      const annotationId = annotationGroup.userData.annotationId;
      if (annotationId && annotationIds.includes(annotationId)) {
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
              console.log('更新标签大小:', annotationId, 'scale:', labelScale);
            }
          });
        }
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
    console.log('重置所有状态：清除高亮、隐藏标注、停止动画、恢复显隐');
    
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
    
    // 5. 恢复所有对象的显示状态
    restoreAllVisibility();
    
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
      cancelAnimationFrame(cameraAnimationRef.current);
      cameraAnimationRef.current = null;
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
      restoreAllVisibility,  // 【新增】恢复所有对象的显示状态
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
        
        // 辅助函数：检查对象是否是模型对象（排除辅助对象）
        const isModelObject = (obj: THREE.Object3D): boolean => {
          const name = obj.name || '';
          const nameLower = name.toLowerCase();
          
          // 排除阴影平面
          if (name === 'InvisibleShadowPlane' || nameLower.includes('shadowplane')) {
            return false;
          }
          
          // 排除背景球体
          if (name === '__background_sphere__' || nameLower.includes('background') || nameLower.includes('sphere')) {
            return false;
          }
          
          // 排除以 Object_ 开头的辅助对象（如 Object_21f33011）
          if (name.startsWith('Object_') && /^Object_[a-f0-9]{8}/i.test(name)) {
            return false;
          }
          
          // 排除 objectk 开头的空对象
          if (nameLower.startsWith('objectk') || nameLower.startsWith('object_')) {
            return false;
          }
          
          // 排除灯光、相机等辅助对象
          if (obj instanceof THREE.Light || obj instanceof THREE.Camera) {
            return false;
          }
          
          // 排除不可见的对象
          if (!obj.visible) {
            return false;
          }
          
          // 确保对象是模型层级下的对象（modelRootRef 的子对象）
          if (modelRootRef.current) {
            let current = obj;
            let isModelChild = false;
            // 向上遍历，检查是否是模型根节点的子对象
            while (current && current !== sceneRef.current) {
              if (current === modelRootRef.current) {
                isModelChild = true;
                break;
              }
              current = current.parent as THREE.Object3D;
            }
            if (!isModelChild) {
              return false;
            }
          }
          
          return true;
        };

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

        // 查找有效的可选取对象（向上遍历父级，找到有几何体的模型对象）
        const findSelectableObject = (obj: THREE.Object3D): THREE.Object3D | null => {
          let current = obj;
          // 向上遍历10层，找到有几何体的模型对象
          for (let i = 0; i < 10 && current; i++) {
            // 首先检查是否是模型对象
            if (isModelObject(current) && hasGeometry(current)) {
              return current;
            }
            // 检查直接子级是否有几何体
            for (const child of current.children) {
              if (isModelObject(child) && hasGeometry(child)) {
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
