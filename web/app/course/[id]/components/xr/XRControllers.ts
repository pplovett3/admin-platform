/**
 * WebXR 控制器管理
 * 处理VR手柄交互、射线选择、手势操作
 */
import * as THREE from 'three';

export interface XRControllerState {
  selecting: boolean;
  squeezing: boolean;
  position: THREE.Vector3;
  rotation: THREE.Quaternion;
}

export interface XRInteractionHandlers {
  onSelect?: (controller: THREE.XRTargetRaySpace, intersection: THREE.Intersection | null) => void;
  onSelectStart?: (controller: THREE.XRTargetRaySpace) => void;
  onSelectEnd?: (controller: THREE.XRTargetRaySpace) => void;
  onSqueeze?: (controller: THREE.XRTargetRaySpace) => void;
  onSqueezeStart?: (controller: THREE.XRTargetRaySpace) => void;
  onSqueezeEnd?: (controller: THREE.XRTargetRaySpace) => void;
  onHover?: (intersection: THREE.Intersection | null) => void;
}

/**
 * XR控制器管理类
 */
export class XRControllers {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private controller1: THREE.XRTargetRaySpace;
  private controller2: THREE.XRTargetRaySpace;
  private controllerGrip1: THREE.XRGripSpace;
  private controllerGrip2: THREE.XRGripSpace;
  private raycaster: THREE.Raycaster;
  private tempMatrix: THREE.Matrix4;
  private rayLine1: THREE.Line | null = null;
  private rayLine2: THREE.Line | null = null;
  private interactableObjects: THREE.Object3D[] = [];
  private handlers: XRInteractionHandlers = {};
  
  // 双手交互状态
  private bothHandsGrabbing: boolean = false;
  private initialPinchDistance: number = 0;
  private initialModelScale: THREE.Vector3 = new THREE.Vector3(1, 1, 1);
  private initialMidpoint: THREE.Vector3 = new THREE.Vector3();
  private targetModel: THREE.Object3D | null = null;

  // 控制器状态
  private controller1State: XRControllerState = {
    selecting: false,
    squeezing: false,
    position: new THREE.Vector3(),
    rotation: new THREE.Quaternion()
  };
  private controller2State: XRControllerState = {
    selecting: false,
    squeezing: false,
    position: new THREE.Vector3(),
    rotation: new THREE.Quaternion()
  };

  private debugGroup: THREE.Group | null = null;
  private debugText: THREE.Sprite | null = null;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.raycaster = new THREE.Raycaster();
    this.tempMatrix = new THREE.Matrix4();

    // 获取控制器
    this.controller1 = renderer.xr.getController(0);
    this.controller2 = renderer.xr.getController(1);
    this.controllerGrip1 = renderer.xr.getControllerGrip(0);
    this.controllerGrip2 = renderer.xr.getControllerGrip(1);

    // 初始化
    this.setupControllers();
    this.createRayVisuals();
    this.createVRDebugPanel();
    
