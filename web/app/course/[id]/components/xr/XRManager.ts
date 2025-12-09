/**
 * WebXR 会话管理器
 * 负责检测WebXR支持、管理VR/AR会话生命周期
 */
import * as THREE from 'three';

export type XRMode = 'vr' | 'ar' | 'none';

export interface XRCapabilities {
  vrSupported: boolean;
  arSupported: boolean;
  handTrackingSupported: boolean;
}

export interface XRSessionConfig {
  mode: XRMode;
  onSessionStart?: (session: XRSession) => void;
  onSessionEnd?: () => void;
  onError?: (error: Error) => void;
}

/**
 * XR会话管理器类
 */
export class XRManager {
  private renderer: THREE.WebGLRenderer;
  private currentSession: XRSession | null = null;
  private currentMode: XRMode = 'none';
  private capabilities: XRCapabilities = {
    vrSupported: false,
    arSupported: false,
    handTrackingSupported: false
  };
  private sessionStartCallback?: (session: XRSession) => void;
  private sessionEndCallback?: () => void;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
  }

  /**
   * 检测WebXR支持情况
   */
  async checkCapabilities(): Promise<XRCapabilities> {
    if (!('xr' in navigator)) {
      console.log('[XRManager] WebXR not supported - navigator.xr is undefined');
      console.log('[XRManager] User Agent:', navigator.userAgent);
      console.log('[XRManager] If on Vision Pro Safari, enable: Settings > Apps > Safari > Advanced > Feature Flags > WebXR Device API');
      return this.capabilities;
    }

    console.log('[XRManager] navigator.xr found, checking session support...');

    try {
      // 检测VR支持
      this.capabilities.vrSupported = await navigator.xr!.isSessionSupported('immersive-vr');
      console.log('[XRManager] VR (immersive-vr) supported:', this.capabilities.vrSupported);
    } catch (e) {
      console.warn('[XRManager] VR support check failed:', e);
    }

    try {
      // 检测AR支持 (Vision Pro, etc.)
      this.capabilities.arSupported = await navigator.xr!.isSessionSupported('immersive-ar');
      console.log('[XRManager] AR (immersive-ar) supported:', this.capabilities.arSupported);
    } catch (e) {
      console.warn('[XRManager] AR support check failed:', e);
    }

    // 额外检测：某些设备可能只支持inline模式
    try {
      const inlineSupported = await navigator.xr!.isSessionSupported('inline');
      console.log('[XRManager] Inline session supported:', inlineSupported);
    } catch (e) {
      // inline模式检测失败不影响主要功能
    }

    console.log('[XRManager] Final capabilities:', this.capabilities);
    return this.capabilities;
  }

  /**
   * 获取当前XR能力
   */
  getCapabilities(): XRCapabilities {
    return { ...this.capabilities };
  }

  /**
   * 获取当前会话模式
   */
  getCurrentMode(): XRMode {
    return this.currentMode;
  }

  /**
   * 是否在XR会话中
   */
  isInSession(): boolean {
    return this.currentSession !== null;
  }

  /**
   * 进入VR模式
   */
  async enterVR(config?: Partial<XRSessionConfig>): Promise<boolean> {
    if (!this.capabilities.vrSupported) {
      console.error('VR not supported');
      config?.onError?.(new Error('VR not supported on this device'));
      return false;
    }

    return this.startSession('vr', config);
  }

  /**
   * 进入AR模式 (Vision Pro透视)
   */
  async enterAR(config?: Partial<XRSessionConfig>): Promise<boolean> {
    if (!this.capabilities.arSupported) {
      console.error('AR not supported');
      config?.onError?.(new Error('AR not supported on this device'));
      return false;
    }

    return this.startSession('ar', config);
  }

  /**
   * 开始XR会话
   */
  private async startSession(mode: XRMode, config?: Partial<XRSessionConfig>): Promise<boolean> {
    if (this.currentSession) {
      console.warn('Already in XR session, ending current session first');
      await this.endSession();
    }

    try {
      const sessionMode = mode === 'vr' ? 'immersive-vr' : 'immersive-ar';
      
      // 配置会话选项
      const sessionInit: XRSessionInit = {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']
      };

      // AR模式额外配置
      if (mode === 'ar') {
        sessionInit.requiredFeatures = ['local-floor'];
        sessionInit.optionalFeatures = [
          ...(sessionInit.optionalFeatures || []),
          'hit-test',
          'dom-overlay'
        ];
      }

      // 请求会话
      const session = await navigator.xr!.requestSession(sessionMode, sessionInit);
      
      this.currentSession = session;
      this.currentMode = mode;
      this.sessionStartCallback = config?.onSessionStart;
      this.sessionEndCallback = config?.onSessionEnd;

      // 设置渲染器
      this.renderer.xr.enabled = true;
      await this.renderer.xr.setSession(session);

      // 设置参考空间
      this.renderer.xr.setReferenceSpaceType('local-floor');

      // 监听会话结束
      session.addEventListener('end', this.handleSessionEnd);

      // 回调
      config?.onSessionStart?.(session);

      console.log(`Entered ${mode.toUpperCase()} mode`);
      return true;
    } catch (error) {
      console.error('Failed to start XR session:', error);
      config?.onError?.(error as Error);
      return false;
    }
  }

  /**
   * 结束XR会话
   */
  async endSession(): Promise<void> {
    if (this.currentSession) {
      try {
        await this.currentSession.end();
      } catch (e) {
        console.warn('Error ending session:', e);
      }
    }
  }

  /**
   * 会话结束处理
   */
  private handleSessionEnd = (): void => {
    console.log('XR session ended');
    
    if (this.currentSession) {
      this.currentSession.removeEventListener('end', this.handleSessionEnd);
    }

    this.currentSession = null;
    this.currentMode = 'none';

    // 恢复渲染器设置
    this.renderer.xr.enabled = false;

    // 回调
    this.sessionEndCallback?.();
    this.sessionEndCallback = undefined;
    this.sessionStartCallback = undefined;
  };

  /**
   * 获取当前会话
   */
  getSession(): XRSession | null {
    return this.currentSession;
  }

  /**
   * 销毁管理器
   */
  dispose(): void {
    this.endSession();
  }
}

/**
 * 创建XR管理器实例
 */
export function createXRManager(renderer: THREE.WebGLRenderer): XRManager {
  return new XRManager(renderer);
}

