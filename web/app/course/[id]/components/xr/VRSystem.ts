/**
 * VR系统管理器 - 整合所有VR功能
 */
import * as THREE from 'three';
import { VRInteraction } from './VRInteraction';
import { VRTeleport } from './VRTeleport';
import { VRUIPanel, VRQuickMenu } from './VRUIPanel';

export interface VRSystemConfig {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
  enableTeleport?: boolean;
  enableModelTree?: boolean;
}

export class VRSystem {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  
  // 子系统
  private interaction: VRInteraction | null = null;
  private teleport: VRTeleport | null = null;
  private modelTreePanel: VRUIPanel | null = null;
  private quickMenu: VRQuickMenu | null = null;
  
  // 相机组（用于瞬移）
  private cameraRig: THREE.Group;
  
  // 当前模型
  private currentModel: THREE.Object3D | null = null;
  
  // 控制器
  private controller1: THREE.XRTargetRaySpace | null = null;
  private controller2: THREE.XRTargetRaySpace | null = null;
  
  // 状态
  private isActive = false;
  private config: VRSystemConfig;
  
  // 回调
  public onObjectSelected?: (object: THREE.Object3D | null) => void;
  public onTeleport?: (position: THREE.Vector3) => void;
  
  constructor(config: VRSystemConfig) {
    this.config = config;
    this.scene = config.scene;
    this.camera = config.camera;
    this.renderer = config.renderer;
    
    // 创建相机组
    this.cameraRig = new THREE.Group();
    this.cameraRig.name = 'VR_CAMERA_RIG';
    this.scene.add(this.cameraRig);
  }
  
  /**
   * 启动VR系统
   */
  public start(model?: THREE.Object3D): void {
    if (this.isActive) return;
    
    console.log('[VRSystem] Starting VR system...');
    this.isActive = true;
    
    if (model) {
      this.currentModel = model;
    }
    
    // 获取控制器
    this.controller1 = this.renderer.xr.getController(0);
    this.controller2 = this.renderer.xr.getController(1);
    
    // 初始化交互系统
    this.setupInteraction();
    
    // 初始化瞬移系统（如果启用）
    if (this.config.enableTeleport !== false) {
      this.setupTeleport();
    }
    
    // 初始化模型树面板（如果启用）
    if (this.config.enableModelTree !== false) {
      this.setupModelTreePanel();
    }
    
    // 初始化快捷菜单
    this.setupQuickMenu();
    
    // 绑定控制器事件
    this.bindControllerEvents();
    
    console.log('[VRSystem] VR system started');
  }
  
  /**
   * 设置交互系统
   */
  private setupInteraction(): void {
    this.interaction = new VRInteraction({
      scene: this.scene,
      camera: this.camera,
      renderer: this.renderer,
      modelRoot: this.currentModel || undefined
    });
    
    this.interaction.setup();
    
    this.interaction.onObjectSelected = (obj) => {
      this.onObjectSelected?.(obj);
    };
  }
  
  /**
   * 设置瞬移系统
   */
  private setupTeleport(): void {
    this.teleport = new VRTeleport({
      scene: this.scene,
      renderer: this.renderer,
      cameraRig: this.cameraRig,
      floorY: 0,
      maxDistance: 10
    });
    
    this.teleport.setup();
  }
  
  /**
   * 设置模型树面板
   */
  private setupModelTreePanel(): void {
    this.modelTreePanel = new VRUIPanel(
      this.scene,
      this.camera,
      this.renderer,
      {
        width: 0.8,
        height: 0.6,
        position: new THREE.Vector3(-1.2, 1.5, -1.5),
        title: '模型树 Model Tree',
        opacity: 0.9,
        followCamera: false
      }
    );
    
    // 如果有模型，构建树
    if (this.currentModel) {
      this.modelTreePanel.buildTreeFromModel(this.currentModel);
    }
    
    // 添加控制按钮
    this.modelTreePanel.addButton('reset', {
      label: '重置视图',
      onClick: () => this.resetModelTransform(),
      width: 80,
      height: 30
    });
    
    this.modelTreePanel.addButton('hide', {
      label: '隐藏面板',
      onClick: () => this.modelTreePanel?.toggle(),
      width: 80,
      height: 30
    });
    
    // 绑定回调
    this.modelTreePanel.onTreeItemSelected = (obj) => {
      this.interaction?.selectObject(obj);
      this.onObjectSelected?.(obj);
    };
    
    this.modelTreePanel.onTreeItemVisibilityToggle = (obj, visible) => {
      console.log('[VRSystem] Visibility toggled:', obj.name, visible);
    };
    
    // 初始隐藏
    this.modelTreePanel.setVisible(false);
  }
  
