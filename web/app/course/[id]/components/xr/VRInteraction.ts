/**
 * VR交互系统 - 射线选中、高亮、缩放、拖拽
 */
import * as THREE from 'three';

export interface VRInteractionConfig {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  modelRoot?: THREE.Object3D; // 可交互的模型根节点
}

export interface SelectedObject {
  object: THREE.Object3D;
  originalMaterial?: THREE.Material | THREE.Material[];
  highlightMaterial?: THREE.Material;
}

export class VRInteraction {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  private modelRoot?: THREE.Object3D;
  
  // 控制器
  private controller1: THREE.XRTargetRaySpace | null = null;
  private controller2: THREE.XRTargetRaySpace | null = null;
  private grip1: THREE.XRGripSpace | null = null;
  private grip2: THREE.XRGripSpace | null = null;
  
  // 射线
  private raycaster = new THREE.Raycaster();
  private tempMatrix = new THREE.Matrix4();
  
  // 选中状态
  private selectedObject: SelectedObject | null = null;
  private hoveredObject: THREE.Object3D | null = null;
  private highlightColor = 0x00ff00;
  
  // 缩放状态
  private isScaling = false;
  private initialPinchDistance = 0;
  private initialModelScale = new THREE.Vector3(1, 1, 1);
  
  // 拖拽状态
  private isDragging = false;
  private dragController: THREE.XRTargetRaySpace | null = null;
  private dragOffset = new THREE.Vector3();
  
  // 射线可视化
  private rayLine1: THREE.Line | null = null;
  private rayLine2: THREE.Line | null = null;
  
  // 回调
  public onObjectSelected?: (object: THREE.Object3D | null) => void;
  public onObjectHovered?: (object: THREE.Object3D | null) => void;
  
  constructor(config: VRInteractionConfig) {
    this.scene = config.scene;
    this.camera = config.camera;
    this.renderer = config.renderer;
    this.modelRoot = config.modelRoot;
  }
  
  /**
   * 初始化VR控制器
   */
  public setup(): void {
    console.log('[VRInteraction] Setting up controllers...');
    
    // 获取控制器
    this.controller1 = this.renderer.xr.getController(0);
    this.controller2 = this.renderer.xr.getController(1);
    this.grip1 = this.renderer.xr.getControllerGrip(0);
    this.grip2 = this.renderer.xr.getControllerGrip(1);
    
    // 创建射线可视化
    this.rayLine1 = this.createRayLine(0xff00ff); // 粉色
    this.rayLine2 = this.createRayLine(0x00ffff); // 青色
    
    this.controller1.add(this.rayLine1);
    this.controller2.add(this.rayLine2);
    
    // 添加控制器手柄模型
    const leftGrip = this.createGripModel(0xff00ff, 'L');
    const rightGrip = this.createGripModel(0x00ffff, 'R');
    this.grip1.add(leftGrip);
    this.grip2.add(rightGrip);
    
    // 添加到场景
    this.scene.add(this.controller1);
    this.scene.add(this.controller2);
    this.scene.add(this.grip1);
    this.scene.add(this.grip2);
    
    // 绑定事件
    this.bindControllerEvents(this.controller1, 1);
    this.bindControllerEvents(this.controller2, 2);
    
    console.log('[VRInteraction] Controllers setup complete');
  }
  
