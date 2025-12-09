/**
 * VR瞬移系统 - 允许用户在VR中移动到不同位置
 */
import * as THREE from 'three';

export interface VRTeleportConfig {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  cameraRig?: THREE.Group; // 相机组，用于移动用户
  floorY?: number; // 地板Y坐标
  maxDistance?: number; // 最大瞬移距离
}

export class VRTeleport {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private cameraRig: THREE.Group;
  private floorY: number;
  private maxDistance: number;
  
  // 控制器
  private controller: THREE.XRTargetRaySpace | null = null;
  
  // 瞬移状态
  private isTeleporting = false;
  private teleportTarget = new THREE.Vector3();
  
  // 瞬移指示器
  private teleportIndicator: THREE.Group | null = null;
  private teleportArc: THREE.Line | null = null;
  
  // 射线检测
  private raycaster = new THREE.Raycaster();
  private tempMatrix = new THREE.Matrix4();
  
  // 地板检测
  private floorMesh: THREE.Mesh | null = null;
  
  constructor(config: VRTeleportConfig) {
    this.scene = config.scene;
    this.renderer = config.renderer;
    this.cameraRig = config.cameraRig || new THREE.Group();
    this.floorY = config.floorY ?? 0;
    this.maxDistance = config.maxDistance ?? 10;
    
    // 如果没有提供cameraRig，创建一个并添加到场景
    if (!config.cameraRig) {
      this.scene.add(this.cameraRig);
    }
  }
  
  /**
   * 初始化瞬移系统
   */
  public setup(): void {
    console.log('[VRTeleport] Setting up teleport system...');
    
    // 使用第二个控制器（通常是左手）作为瞬移控制器
    this.controller = this.renderer.xr.getController(1);
    
    // 创建瞬移指示器
    this.createTeleportIndicator();
    
    // 创建地板检测网格
    this.createFloorMesh();
    
    // 绑定事件 - 使用摇杆或Thumbstick
    this.controller.addEventListener('selectstart', () => {
      // 开始瞬移瞄准
      this.startTeleport();
    });
    
    this.controller.addEventListener('selectend', () => {
      // 执行瞬移
      this.executeTeleport();
    });
    
    console.log('[VRTeleport] Teleport system ready');
  }
  
