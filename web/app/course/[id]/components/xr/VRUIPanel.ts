/**
 * VR UI面板系统 - 模型树、控制按钮等
 */
import * as THREE from 'three';

export interface VRButtonConfig {
  label: string;
  onClick: () => void;
  width?: number;
  height?: number;
  color?: number;
  hoverColor?: number;
  textColor?: string;
}

export interface VRPanelConfig {
  width: number;
  height: number;
  position: THREE.Vector3;
  title?: string;
  backgroundColor?: number;
  opacity?: number;
  followCamera?: boolean;
}

export class VRUIPanel {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private renderer: THREE.WebGLRenderer;
  
  // 面板组件
  private panel: THREE.Group;
  private canvas: HTMLCanvasElement;
  private context: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private mesh: THREE.Mesh;
  
  // 配置
  private config: VRPanelConfig;
  private canvasWidth = 512;
  private canvasHeight = 512;
  
  // 按钮
  private buttons: Map<string, { bounds: DOMRect; config: VRButtonConfig }> = new Map();
  private hoveredButton: string | null = null;
  
  // 模型树数据
  private modelTreeData: { name: string; depth: number; visible: boolean; object: THREE.Object3D }[] = [];
  private scrollOffset = 0;
  private selectedTreeItem: string | null = null;
  
  // 射线检测
  private raycaster = new THREE.Raycaster();
  private tempMatrix = new THREE.Matrix4();
  
  // 回调
  public onTreeItemSelected?: (object: THREE.Object3D) => void;
  public onTreeItemVisibilityToggle?: (object: THREE.Object3D, visible: boolean) => void;
  
  constructor(scene: THREE.Scene, camera: THREE.Camera, renderer: THREE.WebGLRenderer, config: VRPanelConfig) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.config = config;
    
    // 创建canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.context = this.canvas.getContext('2d')!;
    
    // 创建纹理
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.needsUpdate = true;
    
    // 创建面板组
    this.panel = new THREE.Group();
    this.panel.name = 'VR_UI_PANEL';
    
    // 创建面板网格
    const geometry = new THREE.PlaneGeometry(config.width, config.height);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.panel.add(this.mesh);
    
    // 设置位置
    this.panel.position.copy(config.position);
    
    // 添加到场景
    this.scene.add(this.panel);
    
