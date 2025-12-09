/**
 * WebXR Hit Test 管理
 * 用于AR模式下的平面检测和模型放置
 */
import * as THREE from 'three';

export type ARPlacementMode = 'free' | 'fixed';

export interface HitTestResult {
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
  matrix: THREE.Matrix4;
}

/**
 * XR Hit Test 管理类
 */
export class XRHitTest {
  private renderer: THREE.WebGLRenderer;
  private hitTestSource: XRHitTestSource | null = null;
  private hitTestSourceRequested: boolean = false;
  private reticle: THREE.Mesh | null = null;
  private scene: THREE.Scene;
  private placementMode: ARPlacementMode = 'free';
  private isPlaced: boolean = false;
  private placedPosition: THREE.Vector3 = new THREE.Vector3();
  private placedRotation: THREE.Quaternion = new THREE.Quaternion();
  
  // 回调
  private onHitTestResult?: (result: HitTestResult | null) => void;
  private onPlacement?: (position: THREE.Vector3, rotation: THREE.Quaternion) => void;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.createReticle();
  }

  /**
   * 创建放置指示器
   */
  private createReticle(): void {
    // 创建圆环指示器
    const geometry = new THREE.RingGeometry(0.1, 0.12, 32);
    geometry.rotateX(-Math.PI / 2);
    
    const material = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    
    this.reticle = new THREE.Mesh(geometry, material);
    this.reticle.name = 'ar_reticle';
    this.reticle.visible = false;
    this.reticle.matrixAutoUpdate = false;
    
    // 添加中心点
    const dotGeometry = new THREE.CircleGeometry(0.02, 16);
    dotGeometry.rotateX(-Math.PI / 2);
    const dotMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    this.reticle.add(dot);
    
    // 添加脉冲动画环
    const pulseGeometry = new THREE.RingGeometry(0.12, 0.13, 32);
    pulseGeometry.rotateX(-Math.PI / 2);
    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.5
    });
    const pulse = new THREE.Mesh(pulseGeometry, pulseMaterial);
    pulse.name = 'pulse';
    this.reticle.add(pulse);
    
    this.scene.add(this.reticle);
  }

  /**
   * 设置放置模式
   */
  setPlacementMode(mode: ARPlacementMode): void {
    this.placementMode = mode;
    
    if (mode === 'fixed') {
      // 固定模式：模型固定在用户前方
      this.isPlaced = true;
      this.reticle!.visible = false;
    } else {
      // 自由放置模式
      this.isPlaced = false;
      this.reticle!.visible = true;
    }
  }

  /**
   * 获取放置模式
   */
  getPlacementMode(): ARPlacementMode {
    return this.placementMode;
  }

  /**
   * 是否已放置
   */
  getIsPlaced(): boolean {
    return this.isPlaced;
  }

  /**
   * 设置hit test结果回调
   */
  setOnHitTestResult(callback: (result: HitTestResult | null) => void): void {
    this.onHitTestResult = callback;
  }

  /**
   * 设置放置回调
   */
  setOnPlacement(callback: (position: THREE.Vector3, rotation: THREE.Quaternion) => void): void {
    this.onPlacement = callback;
  }

  /**
   * 每帧更新
   */
  update(frame: XRFrame): void {
    if (!this.renderer.xr.isPresenting) return;
    
    const session = this.renderer.xr.getSession();
    if (!session) return;

    // 请求hit test source
    if (!this.hitTestSourceRequested) {
      this.requestHitTestSource(session);
    }

    // 处理hit test结果
    if (this.hitTestSource && this.reticle) {
      const referenceSpace = this.renderer.xr.getReferenceSpace();
      if (!referenceSpace) return;

      const hitTestResults = frame.getHitTestResults(this.hitTestSource);
      
      if (hitTestResults.length > 0) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        
        if (pose) {
          // 更新指示器位置
          this.reticle.visible = !this.isPlaced && this.placementMode === 'free';
          this.reticle.matrix.fromArray(pose.transform.matrix);
          
          // 提取位置和旋转
          const position = new THREE.Vector3();
          const rotation = new THREE.Quaternion();
          const scale = new THREE.Vector3();
          this.reticle.matrix.decompose(position, rotation, scale);
          
          // 回调
          this.onHitTestResult?.({
            position,
            rotation,
            matrix: this.reticle.matrix.clone()
          });
          
          // 脉冲动画
          this.animatePulse();
        }
      } else {
        this.reticle.visible = false;
        this.onHitTestResult?.(null);
      }
    }
  }

  /**
   * 请求hit test source
   */
  private async requestHitTestSource(session: XRSession): Promise<void> {
    this.hitTestSourceRequested = true;
    
    try {
      const referenceSpace = await session.requestReferenceSpace('viewer');
      const hitTestSource = await session.requestHitTestSource!({
        space: referenceSpace
      });
      
      this.hitTestSource = hitTestSource;
      
      // 监听会话结束
      session.addEventListener('end', () => {
        this.hitTestSource = null;
        this.hitTestSourceRequested = false;
      });
    } catch (e) {
      console.warn('Hit test not supported:', e);
    }
  }

  /**
   * 确认放置
   */
  confirmPlacement(): void {
    if (!this.reticle || this.isPlaced) return;
    
    // 提取当前位置
    const position = new THREE.Vector3();
    const rotation = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    this.reticle.matrix.decompose(position, rotation, scale);
    
    this.placedPosition.copy(position);
    this.placedRotation.copy(rotation);
    this.isPlaced = true;
    this.reticle.visible = false;
    
    // 回调
    this.onPlacement?.(position, rotation);
  }

  /**
   * 重置放置
   */
  resetPlacement(): void {
    this.isPlaced = false;
    if (this.reticle && this.placementMode === 'free') {
      this.reticle.visible = true;
    }
  }

  /**
   * 获取放置位置
   */
  getPlacedPosition(): THREE.Vector3 {
    return this.placedPosition.clone();
  }

  /**
   * 获取放置旋转
   */
  getPlacedRotation(): THREE.Quaternion {
    return this.placedRotation.clone();
  }

  /**
   * 脉冲动画
   */
  private animatePulse(): void {
    if (!this.reticle) return;
    
    const pulse = this.reticle.getObjectByName('pulse') as THREE.Mesh;
    if (!pulse) return;
    
    const time = Date.now() * 0.003;
    const scale = 1 + Math.sin(time) * 0.2;
    pulse.scale.setScalar(scale);
    
    const material = pulse.material as THREE.MeshBasicMaterial;
    material.opacity = 0.5 - Math.sin(time) * 0.3;
  }

  /**
   * 获取指示器
   */
  getReticle(): THREE.Mesh | null {
    return this.reticle;
  }

  /**
   * 销毁
   */
  dispose(): void {
    if (this.reticle) {
      this.reticle.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.scene.remove(this.reticle);
    }
    
    this.hitTestSource = null;
  }
}

/**
 * 创建 XR Hit Test 实例
 */
export function createXRHitTest(renderer: THREE.WebGLRenderer, scene: THREE.Scene): XRHitTest {
  return new XRHitTest(renderer, scene);
}

