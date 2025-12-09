/**
 * WebXR 模块导出
 */

// XR 管理器
export { XRManager, createXRManager } from './XRManager';
export type { XRMode, XRCapabilities, XRSessionConfig } from './XRManager';

// XR 按钮组件
export { default as XRButton } from './XRButton';

// XR 控制器
export { XRControllers, createXRControllers } from './XRControllers';
export type { XRControllerState, XRInteractionHandlers } from './XRControllers';

// XR UI 面板（旧版）
export { XRUIPanel, createQuizPanel, createResultPanel } from './XRUIPanel';
export type { PanelStyle, TextStyle, ButtonConfig } from './XRUIPanel';

// XR Hit Test (AR)
export { XRHitTest, createXRHitTest } from './XRHitTest';
export type { ARPlacementMode, HitTestResult } from './XRHitTest';

// XR 集成
export { useXRIntegration, XRButtonContainer } from './XRIntegration';
export type { XRIntegrationProps, XRIntegrationHandle } from './XRIntegration';

// VR 交互系统（新版完整功能）
export { VRInteraction } from './VRInteraction';
export type { VRInteractionConfig, SelectedObject } from './VRInteraction';

// VR 瞬移系统
export { VRTeleport } from './VRTeleport';
export type { VRTeleportConfig } from './VRTeleport';

// VR UI 面板系统（新版 - 模型树专用）
export { VRUIPanel as VRModelTreePanel, VRQuickMenu } from './VRUIPanel';
export type { VRButtonConfig as VRModelTreeButtonConfig, VRPanelConfig as VRModelTreePanelConfig } from './VRUIPanel';

// VR 系统管理器
export { VRSystem } from './VRSystem';
export type { VRSystemConfig } from './VRSystem';

