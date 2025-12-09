/**
 * TypeScript 类型定义文件
 * 用于 @mkkellogg/gaussian-splats-3d 库
 */

declare module '@mkkellogg/gaussian-splats-3d' {
  import * as THREE from 'three';

  export interface DropInViewerOptions {
    /** 是否使用共享内存的Web Workers（默认true） */
    sharedMemoryForWorkers?: boolean;
    /** 是否启用动态场景（默认false） */
    dynamicScene?: boolean;
    /** 是否自我驱动渲染模式（默认true） */
    selfDrivenMode?: boolean;
    /** GPU加速过滤（默认false） */
    gpuAcceleratedSort?: boolean;
    /** 是否启用SIMD加速 */
    enableSIMDInSort?: boolean;
    /** 半精度浮点 */
    halfPrecisionCovariancesOnGPU?: boolean;
    /** 抗锯齿 */
    antialiased?: boolean;
    /** 球谐函数阶数 */
    sphericalHarmonicsDegree?: number;
    /** 渲染模式 */
    renderMode?: number;
    /** 场景背景透明 */
    sceneBackgroundTransparent?: boolean;
  }

  export interface SplatSceneOptions {
    /** 是否显示加载UI */
    showLoadingUI?: boolean;
    /** Splat透明度移除阈值 */
    splatAlphaRemovalThreshold?: number;
    /** 位置 [x, y, z] */
    position?: [number, number, number];
    /** 旋转四元数 [x, y, z, w] */
    rotation?: [number, number, number, number];
    /** 缩放 [x, y, z] */
    scale?: [number, number, number];
    /** 是否流式加载 */
    streamView?: boolean;
    /** 渐进式加载 */
    progressiveLoad?: boolean;
  }

  /**
   * DropInViewer - 可直接添加到Three.js场景的高斯泼溅查看器
   * 继承自THREE.Object3D，支持WebXR
   */
  export class DropInViewer extends THREE.Object3D {
    constructor(options?: DropInViewerOptions);

    /**
     * 添加splat场景
     * @param url Splat文件URL
     * @param options 加载选项
     */
    addSplatScene(url: string, options?: SplatSceneOptions): Promise<void>;

    /**
     * 移除splat场景
     * @param index 场景索引
     */
    removeSplatScene(index: number): void;

    /**
     * 更新查看器（每帧调用）
     */
    update(): void;

    /**
     * 释放资源
     */
    dispose(): void;

    /**
     * 设置渲染模式
     */
    setRenderMode(mode: number): void;

    /**
     * 获取splat网格
     */
    getSplatMesh(): THREE.Mesh | null;
  }

  /**
   * Viewer - 独立的高斯泼溅查看器
   */
  export class Viewer {
    constructor(options?: {
      cameraUp?: [number, number, number];
      initialCameraPosition?: [number, number, number];
      initialCameraLookAt?: [number, number, number];
      selfDrivenMode?: boolean;
      useBuiltInControls?: boolean;
      rootElement?: HTMLElement;
      ignoreDevicePixelRatio?: boolean;
      gpuAcceleratedSort?: boolean;
      sharedMemoryForWorkers?: boolean;
      halfPrecisionCovariancesOnGPU?: boolean;
      antialiased?: boolean;
      sphericalHarmonicsDegree?: number;
      dynamicScene?: boolean;
      renderMode?: number;
    });

    addSplatScene(url: string, options?: SplatSceneOptions): Promise<void>;
    removeSplatScene(index: number): void;
    start(): void;
    stop(): void;
    dispose(): void;
    update(): void;
    render(): void;
    getCamera(): THREE.PerspectiveCamera;
    getScene(): THREE.Scene;
    getRenderer(): THREE.WebGLRenderer;
  }

  /**
   * 渲染模式常量
   */
  export const RenderMode: {
    Always: number;
    OnChange: number;
    Never: number;
  };

  /**
   * 场景格式常量
   */
  export const SceneFormat: {
    Splat: number;
    Ply: number;
    KSplat: number;
  };

  export default {
    DropInViewer,
    Viewer,
    RenderMode,
    SceneFormat
  };
}