    // 初始渲染
    this.render();
  }
  
  /**
   * 从模型构建树形数据
   */
  public buildTreeFromModel(model: THREE.Object3D): void {
    this.modelTreeData = [];
    
    const traverse = (object: THREE.Object3D, depth: number) => {
      // 过滤掉VR相关的对象
      if (object.name.startsWith('VR_') || object.name.startsWith('XR_')) {
        return;
      }
      
      // 只添加有名字的对象或者是Mesh/Group
      if (object.name || object.type === 'Mesh' || object.type === 'Group') {
        this.modelTreeData.push({
          name: object.name || `${object.type}_${object.id}`,
          depth,
          visible: object.visible,
          object
        });
      }
      
      // 递归子对象
      object.children.forEach(child => traverse(child, depth + 1));
    };
    
    traverse(model, 0);
    
    // 限制显示数量
    if (this.modelTreeData.length > 50) {
      this.modelTreeData = this.modelTreeData.slice(0, 50);
    }
    
    this.render();
  }
  
  /**
   * 添加按钮
   */
  public addButton(id: string, config: VRButtonConfig): void {
    this.buttons.set(id, {
      bounds: new DOMRect(0, 0, config.width || 100, config.height || 40),
      config
    });
    this.render();
  }
  
  /**
   * 渲染面板内容
   */
  public render(): void {
    const ctx = this.context;
    const w = this.canvasWidth;
    const h = this.canvasHeight;
    
    // 清除画布
    ctx.clearRect(0, 0, w, h);
    
    // 背景
    ctx.fillStyle = `rgba(0, 0, 0, ${this.config.opacity ?? 0.85})`;
    ctx.fillRect(0, 0, w, h);
    
    // 边框
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    
    // 标题
    if (this.config.title) {
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.config.title, w / 2, 35);
      
      // 标题下划线
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, 50);
      ctx.lineTo(w - 20, 50);
      ctx.stroke();
    }
    
    // 渲染模型树
    this.renderModelTree(ctx, 60);
    
    // 渲染按钮
    this.renderButtons(ctx);
    
    // 更新纹理
    this.texture.needsUpdate = true;
  }
  
  /**
   * 渲染模型树
   */
  private renderModelTree(ctx: CanvasRenderingContext2D, startY: number): void {
    const itemHeight = 28;
    const maxVisible = Math.floor((this.canvasHeight - startY - 80) / itemHeight);
    
    ctx.font = '16px monospace';
    ctx.textAlign = 'left';
    
    const visibleItems = this.modelTreeData.slice(this.scrollOffset, this.scrollOffset + maxVisible);
    
    visibleItems.forEach((item, index) => {
      const y = startY + index * itemHeight;
      const indent = item.depth * 15 + 20;
      
      // 高亮选中项
      if (item.name === this.selectedTreeItem) {
        ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
        ctx.fillRect(10, y - 5, this.canvasWidth - 20, itemHeight - 2);
      }
      
      // 可见性图标
      ctx.fillStyle = item.visible ? '#00ff00' : '#666666';
      ctx.fillText(item.visible ? '👁' : '○', indent - 15, y + 15);
      
      // 对象名称
      ctx.fillStyle = item.visible ? '#ffffff' : '#666666';
      const displayName = item.name.length > 25 ? item.name.substring(0, 22) + '...' : item.name;
      ctx.fillText(displayName, indent + 5, y + 15);
    });
    
    // 滚动条
    if (this.modelTreeData.length > maxVisible) {
      const scrollHeight = (this.canvasHeight - startY - 80);
      const scrollBarHeight = (maxVisible / this.modelTreeData.length) * scrollHeight;
      const scrollBarY = startY + (this.scrollOffset / this.modelTreeData.length) * scrollHeight;
      
      ctx.fillStyle = '#333333';
      ctx.fillRect(this.canvasWidth - 15, startY, 8, scrollHeight);
      
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(this.canvasWidth - 15, scrollBarY, 8, scrollBarHeight);
    }
    
    // 项目计数
    ctx.fillStyle = '#888888';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${this.modelTreeData.length} items`, this.canvasWidth - 20, this.canvasHeight - 60);
  }
  
  /**
   * 渲染按钮
   */
  private renderButtons(ctx: CanvasRenderingContext2D): void {
    let buttonY = this.canvasHeight - 50;
    let buttonX = 20;
    
    this.buttons.forEach((button, id) => {
      const config = button.config;
      const width = config.width || 100;
      const height = config.height || 35;
      
      // 更新按钮位置
      button.bounds = new DOMRect(buttonX, buttonY, width, height);
      
      // 背景
      const isHovered = this.hoveredButton === id;
      ctx.fillStyle = isHovered 
        ? `#${(config.hoverColor || 0x00aa00).toString(16).padStart(6, '0')}`
        : `#${(config.color || 0x006600).toString(16).padStart(6, '0')}`;
      ctx.fillRect(buttonX, buttonY, width, height);
      
      // 边框
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      ctx.strokeRect(buttonX, buttonY, width, height);
      
      // 文字
      ctx.fillStyle = config.textColor || '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(config.label, buttonX + width / 2, buttonY + height / 2 + 5);
      
      buttonX += width + 10;
      
      // 换行
      if (buttonX + width > this.canvasWidth - 20) {
        buttonX = 20;
        buttonY -= 45;
      }
    });
  }
  
  /**
   * 处理控制器交互
   */
  public handleControllerInteraction(controller: THREE.XRTargetRaySpace): boolean {
    // 获取射线
    this.tempMatrix.identity().extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.tempMatrix);
    
    // 检测与面板的交叉
    const intersects = this.raycaster.intersectObject(this.mesh);
    
    if (intersects.length > 0) {
      const uv = intersects[0].uv;
      if (uv) {
        const x = uv.x * this.canvasWidth;
        const y = (1 - uv.y) * this.canvasHeight;
        
        // 检查是否点击了按钮
        for (const [id, button] of this.buttons) {
          if (this.isPointInRect(x, y, button.bounds)) {
            this.hoveredButton = id;
            return true;
          }
        }
        
        // 检查是否点击了模型树项
        const itemHeight = 28;
        const startY = 60;
        const itemIndex = Math.floor((y - startY) / itemHeight) + this.scrollOffset;
        
        if (itemIndex >= 0 && itemIndex < this.modelTreeData.length) {
          const item = this.modelTreeData[itemIndex];
          
          // 检查是否点击了可见性图标
          const iconX = item.depth * 15 + 5;
          if (x >= iconX && x <= iconX + 20) {
            // 切换可见性
            item.visible = !item.visible;
            item.object.visible = item.visible;
            this.onTreeItemVisibilityToggle?.(item.object, item.visible);
          } else {
            // 选中项目
            this.selectedTreeItem = item.name;
            this.onTreeItemSelected?.(item.object);
          }
          
          this.render();
          return true;
        }
        
        this.hoveredButton = null;
      }
      
      return true;
    }
    
    this.hoveredButton = null;
    return false;
  }
  
  /**
   * 处理点击
   */
  public handleClick(): void {
    if (this.hoveredButton) {
      const button = this.buttons.get(this.hoveredButton);
      if (button) {
        button.config.onClick();
      }
    }
  }
  
  /**
   * 检查点是否在矩形内
   */
  private isPointInRect(x: number, y: number, rect: DOMRect): boolean {
    return x >= rect.x && x <= rect.x + rect.width &&
           y >= rect.y && y <= rect.y + rect.height;
  }
  
  /**
   * 滚动模型树
   */
  public scroll(delta: number): void {
    this.scrollOffset = Math.max(0, Math.min(
      this.scrollOffset + delta,
      Math.max(0, this.modelTreeData.length - 10)
    ));
    this.render();
  }
  
  /**
   * 设置面板位置
   */
  public setPosition(position: THREE.Vector3): void {
    this.panel.position.copy(position);
  }
  
  /**
   * 面板朝向相机
   */
  public lookAtCamera(): void {
    const cameraPos = new THREE.Vector3();
    this.camera.getWorldPosition(cameraPos);
    this.panel.lookAt(cameraPos);
  }
  
  /**
   * 设置可见性
   */
  public setVisible(visible: boolean): void {
    this.panel.visible = visible;
  }
  
  /**
   * 获取可见性
   */
  public isVisible(): boolean {
    return this.panel.visible;
  }
  
  /**
   * 切换可见性
   */
  public toggle(): void {
    this.panel.visible = !this.panel.visible;
  }
  
  /**
   * 更新 - 每帧调用
   */
  public update(): void {
    if (this.config.followCamera && this.panel.visible) {
      this.lookAtCamera();
    }
  }
  
  /**
   * 获取面板对象
   */
  public getPanel(): THREE.Group {
    return this.panel;
  }
  
  /**
   * 销毁
   */
  public dispose(): void {
    this.scene.remove(this.panel);
    this.texture.dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}

