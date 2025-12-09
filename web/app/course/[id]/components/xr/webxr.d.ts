/**
 * WebXR API 类型声明补充
 * 扩展Navigator和Window接口以支持WebXR
 */

interface XRSystem {
  isSessionSupported(mode: XRSessionMode): Promise<boolean>;
  requestSession(mode: XRSessionMode, options?: XRSessionInit): Promise<XRSession>;
}

interface Navigator {
  xr?: XRSystem;
}

interface XRSessionInit {
  requiredFeatures?: string[];
  optionalFeatures?: string[];
}

type XRSessionMode = 'inline' | 'immersive-vr' | 'immersive-ar';

interface XRSession extends EventTarget {
  requestReferenceSpace(type: XRReferenceSpaceType): Promise<XRReferenceSpace>;
  requestHitTestSource?(options: XRHitTestOptionsInit): Promise<XRHitTestSource>;
  end(): Promise<void>;
  inputSources: XRInputSourceArray;
}

interface XRInputSourceArray {
  [index: number]: XRInputSource;
  length: number;
}

interface XRInputSource {
  handedness: 'none' | 'left' | 'right';
  targetRayMode: 'gaze' | 'tracked-pointer' | 'screen';
  targetRaySpace: XRSpace;
  gripSpace?: XRSpace;
  gamepad?: Gamepad;
  profiles: string[];
}

interface XRReferenceSpace extends XRSpace {
  getOffsetReferenceSpace(originOffset: XRRigidTransform): XRReferenceSpace;
}

type XRReferenceSpaceType = 'viewer' | 'local' | 'local-floor' | 'bounded-floor' | 'unbounded';

interface XRSpace extends EventTarget {}

interface XRFrame {
  session: XRSession;
  getViewerPose(referenceSpace: XRReferenceSpace): XRViewerPose | null;
  getPose(space: XRSpace, baseSpace: XRSpace): XRPose | null;
  getHitTestResults(hitTestSource: XRHitTestSource): XRHitTestResult[];
}

interface XRViewerPose extends XRPose {
  views: XRView[];
}

interface XRPose {
  transform: XRRigidTransform;
  emulatedPosition: boolean;
}

interface XRView {
  eye: 'none' | 'left' | 'right';
  projectionMatrix: Float32Array;
  transform: XRRigidTransform;
}

interface XRRigidTransform {
  position: DOMPointReadOnly;
  orientation: DOMPointReadOnly;
  matrix: Float32Array;
  inverse: XRRigidTransform;
}

interface XRHitTestOptionsInit {
  space: XRSpace;
  entityTypes?: XRHitTestTrackableType[];
  offsetRay?: XRRay;
}

type XRHitTestTrackableType = 'point' | 'plane' | 'mesh';

interface XRRay {
  origin: DOMPointReadOnly;
  direction: DOMPointReadOnly;
  matrix: Float32Array;
}

interface XRHitTestSource {
  cancel(): void;
}

interface XRHitTestResult {
  getPose(baseSpace: XRSpace): XRPose | null;
}