  /**
   * 设置快捷菜单
   */
  private setupQuickMenu(): void {
    this.quickMenu = new VRQuickMenu(this.scene);
    
    this.quickMenu.addItem('树', '🌳', () => {
      this.modelTreePanel?.toggle();
    });
    
    this.quickMenu.addItem('重置', '↺', () => {
      this.resetModelTransform();
    });
    
    this.quickMenu.addItem('放大', '+', () => {
      if (this.currentModel) {
        this.currentModel.scale.multiplyScalar(1.2);
      }
    });
    
    this.quickMenu.addItem('缩小', '-', () => {
      if (this.currentModel) {
        this.currentModel.scale.multiplyScalar(0.8);
      }
    });
    
    this.quickMenu.addItem('瞬移', '🚀', () => {
      // 切换瞬移模式
      console.log('[VRSystem] Teleport mode toggled');
    });
    
    this.quickMenu.addItem('退出', '✕', () => {
      // 退出VR
      const session = this.renderer.xr.getSession();
      if (session) {
        session.end();
      }
    });
  }
  
  /**
   * 绑定控制器事件
   */
  private bindControllerEvents(): void {
    if (!this.controller1 || !this.controller2) return;
    
    // 右手控制器 - 选中和拖拽
    this.controller1.addEventListener('selectstart', () => {
      // 检查是否点击了UI
      if (this.modelTreePanel?.isVisible()) {
        if (this.modelTreePanel.handleControllerInteraction(this.controller1!)) {
          this.modelTreePanel.handleClick();
          return;
        }
      }
    });
    
    // 左手控制器 - 瞬移
    this.controller2.addEventListener('selectstart', () => {
      // 长按显示快捷菜单
    });
    
    // Y/B按钮 - 显示/隐藏模型树
    this.controller2.addEventListener('squeezestart', () => {
      // 显示快捷菜单在左手位置
      if (this.quickMenu && this.controller2) {
        const pos = new THREE.Vector3();
        this.controller2.getWorldPosition(pos);
        pos.y += 0.1;
        
        const lookAt = new THREE.Vector3();
        this.camera.getWorldPosition(lookAt);
        
        this.quickMenu.toggle(pos, lookAt);
      }
    });
  }
  
  /**
   * 重置模型变换
   */
  public resetModelTransform(): void {
    if (this.currentModel) {
      this.currentModel.position.set(0, 0, 0);
      this.currentModel.rotation.set(0, 0, 0);
      this.currentModel.scale.set(1, 1, 1);
      console.log('[VRSystem] Model transform reset');
    }
  }
  
  /**
   * 设置当前模型
   */
  public setModel(model: THREE.Object3D): void {
    this.currentModel = model;
    
    if (this.interaction) {
      this.interaction.setModelRoot(model);
    }
    
    if (this.modelTreePanel) {
      this.modelTreePanel.buildTreeFromModel(model);
    }
  }
  
  /**
   * 更新 - 每帧调用
   */
  public update(): void {
    if (!this.isActive) return;
    
    this.interaction?.update();
    this.teleport?.update();
    this.modelTreePanel?.update();
  }
  
  /**
   * 停止VR系统
   */
  public stop(): void {
    if (!this.isActive) return;
    
    console.log('[VRSystem] Stopping VR system...');
    
    this.interaction?.dispose();
    this.teleport?.dispose();
    this.modelTreePanel?.dispose();
    this.quickMenu?.dispose();
    
    this.interaction = null;
    this.teleport = null;
    this.modelTreePanel = null;
    this.quickMenu = null;
    
    this.isActive = false;
    
    console.log('[VRSystem] VR system stopped');
  }
  
  /**
   * 获取交互系统
   */
  public getInteraction(): VRInteraction | null {
    return this.interaction;
  }
  
  /**
   * 获取瞬移系统
   */
  public getTeleport(): VRTeleport | null {
    return this.teleport;
  }
  
  /**
   * 获取模型树面板
   */
  public getModelTreePanel(): VRUIPanel | null {
    return this.modelTreePanel;
  }
  
  /**
   * 是否激活
   */
  public isSystemActive(): boolean {
    return this.isActive;
  }
}





