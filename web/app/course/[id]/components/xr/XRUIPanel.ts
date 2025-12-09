/**
 * WebXR 3D UI 面板系统
 * 用于在VR/AR中显示答题面板、标注等UI元素
 */
import * as THREE from 'three';

export interface PanelStyle {
  backgroundColor?: number;
  backgroundOpacity?: number;
  borderColor?: number;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
}

export interface TextStyle {
  fontSize?: number;
  color?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: CanvasTextAlign;
}

export interface ButtonConfig {
  label: string;
  key: string;
  onClick?: (key: string) => void;
  selected?: boolean;
  correct?: boolean;
  wrong?: boolean;
}

const DEFAULT_PANEL_STYLE: PanelStyle = {
  backgroundColor: 0x1e293b,
  backgroundOpacity: 0.95,
  borderColor: 0x3b82f6,
  borderWidth: 2,
  borderRadius: 16,
  padding: 20
};

const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 24,
  color: 0xffffff,
  fontFamily: 'Arial, Microsoft YaHei, sans-serif',
  fontWeight: 'normal',
  textAlign: 'left'
};

/**
 * XR UI 面板类
 */
export class XRUIPanel {
  private group: THREE.Group;
  private panelMesh: THREE.Mesh | null = null;
  private textSprites: THREE.Sprite[] = [];
  private buttonMeshes: THREE.Mesh[] = [];
  private width: number;
  private height: number;
  private style: PanelStyle;
  
  // 交互状态
  private hoveredButton: THREE.Mesh | null = null;
  private onButtonClick?: (key: string) => void;

  constructor(width: number = 0.6, height: number = 0.8, style?: Partial<PanelStyle>) {
    this.width = width;
    this.height = height;
    this.style = { ...DEFAULT_PANEL_STYLE, ...style };
    this.group = new THREE.Group();
    this.group.name = 'XRUIPanel';
    
    this.createBackground();
  }

  /**
   * 创建背景面板
   */
  private createBackground(): void {
    const shape = this.createRoundedRectShape(this.width, this.height, this.style.borderRadius! / 500);
    const geometry = new THREE.ShapeGeometry(shape);
    
    const material = new THREE.MeshBasicMaterial({
      color: this.style.backgroundColor,
      transparent: true,
      opacity: this.style.backgroundOpacity,
      side: THREE.DoubleSide
    });

    this.panelMesh = new THREE.Mesh(geometry, material);
    this.panelMesh.name = 'panel_background';
    this.group.add(this.panelMesh);

    // 添加边框
    if (this.style.borderWidth! > 0) {
      const borderGeometry = new THREE.EdgesGeometry(geometry);
      const borderMaterial = new THREE.LineBasicMaterial({
        color: this.style.borderColor,
        transparent: true,
        opacity: 0.8
      });
      const border = new THREE.LineSegments(borderGeometry, borderMaterial);
      border.name = 'panel_border';
      this.group.add(border);
    }
  }