/**
 * VR快捷菜单 - 手腕附近的圆形菜单
 */
export class VRQuickMenu {
  private scene: THREE.Scene;
  private menu: THREE.Group;
  private items: { mesh: THREE.Mesh; label: string; onClick: () => void }[] = [];
  private isVisible = false;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.menu = new THREE.Group();
    this.menu.name = 'VR_QUICK_MENU';
    this.menu.visible = false;
    this.scene.add(this.menu);
  }
  
  /**
   * 添加菜单项
   */
  public addItem(label: string, icon: string, onClick: () => void): void {
    const angle = (this.items.length / 6) * Math.PI * 2 - Math.PI / 2;
    const radius = 0.12;
    
    // 创建按钮
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    
    // 圆形背景
    ctx.fillStyle = 'rgba(0, 100, 0, 0.9)';
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    
    // 边框
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 4;
    ctx.stroke();
    
    // 图标
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(icon, 64, 55);
    
    // 标签
    ctx.font = '14px Arial';
    ctx.fillText(label, 64, 90);
    
    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.CircleGeometry(0.04, 32);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = Math.cos(angle) * radius;
    mesh.position.y = Math.sin(angle) * radius;
    
    this.menu.add(mesh);
    this.items.push({ mesh, label, onClick });
  }
  
  /**
   * 显示菜单在指定位置
   */
  public show(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    this.menu.position.copy(position);
    this.menu.lookAt(lookAt);
    this.menu.visible = true;
    this.isVisible = true;
  }
  
  /**
   * 隐藏菜单
   */
  public hide(): void {
    this.menu.visible = false;
    this.isVisible = false;
  }
  
  /**
   * 切换显示
   */
  public toggle(position: THREE.Vector3, lookAt: THREE.Vector3): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show(position, lookAt);
    }
  }
  
  /**
   * 检查是否点击了菜单项
   */
  public checkClick(raycaster: THREE.Raycaster): boolean {
    if (!this.isVisible) return false;
    
    for (const item of this.items) {
      const intersects = raycaster.intersectObject(item.mesh);
      if (intersects.length > 0) {
        item.onClick();
        this.hide();
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 销毁
   */
  public dispose(): void {
    this.scene.remove(this.menu);
    this.items.forEach(item => {
      item.mesh.geometry.dispose();
      (item.mesh.material as THREE.Material).dispose();
    });
  }
}