    // 直接添加默认控制器模型（不等待connected事件）
    this.addDefaultControllerModels();
  }
  
  /**
   * 添加默认控制器模型（立即可见）
   */
  private addDefaultControllerModels(): void {
    console.log('[XRControllers] Adding default controller models');
    
    // 左手控制器
    const leftModel = this.createControllerModel('left');
    this.controllerGrip1.add(leftModel);
    
    // 右手控制器  
    const rightModel = this.createControllerModel('right');
    this.controllerGrip2.add(rightModel);
    
    // 在控制器位置添加大的可见球体
    const sphere1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true })
    );
    this.controller1.add(sphere1);
    
    const sphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true })
    );
    this.controller2.add(sphere2);
  }
  
  /**
   * 创建VR内调试面板
   */
  private createVRDebugPanel(): void {
    this.debugGroup = new THREE.Group();
    this.debugGroup.name = 'VRDebugPanel';
    
    // 创建背景面板
    const bgGeometry = new THREE.PlaneGeometry(0.5, 0.3);
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    const bg = new THREE.Mesh(bgGeometry, bgMaterial);
    this.debugGroup.add(bg);
    
    // 创建文字
    this.debugText = this.createDebugTextSprite('VR Debug\n等待控制器...');
    this.debugText.position.z = 0.01;
    this.debugGroup.add(this.debugText);
    
    // 初始位置（用户前方）
    this.debugGroup.position.set(0, 1.5, -1);
    this.scene.add(this.debugGroup);
  }
  
  /**
   * 创建调试文字精灵
   */
  private createDebugTextSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      ctx.fillText(line, 10, 10 + i * 30);
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.5, 0.25, 1);
    return sprite;
  }
  
  /**
   * 更新调试面板文字
   */
  private updateDebugText(text: string): void {
    if (!this.debugText || !this.debugGroup) return;
    
    // 移除旧的
    this.debugGroup.remove(this.debugText);
    (this.debugText.material as THREE.SpriteMaterial).map?.dispose();
    (this.debugText.material as THREE.SpriteMaterial).dispose();
    
    // 创建新的
    this.debugText = this.createDebugTextSprite(text);
    this.debugText.position.z = 0.01;
    this.debugGroup.add(this.debugText);
  }

  /**
   * 设置控制器事件
   */
  private setupControllers(): void {
    // 控制器1事件
    this.controller1.addEventListener('selectstart', () => this.onSelectStart(this.controller1, 1));
    this.controller1.addEventListener('selectend', () => this.onSelectEnd(this.controller1, 1));
    this.controller1.addEventListener('squeezestart', () => this.onSqueezeStart(this.controller1, 1));
    this.controller1.addEventListener('squeezeend', () => this.onSqueezeEnd(this.controller1, 1));
    this.controller1.addEventListener('connected', (e) => this.onControllerConnected(e, 1));
    this.controller1.addEventListener('disconnected', () => this.onControllerDisconnected(1));

    // 控制器2事件
    this.controller2.addEventListener('selectstart', () => this.onSelectStart(this.controller2, 2));
    this.controller2.addEventListener('selectend', () => this.onSelectEnd(this.controller2, 2));
    this.controller2.addEventListener('squeezestart', () => this.onSqueezeStart(this.controller2, 2));
    this.controller2.addEventListener('squeezeend', () => this.onSqueezeEnd(this.controller2, 2));
    this.controller2.addEventListener('connected', (e) => this.onControllerConnected(e, 2));
    this.controller2.addEventListener('disconnected', () => this.onControllerDisconnected(2));

    // 添加到场景
    this.scene.add(this.controller1);
    this.scene.add(this.controller2);
    this.scene.add(this.controllerGrip1);
    this.scene.add(this.controllerGrip2);
  }

  /**
   * 创建射线可视化 - 使用圆柱体代替线条（更明显）
   */
  private createRayVisuals(): void {
    // 使用细长圆柱体代替线条，在VR中更明显
    const rayLength = 5;
    const rayRadius = 0.003;
    
    // 控制器1射线（紫色）
    const geometry1 = new THREE.CylinderGeometry(rayRadius, rayRadius * 0.5, rayLength, 8);
    geometry1.rotateX(Math.PI / 2);
    geometry1.translate(0, 0, -rayLength / 2);
    
    const material1 = new THREE.MeshBasicMaterial({
      color: 0x8b5cf6,
      transparent: true,
      opacity: 0.9
    });
    this.rayLine1 = new THREE.Mesh(geometry1, material1) as any;
    this.controller1.add(this.rayLine1);
    
    // 射线末端小球
    const endSphere1 = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6 })
    );
    endSphere1.position.z = -rayLength;
    endSphere1.name = 'rayEnd';
    this.controller1.add(endSphere1);

    // 控制器2射线（青色）
    const geometry2 = new THREE.CylinderGeometry(rayRadius, rayRadius * 0.5, rayLength, 8);
    geometry2.rotateX(Math.PI / 2);
    geometry2.translate(0, 0, -rayLength / 2);
    
    const material2 = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.9
    });
    this.rayLine2 = new THREE.Mesh(geometry2, material2) as any;
    this.controller2.add(this.rayLine2);
    
    // 射线末端小球
    const endSphere2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.015, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x06b6d4 })
    );
    endSphere2.position.z = -rayLength;
    endSphere2.name = 'rayEnd';
    this.controller2.add(endSphere2);
    
    console.log('[XRControllers] Ray visuals created');
  }

  /**
   * 设置事件处理器
   */
  setHandlers(handlers: XRInteractionHandlers): void {
    this.handlers = handlers;
  }

  /**
   * 设置可交互对象列表
   */
  setInteractableObjects(objects: THREE.Object3D[]): void {
    this.interactableObjects = objects;
  }

  /**
   * 设置目标模型（用于双手缩放/移动）
   */
  setTargetModel(model: THREE.Object3D | null): void {
    this.targetModel = model;
  }

  /**
   * 扳机键按下
   */
  private onSelectStart(controller: THREE.XRTargetRaySpace, index: number): void {
    const state = index === 1 ? this.controller1State : this.controller2State;
    state.selecting = true;

    const intersection = this.getIntersection(controller);
    this.handlers.onSelectStart?.(controller);
    this.handlers.onSelect?.(controller, intersection);

    // 更新射线颜色
    const line = index === 1 ? this.rayLine1 : this.rayLine2;
    if (line) {
      (line.material as THREE.LineBasicMaterial).color.setHex(0x10b981); // 绿色表示按下
    }
  }

  /**
   * 扳机键释放
   */
  private onSelectEnd(controller: THREE.XRTargetRaySpace, index: number): void {
    const state = index === 1 ? this.controller1State : this.controller2State;
    state.selecting = false;

    this.handlers.onSelectEnd?.(controller);

    // 恢复射线颜色
    const line = index === 1 ? this.rayLine1 : this.rayLine2;
    if (line) {
      const color = index === 1 ? 0x8b5cf6 : 0x06b6d4;
      (line.material as THREE.LineBasicMaterial).color.setHex(color);
    }
  }

  /**
   * 握把键按下
   */
  private onSqueezeStart(controller: THREE.XRTargetRaySpace, index: number): void {
    const state = index === 1 ? this.controller1State : this.controller2State;
    state.squeezing = true;

    this.handlers.onSqueezeStart?.(controller);

    // 检查是否双手同时握住
    if (this.controller1State.squeezing && this.controller2State.squeezing) {
      this.startTwoHandInteraction();
    }
  }

  /**
   * 握把键释放
   */
  private onSqueezeEnd(controller: THREE.XRTargetRaySpace, index: number): void {
    const state = index === 1 ? this.controller1State : this.controller2State;
    state.squeezing = false;

    this.handlers.onSqueezeEnd?.(controller);

    // 结束双手交互
    if (this.bothHandsGrabbing) {
      this.endTwoHandInteraction();
    }
  }

  /**
   * 开始双手交互
   */
  private startTwoHandInteraction(): void {
    this.bothHandsGrabbing = true;

    const pos1 = this.controller1.position;
    const pos2 = this.controller2.position;

    this.initialPinchDistance = pos1.distanceTo(pos2);
    this.initialMidpoint.copy(pos1).add(pos2).multiplyScalar(0.5);

    if (this.targetModel) {
      this.initialModelScale.copy(this.targetModel.scale);
    }
  }

  /**
   * 结束双手交互
   */
  private endTwoHandInteraction(): void {
    this.bothHandsGrabbing = false;
  }

  /**
   * 控制器连接
   */
  private onControllerConnected(event: any, index: number): void {
    const data = event.data;
    console.log(`[XRControllers] Controller ${index} CONNECTED:`, data.handedness, data.profiles);
    console.log(`[XRControllers] Controller ${index} targetRayMode:`, data.targetRayMode);

    // 添加控制器模型（简单表示）
    const grip = index === 1 ? this.controllerGrip1 : this.controllerGrip2;
    
    // 先清除旧的模型
    while (grip.children.length > 0) {
      grip.remove(grip.children[0]);
    }
    
    const controllerModel = this.createControllerModel(data.handedness || (index === 1 ? 'left' : 'right'));
    grip.add(controllerModel);
    
    // 同时在controller上也添加一个可视标记
    const controller = index === 1 ? this.controller1 : this.controller2;
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 16, 16),
      new THREE.MeshBasicMaterial({ color: index === 1 ? 0xff00ff : 0x00ffff })
    );
    marker.name = 'connectionMarker';
    controller.add(marker);
    
    console.log(`[XRControllers] Controller ${index} model added to grip and controller`);
  }

  /**
   * 控制器断开
   */
  private onControllerDisconnected(index: number): void {
    console.log(`Controller ${index} disconnected`);
    const grip = index === 1 ? this.controllerGrip1 : this.controllerGrip2;
    while (grip.children.length > 0) {
      grip.remove(grip.children[0]);
    }
  }

  /**
   * 创建简单控制器模型 - 更大更明显
   */
  private createControllerModel(handedness: string): THREE.Object3D {
    const group = new THREE.Group();
    const isLeft = handedness === 'left';
    const color = isLeft ? 0x8b5cf6 : 0x06b6d4;

    // 手柄主体 - 加大尺寸
    const handleGeometry = new THREE.CylinderGeometry(0.02, 0.025, 0.12, 16);
    const handleMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9
    });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.rotation.x = -Math.PI / 4;
    group.add(handle);

    // 发光球体 - 更明显
    const sphereGeometry = new THREE.SphereGeometry(0.025, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9
    });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.z = 0.06;
    group.add(sphere);

    // 外发光环
    const ringGeometry = new THREE.TorusGeometry(0.035, 0.005, 8, 32);
    const ringMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8
    });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.06;
    group.add(ring);

    // 标签 - 显示L或R
    const labelGeometry = new THREE.PlaneGeometry(0.03, 0.03);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = isLeft ? '#8b5cf6' : '#06b6d4';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(isLeft ? 'L' : 'R', 32, 32);
    const texture = new THREE.CanvasTexture(canvas);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.y = 0.05;
    label.rotation.x = -Math.PI / 4;
    group.add(label);

    console.log(`[XRControllers] Created ${handedness} controller model`);
    return group;
  }

  /**
   * 获取射线与物体的交点
   */
  private getIntersection(controller: THREE.XRTargetRaySpace): THREE.Intersection | null {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);

    const intersections = this.raycaster.intersectObjects(this.interactableObjects, true);
    return intersections.length > 0 ? intersections[0] : null;
  }

  /**
   * 每帧更新
   */
  update(): void {
    if (!this.renderer.xr.isPresenting) return;

    // 更新控制器状态
    this.controller1State.position.setFromMatrixPosition(this.controller1.matrixWorld);
    this.controller1State.rotation.setFromRotationMatrix(this.controller1.matrixWorld);
    this.controller2State.position.setFromMatrixPosition(this.controller2.matrixWorld);
    this.controller2State.rotation.setFromRotationMatrix(this.controller2.matrixWorld);

    // 处理双手交互
    if (this.bothHandsGrabbing && this.targetModel) {
      this.updateTwoHandInteraction();
    }

    // 处理悬停检测
    this.updateHover();
    
    // 更新调试面板
    this.updateVRDebug();
  }
  
  /**
   * 更新VR调试信息
   */
  private updateVRDebug(): void {
    if (!this.debugGroup) return;
    
    // 让调试面板始终面向相机
    const camera = this.renderer.xr.getCamera();
    if (camera) {
      // 固定在相机前方
      const cameraPos = new THREE.Vector3();
      const cameraDir = new THREE.Vector3();
      camera.getWorldPosition(cameraPos);
      camera.getWorldDirection(cameraDir);
      
      // 放在相机下方前方
      this.debugGroup.position.copy(cameraPos);
      this.debugGroup.position.add(cameraDir.multiplyScalar(1));
      this.debugGroup.position.y -= 0.3;
      this.debugGroup.lookAt(cameraPos);
    }
    
    // 检查输入源
    const session = this.renderer.xr.getSession();
    const inputSources = session?.inputSources || [];
    
    const pos1 = this.controller1State.position;
    const pos2 = this.controller2State.position;
    
    const debugInfo = [
      `XR Debug Panel`,
      `InputSources: ${inputSources.length}`,
      `C1: ${pos1.x.toFixed(2)}, ${pos1.y.toFixed(2)}, ${pos1.z.toFixed(2)}`,
      `C2: ${pos2.x.toFixed(2)}, ${pos2.y.toFixed(2)}, ${pos2.z.toFixed(2)}`,
      `Selecting: ${this.controller1State.selecting ? 'L' : '-'}${this.controller2State.selecting ? 'R' : '-'}`,
    ];
    
    // 每60帧更新一次文字（避免性能问题）
    if (Math.random() < 0.02) {
      this.updateDebugText(debugInfo.join('\n'));
    }
  }

  /**
   * 更新双手交互（缩放和移动）
   */
  private updateTwoHandInteraction(): void {
    if (!this.targetModel) return;

    const pos1 = this.controller1.position;
    const pos2 = this.controller2.position;

    // 计算当前距离
    const currentDistance = pos1.distanceTo(pos2);
    
    // 计算缩放比例
    if (this.initialPinchDistance > 0) {
      const scaleFactor = currentDistance / this.initialPinchDistance;
      const newScale = this.initialModelScale.clone().multiplyScalar(scaleFactor);
      
      // 限制缩放范围
      newScale.clampScalar(0.1, 10);
      this.targetModel.scale.copy(newScale);
    }

    // 计算移动
    const currentMidpoint = new THREE.Vector3().copy(pos1).add(pos2).multiplyScalar(0.5);
    const delta = currentMidpoint.clone().sub(this.initialMidpoint);
    
    // 应用移动（可选，取决于需求）
    // this.targetModel.position.add(delta);
    // this.initialMidpoint.copy(currentMidpoint);
  }

  /**
   * 更新悬停状态
   */
  private updateHover(): void {
    // 检测控制器1的悬停
    const intersection1 = this.getIntersection(this.controller1);
    const intersection2 = this.getIntersection(this.controller2);

    // 使用第一个有效的交点
    const intersection = intersection1 || intersection2;
    this.handlers.onHover?.(intersection);

    // 更新射线末端位置
    this.updateRayLength(this.controller1, intersection1);
    this.updateRayLength(this.controller2, intersection2);
  }

  /**
   * 更新射线长度和末端位置
   */
  private updateRayLength(controller: THREE.XRTargetRaySpace, intersection: THREE.Intersection | null): void {
    const rayEnd = controller.getObjectByName('rayEnd');
    if (rayEnd) {
      if (intersection) {
        // 移动到交点
        rayEnd.position.z = -intersection.distance;
        // 高亮
        (rayEnd as THREE.Mesh).material = new THREE.MeshBasicMaterial({ 
          color: 0x10b981, // 绿色高亮
          transparent: true,
          opacity: 1
        });
      } else {
        // 默认位置
        rayEnd.position.z = -5;
      }
    }
  }

  /**
   * 震动反馈
   */
  hapticFeedback(controllerIndex: number, intensity: number = 0.5, duration: number = 100): void {
    const session = this.renderer.xr.getSession();
    if (!session) return;

    const inputSources = session.inputSources;
    const source = inputSources[controllerIndex - 1];
    
    if (source && source.gamepad && source.gamepad.hapticActuators) {
      const actuator = source.gamepad.hapticActuators[0];
      if (actuator) {
        actuator.pulse(intensity, duration);
      }
    }
  }

  /**
   * 获取控制器状态
   */
  getControllerState(index: number): XRControllerState {
    return index === 1 ? { ...this.controller1State } : { ...this.controller2State };
  }

  /**
   * 销毁
   */
  dispose(): void {
    // 移除事件监听
    this.controller1.removeEventListener('selectstart', () => {});
    this.controller1.removeEventListener('selectend', () => {});
    this.controller1.removeEventListener('squeezestart', () => {});
    this.controller1.removeEventListener('squeezeend', () => {});
    this.controller2.removeEventListener('selectstart', () => {});
    this.controller2.removeEventListener('selectend', () => {});
    this.controller2.removeEventListener('squeezestart', () => {});
    this.controller2.removeEventListener('squeezeend', () => {});

    // 移除射线
    if (this.rayLine1) {
      this.controller1.remove(this.rayLine1);
      this.rayLine1.geometry.dispose();
      (this.rayLine1.material as THREE.Material).dispose();
    }
    if (this.rayLine2) {
      this.controller2.remove(this.rayLine2);
      this.rayLine2.geometry.dispose();
      (this.rayLine2.material as THREE.Material).dispose();
    }

    // 移除控制器
    this.scene.remove(this.controller1);
    this.scene.remove(this.controller2);
    this.scene.remove(this.controllerGrip1);
    this.scene.remove(this.controllerGrip2);
  }
}

/**
 * 创建XR控制器实例
 */
export function createXRControllers(renderer: THREE.WebGLRenderer, scene: THREE.Scene): XRControllers {
  return new XRControllers(renderer, scene);
}