  /**
   * 创建瞬移指示器
   */
  private createTeleportIndicator(): void {
    this.teleportIndicator = new THREE.Group();
    this.teleportIndicator.visible = false;
    
    // 圆环指示器
    const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    this.teleportIndicator.add(ring);
    
    // 中心点
    const centerGeometry = new THREE.CircleGeometry(0.1, 16);
    const centerMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide
    });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.01;
    this.teleportIndicator.add(center);
    
    // 方向箭头
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.5);
    arrowShape.lineTo(0.15, 0.3);
    arrowShape.lineTo(0.05, 0.3);
    arrowShape.lineTo(0.05, 0);
    arrowShape.lineTo(-0.05, 0);
    arrowShape.lineTo(-0.05, 0.3);
    arrowShape.lineTo(-0.15, 0.3);
    arrowShape.closePath();
    
    const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
    const arrowMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
    arrow.rotation.x = -Math.PI / 2;
    arrow.position.y = 0.02;
    this.teleportIndicator.add(arrow);
    
    this.scene.add(this.teleportIndicator);
    
    // 创建瞬移弧线
    this.createTeleportArc();
  }
  
  /**
   * 创建瞬移弧线
   */
  private createTeleportArc(): void {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      points.push(new THREE.Vector3(0, 0, 0));
    }
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.6
    });
    
    this.teleportArc = new THREE.Line(geometry, material);
    this.teleportArc.visible = false;
    this.scene.add(this.teleportArc);
  }
  
  /**
   * 创建地板检测网格
   */
  private createFloorMesh(): void {
    const geometry = new THREE.PlaneGeometry(100, 100);
    const material = new THREE.MeshBasicMaterial({
      visible: false,
      side: THREE.DoubleSide
    });
    
    this.floorMesh = new THREE.Mesh(geometry, material);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = this.floorY;
    this.floorMesh.name = 'VR_TELEPORT_FLOOR';
    
    this.scene.add(this.floorMesh);
  }
  
  /**
   * 开始瞬移瞄准
   */
  public startTeleport(): void {
    if (!this.controller) return;
    
    this.isTeleporting = true;
    
    if (this.teleportIndicator) {
      this.teleportIndicator.visible = true;
    }
    if (this.teleportArc) {
      this.teleportArc.visible = true;
    }
    
    console.log('[VRTeleport] Teleport aiming started');
  }
  
  /**
   * 执行瞬移
   */
  public executeTeleport(): void {
    if (!this.isTeleporting) return;
    
    this.isTeleporting = false;
    
    if (this.teleportIndicator) {
      this.teleportIndicator.visible = false;
    }
    if (this.teleportArc) {
      this.teleportArc.visible = false;
    }
    
    // 检查是否有有效的瞬移目标
    if (this.teleportTarget.y >= this.floorY - 0.1) {
      // 移动相机组到目标位置
      const currentY = this.cameraRig.position.y;
      this.cameraRig.position.x = this.teleportTarget.x;
      this.cameraRig.position.z = this.teleportTarget.z;
      // 保持Y坐标不变（除非有高低差）
      
      console.log('[VRTeleport] Teleported to:', this.teleportTarget);
    }
  }
  
  /**
   * 计算抛物线瞬移路径
   */
  private calculateParabolicPath(origin: THREE.Vector3, direction: THREE.Vector3): THREE.Vector3[] {
    const points: THREE.Vector3[] = [];
    const velocity = direction.clone().multiplyScalar(5); // 初始速度
    const gravity = new THREE.Vector3(0, -9.8, 0);
    const dt = 0.05;
    const maxTime = 2;
    
    let pos = origin.clone();
    let vel = velocity.clone();
    
    for (let t = 0; t < maxTime; t += dt) {
      points.push(pos.clone());
      
      // 检查是否碰到地板
      if (pos.y <= this.floorY) {
        pos.y = this.floorY;
        points.push(pos.clone());
        break;
      }
      
      // 更新位置和速度
      pos.add(vel.clone().multiplyScalar(dt));
      vel.add(gravity.clone().multiplyScalar(dt));
      
      // 检查最大距离
      if (origin.distanceTo(pos) > this.maxDistance) {
        break;
      }
    }
    
    return points;
  }
  
  /**
   * 更新 - 每帧调用
   */
  public update(): void {
    if (!this.isTeleporting || !this.controller) return;
    
    // 获取控制器方向
    this.tempMatrix.identity().extractRotation(this.controller.matrixWorld);
    const direction = new THREE.Vector3(0, 0, -1).applyMatrix4(this.tempMatrix);
    
    // 获取控制器位置
    const origin = new THREE.Vector3();
    this.controller.getWorldPosition(origin);
    
    // 计算抛物线路径
    const path = this.calculateParabolicPath(origin, direction);
    
    // 更新弧线
    if (this.teleportArc && path.length > 0) {
      const positions = new Float32Array(path.length * 3);
      path.forEach((point, i) => {
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
      });
      
      this.teleportArc.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(positions, 3)
      );
      this.teleportArc.geometry.setDrawRange(0, path.length);
    }
    
    // 射线检测地板
    this.raycaster.ray.origin.copy(origin);
    this.raycaster.ray.direction.copy(direction);
    
    const targets = this.floorMesh ? [this.floorMesh] : [];
    const intersects = this.raycaster.intersectObjects(targets);
    
    if (intersects.length > 0) {
      this.teleportTarget.copy(intersects[0].point);
      
      if (this.teleportIndicator) {
        this.teleportIndicator.visible = true;
        this.teleportIndicator.position.copy(this.teleportTarget);
        this.teleportIndicator.position.y = this.floorY + 0.01;
        
        // 指向控制器方向
        const lookAt = origin.clone();
        lookAt.y = this.teleportIndicator.position.y;
        this.teleportIndicator.lookAt(lookAt);
      }
      
      // 更新弧线颜色为绿色（有效目标）
      if (this.teleportArc) {
        (this.teleportArc.material as THREE.LineBasicMaterial).color.setHex(0x00ff00);
      }
    } else {
      // 使用抛物线终点
      if (path.length > 0) {
        this.teleportTarget.copy(path[path.length - 1]);
      }
      
      if (this.teleportIndicator) {
        this.teleportIndicator.visible = false;
      }
      
      // 更新弧线颜色为红色（无效目标）
      if (this.teleportArc) {
        (this.teleportArc.material as THREE.LineBasicMaterial).color.setHex(0xff0000);
      }
    }
  }
  
  /**
   * 设置相机组
   */
  public setCameraRig(rig: THREE.Group): void {
    this.cameraRig = rig;
  }
  
  /**
   * 获取相机组
   */
  public getCameraRig(): THREE.Group {
    return this.cameraRig;
  }
  
  /**
   * 销毁
   */
  public dispose(): void {
    if (this.teleportIndicator) {
      this.scene.remove(this.teleportIndicator);
    }
    if (this.teleportArc) {
      this.scene.remove(this.teleportArc);
    }
    if (this.floorMesh) {
      this.scene.remove(this.floorMesh);
    }
  }
}