  /**
   * 创建圆角矩形形状
   */
  private createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
    const shape = new THREE.Shape();
    const x = -width / 2;
    const y = -height / 2;

    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);

    return shape;
  }

  /**
   * 添加文字
   */
  addText(
    text: string, 
    position: { x: number; y: number; z?: number },
    style?: Partial<TextStyle>,
    maxWidth?: number
  ): THREE.Sprite {
    const mergedStyle = { ...DEFAULT_TEXT_STYLE, ...style };
    const sprite = this.createTextSprite(text, mergedStyle, maxWidth);
    
    sprite.position.set(
      position.x - this.width / 2,
      position.y - this.height / 2,
      position.z || 0.001
    );
    
    this.textSprites.push(sprite);
    this.group.add(sprite);
    
    return sprite;
  }

  /**
   * 创建文字精灵
   */
  private createTextSprite(text: string, style: TextStyle, maxWidth?: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    
    // 设置字体
    const fontSize = style.fontSize! * 2; // 高分辨率
    context.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    
    // 计算文字宽度（支持自动换行）
    let lines: string[] = [text];
    const canvasMaxWidth = maxWidth ? maxWidth * 400 : 800;
    
    if (maxWidth) {
      lines = this.wrapText(context, text, canvasMaxWidth);
    }
    
    const lineHeight = fontSize * 1.3;
    const textWidth = Math.max(...lines.map(line => context.measureText(line).width));
    
    canvas.width = Math.min(textWidth + 20, 1024);
    canvas.height = lines.length * lineHeight + 20;
    
    // 重新设置字体（canvas resize后丢失）
    context.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
    context.textAlign = style.textAlign!;
    context.textBaseline = 'top';
    context.fillStyle = '#' + style.color!.toString(16).padStart(6, '0');
    
    // 绘制文字
    const xOffset = style.textAlign === 'center' ? canvas.width / 2 : 10;
    lines.forEach((line, index) => {
      context.fillText(line, xOffset, 10 + index * lineHeight);
    });
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false
    });
    
    const sprite = new THREE.Sprite(material);
    const scale = 0.001;
    sprite.scale.set(canvas.width * scale, canvas.height * scale, 1);
    
    return sprite;
  }

  /**
   * 文字自动换行
   */
  private wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split('');
    const lines: string[] = [];
    let currentLine = '';

    for (const char of words) {
      const testLine = currentLine + char;
      const metrics = context.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  /**
   * 添加按钮
   */
  addButton(
    config: ButtonConfig,
    position: { x: number; y: number },
    size: { width: number; height: number }
  ): THREE.Mesh {
    const buttonGroup = new THREE.Group();
    
    // 按钮背景
    const shape = this.createRoundedRectShape(size.width, size.height, 0.01);
    const geometry = new THREE.ShapeGeometry(shape);
    
    let bgColor = 0x374151; // 默认灰色
    let borderColor = 0x6b7280;
    
    if (config.selected) {
      bgColor = 0x3b82f6;
      borderColor = 0x60a5fa;
    }
    if (config.correct) {
      bgColor = 0x10b981;
      borderColor = 0x34d399;
    }
    if (config.wrong) {
      bgColor = 0xef4444;
      borderColor = 0xf87171;
    }
    
    const material = new THREE.MeshBasicMaterial({
      color: bgColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    
    const buttonMesh = new THREE.Mesh(geometry, material);
    buttonMesh.name = `button_${config.key}`;
    buttonMesh.userData = {
      isButton: true,
      key: config.key,
      onClick: config.onClick
    };
    
    buttonMesh.position.set(
      position.x - this.width / 2,
      position.y - this.height / 2,
      0.002
    );
    
    // 按钮文字
    const textSprite = this.createTextSprite(config.label, {
      fontSize: 20,
      color: 0xffffff,
      fontWeight: '500',
      textAlign: 'center'
    });
    textSprite.position.set(0, 0, 0.003);
    buttonMesh.add(textSprite);
    
    // 按钮边框
    const borderGeometry = new THREE.EdgesGeometry(geometry);
    const borderMaterial = new THREE.LineBasicMaterial({
      color: borderColor,
      transparent: true,
      opacity: 0.8
    });
    const border = new THREE.LineSegments(borderGeometry, borderMaterial);
    border.position.z = 0.001;
    buttonMesh.add(border);
    
    this.buttonMeshes.push(buttonMesh);
    this.group.add(buttonMesh);
    
    return buttonMesh;
  }

  /**
   * 设置按钮点击回调
   */
  setButtonClickHandler(handler: (key: string) => void): void {
    this.onButtonClick = handler;
  }

  /**
   * 处理射线交互
   */
  handleRaycast(raycaster: THREE.Raycaster): THREE.Intersection | null {
    const intersections = raycaster.intersectObjects(this.buttonMeshes, false);
    
    // 清除之前的悬停状态
    if (this.hoveredButton) {
      this.setButtonHoverState(this.hoveredButton, false);
      this.hoveredButton = null;
    }
    
    if (intersections.length > 0) {
      const intersection = intersections[0];
      const button = intersection.object as THREE.Mesh;
      
      if (button.userData.isButton) {
        this.hoveredButton = button;
        this.setButtonHoverState(button, true);
        return intersection;
      }
    }
    
    return null;
  }

  /**
   * 设置按钮悬停状态
   */
  private setButtonHoverState(button: THREE.Mesh, hovered: boolean): void {
    const material = button.material as THREE.MeshBasicMaterial;
    if (hovered) {
      material.opacity = 1;
      button.scale.setScalar(1.05);
    } else {
      material.opacity = 0.9;
      button.scale.setScalar(1);
    }
  }

  /**
   * 触发按钮点击
   */
  triggerButtonClick(): void {
    if (this.hoveredButton && this.hoveredButton.userData.isButton) {
      const key = this.hoveredButton.userData.key;
      this.hoveredButton.userData.onClick?.(key);
      this.onButtonClick?.(key);
    }
  }

  /**
   * 更新按钮状态
   */
  updateButton(key: string, config: Partial<ButtonConfig>): void {
    const button = this.buttonMeshes.find(b => b.userData.key === key);
    if (!button) return;
    
    const material = button.material as THREE.MeshBasicMaterial;
    
    if (config.selected !== undefined) {
      material.color.setHex(config.selected ? 0x3b82f6 : 0x374151);
    }
    if (config.correct !== undefined && config.correct) {
      material.color.setHex(0x10b981);
    }
    if (config.wrong !== undefined && config.wrong) {
      material.color.setHex(0xef4444);
    }
  }

  /**
   * 清除所有内容
   */
  clear(): void {
    // 清除文字
    this.textSprites.forEach(sprite => {
      const material = sprite.material as THREE.SpriteMaterial;
      material.map?.dispose();
      material.dispose();
      this.group.remove(sprite);
    });
    this.textSprites = [];
    
    // 清除按钮
    this.buttonMeshes.forEach(button => {
      button.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.group.remove(button);
    });
    this.buttonMeshes = [];
  }

  /**
   * 获取面板组
   */
  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * 获取所有按钮
   */
  getButtons(): THREE.Mesh[] {
    return this.buttonMeshes;
  }

  /**
   * 设置面板位置
   */
  setPosition(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
  }

  /**
   * 设置面板朝向
   */
  lookAt(target: THREE.Vector3): void {
    this.group.lookAt(target);
  }

  /**
   * 面朝相机
   */
  faceCamera(camera: THREE.Camera): void {
    this.group.quaternion.copy(camera.quaternion);
  }

  /**
   * 设置可见性
   */
  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /**
   * 销毁
   */
  dispose(): void {
    this.clear();
    
    if (this.panelMesh) {
      this.panelMesh.geometry.dispose();
      (this.panelMesh.material as THREE.Material).dispose();
    }
    
    // 移除边框
    this.group.children.forEach(child => {
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
    
    // 从父节点移除
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}

/**
 * 创建答题面板
 */
export function createQuizPanel(
  question: string,
  options: { key: string; text: string }[],
  onAnswer: (key: string) => void,
  currentAnswer?: string,
  result?: { correctAnswer: string; correct: boolean }
): XRUIPanel {
  const panel = new XRUIPanel(0.7, 0.9, {
    backgroundColor: 0x0f172a,
    backgroundOpacity: 0.95,
    borderColor: 0x8b5cf6,
    borderRadius: 20
  });
  
  // 添加题目
  panel.addText(question, { x: 0.35, y: 0.82 }, {
    fontSize: 22,
    color: 0xffffff,
    fontWeight: 'bold',
    textAlign: 'left'
  }, 0.6);
  
  // 添加选项按钮
  const buttonHeight = 0.1;
  const buttonSpacing = 0.12;
  const startY = 0.55;
  
  options.forEach((opt, index) => {
    const y = startY - index * buttonSpacing;
    const isSelected = currentAnswer === opt.key;
    const isCorrect = result && result.correctAnswer === opt.key;
    const isWrong = result && isSelected && !result.correct;
    
    panel.addButton(
      {
        label: `${opt.key}. ${opt.text}`,
        key: opt.key,
        onClick: onAnswer,
        selected: isSelected && !result,
        correct: !!isCorrect,
        wrong: !!isWrong
      },
      { x: 0.35, y },
      { width: 0.6, height: buttonHeight }
    );
  });
  
  panel.setButtonClickHandler(onAnswer);
  
  return panel;
}

/**
 * 创建结果面板
 */
export function createResultPanel(
  score: number,
  correctCount: number,
  totalQuestions: number,
  onRetry: () => void,
  onExit: () => void
): XRUIPanel {
  const panel = new XRUIPanel(0.5, 0.6, {
    backgroundColor: 0x0f172a,
    backgroundOpacity: 0.95,
    borderColor: score >= 60 ? 0x10b981 : 0xef4444,
    borderRadius: 24
  });
  
  // 标题
  panel.addText('答题结果', { x: 0.25, y: 0.52 }, {
    fontSize: 28,
    color: 0xffffff,
    fontWeight: 'bold',
    textAlign: 'center'
  });
  
  // 分数
  panel.addText(`${score}分`, { x: 0.25, y: 0.38 }, {
    fontSize: 48,
    color: score >= 60 ? 0x10b981 : 0xef4444,
    fontWeight: 'bold',
    textAlign: 'center'
  });
  
  // 统计
  panel.addText(`共${totalQuestions}题，答对${correctCount}题`, { x: 0.25, y: 0.25 }, {
    fontSize: 18,
    color: 0x9ca3af,
    textAlign: 'center'
  });
  
  // 按钮
  panel.addButton(
    { label: '重新答题', key: 'retry', onClick: onRetry },
    { x: 0.13, y: 0.1 },
    { width: 0.2, height: 0.08 }
  );
  
  panel.addButton(
    { label: '退出', key: 'exit', onClick: onExit },
    { x: 0.37, y: 0.1 },
    { width: 0.2, height: 0.08 }
  );
  
  return panel;
}