  /**
   * 创建射线可视化
   */
  private createRayLine(color: number): THREE.Line {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -5)
    ]);
    const material = new THREE.LineBasicMaterial({ 
      color, 
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });
    return new THREE.Line(geometry, material);
  }
  
  /**
   * 创建手柄模型
   */
  private createGripModel(color: number, label: string): THREE.Group {
    const group = new THREE.Group();
    
    // 手柄主体
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.025, 0.1, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    handle.rotation.x = Math.PI / 2;
    group.add(handle);
    
    // 标签球
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    sphere.position.z = 0.05;
    group.add(sphere);
    
    return group;
  }
  
  /**
   * 绑定控制器事件
   */
  private bindControllerEvents(controller: THREE.XRTargetRaySpace, index: number): void {
    // 选择开始（Trigger按下）
    controller.addEventListener('selectstart', () => {
      console.log(`[VRInteraction] Controller ${index} selectstart`);
      this.onSelectStart(controller);
    });
    
    // 选择结束（Trigger释放）
    controller.addEventListener('selectend', () => {
      console.log(`[VRInteraction] Controller ${index} selectend`);
      this.onSelectEnd(controller);
    });
    
    // 挤压开始（Grip按下）
    controller.addEventListener('squeezestart', () => {
      console.log(`[VRInteraction] Controller ${index} squeezestart`);
      this.onSqueezeStart(controller);
    });
    
    // 挤压结束（Grip释放）
    controller.addEventListener('squeezeend', () => {
      console.log(`[VRInteraction] Controller ${index} squeezeend`);
      this.onSqueezeEnd(controller);
    });
  }
  
  /**
   * Trigger按下 - 选中/拖拽
   */
  private onSelectStart(controller: THREE.XRTargetRaySpace): void {
    const intersected = this.getIntersectedObject(controller);
    
    if (intersected) {
      // 选中对象
      this.selectObject(intersected);
      
      // 开始拖拽
      this.isDragging = true;
      this.dragController = controller;
      
      // 计算拖拽偏移
      controller.getWorldPosition(this.dragOffset);
      this.dragOffset.sub(intersected.position);
    } else {
      // 点击空白处取消选中
      this.deselectObject();
    }
  }
  
  /**
   * Trigger释放
   */
  private onSelectEnd(_controller: THREE.XRTargetRaySpace): void {
    this.isDragging = false;
    this.dragController = null;
  }
  
  /**
   * Grip按下 - 开始缩放
   */
  private onSqueezeStart(_controller: THREE.XRTargetRaySpace): void {
    // 检查是否双手都按下Grip
    if (this.controller1 && this.controller2) {
      const session = this.renderer.xr.getSession();
      if (session) {
        const inputSources = session.inputSources;
        let gripsPressed = 0;
        
        for (const source of inputSources) {
          if (source.gamepad) {
            // Grip通常是buttons[1]
            if (source.gamepad.buttons[1]?.pressed) {
              gripsPressed++;
            }
          }
        }
        
        if (gripsPressed >= 2 && this.modelRoot) {
          this.isScaling = true;
          this.initialPinchDistance = this.getPinchDistance();
          this.initialModelScale.copy(this.modelRoot.scale);
          console.log('[VRInteraction] Scaling started, distance:', this.initialPinchDistance);
        }
      }
    }
  }
  
  /**
   * Grip释放
   */
  private onSqueezeEnd(_controller: THREE.XRTargetRaySpace): void {
    this.isScaling = false;
  }
  
  /**
   * 获取双手之间的距离
   */
  private getPinchDistance(): number {
    if (!this.controller1 || !this.controller2) return 1;
    
    const pos1 = new THREE.Vector3();
    const pos2 = new THREE.Vector3();
    this.controller1.getWorldPosition(pos1);
    this.controller2.getWorldPosition(pos2);
    
    return pos1.distanceTo(pos2);
  }
  
  /**
   * 射线检测获取交互对象
   */
  private getIntersectedObject(controller: THREE.XRTargetRaySpace): THREE.Object3D | null {
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
    
    // 获取可交互对象
    const targets = this.modelRoot ? [this.modelRoot] : this.scene.children.filter(
      child => child.type === 'Mesh' || child.type === 'Group'
    );
    
    const intersects = this.raycaster.intersectObjects(targets, true);
    
    if (intersects.length > 0) {
      // 找到最近的可选中对象
      for (const intersect of intersects) {
        let obj: THREE.Object3D | null = intersect.object;
        
        // 向上查找有名字的父对象
        while (obj && !obj.name && obj.parent && obj.parent !== this.scene) {
          obj = obj.parent;
        }
        
        if (obj && obj.name && !obj.name.startsWith('VR_') && !obj.name.startsWith('XR_')) {
          return obj;
        }
      }
      
      return intersects[0].object;
    }
    
    return null;
  }
  
  /**
   * 选中对象
   */
  public selectObject(object: THREE.Object3D): void {
    // 先取消之前的选中
    this.deselectObject();
    
    console.log('[VRInteraction] Selecting object:', object.name || object.uuid);
    
    // 保存原始材质并应用高亮
    if (object instanceof THREE.Mesh) {
      this.selectedObject = {
        object,
        originalMaterial: object.material
      };
      
      // 创建高亮材质
      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: this.highlightColor,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      
      // 创建高亮轮廓
      const outlineGeometry = object.geometry.clone();
      const outline = new THREE.Mesh(outlineGeometry, highlightMaterial);
      outline.scale.multiplyScalar(1.05);
      outline.name = 'VR_HIGHLIGHT_OUTLINE';
      object.add(outline);
    } else {
      this.selectedObject = { object };
      
      // 遍历子对象添加高亮
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const outline = new THREE.Mesh(
            child.geometry.clone(),
            new THREE.MeshBasicMaterial({
              color: this.highlightColor,
              transparent: true,
              opacity: 0.3,
              side: THREE.DoubleSide
            })
          );
          outline.scale.multiplyScalar(1.02);
          outline.name = 'VR_HIGHLIGHT_OUTLINE';
          child.add(outline);
        }
      });
    }
    
    this.onObjectSelected?.(object);
  }
  
  /**
   * 取消选中
   */
  public deselectObject(): void {
    if (this.selectedObject) {
      // 移除高亮轮廓
      const removeOutlines = (obj: THREE.Object3D) => {
        const toRemove: THREE.Object3D[] = [];
        obj.traverse((child) => {
          if (child.name === 'VR_HIGHLIGHT_OUTLINE') {
            toRemove.push(child);
          }
        });
        toRemove.forEach(child => child.parent?.remove(child));
      };
      
      removeOutlines(this.selectedObject.object);
      
      this.selectedObject = null;
      this.onObjectSelected?.(null);
    }
  }
  
  /**
   * 设置模型根节点
   */
  public setModelRoot(model: THREE.Object3D): void {
    this.modelRoot = model;
  }
  
  /**
   * 更新 - 每帧调用
   */
  public update(): void {
    // 更新悬停状态
    this.updateHover();
    
    // 更新拖拽
    if (this.isDragging && this.dragController && this.selectedObject) {
      const controllerPos = new THREE.Vector3();
      this.dragController.getWorldPosition(controllerPos);
      
      // 移动选中的对象
      this.selectedObject.object.position.copy(controllerPos).sub(this.dragOffset);
    }
    
    // 更新缩放
    if (this.isScaling && this.modelRoot && this.initialPinchDistance > 0) {
      const currentDistance = this.getPinchDistance();
      const scaleFactor = currentDistance / this.initialPinchDistance;
      
      this.modelRoot.scale.copy(this.initialModelScale).multiplyScalar(scaleFactor);
      
      // 限制缩放范围
      const minScale = 0.1;
      const maxScale = 10;
      this.modelRoot.scale.clampScalar(minScale, maxScale);
    }
    
    // 更新射线可视化
    this.updateRayVisualization();
  }
  
  /**
   * 更新悬停状态
   */
  private updateHover(): void {
    if (!this.controller1) return;
    
    const intersected = this.getIntersectedObject(this.controller1);
    
    if (intersected !== this.hoveredObject) {
      // 移除之前的悬停效果
      if (this.hoveredObject && this.hoveredObject !== this.selectedObject?.object) {
        this.removeHoverEffect(this.hoveredObject);
      }
      
      // 添加新的悬停效果
      if (intersected && intersected !== this.selectedObject?.object) {
        this.addHoverEffect(intersected);
      }
      
      this.hoveredObject = intersected;
      this.onObjectHovered?.(intersected);
    }
  }
  
  /**
   * 添加悬停效果
   */
  private addHoverEffect(object: THREE.Object3D): void {
    if (object instanceof THREE.Mesh) {
      const outline = new THREE.Mesh(
        object.geometry.clone(),
        new THREE.MeshBasicMaterial({
          color: 0xffff00,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide
        })
      );
      outline.scale.multiplyScalar(1.02);
      outline.name = 'VR_HOVER_OUTLINE';
      object.add(outline);
    }
  }
  
  /**
   * 移除悬停效果
   */
  private removeHoverEffect(object: THREE.Object3D): void {
    const toRemove: THREE.Object3D[] = [];
    object.traverse((child) => {
      if (child.name === 'VR_HOVER_OUTLINE') {
        toRemove.push(child);
      }
    });
    toRemove.forEach(child => child.parent?.remove(child));
  }
  
  /**
   * 更新射线可视化
   */
  private updateRayVisualization(): void {
    // 射线末端指示器颜色变化
    if (this.rayLine1 && this.controller1) {
      const intersected = this.getIntersectedObject(this.controller1);
      const material = this.rayLine1.material as THREE.LineBasicMaterial;
      material.color.setHex(intersected ? 0x00ff00 : 0xff00ff);
    }
    
    if (this.rayLine2 && this.controller2) {
      const intersected = this.getIntersectedObject(this.controller2);
      const material = this.rayLine2.material as THREE.LineBasicMaterial;
      material.color.setHex(intersected ? 0x00ff00 : 0x00ffff);
    }
  }
  
  /**
   * 获取当前选中对象
   */
  public getSelectedObject(): THREE.Object3D | null {
    return this.selectedObject?.object || null;
  }
  
  /**
   * 销毁
   */
  public dispose(): void {
    this.deselectObject();
    
    if (this.rayLine1) {
      this.controller1?.remove(this.rayLine1);
      this.rayLine1.geometry.dispose();
      (this.rayLine1.material as THREE.Material).dispose();
    }
    
    if (this.rayLine2) {
      this.controller2?.remove(this.rayLine2);
      this.rayLine2.geometry.dispose();
      (this.rayLine2.material as THREE.Material).dispose();
    }
    
    if (this.controller1) this.scene.remove(this.controller1);
    if (this.controller2) this.scene.remove(this.controller2);
    if (this.grip1) this.scene.remove(this.grip1);
    if (this.grip2) this.scene.remove(this.grip2);
  }
}





