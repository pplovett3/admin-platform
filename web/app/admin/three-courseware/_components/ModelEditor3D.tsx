"use client";

/**
 * 从文件二进制头部检测文件格式
 * @param arrayBuffer 文件的 ArrayBuffer
 * @returns 文件扩展名 (glb, fbx, obj) 或空字符串
 */
function detectFileFormat(arrayBuffer: ArrayBuffer): string {
  if (arrayBuffer.byteLength < 4) {
    return '';
  }
  
  const bytes = new Uint8Array(arrayBuffer);
  
  // 检查 GLB 格式 (magic: 'glTF', version: 2)
  if (bytes.length >= 12) {
    const magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    if (magic === 'glTF') {
      const version = new DataView(arrayBuffer, 4, 4).getUint32(0, true);
      if (version === 2) {
        console.log('✅ 检测到 GLB 格式 (glTF 2.0)');
        return 'glb';
      }
    }
  }
  
  // 检查 FBX 格式 (通常以 "Kaydara FBX Binary" 开头)
  if (bytes.length >= 18) {
    const header = String.fromCharCode(...bytes.slice(0, 18));
    if (header.includes('Kaydara FBX')) {
      console.log('✅ 检测到 FBX 格式');
      return 'fbx';
    }
  }
  
  // 检查 OBJ 格式 (文本文件，通常以 # 或 v 开头)
  if (bytes.length >= 100) {
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(0, 100));
      if (/^(#|v |vn |vt |f |o |g |mtllib |usemtl )/m.test(text)) {
        console.log('✅ 检测到 OBJ 格式');
        return 'obj';
      }
    } catch {
      // 不是有效的 UTF-8 文本
    }
  }
  
  console.log('❌ 无法识别文件格式');
  return '';
}

function TimeRuler({ duration, pxPerSec, current, onScrub }: { duration: number; pxPerSec: number; current: number; onScrub: (t:number)=>void }) {
  const width = Math.max(0, duration * pxPerSec);
  // 动态步长：尽量接近 80px 一格
  const rawStep = 80; // 目标像素间隔
  const step = (() => {
    const s = rawStep / Math.max(1, pxPerSec); // 秒
    if (s <= 0.1) return 0.1;
    if (s <= 0.2) return 0.2;
    if (s <= 0.5) return 0.5;
    if (s <= 1) return 1;
    if (s <= 2) return 2;
    if (s <= 5) return 5;
    return 10;
  })();
  const ticks: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) ticks.push(Number(t.toFixed(6)));
  const onDown = (e: React.MouseEvent) => {
    const el = e.currentTarget as HTMLDivElement; 
    const toTime = (clientX:number) => { 
      const scrollContainer = el.parentElement as HTMLDivElement | null;
      if (!scrollContainer) return 0;
      
      // 获取滚动容器相对于屏幕的位置，这已经包含了paddingLeft的偏移
      const containerRect = scrollContainer.getBoundingClientRect();
      const sl = scrollContainer.scrollLeft || 0; 
      
      // 计算相对于滚动容器内容区域起始位置的x坐标
      const x = Math.max(0, clientX - containerRect.left + sl); 
      const time = x / Math.max(1, pxPerSec);
      
      console.log('TimeRuler toTime debug:', { 
        clientX, 
        containerLeft: containerRect.left, 
        scrollLeft: sl, 
        x, 
        time 
      });
      
      return time; 
    };
    onScrub(Math.max(0, Math.min(duration, toTime(e.clientX))));
    const onMove = (ev: MouseEvent) => { onScrub(Math.max(0, Math.min(duration, toTime(ev.clientX)))); };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  return (
    <div style={{ position:'relative', height: 28, minWidth: `${width}px`, background:'#0f172a', border:'1px solid #334155', borderRadius: 4 }} onMouseDown={onDown}>
      {ticks.map((t, i) => (
        <div key={i} style={{ position:'absolute', left: `${t*pxPerSec}px`, top: 0, bottom: 0, width: 1, background: (Math.abs((t/step)%5)<1e-6) ? '#475569' : '#334155' }} />
      ))}
      {ticks.map((t, i) => ((Math.abs((t/step)%5)<1e-6) ? <div key={`lbl-${i}`} style={{ position:'absolute', left: `${t*pxPerSec+4}px`, top: 4, fontSize: 10, color:'#94a3b8' }}>{t.toFixed(step<1?1:0)}s</div> : null))}
      <div title={`当前: ${(current || 0).toFixed(2)}s`} style={{ position:'absolute', left: `${(current || 0)*pxPerSec}px`, top: 0, bottom: 0, width: 2, background:'#ef4444' }} />
    </div>
  );
}

// 步骤编辑弹窗
function StepEditor({ open, value, defaultTime, onCancel, onSave, onDelete }: { open: boolean; value: { id: string; name: string } | null; defaultTime?: number; onCancel: ()=>void; onSave: (name: string)=>void; onDelete: ()=>void }) {
  const [form] = Form.useForm();
  useEffect(()=>{
    if (open) form.setFieldsValue({ name: value?.name || '' });
  }, [open, value, form]);
  return (
    <Modal title={value? '编辑步骤' : '添加步骤'} open={open} onCancel={onCancel} onOk={async ()=>{ const v = await form.validateFields(); onSave(String(v.name||'')); }}
      footer={null} destroyOnClose={true} maskClosable>
      <Form layout="vertical" form={form} preserve={false}>
        <Form.Item name="name" label="步骤名称" rules={[{ required: true, message: '请输入步骤名称' }]}>
          <Input placeholder="例如：拧紧螺栓" />
        </Form.Item>
        <Space style={{ width: '100%', justifyContent:'flex-end' }}>
          {value && <Button danger onClick={onDelete}>删除</Button>}
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={async ()=>{ const v = await form.validateFields(); onSave(String(v.name||'')); }}>确定</Button>
        </Space>
      </Form>
    </Modal>
  );
}

// 动画编辑弹窗
function AnimationEditor({ open, value, onCancel, onSave, onDelete }: { 
  open: boolean; 
  value: { id: string; name: string; description?: string } | null; 
  onCancel: ()=>void; 
  onSave: (name: string, description: string)=>void; 
  onDelete: ()=>void;
}) {
  const [form] = Form.useForm();
  useEffect(()=>{
    if (open) {
      form.setFieldsValue({ 
        name: value?.name || '', 
        description: value?.description || '' 
      });
    }
  }, [open, value, form]);
  
  return (
    <Modal 
      title={value ? '编辑动画' : '新建动画'} 
      open={open} 
      onCancel={onCancel}
      footer={null} 
      destroyOnClose={true} 
      maskClosable
    >
      <Form layout="vertical" form={form} preserve={false}>
        <Form.Item name="name" label="动画名称" rules={[{ required: true, message: '请输入动画名称' }]}>
          <Input placeholder="例如：装配过程" />
        </Form.Item>
        <Form.Item name="description" label="动画描述">
          <Input.TextArea placeholder="描述这个动画的内容和用途（可选）" rows={3} />
        </Form.Item>
        <Space style={{ width: '100%', justifyContent:'flex-end' }}>
          {value && <Button danger onClick={onDelete}>删除动画</Button>}
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={async ()=>{ 
            const v = await form.validateFields(); 
            onSave(String(v.name||''), String(v.description||'')); 
          }}>确定</Button>
        </Space>
      </Form>
    </Modal>
  );
}

// --- iOS 扁平风格图标（替换默认图标，交互不变） ---
function IconViewLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <g transform="translate(12,12)">
        <path d="M-8,-4 L0,-7 L8,-4 L8,6 L0,9 L-8,6 Z" />
        <path d="M-8,-4 L0,-1 L0,9" />
        <path d="M8,-4 L0,-1" />
        <path d="M-8,-4 L0,-1 L0,9 L-8,6 Z" fill="#3b82f6" opacity="0.35" stroke="none" />
      </g>
    </svg>
  );
}
function IconViewFront(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <g transform="translate(12,12)">
        <path d="M-6,-6 L6,-6 L6,6 L-6,6 Z" />
        <path d="M6,-6 L9,-3 L9,9 L6,6" />
        <path d="M6,6 L9,9" />
        <path d="M-6,6 L-3,9 L9,9" />
        <rect x="-6" y="-6" width="12" height="12" fill="#3b82f6" opacity="0.35" stroke="none" />
      </g>
    </svg>
  );
}
function IconViewTop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <g transform="translate(12,12)">
        <path d="M-8,-4 L0,-7 L8,-4 L8,6 L0,9 L-8,6 Z" />
        <path d="M-8,-4 L0,-1 L0,9" />
        <path d="M8,-4 L0,-1" />
        <path d="M-8,-4 L0,-7 L8,-4 L0,-1 Z" fill="#3b82f6" opacity="0.35" stroke="none" />
      </g>
    </svg>
  );
}
function IconViewIso(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <g transform="translate(12,12)">
        <path d="M-8,-4 L0,-7 L8,-4 L8,6 L0,9 L-8,6 Z" />
        <path d="M-8,-4 L0,-1 L0,9" />
        <path d="M8,-4 L0,-1" />
        <path d="M-8,-4 L0,-7 L8,-4 L0,-1 Z" fill="#3b82f6" opacity="0.25" stroke="none" />
        <path d="M-8,-4 L0,-1 L0,9 L-8,6 Z" fill="#3b82f6" opacity="0.3" stroke="none" />
        <path d="M0,-1 L8,-4 L8,6 L0,9 Z" fill="#3b82f6" opacity="0.2" stroke="none" />
      </g>
    </svg>
  );
}
function IconTranslate(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 9l-3 3 3 3" />
      <path d="M9 5l3-3 3 3" />
      <path d="M15 19l-3 3-3-3" />
      <path d="M19 9l3 3-3 3" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
function IconRotate(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
  );
}
function IconScale(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
      <rect x="9" y="9" width="6" height="6" rx="1" />
      <path d="M9 12h6" />
      <path d="M12 9v6" />
    </svg>
  );
}
function IconFocus(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M12 1v2" />
      <path d="M12 21v2" />
      <path d="M1 12h2" />
      <path d="M21 12h2" />
    </svg>
  );
}
function IconIsolate(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3,3" />
      <rect x="8" y="8" width="8" height="8" rx="1" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
      <path d="M1 1l22 22" opacity="0.5" />
    </svg>
  );
}
function IconShowAll(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} stroke="currentColor" fill="none" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <circle cx="6.5" cy="6.5" r="1" fill="currentColor" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
      <circle cx="6.5" cy="17.5" r="1" fill="currentColor" />
      <circle cx="17.5" cy="17.5" r="1" fill="currentColor" />
    </svg>
  );
}
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { Button, Card, Flex, Form, Input, Space, Tree, App, Modal, Upload, Slider, InputNumber, Select, Tabs, Switch, Dropdown, Segmented, Tooltip, Divider } from 'antd';
import { UploadOutlined, LinkOutlined, InboxOutlined, FolderOpenOutlined, AimOutlined, EyeOutlined, ScissorOutlined, DragOutlined, ReloadOutlined, ExpandOutlined, AppstoreOutlined, ArrowUpOutlined, ArrowLeftOutlined, SettingOutlined, EyeInvisibleOutlined, SaveOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { getToken, getAPI_URL } from '@/app/_lib/api';
import { apiPut, apiGet } from '@/app/_utils/api';
import type { UploadProps } from 'antd';

type TreeNode = {
  title: string;
  key: string;
  children?: TreeNode[];
};

type Annotation = {
  id: string;
  targetKey: string; // object.uuid
  targetPath: string; // name path
  anchor: { space: 'local'; offset: [number,number,number] };
  label: { 
    title: string; 
    summary?: string;
    // 标签相对于标注点的偏移量（在创建时固定）
    // 新版默认为"local"（随父节点TRS变化），旧数据可能为世界偏移
    offset?: [number, number, number];
    offsetSpace?: 'local'|'world';
  };
};

type CameraKeyframe = {
  time: number;
  position: [number, number, number];
  target: [number, number, number];
  easing?: 'linear' | 'easeInOut';
};

type VisibilityKeyframe = { time: number; value: boolean };

type TimelineState = {
  duration: number; // seconds
  current: number;  // seconds
  playing: boolean;
  cameraKeys: CameraKeyframe[];
  visTracks: Record<string, VisibilityKeyframe[]>; // key: object uuid
  trsTracks: Record<string, TransformKeyframe[]>; // key: object uuid
  annotationTracks: Record<string, VisibilityKeyframe[]>; // key: annotation id
  gltfAnimation?: {
    clip: THREE.AnimationClip;
    mixer: THREE.AnimationMixer;
    action?: THREE.AnimationAction;
    isOriginal?: boolean; // 标记是否为原始GLB动画
  };
};

type TransformKeyframe = {
  time: number;
  position?: [number, number, number];
  rotationEuler?: [number, number, number]; // radians
  scale?: [number, number, number];
  easing?: 'linear' | 'easeInOut';
};

type SelectedKeyframe = { trackType: 'cam' | 'vis' | 'trs', trackId: string, index: number };

function generateUuid(): string {
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).crypto?.randomUUID) {
      return (globalThis as any).crypto.randomUUID();
    }
    const arr = new Uint8Array(16);
    if ((globalThis as any).crypto?.getRandomValues) {
      (globalThis as any).crypto.getRandomValues(arr);
    } else {
      for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256);
    }
    arr[6] = (arr[6] & 0x0f) | 0x40; // version
    arr[8] = (arr[8] & 0x3f) | 0x80; // variant
    const toHex = (n: number) => n.toString(16).padStart(2, '0');
    const s = Array.from(arr, toHex).join('');
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  } catch {
    return `uuid-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

interface CoursewareData {
  _id: string;
  name: string;
  description: string;
  modelUrl: string;
  modifiedModelUrl?: string;
  annotations: any[];
  animations: any[];
  settings: any;
  modelStructure?: any[];
  version: number;
}

interface ModelEditor3DProps {
  initialUrl?: string;
  coursewareId?: string;
  coursewareData?: CoursewareData;
}

export default function ModelEditor3D({ initialUrl, coursewareId, coursewareData }: ModelEditor3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const backgroundTextureRef = useRef<THREE.Texture | null>(null);
  const pmremGeneratorRef = useRef<THREE.PMREMGenerator | null>(null);
  const environmentMapRef = useRef<THREE.Texture | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const outlineRef = useRef<OutlinePass | null>(null);
  const modelRootRef = useRef<THREE.Object3D | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const tcontrolsRef = useRef<TransformControls | null>(null);
  const multiPivotRef = useRef<THREE.Object3D | null>(null);
  const prevPivotWorldRef = useRef<THREE.Matrix4 | null>(null);
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const ambLightRef = useRef<THREE.AmbientLight | null>(null);
  const hemiLightRef = useRef<THREE.HemisphereLight | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const { message } = App.useApp();

  const [urlForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());
  const selectedSetRef = useRef<Set<string>>(new Set());
  useEffect(() => { selectedSetRef.current = selectedSet; }, [selectedSet]);
  const [treeFilter, setTreeFilter] = useState<string>('');
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [editingAnno, setEditingAnno] = useState<Annotation | null>(null);
  const [labelScale, setLabelScale] = useState(1.0); // 标签大小缩放
  const [showAnnotations, setShowAnnotations] = useState<boolean>(true); // 标签显隐
  const keyToObject = useRef<Map<string, THREE.Object3D>>(new Map());
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const pendingImportRef = useRef<any | null>(null); // 缓存导入的 JSON，待模型加载后再解析
  const initialDataLoadedRef = useRef<boolean>(false); // 防止重复加载初始数据
  const [timeline, setTimeline] = useState<TimelineState>({ duration: 10, current: 0, playing: false, cameraKeys: [], visTracks: {}, trsTracks: {}, annotationTracks: {} });
  const lastTickRef = useRef<number>(performance.now());
  const lastBackgroundSphereCheckRef = useRef<number>(0);
  const lastCameraDistanceRef = useRef<number>(0);
  const materialModifiedRef = useRef<boolean>(false); // 跟踪材质是否被用户修改
  const [cameraKeyEasing, setCameraKeyEasing] = useState<'linear'|'easeInOut'>('easeInOut');
  const [highlightMode, setHighlightMode] = useState<'outline'|'emissive'>('outline');
  const [gizmoMode, setGizmoMode] = useState<'translate'|'rotate'|'scale'>('translate');
  const [gizmoSpace, setGizmoSpace] = useState<'local'|'world'>('local');
  const [gizmoSnap, setGizmoSnap] = useState<{ t?: number; r?: number; s?: number }>({ t: undefined, r: undefined, s: undefined });
  const [bgTransparent, setBgTransparent] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>('#919191');
  const [bgType, setBgType] = useState<'color' | 'splat'>('splat'); // 只保留纯色和高斯+HDR两种模式
  const [bgPanorama, setBgPanorama] = useState<string | null>('/360background_7.hdr'); // 用于环境光照
  const [bgPanoramaBrightness, setBgPanoramaBrightness] = useState<number>(1.0);
  const [useHDREnvironment, setUseHDREnvironment] = useState<boolean>(true);
  const [bgSplat, setBgSplat] = useState<string>('/world/world_1'); // 默认world场景路径
  const [splatLoading, setSplatLoading] = useState<boolean>(false);
  const splatViewerRef = useRef<any>(null);
  // 高斯泼溅模型变换参数
  const [splatPosition, setSplatPosition] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const [splatRotation, setSplatRotation] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const [splatScale, setSplatScale] = useState<number>(1.0);
  
  // 待应用的设置（点击"应用"按钮才生效）
  const [pendingSettings, setPendingSettings] = useState<{
    bgType: 'color' | 'splat';
    bgColor: string;
    bgSplat: string;
    bgPanorama: string | null;
    bgPanoramaBrightness: number;
    splatPosition: { x: number; y: number; z: number };
    splatRotation: { x: number; y: number; z: number };
    splatScale: number;
    dirLight: { color: string; intensity: number; position: { x: number; y: number; z: number } };
    ambLight: { color: string; intensity: number };
    hemiLight: { skyColor: string; groundColor: string; intensity: number };
  } | null>(null);
  
  // HDR全景图列表（用于环境光照）
  // 【已废弃】panoramaOptions 数组已删除，高斯泼溅模式使用配套的 .hdr 文件
  
  // World场景列表（每个场景包含spz模型+对应HDR+配置json）
  const [worldScenes, setWorldScenes] = useState<Array<{
    id: string;
    name: string;
    path: string;
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: number;
  }>>([]);
  
  // 跟踪是否已加载保存的设置
  const savedSettingsLoadedRef = useRef<boolean>(false);
  
  // 加载world场景列表（只扫描有json配置文件的文件夹）
  useEffect(() => {
    const loadWorldScenes = async () => {
      const scenes: typeof worldScenes = [];
      // 尝试加载world_1到world_20（只加载有json配置的）
      for (let i = 1; i <= 20; i++) {
        try {
          const jsonUrl = `/world/world_${i}/world_${i}.json`;
          const res = await fetch(jsonUrl, { cache: 'no-store' }); // 禁用缓存确保获取最新配置
          if (res.ok) {
            const config = await res.json();
            const sceneName = config.name || `场景${i}`;
            scenes.push({
              id: `world_${i}`,
              name: sceneName,
              path: `/world/world_${i}`,
              position: config.position || { x: 0, y: 0, z: 0 },
              rotation: config.rotation || { x: 0, y: 0, z: 0 },
              scale: parseFloat(config.scale) || 1.0
            });
            console.log(`✅ 加载world场景配置: world_${i}`, sceneName);
          }
        } catch (e) {
          // 场景不存在或json无效，跳过
          console.log(`⚠️ world_${i} 场景不存在或无效`);
        }
      }
      console.log(`📂 共找到 ${scenes.length} 个world场景:`, scenes.map(s => s.name));
      setWorldScenes(scenes);
      
      // 只有当没有加载保存的设置时，才默认选择第一个场景
      // 延迟检查，等待保存的设置加载完成
      setTimeout(() => {
        if (!savedSettingsLoadedRef.current && scenes.length > 0) {
          const firstScene = scenes[0];
          setBgSplat(firstScene.path);
          setSplatPosition(firstScene.position);
          setSplatRotation(firstScene.rotation);
          setSplatScale(firstScene.scale);
          console.log('✅ 没有保存设置，默认选择第一个场景:', firstScene.name);
        }
      }, 500);
    };
    loadWorldScenes();
  }, []);
  const [dirLight, setDirLight] = useState<{ color: string; intensity: number; position: { x: number; y: number; z: number } }>({ color: '#ffffff', intensity: 0, position: { x: 3, y: 5, z: 2 } });
  const [ambLight, setAmbLight] = useState<{ color: string; intensity: number }>({ color: '#ffffff', intensity: 0 });
  const [hemiLight, setHemiLight] = useState<{ skyColor: string; groundColor: string; intensity: number }>({ skyColor: '#ffffff', groundColor: '#404040', intensity: 0 });
  const [autoKey, setAutoKey] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoKeyRef = useRef<boolean>(false);
  const [coursewareName, setCoursewareName] = useState<string>('');
  useEffect(()=>{ autoKeyRef.current = autoKey; }, [autoKey]);
  const trackLabelWidth = 160;
  // 【已废弃】自发光高亮相关的 materialBackup 和 highlightedMats 已删除
  // 使用已有的 boxHelperRef 进行边界框高亮（零性能开销）
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [mode, setMode] = useState<'annot'|'anim'>('annot');
  // 记录初始姿态（TRS与可见性）
  const initialStateRef = useRef<Map<string, { pos: THREE.Vector3; rot: THREE.Euler; scl: THREE.Vector3; visible: boolean }>>(new Map());
  
  // TRS 撤销/重做系统
  interface TRSSnapshot {
    objectKey: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  }
  const trsUndoStack = useRef<TRSSnapshot[]>([]);
  const trsRedoStack = useRef<TRSSnapshot[]>([]);
  const trsTransformStartState = useRef<TRSSnapshot | null>(null);
  const [materialIndex, setMaterialIndex] = useState(0);
  const [materialPropsKey, setMaterialPropsKey] = useState(0); // 用于强制更新材质属性滑块
  const [modelName, setModelName] = useState<string>('未加载模型');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const localFileInputRef = useRef<HTMLInputElement | null>(null);
  const [localFileInputKey, setLocalFileInputKey] = useState<number>(0);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const gridRef = useRef<THREE.GridHelper | null>(null);
  // 监听 showGrid 变化，同步更新地面显示
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.visible = showGrid;
    }
  }, [showGrid]);
  const [selectedCamKeyIdx, setSelectedCamKeyIdx] = useState<number | null>(null);
  const [selectedTrs, setSelectedTrs] = useState<{ key: string; index: number } | null>(null);
  const [selectedVis, setSelectedVis] = useState<{ key: string; index: number } | null>(null);
  const selectedCamKeyIdxRef = useRef<number | null>(null);
  const selectedTrsRef = useRef<{ key: string; index: number } | null>(null);
  const selectedVisRef = useRef<{ key: string; index: number } | null>(null);
  useEffect(()=>{ selectedCamKeyIdxRef.current = selectedCamKeyIdx; }, [selectedCamKeyIdx]);
  useEffect(()=>{ selectedTrsRef.current = selectedTrs; }, [selectedTrs]);
  useEffect(()=>{ selectedVisRef.current = selectedVis; }, [selectedVis]);
  const [prsTick, setPrsTick] = useState(0);
  const [timelineHeight, setTimelineHeight] = useState<number>(()=>{
    try { return Number(localStorage.getItem('three_timeline_h')||'280') || 280; } catch { return 280; }
  });
  useEffect(()=>{ try { localStorage.setItem('three_timeline_h', String(timelineHeight)); } catch {} }, [timelineHeight]);
  const timelineRef = useRef<TimelineState>(
    { duration: 10, current: 0, playing: false, cameraKeys: [], visTracks: {}, trsTracks: {}, annotationTracks: {} }
  );
  useEffect(()=>{ timelineRef.current = timeline; }, [timeline]);

  type Clip = { id: string; name: string; description?: string; timeline: TimelineState };
  const [clips, setClips] = useState<Clip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  // 时间线区间选择、激活轨道与剪贴板
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null); // 'cam' | 'vis:<uuid>' | 'trs:<uuid>'
  const [clipboard, setClipboard] = useState<{
    anchor: number;
    trackType: 'cam' | 'vis' | 'trs';
    keys: CameraKeyframe[] | VisibilityKeyframe[] | TransformKeyframe[];
  } | null>(null);
  const [stretchFactor, setStretchFactor] = useState<number>(1);
  const [pxPerSec, setPxPerSec] = useState<number>(80);
  const [globalSel, setGlobalSel] = useState<{ start:number; end:number }|null>(null);
  const globalSelRef = useRef<{ start:number; end:number }|null>(null);
  useEffect(()=>{ globalSelRef.current = globalSel; }, [globalSel]);

  // 统一的关键帧选择状态
  const [selectedKeyframes, setSelectedKeyframes] = useState<SelectedKeyframe[]>([]);
  const selectedKeyframesRef = useRef<SelectedKeyframe[]>([]);
  useEffect(() => { selectedKeyframesRef.current = selectedKeyframes; }, [selectedKeyframes]);

  // 跨轨道框选功能
  const collectSelectedKeyframes = () => {
    const range = globalSel;
    if (!range) return { cam: [], vis: {}, trs: {} };
    const minT = Math.min(range.start, range.end), maxT = Math.max(range.start, range.end);
    const result = { cam: [] as number[], vis: {} as Record<string, number[]>, trs: {} as Record<string, number[]> };
    
    // 相机关键帧
    timeline.cameraKeys.forEach((k, i) => {
      if (k.time >= minT && k.time <= maxT) result.cam.push(i);
    });
    
    // 可见性关键帧
    Object.entries(timeline.visTracks).forEach(([objKey, keys]) => {
      const indices: number[] = [];
      keys.forEach((k, i) => {
        if (k.time >= minT && k.time <= maxT) indices.push(i);
      });
      if (indices.length > 0) result.vis[objKey] = indices;
    });
    
    // 变换关键帧
    Object.entries(timeline.trsTracks).forEach(([objKey, keys]) => {
      const indices: number[] = [];
      keys.forEach((k, i) => {
        if (k.time >= minT && k.time <= maxT) indices.push(i);
      });
      if (indices.length > 0) result.trs[objKey] = indices;
    });
    
    return result;
  };

  const deleteSelectedKeyframes = () => {
    if (selectedKeyframes.length === 0) return;
    
    pushHistory();
    setTimeline(prev => {
      const newTimeline = { ...prev };
      
      // 按类型分组删除
      const toDeleteCam: number[] = [];
      const toDeleteVis: Record<string, number[]> = {};
      const toDeleteTrs: Record<string, number[]> = {};
      
      selectedKeyframes.forEach(kf => {
        if (kf.trackType === 'cam') {
          toDeleteCam.push(kf.index);
        } else if (kf.trackType === 'vis') {
          if (!toDeleteVis[kf.trackId]) toDeleteVis[kf.trackId] = [];
          toDeleteVis[kf.trackId].push(kf.index);
        } else if (kf.trackType === 'trs') {
          if (!toDeleteTrs[kf.trackId]) toDeleteTrs[kf.trackId] = [];
          toDeleteTrs[kf.trackId].push(kf.index);
        }
      });
      
      // 删除相机关键帧
      if (toDeleteCam.length > 0) {
        newTimeline.cameraKeys = prev.cameraKeys.filter((_, i) => !toDeleteCam.includes(i));
      }
      
      // 删除可见性关键帧
      const newVisTracks = { ...prev.visTracks };
      Object.entries(toDeleteVis).forEach(([objKey, indices]) => {
        if (newVisTracks[objKey]) {
          const filteredKeys = newVisTracks[objKey].filter((_, i) => !indices.includes(i));
          if (filteredKeys.length === 0) {
            delete newVisTracks[objKey]; // 删除空轨道
          } else {
            newVisTracks[objKey] = filteredKeys;
          }
        }
      });
      newTimeline.visTracks = newVisTracks;
      
      // 删除变换关键帧
      const newTrsTracks = { ...prev.trsTracks };
      Object.entries(toDeleteTrs).forEach(([objKey, indices]) => {
        if (newTrsTracks[objKey]) {
          const filteredKeys = newTrsTracks[objKey].filter((_, i) => !indices.includes(i));
          if (filteredKeys.length === 0) {
            delete newTrsTracks[objKey]; // 删除空轨道
          } else {
            newTrsTracks[objKey] = filteredKeys;
          }
        }
      });
      newTimeline.trsTracks = newTrsTracks;
      
      return newTimeline;
    });
    
    setSelectedKeyframes([]);
    setGlobalSel(null);
  };

  const moveSelectedKeyframes = (deltaTime: number) => {
    if (selectedKeyframes.length === 0) return;
    
    // 关键帧批量移动不进入撤销记录
    setTimeline(prev => {
      const newTimeline = { ...prev };
      
      // 按类型分组移动，但要考虑排序可能会改变索引
      const newCameraKeys = [...prev.cameraKeys];
      const newVisTracks = { ...prev.visTracks };
      const newTrsTracks = { ...prev.trsTracks };
      
      selectedKeyframes.forEach(kf => {
        if (kf.trackType === 'cam' && newCameraKeys[kf.index]) {
          newCameraKeys[kf.index] = { 
            ...newCameraKeys[kf.index], 
            time: Math.max(0, Math.min(prev.duration, newCameraKeys[kf.index].time + deltaTime)) 
          };
        } else if (kf.trackType === 'vis' && newVisTracks[kf.trackId] && newVisTracks[kf.trackId][kf.index]) {
          newVisTracks[kf.trackId] = newVisTracks[kf.trackId].map((k, i) =>
            i === kf.index ? { ...k, time: Math.max(0, Math.min(prev.duration, k.time + deltaTime)) } : k
          );
        } else if (kf.trackType === 'trs' && newTrsTracks[kf.trackId] && newTrsTracks[kf.trackId][kf.index]) {
          newTrsTracks[kf.trackId] = newTrsTracks[kf.trackId].map((k, i) =>
            i === kf.index ? { ...k, time: Math.max(0, Math.min(prev.duration, k.time + deltaTime)) } : k
          );
        }
      });
      
      // 对移动后的关键帧进行排序
      newTimeline.cameraKeys = newCameraKeys.sort((a,b)=>a.time-b.time);
      
      Object.keys(newVisTracks).forEach(objKey => {
        newVisTracks[objKey] = newVisTracks[objKey].sort((a,b)=>a.time-b.time);
      });
      newTimeline.visTracks = newVisTracks;
      
      Object.keys(newTrsTracks).forEach(objKey => {
        newTrsTracks[objKey] = newTrsTracks[objKey].sort((a,b)=>a.time-b.time);
      });
      newTimeline.trsTracks = newTrsTracks;
      
      return newTimeline;
    });
  };

  // 全局选择处理函数
  const handleGlobalSelectionStart = (startTime: number, e: React.MouseEvent) => {
    console.log('Global selection started from track'); // Debug
    setGlobalSel({ start: startTime, end: startTime });
    
    const scrollContainer = tracksScrollRef.current!;
    const rect = scrollContainer.getBoundingClientRect();
    const scrollLeft = scrollContainer.scrollLeft || 0;
    const toTime = (clientX: number) => {
      const x = Math.max(0, clientX - rect.left + scrollLeft);
      return Math.max(0, Math.min(timeline.duration, x / Math.max(1, pxPerSec)));
    };
    
    const onMove = (ev: MouseEvent) => {
      setGlobalSel(prev => {
        if (!prev) return null;
        const newRange = { ...prev, end: toTime(ev.clientX) };
        // 实时更新选中的关键帧
        collectAndSelectKeyframesInRange(newRange);
        return newRange;
      });
    };
    const onUp = () => {
      console.log('Global selection ended from track'); // Debug
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      
      // 选择完成后，收集范围内的关键帧
      const range = globalSelRef.current;
      if (range) {
        collectAndSelectKeyframesInRange(range);
      }
      setGlobalSel(null); // 隐藏选择框
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // 收集并选择范围内的关键帧
  const collectAndSelectKeyframesInRange = (range: { start: number; end: number }) => {
    const minT = Math.min(range.start, range.end);
    const maxT = Math.max(range.start, range.end);
    const selected: SelectedKeyframe[] = [];
    
    // 相机关键帧
    timeline.cameraKeys.forEach((k, i) => {
      if (k.time >= minT && k.time <= maxT) {
        selected.push({ trackType: 'cam', trackId: 'cam', index: i });
      }
    });
    
    // 可见性关键帧
    Object.entries(timeline.visTracks).forEach(([objKey, keys]) => {
      keys.forEach((k, i) => {
        if (k.time >= minT && k.time <= maxT) {
          selected.push({ trackType: 'vis', trackId: objKey, index: i });
        }
      });
    });
    
    // 变换关键帧
    Object.entries(timeline.trsTracks).forEach(([objKey, keys]) => {
      keys.forEach((k, i) => {
        if (k.time >= minT && k.time <= maxT) {
          selected.push({ trackType: 'trs', trackId: objKey, index: i });
        }
      });
    });
    
    setSelectedKeyframes(selected);
    // 强制重新渲染所有轨道以确保高亮显示正确
    setPrsTick(v => v + 1);
    console.log('Selected keyframes:', selected); // Debug
  };

  // 复制粘贴剪贴板（专门用于Ctrl+C/V）
  const [keyframeClipboard, setKeyframeClipboard] = useState<{
    keyframes: SelectedKeyframe[];
    originalTimes: number[];
    anchorTime: number;
  } | null>(null);

  // 复制选中的关键帧
  const copySelectedKeyframes = () => {
    if (selectedKeyframes.length === 0) {
      message.warning('请先选择关键帧');
      return;
    }

    const keyframes = [...selectedKeyframes];
    const originalTimes: number[] = [];
    let minTime = Infinity;

    // 收集原始时间并找到最小时间作为锚点
    keyframes.forEach(kf => {
      let time = 0;
      if (kf.trackType === 'cam') {
        time = timeline.cameraKeys[kf.index]?.time || 0;
      } else if (kf.trackType === 'vis') {
        time = timeline.visTracks[kf.trackId]?.[kf.index]?.time || 0;
      } else if (kf.trackType === 'trs') {
        time = timeline.trsTracks[kf.trackId]?.[kf.index]?.time || 0;
      }
      originalTimes.push(time);
      minTime = Math.min(minTime, time);
    });

    setKeyframeClipboard({
      keyframes,
      originalTimes,
      anchorTime: minTime
    });

    message.success(`已复制 ${keyframes.length} 个关键帧`);
  };

  // 粘贴关键帧到当前时间
  const pasteKeyframes = () => {
    if (!keyframeClipboard) {
      message.warning('剪贴板为空');
      return;
    }

    const currentTime = timeline.current;
    const { keyframes, originalTimes, anchorTime } = keyframeClipboard;
    
    pushHistory();
    
    setTimeline(prev => {
      const newTimeline = { ...prev };
      const newCameraKeys = [...prev.cameraKeys];
      const newVisTracks = { ...prev.visTracks };
      const newTrsTracks = { ...prev.trsTracks };

      keyframes.forEach((kf, idx) => {
        const originalTime = originalTimes[idx];
        const relativeTime = originalTime - anchorTime;
        const newTime = Math.max(0, Math.min(prev.duration, currentTime + relativeTime));

        if (kf.trackType === 'cam') {
          const originalKey = prev.cameraKeys[kf.index];
          if (originalKey) {
            const newKey = { ...originalKey, time: newTime };
            newCameraKeys.push(newKey);
          }
        } else if (kf.trackType === 'vis') {
          const originalKey = prev.visTracks[kf.trackId]?.[kf.index];
          if (originalKey) {
            const newKey = { ...originalKey, time: newTime };
            if (!newVisTracks[kf.trackId]) newVisTracks[kf.trackId] = [];
            newVisTracks[kf.trackId].push(newKey);
          }
        } else if (kf.trackType === 'trs') {
          const originalKey = prev.trsTracks[kf.trackId]?.[kf.index];
          if (originalKey) {
            const newKey = { ...originalKey, time: newTime };
            if (!newTrsTracks[kf.trackId]) newTrsTracks[kf.trackId] = [];
            newTrsTracks[kf.trackId].push(newKey);
          }
        }
      });

      // 排序关键帧
      newTimeline.cameraKeys = newCameraKeys.sort((a,b)=>a.time-b.time);
      
      Object.keys(newVisTracks).forEach(objKey => {
        newVisTracks[objKey] = newVisTracks[objKey].sort((a,b)=>a.time-b.time);
      });
      newTimeline.visTracks = newVisTracks;
      
      Object.keys(newTrsTracks).forEach(objKey => {
        newTrsTracks[objKey] = newTrsTracks[objKey].sort((a,b)=>a.time-b.time);
      });
      newTimeline.trsTracks = newTrsTracks;

      return newTimeline;
    });

    message.success(`已粘贴 ${keyframes.length} 个关键帧到时间 ${currentTime.toFixed(2)}s`);
  };

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log('Key pressed:', e.key, 'Ctrl:', e.ctrlKey, 'Meta:', e.metaKey, 'Shift:', e.shiftKey); // Debug
      
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        console.log('Ignoring keydown in input field'); // Debug
        return;
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        console.log('Delete key pressed, selected keyframes:', selectedKeyframes.length); // Debug
        deleteSelectedKeyframes();
      } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        console.log('Undo/Redo key pressed', e.shiftKey ? 'redo' : 'undo'); // Debug
        if (e.shiftKey) redo(); else undo();
      } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        console.log('Copy key pressed'); // Debug
        copySelectedKeyframes();
      } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        console.log('Paste key pressed'); // Debug
        pasteKeyframes();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedKeyframes, keyframeClipboard, timeline]);
  type StepMarker = { id: string; time: number; name: string };
  const [steps, setSteps] = useState<StepMarker[]>([]);
  const stepsRef = useRef<StepMarker[]>([]);
  useEffect(()=>{ stepsRef.current = steps; }, [steps]);
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<StepMarker | null>(null);
  const [stepDraftTime, setStepDraftTime] = useState<number>(0);
  
  // 动画编辑状态
  const [animationModalOpen, setAnimationModalOpen] = useState(false);
  const [editingAnimation, setEditingAnimation] = useState<Clip | null>(null);
  const [stepForm] = Form.useForm();
  // 重命名弹窗
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameForm] = Form.useForm();
  // 多选框选（3D）
  const [boxSel, setBoxSel] = useState<{ x0:number,y0:number,x1:number,y1:number }|null>(null);
  const boxSelRef = useRef<{ x0:number,y0:number,x1:number,y1:number }|null>(null);
  useEffect(()=>{ boxSelRef.current = boxSel; }, [boxSel]);
  const boxLayerRef = useRef<HTMLDivElement|null>(null);
  // 时间线跨轨道选择
  const [multiSel, setMultiSel] = useState<{ cam:number[]; vis:Record<string, number[]>; trs:Record<string, number[]>; range?:{start:number,end:number}|null }>({ cam:[], vis:{}, trs:{}, range:null });
  const tracksScrollRef = useRef<HTMLDivElement | null>(null);
  const innerScrollRef = useRef<HTMLDivElement | null>(null);
  const rulerScrollRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const activeTrackIdRef = useRef<string | null>(null);
  useEffect(()=>{ selectionRef.current = selection; }, [selection]);
  useEffect(()=>{ activeTrackIdRef.current = activeTrackId; }, [activeTrackId]);

  // 动画数据现在不使用localStorage，而是通过课件数据管理
  // useEffect(() => {
  //   try {
  //     const raw = localStorage.getItem('three_courseware_clips');
  //     if (raw) {
  //       const arr = JSON.parse(raw) as Clip[];
  //       if (Array.isArray(arr)) { setClips(arr); setActiveClipId(arr[0]?.id || null); if (arr[0]?.timeline) setTimeline(arr[0].timeline); }
  //     }
  //   } catch {}
  // }, []);

  // useEffect(() => {
  //   try { localStorage.setItem('three_courseware_clips', JSON.stringify(clips)); } catch {}
  // }, [clips]);

  // 依据模式/选中对象/坐标系，统一管理 TransformControls 的挂载与可见
  useEffect(() => {
    const t = tcontrolsRef.current;
    if (!t) return;
    const obj = selectedKey ? keyToObject.current.get(selectedKey) : undefined;
    // 在两种模式下都显示gizmo（标签模式和动画模式）
    if (obj) {
      t.attach(obj);
      t.setMode(gizmoMode);
      t.setSpace(gizmoSpace as any);
      (t as any).visible = true;
    } else {
      t.detach();
      (t as any).visible = false;
    }
  }, [mode, selectedKey, gizmoMode, gizmoSpace]);

  const createClip = () => {
    setEditingAnimation(null);
    setAnimationModalOpen(true);
  };

  const saveClip = () => {
    if (!activeClipId) return message.warning('请先选择或新建动画');
    
    // 调试信息：当前时间线状态
    console.log(`[Animation/Save] 保存动画: ${activeClipId}`);
    console.log(`  显隐轨道数量: ${Object.keys(timeline.visTracks).length}`);
    console.log(`  变换轨道数量: ${Object.keys(timeline.trsTracks).length}`);
    console.log(`  步骤数量: ${stepsRef.current?.length || 0}`);
    
    // 详细显示每个显隐轨道
    Object.entries(timeline.visTracks).forEach(([uuid, keyframes]) => {
      const obj = keyToObject.current.get(uuid);
      const objName = obj?.name || uuid.slice(0,8);
      console.log(`  [显隐轨道] ${objName}: ${keyframes.length}个关键帧`, keyframes.map(k => `${k.time}s:${k.value ? '显示' : '隐藏'}`).join(', '));
    });
    
    // 更新当前活动动画的timeline数据
    setClips(prev => prev.map(c => c.id === activeClipId ? { 
      ...c, 
      timeline: JSON.parse(JSON.stringify(timeline)), // 深拷贝当前时间线数据
      // 持久化当前步骤
      steps: JSON.parse(JSON.stringify(stepsRef.current || []))
    } : c));
    message.success('动画已保存到列表');
  };
  
  // 动画编辑处理函数
  const handleAnimationSave = (name: string, description: string) => {
    if (editingAnimation) {
      // 编辑现有动画：更新当前时间线数据到正在编辑的动画
      setClips(prev => prev.map(c => 
        c.id === editingAnimation.id 
          ? { 
              ...c, 
              name, 
              description,
              timeline: JSON.parse(JSON.stringify(timeline)), // 更新时间线数据
              steps: JSON.parse(JSON.stringify(stepsRef.current||[]))
            }
          : c
      ));
      message.success('动画已更新');
    } else {
      // 创建新动画：检查重名
      const trimmedName = name.trim();
      const nameExists = clips.some(c => c.name.trim() === trimmedName);
      
      if (nameExists) {
        message.error(`动画名称 "${trimmedName}" 已存在，请使用其他名称`);
        return; // 不关闭弹窗，让用户修改名称
      }
      
      const id = generateUuid();
      const emptyTimeline: TimelineState = { 
        duration: Math.max(1, Number((timeline && (timeline as any).duration) || 10)),
        current: 0,
        playing: false,
        cameraKeys: [],
        visTracks: {},
        trsTracks: {},
        annotationTracks: {}
      };
      const clip: Clip = { 
        id, 
        name: trimmedName, 
        description, 
        timeline: emptyTimeline
      };
      setClips(prev => [clip, ...prev]);
      setActiveClipId(id);
      setTimeline(emptyTimeline);
      message.success('动画已创建');
      
      setAnimationModalOpen(false);
      setEditingAnimation(null);
    }
    
    // 只有在成功创建新动画时才关闭弹窗
    if (editingAnimation) {
    setAnimationModalOpen(false);
    setEditingAnimation(null);
    }
  };
  
  const handleAnimationDelete = () => {
    if (!editingAnimation) return;
    
    setClips(prev => prev.filter(c => c.id !== editingAnimation.id));
    
    // 如果删除的是当前活动动画，清除活动状态
    if (activeClipId === editingAnimation.id) {
      setActiveClipId('');
    }
    
    setAnimationModalOpen(false);
    setEditingAnimation(null);
    message.success('动画已删除');
  };
  
  const editClip = (clip: Clip) => {
    setEditingAnimation(clip);
    setAnimationModalOpen(true);
  };

  const onSelectClip = (id: string) => {
    setActiveClipId(id);
    const c = clips.find(x => x.id === id);
    if (c) {
      console.log('切换到动画:', c.name);
      // 确保时间线数据的完整性
      const safeTimeline = {
        duration: c.timeline.duration || 10,
        current: c.timeline.current || 0,
        playing: c.timeline.playing || false,
        cameraKeys: c.timeline.cameraKeys || [],
        visTracks: c.timeline.visTracks || {},
        trsTracks: c.timeline.trsTracks || {},
        annotationTracks: c.timeline.annotationTracks || {}
      };
      setTimeline(safeTimeline);
      // 同步该动画的步骤
      setSteps(Array.isArray((c as any).steps) ? [...(c as any).steps] : []);
      // 若为GLB原始动画且当前无解析轨道，立即按名称路径解析一次
      try {
        const gltfAnim = (c as any).timeline?.gltfAnimation;
        const noTrs = !safeTimeline.trsTracks || Object.keys(safeTimeline.trsTracks).length === 0;
        const noVis = !safeTimeline.visTracks || Object.keys(safeTimeline.visTracks).length === 0;
        if (gltfAnim?.clip && noTrs && noVis && modelRootRef.current) {
          const parsed = parseAnimationClipToTracks(gltfAnim.clip, modelRootRef.current);
          // 只解析一次，避免重复叠加
          setClips(prev => prev.map(cc => cc.id === c.id ? { ...cc, timeline: { ...cc.timeline, visTracks: parsed.visTracks, trsTracks: parsed.trsTracks } } : cc));
          setTimeline(prev => ({ ...prev, visTracks: parsed.visTracks, trsTracks: parsed.trsTracks }));
        }
      } catch (e) { console.warn('切换动画时解析GLB轨道失败:', e); }
      // 同时应用时间线数据到场景
      setTimeout(() => {
        applyTimelineAt(safeTimeline.current);
      }, 0);
    }
  };

  useEffect(() => {
    initRenderer();
    animate();
    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);
    // 热键：1/2/3 切换 gizmo 模式；L 切换局部/世界；Ctrl/Shift+Z 撤销/重做；Delete 删除选中关键帧
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = target?.isContentEditable;
      if (tag === 'input' || tag === 'textarea' || isEditable) return;
      const t = tcontrolsRef.current;
      if (e.key === '1') { setGizmoMode('translate'); t?.setMode('translate'); }
      else if (e.key === '2') { setGizmoMode('rotate'); t?.setMode('rotate'); }
      else if (e.key === '3') { setGizmoMode('scale'); t?.setMode('scale'); }
      else if (e.key.toLowerCase() === 'l') { const next = gizmoSpace === 'local' ? 'world' : 'local'; setGizmoSpace(next); t?.setSpace(next as any); }
      else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && !e.shiftKey) { undo(); }
      else if (((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) || ((e.key === 'y' || e.key === 'Y') && (e.ctrlKey || e.metaKey))) { redo(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        // 选区批量删除优先
        if (selectionRef.current && activeTrackIdRef.current) {
          const changed = bulkDeleteSelected();
          if (changed) { setSelection(null); return; }
        }
        // 使用 refs 获取最新选中状态
        const camIdx = selectedCamKeyIdxRef.current;
        const trsSel = selectedTrsRef.current;
        const visSel = selectedVisRef.current;
        if (camIdx!=null) { setTimeline(prev=>({ ...prev, cameraKeys: prev.cameraKeys.filter((_,i)=>i!==camIdx) })); setSelectedCamKeyIdx(null); return; }
        if (trsSel) {
          setTimeline(prev=>{ const tracks={...prev.trsTracks}; const list=(tracks[trsSel.key]||[]).slice(); list.splice(trsSel.index,1); tracks[trsSel.key]=list; return { ...prev, trsTracks: tracks }; });
          setSelectedTrs(null);
          return;
        }
        if (visSel) {
          setTimeline(prev=>{ const tracks={...prev.visTracks}; const list=(tracks[visSel.key]||[]).slice(); list.splice(visSel.index,1); tracks[visSel.key]=list; return { ...prev, visTracks: tracks }; });
          setSelectedVis(null);
          return;
        }
        if (selectedKey) {
          const key = selectedKey;
          // 删除当前对象在当前时间的显隐关键帧
          setTimeline(prev=>{
            const list = (prev.visTracks[key]||[]).slice();
            const eps=1e-3; const idx = list.findIndex(k=>Math.abs(k.time - prev.current) < eps);
            if (idx<0) return prev; list.splice(idx,1);
            return { ...prev, visTracks: { ...prev.visTracks, [key]: list } };
          });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKey);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current.domElement.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 当左右面板显隐、时间线高度或折叠状态变化时，触发一次 resize（含轻微延迟，等待过渡完成）
  useEffect(() => {
    resize();
    const id = setTimeout(() => resize(), 240);
    const id2 = setTimeout(() => resize(), 480);
    return () => { clearTimeout(id); clearTimeout(id2); };
  }, [showLeft, showRight, timelineHeight, mode]);

  // 更新场景中所有材质的环境贴图
  const updateMaterialsEnvMap = useCallback((envMap: THREE.Texture | null, intensity: number = 1.0) => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const material = Array.isArray(object.material) ? object.material : [object.material];
        material.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || 
              mat instanceof THREE.MeshPhysicalMaterial ||
              mat instanceof THREE.MeshPhongMaterial) {
            mat.envMap = envMap;
            // 设置环境贴图强度
            if ('envMapIntensity' in mat) {
              (mat as any).envMapIntensity = intensity;
            }
            mat.needsUpdate = true;
          }
        });
      }
    });
  }, []);

  // 更新所有材质的环境贴图强度
  const updateMaterialsEnvMapIntensity = useCallback((intensity: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        const material = Array.isArray(object.material) ? object.material : [object.material];
        material.forEach((mat) => {
          if (mat instanceof THREE.MeshStandardMaterial || 
              mat instanceof THREE.MeshPhysicalMaterial ||
              mat instanceof THREE.MeshPhongMaterial) {
            // 设置环境贴图强度
            if ('envMapIntensity' in mat) {
              (mat as any).envMapIntensity = intensity;
            }
            mat.needsUpdate = true;
          }
        });
      }
    });
    
    // 强制重新渲染
    const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; 
    if (r && s && c) { 
      const comp = composerRef.current; 
      if (comp) comp.render(); else r.render(s, c); 
    }
  }, []);

  // 背景与灯光设置实时应用（不关闭弹窗，不销毁组件）
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    
    // 如果初始数据还未加载完成，跳过背景设置（避免使用默认值覆盖）
    if (!initialDataLoadedRef.current) {
      console.log('⏸️ [Background/Effect] 初始数据未加载完成，跳过背景设置', {
        bgType,
        bgPanorama,
        bgPanoramaBrightness
      });
      return;
    }
    
    console.log('🔄 [Background/Effect] 背景设置effect触发', {
      bgTransparent,
      bgType,
      bgPanorama,
      bgPanoramaBrightness,
      useHDREnvironment,
      bgSplat
    });
    
    // 清理函数：移除旧的高斯泼溅查看器
    const cleanupSplatViewer = () => {
      if (splatViewerRef.current) {
        try {
          scene.remove(splatViewerRef.current);
          if (splatViewerRef.current.dispose) {
            splatViewerRef.current.dispose();
          }
        } catch (e) {
          console.warn('清理高斯泼溅查看器时出错:', e);
        }
        splatViewerRef.current = null;
      }
    };
    
    if (bgTransparent) {
      scene.background = null;
      cleanupSplatViewer();
    } else if (bgType === 'splat' && bgSplat) {
      // 高斯泼溅背景 + HDR环境光照
      // 判断是world场景路径还是直接splat文件
      const isWorldScene = bgSplat.startsWith('/world/');
      const splatPath = isWorldScene 
        ? `${bgSplat}/${bgSplat.split('/').pop()}.spz`  // /world/world_1 -> /world/world_1/world_1.spz
        : bgSplat;
      const hdrPath = isWorldScene
        ? `${bgSplat}/${bgSplat.split('/').pop()}.hdr`  // /world/world_1 -> /world/world_1/world_1.hdr
        : bgPanorama;
      
      console.log('🌌 [Background/Splat] 开始加载高斯泼溅场景:', { splatPath, hdrPath });
      setSplatLoading(true);
      
      // 移除背景球体
      const oldSphere = scene.getObjectByName('__background_sphere__');
      if (oldSphere) scene.remove(oldSphere);
      scene.background = null;
      
      // 加载HDR环境光照（如果有）
      if (hdrPath && (hdrPath.toLowerCase().endsWith('.hdr') || hdrPath.toLowerCase().endsWith('.exr'))) {
        const envLoader = hdrPath.toLowerCase().endsWith('.hdr') ? new RGBELoader() : new EXRLoader();
        envLoader.load(hdrPath, (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          const pmremGenerator = pmremGeneratorRef.current;
          if (pmremGenerator) {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            scene.environment = envMap;
            // 应用 HDR 亮度到渲染器曝光度
            const renderer = rendererRef.current;
            if (renderer) {
              renderer.toneMappingExposure = bgPanoramaBrightness;
            }
            // 应用到材质环境贴图强度
            updateMaterialsEnvMap(envMap, bgPanoramaBrightness);
            console.log('✅ [Background/Splat] HDR环境光照已应用:', hdrPath, '亮度:', bgPanoramaBrightness);
          }
        }, undefined, (error) => {
          console.warn('⚠️ [Background/Splat] 加载HDR环境光照失败:', error);
        });
      }
      
      // 动态导入高斯泼溅库
      import('@mkkellogg/gaussian-splats-3d').then((GaussianSplats3D) => {
        // 清理旧的查看器
        cleanupSplatViewer();
        
        try {
          // 创建DropInViewer
          const viewer = new GaussianSplats3D.DropInViewer({
            sharedMemoryForWorkers: false,
            dynamicScene: true,
            selfDrivenMode: false // 我们自己控制渲染
          });
          
          splatViewerRef.current = viewer;
          scene.add(viewer);
          
          // 将角度转换为四元数
          const euler = new THREE.Euler(
            splatRotation.x * Math.PI / 180,
            splatRotation.y * Math.PI / 180,
            splatRotation.z * Math.PI / 180,
            'XYZ'
          );
          const quaternion = new THREE.Quaternion().setFromEuler(euler);
          
          // 加载splat文件
          viewer.addSplatScene(splatPath, {
            showLoadingUI: false,
            splatAlphaRemovalThreshold: 5,
            position: [splatPosition.x, splatPosition.y, splatPosition.z],
            rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w],
            scale: [splatScale, splatScale, splatScale]
          }).then(() => {
            console.log('✅ [Background/Splat] 高斯泼溅模型加载成功', {
              splatPath,
              position: splatPosition,
              rotation: splatRotation,
              scale: splatScale
            });
            setSplatLoading(false);
            
            // 强制重新渲染
            const r = rendererRef.current;
            const c = cameraRef.current;
            if (r && c) {
              const composer = composerRef.current;
              if (composer) composer.render();
              else r.render(scene, c);
            }
          }).catch((error: any) => {
            console.error('❌ [Background/Splat] 加载高斯泼溅模型失败:', error);
            setSplatLoading(false);
            scene.background = new THREE.Color(bgColor);
          });
        } catch (error) {
          console.error('❌ [Background/Splat] 创建高斯泼溅查看器失败:', error);
          setSplatLoading(false);
          scene.background = new THREE.Color(bgColor);
        }
      }).catch((error) => {
        console.error('❌ [Background/Splat] 导入高斯泼溅库失败:', error);
        setSplatLoading(false);
        scene.background = new THREE.Color(bgColor);
      });
      
      return; // 异步操作，提前返回
    } else {
      // 纯色背景模式
      cleanupSplatViewer();
      // 移除背景球体
      const oldSphere = scene.getObjectByName('__background_sphere__');
      if (oldSphere) scene.remove(oldSphere);
      scene.background = new THREE.Color(bgColor);
      scene.environment = null;
      console.log('✅ [Background/Color] 纯色背景已设置:', bgColor);
    }
    
    const r = rendererRef.current; const c = cameraRef.current; if (r && c) {
      const composer = composerRef.current; if (composer) composer.render(); else r.render(scene, c);
    }
  }, [bgTransparent, bgColor, bgType, bgPanorama, bgSplat, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, useHDREnvironment, updateMaterialsEnvMap]);
  
  /* 删除全景图模式 - 以下代码已废弃
    if (false && bgType === 'panorama' && bgPanorama) {
      // 检测是否为HDR或EXR文件
      const lowerPath = bgPanorama?.toLowerCase() || '';
      const isHDR = lowerPath.endsWith('.hdr');
      const isEXR = lowerPath.endsWith('.exr');
      
      if (isHDR || isEXR) {
        // 根据文件类型选择加载器
        const loader = isHDR ? new RGBELoader() : new EXRLoader();
        console.log(`🌐 [Background/Effect] 开始加载${isHDR ? 'HDR' : 'EXR'}全景图:`, bgPanorama);
        loader.load(
          bgPanorama,
          (texture) => {
            console.log(`✅ ${isHDR ? 'HDR' : 'EXR'}全景图加载成功:`, bgPanorama);
            texture.mapping = THREE.EquirectangularReflectionMapping;
            backgroundTextureRef.current = texture;
            
            // 生成环境贴图（需要翻转以修正反射方向）
            const pmremGenerator = pmremGeneratorRef.current;
            if (pmremGenerator) {
              // 创建翻转后的纹理用于环境贴图（通过repeat.x = -1实现水平翻转）
              const flippedTexture = texture.clone();
              flippedTexture.wrapS = THREE.RepeatWrapping;
              flippedTexture.repeat.x = -1; // 水平翻转环境贴图
              const envMap = pmremGenerator.fromEquirectangular(flippedTexture).texture;
              environmentMapRef.current = envMap;
              
              // 如果启用HDR环境光照，应用到场景
              if (useHDREnvironment) {
                scene.environment = envMap;
                updateMaterialsEnvMap(envMap, bgPanoramaBrightness);
                // 应用亮度到环境光照
                const renderer = rendererRef.current;
                if (renderer) {
                  renderer.toneMappingExposure = 1.2 * bgPanoramaBrightness;
                }
              }
            }
            
            // 创建自定义shader材质来显示HDR/EXR背景
            const material = new THREE.ShaderMaterial({
              uniforms: {
                tBackground: { value: texture },
                brightness: { value: bgPanoramaBrightness }
              },
              vertexShader: `
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                  gl_Position = projectionMatrix * mvPosition;
                  // 将深度值设置为最远（1.0），确保背景始终在最后渲染
                  gl_Position.z = gl_Position.w * 0.999999;
                }
              `,
              fragmentShader: `
                uniform sampler2D tBackground;
                uniform float brightness;
                varying vec2 vUv;
                void main() {
                  // 翻转水平方向（左右反转）以修正HDR贴图方向
                  vec2 flippedUv = vec2(1.0 - vUv.x, vUv.y);
                  vec4 texColor = texture2D(tBackground, flippedUv);
                  gl_FragColor = vec4(texColor.rgb * brightness, texColor.a);
                }
              `,
              side: THREE.BackSide,
              toneMapped: false, // HDR/EXR不需要色调映射
              depthWrite: false, // 不写入深度缓冲区，避免遮挡其他物体
              depthTest: true // 启用深度测试，但通过shader将深度设置为最远
            });
            
            // 创建球体几何体来显示背景
            // 背景球体必须足够大，确保：
            // 1. 相机在任何位置都在球体内部
            // 2. 球体不会被相机的 far plane 裁剪
            // 3. 球体足够大，避免被相机 near plane 裁剪
            const camera = cameraRef.current;
            if (!camera) return;
            
            // 计算相机到原点的距离
            const cameraDistance = camera.position.length();
            // 球体半径应该足够大，确保相机在球体内，但要在 far plane 内
            // 使用 far * 0.95 确保球体在 far plane 内，同时考虑相机距离
            // 如果相机距离很大，需要确保球体半径 > 相机距离
            const minRadiusForCamera = cameraDistance * 1.5; // 确保相机在球体内，留50%余量
            const maxRadiusForFar = camera.far * 0.95; // 确保球体在 far plane 内
            const sphereRadius = Math.max(10000, Math.max(minRadiusForCamera, maxRadiusForFar));
            
            const geometry = new THREE.SphereGeometry(sphereRadius, 64, 64);
            const sphere = new THREE.Mesh(geometry, material);
            sphere.name = '__background_sphere__';
            // 设置渲染顺序为最大值，确保背景球体在最后渲染
            sphere.renderOrder = Infinity;
            // 禁用视锥体剔除，确保球体始终被渲染（即使相机在球体内部）
            sphere.frustumCulled = false;
            // 确保背景球体在原点，相机在球体内部
            sphere.position.set(0, 0, 0);
            
            console.log(`🌐 创建HDR背景球体: 半径=${sphereRadius.toFixed(2)}, 相机距离=${cameraDistance.toFixed(2)}, 相机Far=${camera.far.toFixed(2)}`);
            console.log(`   相机在球内: ${sphereRadius > cameraDistance ? '✅' : '❌'}, 球体在Far内: ${sphereRadius < camera.far ? '✅' : '❌'}`);
            
            // 移除旧的背景球体
            const oldSphere = scene.getObjectByName('__background_sphere__');
            if (oldSphere) {
              scene.remove(oldSphere);
              console.log('🗑️ 移除旧的HDR背景球体');
            }
            
            scene.add(sphere);
            scene.background = null; // 清除默认背景
            console.log('✅ HDR背景球体已添加到场景');
            
            const r = rendererRef.current; const c = cameraRef.current; if (r && c) {
              const composer = composerRef.current; if (composer) composer.render(); else r.render(scene, c);
            }
          },
          undefined,
          (error) => {
            console.error(`❌ 加载${isHDR ? 'HDR' : 'EXR'}全景图失败:`, error);
            console.error('图片路径:', bgPanorama);
            console.error('错误详情:', error);
            scene.background = new THREE.Color(bgColor);
            const r = rendererRef.current; const c = cameraRef.current; if (r && c) {
              const composer = composerRef.current; if (composer) composer.render(); else r.render(scene, c);
            }
          }
        );
      } else {
        // 加载普通全景图
        const loader = new THREE.TextureLoader();
        console.log('🖼️ 开始加载普通全景图:', bgPanorama);
        loader.load(
          bgPanorama,
          (texture) => {
            console.log('✅ 普通全景图加载成功:', bgPanorama);
            texture.mapping = THREE.EquirectangularReflectionMapping;
            backgroundTextureRef.current = texture;
            
            // 如果启用HDR环境光照，生成环境贴图
            if (useHDREnvironment) {
              const pmremGenerator = pmremGeneratorRef.current;
              if (pmremGenerator) {
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;
                environmentMapRef.current = envMap;
                scene.environment = envMap;
                updateMaterialsEnvMap(envMap, bgPanoramaBrightness);
                // 应用亮度到环境光照
                const renderer = rendererRef.current;
                if (renderer) {
                  renderer.toneMappingExposure = 1.2 * bgPanoramaBrightness;
                }
              }
            } else {
              scene.environment = null;
              updateMaterialsEnvMap(null, 1.0);
            }
            
            // 创建自定义shader材质来调整亮度
            const material = new THREE.ShaderMaterial({
              uniforms: {
                tBackground: { value: texture },
                brightness: { value: bgPanoramaBrightness }
              },
              vertexShader: `
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                  gl_Position = projectionMatrix * mvPosition;
                  // 将深度值设置为最远（1.0），确保背景始终在最后渲染
                  gl_Position.z = gl_Position.w * 0.999999;
                }
              `,
              fragmentShader: `
                uniform sampler2D tBackground;
                uniform float brightness;
                varying vec2 vUv;
                void main() {
                  // 翻转水平方向（左右反转）以修正HDR贴图方向
                  vec2 flippedUv = vec2(1.0 - vUv.x, vUv.y);
                  vec4 texColor = texture2D(tBackground, flippedUv);
                  gl_FragColor = vec4(texColor.rgb * brightness, texColor.a);
                }
              `,
              side: THREE.BackSide,
              depthWrite: false, // 不写入深度缓冲区，避免遮挡其他物体
              depthTest: true // 启用深度测试，但通过shader将深度设置为最远
            });
            
            // 创建球体几何体来显示背景
            // 背景球体必须足够大，确保：
            // 1. 相机在任何位置都在球体内部
            // 2. 球体不会被相机的 far plane 裁剪
            // 3. 球体足够大，避免被相机 near plane 裁剪
            const camera = cameraRef.current;
            if (!camera) return;
            
            // 计算相机到原点的距离
            const cameraDistance = camera.position.length();
            // 球体半径应该足够大，确保相机在球体内，但要在 far plane 内
            // 使用 far * 0.95 确保球体在 far plane 内，同时考虑相机距离
            // 如果相机距离很大，需要确保球体半径 > 相机距离
            const minRadiusForCamera = cameraDistance * 1.5; // 确保相机在球体内，留50%余量
            const maxRadiusForFar = camera.far * 0.95; // 确保球体在 far plane 内
            const sphereRadius = Math.max(10000, Math.max(minRadiusForCamera, maxRadiusForFar));
            
            const geometry = new THREE.SphereGeometry(sphereRadius, 64, 64);
            const sphere = new THREE.Mesh(geometry, material);
            sphere.name = '__background_sphere__';
            // 设置渲染顺序为最大值，确保背景球体在最后渲染
            sphere.renderOrder = Infinity;
            // 禁用视锥体剔除，确保球体始终被渲染（即使相机在球体内部）
            sphere.frustumCulled = false;
            // 确保背景球体在原点，相机在球体内部
            sphere.position.set(0, 0, 0);
            
            console.log(`🖼️ 创建普通全景背景球体: 半径=${sphereRadius.toFixed(2)}, 相机距离=${cameraDistance.toFixed(2)}, 相机Far=${camera.far.toFixed(2)}`);
            console.log(`   相机在球内: ${sphereRadius > cameraDistance ? '✅' : '❌'}, 球体在Far内: ${sphereRadius < camera.far ? '✅' : '❌'}`);
            
            // 移除旧的背景球体
            const oldSphere = scene.getObjectByName('__background_sphere__');
            if (oldSphere) {
              scene.remove(oldSphere);
              console.log('🗑️ 移除旧的普通全景背景球体');
            }
            
            scene.add(sphere);
            scene.background = null; // 清除默认背景
            console.log('✅ 普通全景背景球体已添加到场景');
            
            const r = rendererRef.current; const c = cameraRef.current; if (r && c) {
              const composer = composerRef.current; if (composer) composer.render(); else r.render(scene, c);
            }
          },
          undefined,
          (error) => {
            console.error('❌ 加载普通全景图失败:', error);
            console.error('图片路径:', bgPanorama);
            console.error('错误详情:', error);
            scene.background = new THREE.Color(bgColor);
            const r = rendererRef.current; const c = cameraRef.current; if (r && c) {
              const composer = composerRef.current; if (composer) composer.render(); else r.render(scene, c);
            }
          }
        );
      }
    }
    全景图模式已删除 */
  
  // HDR环境光照开关（仅用于高斯泼溅模式中的环境光照）
  useEffect(() => {
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    if (!scene || bgType !== 'splat' || !bgPanorama) return;
    
    const lowerPath = bgPanorama.toLowerCase();
    const isHDR = lowerPath.endsWith('.hdr') || lowerPath.endsWith('.exr');
    
    if (useHDREnvironment && isHDR && environmentMapRef.current) {
      scene.environment = environmentMapRef.current;
      updateMaterialsEnvMap(environmentMapRef.current, bgPanoramaBrightness);
      // 应用亮度到环境光照
      if (renderer) {
        renderer.toneMappingExposure = 1.2 * bgPanoramaBrightness;
      }
    } else {
      scene.environment = null;
      updateMaterialsEnvMap(null, 1.0);
      // 恢复默认曝光值
      if (renderer) {
        renderer.toneMappingExposure = 1.2;
      }
    }
    
    const r = rendererRef.current; const c = cameraRef.current; if (r && c) {
      const composer = composerRef.current; if (composer) composer.render(); else r.render(scene, c);
    }
  }, [useHDREnvironment, bgType, bgPanorama, bgPanoramaBrightness, updateMaterialsEnvMap, updateMaterialsEnvMapIntensity]);
  
  // 全景图亮度调节（panorama 模式已删除，此 useEffect 已废弃）

  useEffect(() => {
    const l = dirLightRef.current; if (!l) return;
    l.color = new THREE.Color(dirLight.color);
    l.intensity = dirLight.intensity;
    l.position.set(dirLight.position.x, dirLight.position.y, dirLight.position.z);
    l.updateMatrixWorld();
    const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; if (r && s && c) { const comp = composerRef.current; if (comp) comp.render(); else r.render(s, c); }
  }, [dirLight]);

  useEffect(() => {
    const l = ambLightRef.current; if (!l) return;
    l.color = new THREE.Color(ambLight.color);
    l.intensity = ambLight.intensity;
    const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; if (r && s && c) { const comp = composerRef.current; if (comp) comp.render(); else r.render(s, c); }
  }, [ambLight]);

  useEffect(() => {
    const l = hemiLightRef.current; if (!l) return;
    l.color = new THREE.Color(hemiLight.skyColor);
    (l as any).groundColor = new THREE.Color(hemiLight.groundColor);
    l.intensity = hemiLight.intensity;
    const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; if (r && s && c) { const comp = composerRef.current; if (comp) comp.render(); else r.render(s, c); }
  }, [hemiLight]);

  useEffect(() => {
    if (initialUrl) {
      urlForm.setFieldsValue({ url: initialUrl });
      // 优先加载修改后的模型（如果存在）
      loadModel(initialUrl, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  function initRenderer() {
    const mount = mountRef.current!;
    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    // 初始化PMREMGenerator用于HDR环境贴图
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    pmremGeneratorRef.current = pmremGenerator;

    const scene = new THREE.Scene();
    // 初始化背景会在useEffect中处理
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100000);
    camera.position.set(2.6, 1.8, 2.6);
    cameraRef.current = camera;

    const light = new THREE.DirectionalLight(new THREE.Color(dirLight.color), dirLight.intensity);
    light.position.set(dirLight.position.x, dirLight.position.y, dirLight.position.z);
    scene.add(light);
    dirLightRef.current = light;
    const amb = new THREE.AmbientLight(new THREE.Color(ambLight.color), ambLight.intensity);
    scene.add(amb);
    ambLightRef.current = amb;
    const hemi = new THREE.HemisphereLight(new THREE.Color(hemiLight.skyColor), new THREE.Color(hemiLight.groundColor), hemiLight.intensity);
    hemi.position.set(0, 1, 0);
    scene.add(hemi);
    hemiLightRef.current = hemi;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;
    // 自动相机关键帧：用户结束相机交互时落帧/写回
    controls.addEventListener('end', () => {
      if (!autoKeyRef.current) return;
      setTimeline(prev => {
        const keys = [...prev.cameraKeys];
        const eps = 1e-3; const i = keys.findIndex(k => Math.abs(k.time - prev.current) < eps);
        const camera = cameraRef.current!; const ctrl = controlsRef.current!;
        const rec: CameraKeyframe = { time: prev.current, position: [camera.position.x, camera.position.y, camera.position.z] as [number,number,number], target: [ctrl.target.x, ctrl.target.y, ctrl.target.z] as [number,number,number], easing: cameraKeyEasing };
        if (i < 0) keys.push(rec); else keys[i] = { ...keys[i], position: rec.position, target: rec.target };
        keys.sort((a,b)=>a.time-b.time);
        return { ...prev, cameraKeys: keys };
      });
      pushHistory();
    });

    // Transform gizmo
    const tcontrols = new TransformControls(camera, renderer.domElement);
    tcontrols.setSize(1);
    (tcontrols as any).visible = false;
    tcontrols.addEventListener('dragging-changed', (e: any) => {
      controls.enabled = !e.value;
      if (e.value) { 
        // 拖拽开始
        prevPivotWorldRef.current = (multiPivotRef.current||tcontrols.object)?.matrixWorld.clone() || null; 
        pushHistory();
        
        // 记录TRS变换开始时的状态
        const obj = tcontrols.object as THREE.Object3D | null;
        if (obj && selectedKey) {
          const snapshot = trsSaveSnapshot(selectedKey);
          if (snapshot) {
            trsTransformStartState.current = snapshot;
          }
        }
      } else {
        // 拖拽结束
        if (trsTransformStartState.current) {
          // 保存到TRS撤销栈
          trsUndoStack.current.push(trsTransformStartState.current);
          trsRedoStack.current = []; // 清空重做栈
          trsTransformStartState.current = null;
        }
      }
    });
    tcontrols.addEventListener('objectChange', () => {
      const obj = tcontrols.object as THREE.Object3D | null;
      if (!obj) return;
      setPrsTick(v=>v+1);
      
      // 获取当前最新的选中集合
      const selIds = Array.from(selectedSetRef.current);
      console.log('ObjectChange - selIds:', selIds, 'obj:', obj?.name, 'multiPivot:', multiPivotRef.current?.name); // Debug
      
      // 如果是多选，应用相对变换到所有选中对象
      if (multiPivotRef.current && selIds.length>1 && obj === multiPivotRef.current) {
        console.log('Applying multi-object transform'); // Debug
        const pivot = multiPivotRef.current;
        const prevMat = prevPivotWorldRef.current; if (!prevMat) return;
        const curMat = pivot.matrixWorld.clone();
        const delta = new THREE.Matrix4().copy(prevMat).invert().multiply(curMat);
        selIds.forEach(id=>{
          const o = keyToObject.current.get(id); if (!o) return;
          const mw = o.matrixWorld.clone();
          mw.premultiply(delta);
          const parentInv = new THREE.Matrix4().copy((o.parent as any).matrixWorld).invert();
          o.matrix.copy(parentInv.multiply(mw));
          o.matrix.decompose(o.position, o.quaternion, o.scale);
          o.updateMatrixWorld(true);
          writeBackTRSFromObject(o);
        });
        prevPivotWorldRef.current = curMat.clone();
        
        // 更新高亮框位置
        updateHighlightPosition();
        return;
      }
      // 单选
      writeBackTRSFromObject(obj);
      
      // 更新高亮框位置
      updateHighlightPosition();
    });
    scene.add(tcontrols as any);
    tcontrolsRef.current = tcontrols;
    // 初始化 gizmo 配置
    tcontrols.setMode(gizmoMode);
    tcontrols.setSpace(gizmoSpace);
    tcontrols.setTranslationSnap(gizmoSnap.t ?? null as any);
    tcontrols.setRotationSnap(gizmoSnap.r ?? null as any);
    tcontrols.setScaleSnap(gizmoSnap.s ?? null as any);

    renderer.domElement.addEventListener('pointerdown', (ev: any)=>{
      // Ctrl/Meta + 左键用于框选，禁止 OrbitControls 平移/旋转
      if ((ev.ctrlKey || ev.metaKey) && ev.button===0) { (controls as any).enabled = false; }
      onPointerDown(ev);
      // 鼠标抬起后恢复
      const onUp=()=>{ (controls as any).enabled = true; window.removeEventListener('pointerup', onUp); };
      window.addEventListener('pointerup', onUp);
    });

    // markers container
    const markers = new THREE.Group();
    markers.name = 'annotation_markers';
    scene.add(markers);
    markersGroupRef.current = markers;

    // postprocessing
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const size = new THREE.Vector2();
    renderer.getSize(size);
    const outline = new OutlinePass(new THREE.Vector2(size.x, size.y), scene, camera);
    outline.edgeStrength = 3.0;
    outline.edgeGlow = 0.3;
    outline.edgeThickness = 1.0;
    outline.visibleEdgeColor.set('#22d3ee');
    outline.hiddenEdgeColor.set('#0ea5b7');
    composer.addPass(outline);
    composerRef.current = composer;
    outlineRef.current = outline;
  }

  function resize() {
    const mount = mountRef.current;
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    if (!mount || !renderer || !camera) return;
    const w = mount.clientWidth;
    const h = mount.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composerRef.current?.setSize(w, h);
    // 地面网格自适应：放置在原点
    if (showGrid) {
      const scene = sceneRef.current; if (scene) {
        if (!gridRef.current) {
          const grid = new THREE.GridHelper(10, 20, 0x888888, 0x444444);
          scene.add(grid);
          gridRef.current = grid as any;
        }
        if (gridRef.current) gridRef.current.visible = true;
      }
    } else {
      if (gridRef.current) gridRef.current.visible = false;
    }
  }

  function animate() {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!renderer || !scene || !camera) return;
    requestAnimationFrame(animate);
    // timeline playback
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastTickRef.current) / 1000);
    lastTickRef.current = now;
    setTimeline(prev => {
      if (!prev.playing) { 
        controls?.update(); 
        // 即使不播放也要更新GLTF mixer以保持时间同步
        if (prev.gltfAnimation?.mixer && prev.gltfAnimation?.action) {
          prev.gltfAnimation.action.time = prev.current || 0;
          prev.gltfAnimation.mixer.update(0);
        }
        // 检查并更新背景球体大小
        const currentCameraDistance = camera.position.length();
        const distanceChanged = Math.abs(currentCameraDistance - lastCameraDistanceRef.current) / Math.max(1, lastCameraDistanceRef.current) > 0.1;
        const timeSinceLastCheck = now - lastBackgroundSphereCheckRef.current;
        
        if (distanceChanged || timeSinceLastCheck > 500) {
          const backgroundSphere = scene.getObjectByName('__background_sphere__') as THREE.Mesh | undefined;
          if (backgroundSphere && backgroundSphere.geometry instanceof THREE.SphereGeometry) {
            const oldRadius = backgroundSphere.geometry.parameters.radius;
            const minRadiusForCamera = currentCameraDistance * 1.5;
            const maxRadiusForFar = camera.far * 0.95;
            const newRadius = Math.max(10000, Math.max(minRadiusForCamera, maxRadiusForFar));
            
            if (Math.abs(oldRadius - newRadius) > 100) {
              const newGeometry = new THREE.SphereGeometry(newRadius, 64, 64);
              backgroundSphere.geometry.dispose();
              backgroundSphere.geometry = newGeometry;
              backgroundSphere.position.set(0, 0, 0);
            }
          }
          lastBackgroundSphereCheckRef.current = now;
          lastCameraDistanceRef.current = currentCameraDistance;
        }
        return prev; 
      }
      const nextTime = Math.min(prev.duration, prev.current + dt);
      
      // 更新GLTF动画 - 暂时禁用
      if (prev.gltfAnimation?.mixer) {
        // TODO: 修复mixer问题后重新启用
        console.log('GLTF动画mixer更新暂时禁用');
      }
      
      applyTimelineAt(nextTime);
      controls?.update();
      if (nextTime >= prev.duration) return { ...prev, current: prev.duration, playing: false };
      return { ...prev, current: nextTime };
    });
    
    // 动态更新背景球体大小（每500ms检查一次，或相机距离变化超过10%时）
    const currentCameraDistance = camera.position.length();
    const distanceChanged = Math.abs(currentCameraDistance - lastCameraDistanceRef.current) / Math.max(1, lastCameraDistanceRef.current) > 0.1;
    const timeSinceLastCheck = now - lastBackgroundSphereCheckRef.current;
    
    if (distanceChanged || timeSinceLastCheck > 500) {
      const backgroundSphere = scene.getObjectByName('__background_sphere__') as THREE.Mesh | undefined;
      if (backgroundSphere && backgroundSphere.geometry instanceof THREE.SphereGeometry) {
        const oldRadius = backgroundSphere.geometry.parameters.radius;
        const minRadiusForCamera = currentCameraDistance * 1.5;
        const maxRadiusForFar = camera.far * 0.95;
        const newRadius = Math.max(10000, Math.max(minRadiusForCamera, maxRadiusForFar));
        
        // 如果半径需要更新，重新创建几何体
        if (Math.abs(oldRadius - newRadius) > 100) {
          const newGeometry = new THREE.SphereGeometry(newRadius, 64, 64);
          backgroundSphere.geometry.dispose();
          backgroundSphere.geometry = newGeometry;
          backgroundSphere.position.set(0, 0, 0);
        }
      }
      lastBackgroundSphereCheckRef.current = now;
      lastCameraDistanceRef.current = currentCameraDistance;
    }
    
    // 更新高斯泼溅查看器
    if (splatViewerRef.current && splatViewerRef.current.update) {
      try {
        splatViewerRef.current.update();
      } catch (e) {
        // 静默处理更新错误
      }
    }
    
    // 在高斯泼溅模式下跳过后处理（EffectComposer），直接渲染以提升性能
    // OutlinePass等后处理效果会严重影响高斯泼溅的渲染性能
    if (splatViewerRef.current) {
      renderer.render(scene, camera);
    } else {
      const composer = composerRef.current;
      if (composer) composer.render(); else renderer.render(scene, camera);
    }
  }

  function applyTimelineAt(t: number) {
    const tl = timelineRef.current;
    const isVec3 = (v: any): v is [number, number, number] => Array.isArray(v) && v.length === 3 && v.every((x:any)=> typeof x === 'number' && isFinite(x));
    
    console.log('应用时间线于时间:', t, '数据:', {
      相机关键帧: tl.cameraKeys?.length || 0,
      可见性轨道: Object.keys(tl.visTracks || {}).length,
      变换轨道: Object.keys(tl.trsTracks || {}).length,
      GLTF动画: !!tl.gltfAnimation
    });
    
    // 处理GLTF内置动画 - 暂时禁用
    if (tl.gltfAnimation) {
      console.log('GLTF动画功能暂时禁用，跳过播放');
      // TODO: 修复后重新启用GLTF动画播放逻辑
    }
    
    // camera
    const camKeys = [...(tl.cameraKeys||[])].sort((a,b)=>a.time-b.time);
    if (camKeys.length > 0) {
      const camera = cameraRef.current!;
      const controls = controlsRef.current!;
      let k0 = camKeys[0];
      let k1 = camKeys[camKeys.length - 1];
      for (let i = 0; i < camKeys.length; i++) {
        if (camKeys[i].time <= t) k0 = camKeys[i];
        if (camKeys[i].time >= t) { k1 = camKeys[i]; break; }
      }
      const lerp = (a:number,b:number,s:number)=>a+(b-a)*s;
      let s = Math.max(0, Math.min(1, (k1.time === k0.time) ? 0 : (t - k0.time) / (k1.time - k0.time)));
      const ease = k0.easing || 'easeInOut';
      if (ease === 'easeInOut') {
        // easeInOutCubic
        s = s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
      }
      const pos0 = isVec3(k0.position) ? k0.position : [camera.position.x, camera.position.y, camera.position.z] as [number,number,number];
      const pos1 = isVec3(k1.position) ? k1.position : pos0;
      const tar0 = isVec3(k0.target) ? k0.target : [controls.target.x, controls.target.y, controls.target.z] as [number,number,number];
      const tar1 = isVec3(k1.target) ? k1.target : tar0;
      const pos: [number,number,number] = [
        lerp(pos0[0], pos1[0], s),
        lerp(pos0[1], pos1[1], s),
        lerp(pos0[2], pos1[2], s)
      ];
      const tar: [number,number,number] = [
        lerp(tar0[0], tar1[0], s),
        lerp(tar0[1], tar1[1], s),
        lerp(tar0[2], tar1[2], s)
      ];
      camera.position.set(pos[0], pos[1], pos[2]);
      controls.target.set(tar[0], tar[1], tar[2]);
      camera.updateProjectionMatrix();
      controls.update();
    }
    
    // visibility
    const visTracks = tl.visTracks || {};
    for (const key of Object.keys(visTracks)) {
      const obj = keyToObject.current.get(key);
      if (!obj) {
        console.warn('找不到可见性轨道对应的对象:', key);
        continue;
      }
      const keys = [...(visTracks[key] || [])].sort((a,b)=>a.time-b.time);
      if (keys.length === 0) continue;
      let value = keys[0].value;
      for (let i = 0; i < keys.length; i++) { if (keys[i].time <= t) value = keys[i].value; else break; }
      obj.visible = value;
    }
    
    // TRS
    const trsTracks = tl.trsTracks || {};
    for (const key of Object.keys(trsTracks)) {
      const obj = keyToObject.current.get(key);
      if (!obj) {
        console.warn('找不到变换轨道对应的对象:', key);
        continue;
      }
      const keys = [...(trsTracks[key] || [])].sort((a,b)=>a.time-b.time);
      if (keys.length === 0) continue;
      let k0 = keys[0]; let k1 = keys[keys.length-1];
      for (let i=0;i<keys.length;i++){ if (keys[i].time <= t) k0 = keys[i]; if (keys[i].time >= t) { k1 = keys[i]; break; } }
      const lerp = (a:number,b:number,s:number)=>a+(b-a)*s;
      let s = Math.max(0, Math.min(1, (k1.time === k0.time) ? 0 : (t - k0.time) / (k1.time - k0.time)));
      const ease = k0.easing || 'easeInOut';
      if (ease === 'easeInOut') s = s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
      if (isVec3(k0.position) && isVec3(k1.position)) {
        obj.position.set(
          lerp(k0.position[0], k1.position[0], s),
          lerp(k0.position[1], k1.position[1], s),
          lerp(k0.position[2], k1.position[2], s)
        );
      }
      if (isVec3(k0.rotationEuler) && isVec3(k1.rotationEuler)) {
        obj.rotation.set(
          lerp(k0.rotationEuler[0], k1.rotationEuler[0], s),
          lerp(k0.rotationEuler[1], k1.rotationEuler[1], s),
          lerp(k0.rotationEuler[2], k1.rotationEuler[2], s)
        );
      }
      if (isVec3(k0.scale) && isVec3(k1.scale)) {
        obj.scale.set(
          lerp(k0.scale[0], k1.scale[0], s),
          lerp(k0.scale[1], k1.scale[1], s),
          lerp(k0.scale[2], k1.scale[2], s)
        );
      }
      obj.updateMatrixWorld();
    }
    
    // 更新标注位置（跟随父对象变换）
    refreshMarkers();
    
    // Annotations visibility
    const annTracks = tl.annotationTracks || {};
    const group = markersGroupRef.current;
    if (group) {
      for (const child of group.children) {
        const id = (child as any).userData?.annotationId as string | undefined;
        if (!id) continue;
        const keys = (annTracks[id] || []).sort((a,b)=>a.time-b.time);
        if (keys.length === 0) { (child as any).visible = true; continue; }
        let value = keys[0].value;
        for (let i = 0; i < keys.length; i++) { if (keys[i].time <= t) value = keys[i].value; else break; }
        (child as any).visible = value;
      }
    }
  }

  async function loadModel(src: string, preferModified: boolean = false) {
    const scene = sceneRef.current!;
    setLoading(true);
    
    // 重置材质修改标记（加载新模型时）
    materialModifiedRef.current = false;
    
    // 如果有修改后的模型且优先使用修改版本，则使用修改后的URL
    let actualSrc = src;
    if (preferModified && coursewareData?.modifiedModelUrl) {
      actualSrc = coursewareData.modifiedModelUrl;
      console.log('🔄 使用修改后的模型文件:', actualSrc);
      message.loading('正在加载修改后的模型...', 0);
    } else {
      console.log('📁 使用原始模型文件:', actualSrc);
      message.loading('正在加载模型...', 0); // 0表示不自动消失
    }
    
    try {
      // 清除旧模型
      if (modelRootRef.current) {
        scene.remove(modelRootRef.current);
        modelRootRef.current.traverse((o: any) => {
          try {
            if (o.geometry && typeof o.geometry.dispose === 'function') {
              o.geometry.dispose();
            }
          if (o.material) {
              if (Array.isArray(o.material)) {
                o.material.forEach((m: any) => {
                  if (m && typeof m.dispose === 'function') m.dispose();
                });
              } else if (o.material && typeof o.material.dispose === 'function') {
                o.material.dispose();
              }
            }
          } catch (err) {
            console.warn('清理模型资源时出错:', err);
          }
        });
        modelRootRef.current = null;
      }
      if (boxHelperRef.current) {
        scene.remove(boxHelperRef.current);
        boxHelperRef.current = null;
      }
      keyToObject.current.clear();
      setTreeData([]);
      setSelectedKey(undefined);
      setHiddenKeys(new Set());
      setAnnotations([]);
      pendingImportRef.current && (pendingImportRef.current = pendingImportRef.current); // 保留缓存

      const manager = new THREE.LoadingManager();
      
      // 构建最终的加载URL
      let finalSrc = actualSrc;
      let useProxy = false;
      
      if (actualSrc.startsWith('/api/files/')) {
        // 内部API文件：使用动态获取的API URL，如果是公网域名则使用相对路径（通过 Next.js rewrites）
        const baseUrl = getAPI_URL();
        finalSrc = `${baseUrl}${actualSrc}`;
      } else if (actualSrc.startsWith('https://dl.yf-xr.com/') || actualSrc.startsWith('https://video.yf-xr.com/')) {
        // 公网URL：使用代理避免CORS问题
        const baseUrl = getAPI_URL();
        finalSrc = `${baseUrl}/api/files/proxy?url=${encodeURIComponent(actualSrc)}`;
        useProxy = true;
      }

      // 使用fetch来加载模型文件（支持认证和代理）
      let root: THREE.Object3D;
      let animations: THREE.AnimationClip[] = [];
      if (actualSrc.startsWith('/api/files/') || useProxy) {
        const token = getToken?.();
        const headers: Record<string, string> = {};
        
        // 对内部API和代理请求都需要认证
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }
        
        const response = await fetch(finalSrc, { headers });
        if (!response.ok) {
          throw new Error(`Failed to load model: ${response.status} ${response.statusText}`);
        }
        
        // 从响应头 Content-Disposition 中提取文件名和扩展名
        let fileExt = '';
        const contentDisposition = response.headers.get('Content-Disposition');
        console.log('📋 Content-Disposition 响应头:', contentDisposition);
        
        if (contentDisposition) {
          // 解析 Content-Disposition: inline; filename="model.glb" 或 filename*=UTF-8''model.glb
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=(["']?)([^"'\n]*)\1/i);
          const filenameStarMatch = contentDisposition.match(/filename\*=UTF-8''([^;\n]*)/i);
          
          let filename = '';
          if (filenameStarMatch && filenameStarMatch[1]) {
            filename = decodeURIComponent(filenameStarMatch[1]);
          } else if (filenameMatch && filenameMatch[2]) {
            filename = decodeURIComponent(filenameMatch[2]);
          }
          
          if (filename) {
            fileExt = filename.toLowerCase().split('.').pop() || '';
            console.log('✅ 从 Content-Disposition 提取文件扩展名:', fileExt, '文件名:', filename);
          }
        }
        
        // 如果响应头中没有文件名，则回退到从 URL 中提取
        if (!fileExt) {
          const urlPath = actualSrc.split('?')[0];
          const urlParts = urlPath.split('/');
          const lastPart = urlParts[urlParts.length - 1];
          if (lastPart && lastPart.includes('.')) {
            fileExt = lastPart.toLowerCase().split('.').pop() || '';
            console.log('⚠️ 从 URL 路径提取文件扩展名:', fileExt);
          }
        }
        
        // 最后的回退：尝试从文件二进制头部识别格式
        if (!fileExt) {
          const arrayBuffer = await response.arrayBuffer();
          fileExt = detectFileFormat(arrayBuffer);
          console.log('🔍 从文件头部识别格式:', fileExt || '未识别');
          
          if (!fileExt) {
            throw new Error('无法识别文件格式。请确保文件是有效的 GLB、FBX 或 OBJ 格式。');
          }
          
          // 继续使用这个 arrayBuffer
          const isGLTF = fileExt === 'glb' || fileExt === 'gltf';
          const isFBX = fileExt === 'fbx';
          const isOBJ = fileExt === 'obj';
          
          let loadedRoot: THREE.Object3D | null = null;
          let loadedAnimations: THREE.AnimationClip[] = [];
          
          // 根据格式使用不同的加载器
          if (isGLTF) {
            const ktx2 = new KTX2Loader(manager)
              .setTranscoderPath('https://unpkg.com/three@0.164.0/examples/jsm/libs/basis/')
              .detectSupport(rendererRef.current!);
            const draco = new DRACOLoader(manager)
              .setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
            const loader = new GLTFLoader(manager)
              .setKTX2Loader(ktx2)
              .setDRACOLoader(draco);
            const gltf = await new Promise<any>((resolve, reject) => {
              loader.parse(arrayBuffer, '', resolve, reject);
            });
            loadedRoot = gltf.scene || gltf.scenes[0];
            loadedAnimations = gltf.animations || [];
          } else if (isFBX) {
            const loader = new FBXLoader(manager);
            loadedRoot = loader.parse(arrayBuffer, '');
            loadedAnimations = (loadedRoot as any).animations || [];
            // 🔧 修复FBX模型位置偏差：重置根对象的变换，使其与GLB模型行为一致
            if (loadedRoot) {
              // 如果根对象有变换，先将其烘焙到所有子对象
              if (loadedRoot.position.lengthSq() > 0.0001 || 
                  loadedRoot.rotation.x !== 0 || loadedRoot.rotation.y !== 0 || loadedRoot.rotation.z !== 0 ||
                  loadedRoot.scale.x !== 1 || loadedRoot.scale.y !== 1 || loadedRoot.scale.z !== 1) {
                console.log('🔧 FBX根对象有变换，正在烘焙到子对象...', {
                  position: loadedRoot.position,
                  rotation: loadedRoot.rotation,
                  scale: loadedRoot.scale
                });
                loadedRoot.updateMatrixWorld(true);
                const rootMatrix = loadedRoot.matrix.clone();
                loadedRoot.children.forEach((child) => {
                  child.applyMatrix4(rootMatrix);
                  child.updateMatrixWorld(true);
                });
              }
              // 重置根对象的变换
              loadedRoot.position.set(0, 0, 0);
              loadedRoot.rotation.set(0, 0, 0);
              loadedRoot.scale.set(1, 1, 1);
              loadedRoot.updateMatrixWorld(true);
              console.log('✅ FBX根对象变换已重置');
            }
          } else if (isOBJ) {
            const loader = new OBJLoader(manager);
            const textDecoder = new TextDecoder();
            const text = textDecoder.decode(arrayBuffer);
            loadedRoot = loader.parse(text);
            loadedAnimations = [];
          }
          
          if (!loadedRoot) {
            throw new Error('模型加载失败');
          }
          
          // 跳到后续处理（避免重复代码）
          root = loadedRoot;
          animations = loadedAnimations;
          
          // 🔧 统一FBX和GLB的层级结构：确保FBX也有Group包装层
          // 规整根节点（与后续处理保持一致）
          if ((root as any).isScene) {
            let candidate: THREE.Object3D = root;
            while ((candidate as any).isScene && candidate.children && candidate.children.length === 1) {
              candidate = candidate.children[0];
            }
            if ((candidate as any).isScene) {
              const container = new THREE.Group();
              container.name = root.name || '模型';
              const children = [...candidate.children];
              children.forEach((child) => container.add(child));
              root = container;
            } else {
              root = candidate;
            }
          } else if (fileExt === 'fbx') {
            // 🔧 FBX特殊处理：统一层级结构，确保FBX也有Group包装层（与GLB保持一致）
            console.log('🔍 FBX层级结构检查:', {
              rootType: root.type,
              rootName: root.name,
              childrenCount: root.children.length,
              hasMesh: (root as any).isMesh || (root as any).geometry,
              rootPosition: root.position,
              rootRotation: root.rotation,
              rootScale: root.scale
            });
            
            // 确保根对象的变换矩阵是最新的
            root.updateMatrixWorld(true);
            
            // 强制为所有FBX创建Group包装层，确保层级结构统一
            const container = new THREE.Group();
            container.name = root.name || '模型';
            // 标记这是FBX创建的包装层，不应该被剥离
            (container as any).userData = { isFBXWrapper: true, ...((container as any).userData || {}) };
            
            // 先设置容器的变换，确保位置在原点
            container.position.set(0, 0, 0);
            container.rotation.set(0, 0, 0);
            container.scale.set(1, 1, 1);
            
            // 将根对象的所有子节点移动到新容器中
            // 重要：在移动前，记录每个子对象的世界位置，确保移动后世界位置不变
            root.updateMatrixWorld(true);
            const children = [...root.children];
            const childWorldPositions = new Map<THREE.Object3D, THREE.Vector3>();
            
            // 记录每个子对象的世界位置（相对于原root的世界坐标系）
            children.forEach((child) => {
              child.updateMatrixWorld(true);
              const worldPos = new THREE.Vector3();
              child.getWorldPosition(worldPos);
              childWorldPositions.set(child, worldPos);
            });
            
            // 移动子对象到新容器
            children.forEach((child) => {
              root.remove(child);
              container.add(child);
            });
            
            // 如果根对象本身有Mesh，也需要保留
            if ((root as any).isMesh || (root as any).geometry) {
              console.log('🔧 FBX根对象包含Mesh，保留根对象');
              container.add(root);
            }
            
            // 将容器设置为新的根对象
            root = container;
            
            // 更新新根对象的变换矩阵（现在容器已经是root了）
            root.updateMatrixWorld(true);
            
            // 重新计算每个子对象的本地位置，使其世界位置保持不变
            children.forEach((child) => {
              const worldPos = childWorldPositions.get(child);
              if (worldPos) {
                // 计算相对于新容器的本地位置
                // 由于容器现在在原点，世界位置就是本地位置
                child.position.copy(worldPos);
                child.updateMatrixWorld(true);
              }
            });
            
            console.log('🔧 FBX根对象已用Group替换');
            
            // 确保Group名称明确标识
            if (root.name && root.children.length > 0) {
              // 如果Group有名称且不是默认名称，保持原名称
              // 否则使用第一个子对象的名称或默认名称
              const firstChildName = root.children[0]?.name;
              if (!root.name || root.name === '模型') {
                root.name = firstChildName || '模型根节点';
              }
            }
            
            console.log('✅ FBX已创建Group包装层，统一层级结构', {
              newRootType: root.type,
              newRootName: root.name,
              childrenCount: root.children.length,
              newRootPosition: root.position,
              firstChildPosition: root.children[0]?.position,
              childrenNames: root.children.map(c => c.name || c.type).slice(0, 3)
            });
            
            // 验证Group层确实存在
            console.log('🔍 验证Group层结构:', {
              rootIsGroup: root.type === 'Group',
              rootHasUserData: !!(root as any).userData?.isFBXWrapper,
              rootChildren: root.children.length,
              rootName: root.name
            });
          }
          
          modelRootRef.current = root;
          scene.add(root);
          
          // 设置模型阴影
          root.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          
          // 构建节点映射
          rebuildTree();
          
          // 验证树结构是否正确构建（通过keyToObject检查）
          const rootKey = root.uuid;
          const rootInMap = keyToObject.current.get(rootKey);
          console.log('🔍 重建树结构后验证:', {
            rootType: root.type,
            rootName: root.name,
            rootChildrenCount: root.children.length,
            rootKey: rootKey,
            rootInMap: !!rootInMap,
            rootHasWrapperFlag: !!(root as any).userData?.isFBXWrapper,
            firstChildName: root.children[0]?.name
          });
          
          // 自动调整相机视角
          focusObject(root);
          
          // 检查背景球体状态（模型加载后）
          const backgroundSphereAfterLoad = scene.getObjectByName('__background_sphere__') as THREE.Mesh | undefined;
          if (backgroundSphereAfterLoad) {
            const camera = cameraRef.current;
            if (camera) {
              const sphereRadius = (backgroundSphereAfterLoad.geometry as THREE.SphereGeometry).parameters.radius;
              const cameraDistance = camera.position.length();
              console.log(`✅ 模型加载完成，背景球体状态检查:`, {
                球体存在: true,
                球体半径: sphereRadius.toFixed(2),
                相机距离: cameraDistance.toFixed(2),
                相机Far: camera.far.toFixed(2),
                相机在球内: sphereRadius > cameraDistance ? '✅' : '❌',
                球体在Far内: sphereRadius < camera.far ? '✅' : '❌'
              });
            }
          } else {
            console.warn('⚠️ 模型加载完成，但背景球体不存在！');
          }
          
          // 🎬 处理模型内置动画
          if (animations && animations.length > 0) {
            console.log('🎬 发现模型内置动画:', animations.length, '个');
            
            // 保存原始动画到ref，用于后续导出
            originalAnimationsRef.current = [...animations];
            console.log('📁 已保存原始动画供后续导出使用');
          }
          
          // 🔥 处理动画元数据（纯相机动画等）
          if (pendingImportRef.current?.animationMetadata) {
            console.log('🔄 [分支1] 检测到待处理的动画元数据，进行动画重建...');
            console.log('📊 动画元数据数量:', pendingImportRef.current.animationMetadata.length);
            console.log('📊 GLB动画数量:', animations.length);
            
            // 创建GLB动画的编辑器条目
            const gltfClips: Clip[] = animations.map((clip, index) => ({
              id: generateUuid(),
              name: clip.name || `原始动画${index + 1}`,
              description: `模型内置动画`,
              timeline: {
                duration: clip.duration || 10,
                current: 0,
                playing: false,
                cameraKeys: [],
                visTracks: {},
                trsTracks: {},
                annotationTracks: {},
                gltfAnimation: { clip, mixer: null as any, isOriginal: true }
              }
            }));
            
            // 从GLB和元数据重建动画
            const rebuiltClips = loadAnimationsFromGLB(animations, pendingImportRef.current.animationMetadata, root);
            console.log('✅ 重建后的动画数量:', rebuiltClips.length);
            
            // 合并重建的动画和未匹配的内置动画
            const matchedAnimationNames = new Set(rebuiltClips.map(c => c.name));
            const unmatchedGltfClips = gltfClips.filter(clip => !matchedAnimationNames.has(clip.name));
            const allClips = [...rebuiltClips, ...unmatchedGltfClips];
            console.log('📊 合并后的总动画数量:', allClips.length);
            
            if (allClips.length > 0) {
              setClips(allClips);
              setActiveClipId(allClips[0].id);
              setTimeline({
                duration: allClips[0].timeline.duration || 10,
                current: 0,
                playing: false,
                cameraKeys: allClips[0].timeline.cameraKeys || [],
                visTracks: allClips[0].timeline.visTracks || {},
                trsTracks: allClips[0].timeline.trsTracks || {},
                annotationTracks: allClips[0].timeline.annotationTracks || {}
              });
              // 🔥 同步步骤数据
              setSteps(Array.isArray((allClips[0] as any).steps) ? [...(allClips[0] as any).steps] : []);
              console.log('✅ [分支1] 动画数据已加载，当前活动动画:', allClips[0].name, '步骤数:', (allClips[0] as any).steps?.length || 0);
            }
            
            // 清除动画pending数据（保留标注数据供后续恢复）
            delete pendingImportRef.current.animationMetadata;
            delete pendingImportRef.current.allAnimations;
            console.log('🧹 已清理GLB动画的pending数据');
          }
          
          // 🔥 恢复标注数据
          if (pendingImportRef.current) {
            console.log('📍 [分支1] 开始恢复标注数据...');
            tryRestoreFromPending();
          }
          
          // 模型加载完成后消息提示
          message.destroy();
          message.success('模型已加载');
          return;
        }
        
        const isGLTF = fileExt === 'glb' || fileExt === 'gltf';
        const isFBX = fileExt === 'fbx';
        const isOBJ = fileExt === 'obj';
        
        const arrayBuffer = await response.arrayBuffer();
        
        // 根据格式使用不同的加载器
        if (isGLTF) {
          const ktx2 = new KTX2Loader(manager)
            .setTranscoderPath('https://unpkg.com/three@0.164.0/examples/jsm/libs/basis/')
            .detectSupport(rendererRef.current!);
          const draco = new DRACOLoader(manager)
            .setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
          const loader = new GLTFLoader(manager)
            .setKTX2Loader(ktx2)
            .setDRACOLoader(draco);
          const gltf = await loader.parseAsync(arrayBuffer, '');
          root = gltf.scene || gltf.scenes[0];
          animations = gltf.animations || [];
        } else if (isFBX) {
          const loader = new FBXLoader(manager);
          root = loader.parse(arrayBuffer, '');
          animations = (root as any).animations || [];
          // 🔧 修复FBX模型位置偏差：重置根对象的变换，使其与GLB模型行为一致
          if (root) {
            // 如果根对象有变换，先将其烘焙到所有子对象
            if (root.position.lengthSq() > 0.0001 || 
                root.rotation.x !== 0 || root.rotation.y !== 0 || root.rotation.z !== 0 ||
                root.scale.x !== 1 || root.scale.y !== 1 || root.scale.z !== 1) {
              console.log('🔧 FBX根对象有变换，正在烘焙到子对象...', {
                position: root.position,
                rotation: root.rotation,
                scale: root.scale
              });
              root.updateMatrixWorld(true);
              const rootMatrix = root.matrix.clone();
              root.children.forEach((child) => {
                child.applyMatrix4(rootMatrix);
                child.updateMatrixWorld(true);
              });
            }
            // 重置根对象的变换
            root.position.set(0, 0, 0);
            root.rotation.set(0, 0, 0);
            root.scale.set(1, 1, 1);
            root.updateMatrixWorld(true);
            console.log('✅ FBX根对象变换已重置');
          }
        } else if (isOBJ) {
          const loader = new OBJLoader(manager);
          const textDecoder = new TextDecoder();
          const text = textDecoder.decode(arrayBuffer);
          root = loader.parse(text);
          animations = [];
        } else {
          throw new Error(`不支持的文件格式: .${fileExt}`);
        }
        
        // 🎬 处理模型内置动画 - 完整支持读取和保存
        if (animations && animations.length > 0) {
          console.log('🎬 发现模型内置动画:', animations.length, '个');
          
          // 保存原始动画到ref，用于后续导出
          originalAnimationsRef.current = [...animations];
          console.log('📁 已保存原始动画供后续导出使用');
          
          // 创建对应的编辑器动画条目
          const gltfClips: Clip[] = animations.map((clip, index) => ({
            id: generateUuid(),
            name: clip.name || `原始动画${index + 1}`,
            description: `模型内置动画`,
            timeline: {
              duration: clip.duration || 10,
              current: 0,
              playing: false,
              cameraKeys: [],
              visTracks: {},
              trsTracks: {},
              annotationTracks: {},
              // 标记为原始动画
              gltfAnimation: {
                clip,
                mixer: null as any, // 暂不创建mixer
                isOriginal: true    // 标记为原始动画
              }
            }
          }));
          
          // 检查是否有待加载的动画元数据
          if (pendingImportRef.current?.animationMetadata) {
            console.log('🔄 检测到待处理的动画元数据，进行GLB动画重建...');
            console.log('📊 动画元数据数量:', pendingImportRef.current.animationMetadata.length);
            console.log('📊 GLB动画数量:', animations.length);
            
            // 从GLB和元数据重建动画（传入当前root）
            const rebuiltClips = loadAnimationsFromGLB(animations, pendingImportRef.current.animationMetadata, root);
            console.log('✅ 重建后的动画数量:', rebuiltClips.length);
            
            // 找出没有匹配元数据的GLB内置动画
            const matchedAnimationNames = new Set(rebuiltClips.map(c => c.name));
            const unmatchedGltfClips = gltfClips.filter(clip => !matchedAnimationNames.has(clip.name));
            console.log('📊 未匹配的内置动画数量:', unmatchedGltfClips.length);
            
            // 合并重建的动画和未匹配的内置动画
            const allClips = [...rebuiltClips, ...unmatchedGltfClips];
            console.log('📊 合并后的总动画数量:', allClips.length);
            
            if (allClips.length > 0) {
              setClips(allClips);
              setActiveClipId(allClips[0].id);
              setTimeline({
                duration: allClips[0].timeline.duration || 10,
                current: 0,
                playing: false,
                cameraKeys: allClips[0].timeline.cameraKeys || [],
                visTracks: allClips[0].timeline.visTracks || {},
                trsTracks: allClips[0].timeline.trsTracks || {},
                annotationTracks: allClips[0].timeline.annotationTracks || {}
              });
              // 🔥 同步步骤数据
              setSteps(Array.isArray((allClips[0] as any).steps) ? [...(allClips[0] as any).steps] : []);
              console.log('✅ 动画数据已加载，当前活动动画:', allClips[0].name, '步骤数:', (allClips[0] as any).steps?.length || 0);
            } else {
              console.warn('⚠️ 重建后的动画列表为空，尝试使用传统方式加载...');
              // 如果重建失败，尝试使用传统方式加载
              const loadedClips: Clip[] = pendingImportRef.current.animationMetadata.map((anim: any) => {
                let timeline = anim.timeline || { 
                  duration: anim.duration || 10, 
                  current: 0, 
                  playing: false, 
                  cameraKeys: [], 
                  visTracks: {}, 
                  trsTracks: {}, 
                  annotationTracks: {} 
                };
                return {
                  id: anim.id || generateUuid(),
                  name: anim.name || '未命名动画',
                  description: anim.description || '',
                  timeline,
                  steps: anim.steps || []
                };
              });
              // 合并传统加载的动画和内置动画
              const finalClips = [...loadedClips, ...gltfClips];
              if (finalClips.length > 0) {
                setClips(finalClips);
                setActiveClipId(finalClips[0].id);
                setTimeline(finalClips[0].timeline);
                console.log('✅ 使用传统方式加载动画成功，数量:', finalClips.length);
              }
            }
            
            // 清除pending数据，防止被传统恢复逻辑覆盖
            delete pendingImportRef.current.animationMetadata;
            delete pendingImportRef.current.allAnimations;
            console.log('🧹 已清理GLB动画的pending数据，防止被覆盖');
          } else {
            // 无元数据：将原始动画加入列表并自动选中第一个，同时懒解析其轨道
            setClips(prev => {
              const next = [...gltfClips, ...prev];
              if (next.length > 0) {
                setActiveClipId(next[0].id);
                try {
                  const gltfAnim = (next[0] as any).timeline?.gltfAnimation;
                  if (gltfAnim?.clip && root) {
                    const parsed = parseAnimationClipToTracks(gltfAnim.clip, root);
                    next[0] = { ...next[0], timeline: { ...next[0].timeline, visTracks: parsed.visTracks, trsTracks: parsed.trsTracks } };
                    setTimeline(tl => ({ ...tl, duration: gltfAnim.clip.duration || tl.duration, visTracks: parsed.visTracks, trsTracks: parsed.trsTracks }));
                  }
                } catch (e) { console.warn('首个原始动画懒解析失败（忽略）:', e); }
              }
              return next;
            });
          }
          
          console.log(`✅ 已加载${gltfClips.length}个原始动画到编辑器`);
        }
      } else {
        // 对于其他URL（如外部链接），从URL提取文件扩展名
        const fileExt = actualSrc.toLowerCase().split('?')[0].split('.').pop() || '';
        const isGLTF = fileExt === 'glb' || fileExt === 'gltf';
        const isFBX = fileExt === 'fbx';
        const isOBJ = fileExt === 'obj';
        
        // 根据格式使用对应的loader
        if (isGLTF) {
          const ktx2 = new KTX2Loader(manager)
            .setTranscoderPath('https://unpkg.com/three@0.164.0/examples/jsm/libs/basis/')
            .detectSupport(rendererRef.current!);
          const draco = new DRACOLoader(manager)
            .setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
          const loader = new GLTFLoader(manager)
            .setKTX2Loader(ktx2)
            .setDRACOLoader(draco);
          const gltf = await loader.loadAsync(finalSrc);
          root = gltf.scene || gltf.scenes[0];
          animations = gltf.animations || [];
        } else if (isFBX) {
          const loader = new FBXLoader(manager);
          root = await loader.loadAsync(finalSrc);
          animations = (root as any).animations || [];
          // 🔧 修复FBX模型位置偏差：重置根对象的变换，使其与GLB模型行为一致
          if (root) {
            // 如果根对象有变换，先将其烘焙到所有子对象
            if (root.position.lengthSq() > 0.0001 || 
                root.rotation.x !== 0 || root.rotation.y !== 0 || root.rotation.z !== 0 ||
                root.scale.x !== 1 || root.scale.y !== 1 || root.scale.z !== 1) {
              console.log('🔧 FBX根对象有变换，正在烘焙到子对象...', {
                position: root.position,
                rotation: root.rotation,
                scale: root.scale
              });
              root.updateMatrixWorld(true);
              const rootMatrix = root.matrix.clone();
              root.children.forEach((child) => {
                child.applyMatrix4(rootMatrix);
                child.updateMatrixWorld(true);
              });
            }
            // 重置根对象的变换
            root.position.set(0, 0, 0);
            root.rotation.set(0, 0, 0);
            root.scale.set(1, 1, 1);
            root.updateMatrixWorld(true);
            console.log('✅ FBX根对象变换已重置');
          }
        } else if (isOBJ) {
          const loader = new OBJLoader(manager);
          root = await loader.loadAsync(finalSrc);
          animations = [];
        } else {
          throw new Error(`不支持的文件格式: .${fileExt}`);
        }
        
        // 🎬 处理模型内置动画 - 完整支持读取和保存
        if (animations && animations.length > 0) {
          console.log('🎬 发现模型内置动画:', animations.length, '个');
          
          // 保存原始动画到ref，用于后续导出
          originalAnimationsRef.current = [...animations];
          console.log('📁 已保存原始动画供后续导出使用');
          
          // 创建对应的编辑器动画条目
          const gltfClips: Clip[] = animations.map((clip, index) => ({
            id: generateUuid(),
            name: clip.name || `原始动画${index + 1}`,
            description: `模型内置动画`,
            timeline: {
              duration: clip.duration || 10,
              current: 0,
              playing: false,
              cameraKeys: [],
              visTracks: {},
              trsTracks: {},
              annotationTracks: {},
              // 标记为原始动画
              gltfAnimation: {
                clip,
                mixer: null as any, // 暂不创建mixer
                isOriginal: true    // 标记为原始动画
              }
            }
          }));
          
          // 检查是否有待加载的动画元数据
          if (pendingImportRef.current?.animationMetadata) {
            console.log('🔄 检测到待处理的动画元数据，进行GLB动画重建...');
            console.log('📊 动画元数据数量:', pendingImportRef.current.animationMetadata.length);
            console.log('📊 GLB动画数量:', animations.length);
            
            // 从GLB和元数据重建动画（传入当前root）
            const rebuiltClips = loadAnimationsFromGLB(animations, pendingImportRef.current.animationMetadata, root);
            console.log('✅ 重建后的动画数量:', rebuiltClips.length);
            
            // 找出没有匹配元数据的GLB内置动画
            const matchedAnimationNames = new Set(rebuiltClips.map(c => c.name));
            const unmatchedGltfClips = gltfClips.filter(clip => !matchedAnimationNames.has(clip.name));
            console.log('📊 未匹配的内置动画数量:', unmatchedGltfClips.length);
            
            // 合并重建的动画和未匹配的内置动画
            const allClips = [...rebuiltClips, ...unmatchedGltfClips];
            console.log('📊 合并后的总动画数量:', allClips.length);
            
            if (allClips.length > 0) {
              setClips(allClips);
              setActiveClipId(allClips[0].id);
              setTimeline({
                duration: allClips[0].timeline.duration || 10,
                current: 0,
                playing: false,
                cameraKeys: allClips[0].timeline.cameraKeys || [],
                visTracks: allClips[0].timeline.visTracks || {},
                trsTracks: allClips[0].timeline.trsTracks || {},
                annotationTracks: allClips[0].timeline.annotationTracks || {}
              });
              // 🔥 同步步骤数据
              setSteps(Array.isArray((allClips[0] as any).steps) ? [...(allClips[0] as any).steps] : []);
              console.log('✅ 动画数据已加载，当前活动动画:', allClips[0].name, '步骤数:', (allClips[0] as any).steps?.length || 0);
            } else {
              console.warn('⚠️ 重建后的动画列表为空，尝试使用传统方式加载...');
              // 如果重建失败，尝试使用传统方式加载
              const loadedClips: Clip[] = pendingImportRef.current.animationMetadata.map((anim: any) => {
                let timeline = anim.timeline || { 
                  duration: anim.duration || 10, 
                  current: 0, 
                  playing: false, 
                  cameraKeys: [], 
                  visTracks: {}, 
                  trsTracks: {}, 
                  annotationTracks: {} 
                };
                return {
                  id: anim.id || generateUuid(),
                  name: anim.name || '未命名动画',
                  description: anim.description || '',
                  timeline,
                  steps: anim.steps || []
                };
              });
              // 合并传统加载的动画和内置动画
              const finalClips = [...loadedClips, ...gltfClips];
              if (finalClips.length > 0) {
                setClips(finalClips);
                setActiveClipId(finalClips[0].id);
                setTimeline(finalClips[0].timeline);
                console.log('✅ 使用传统方式加载动画成功，数量:', finalClips.length);
              }
            }
            
            // 清除pending数据，防止被传统恢复逻辑覆盖
            delete pendingImportRef.current.animationMetadata;
            delete pendingImportRef.current.allAnimations;
            console.log('🧹 已清理GLB动画的pending数据，防止被覆盖');
          } else {
            // 无元数据：将原始动画加入列表并自动选中第一个，同时懒解析其轨道
            setClips(prev => {
              const next = [...gltfClips, ...prev];
              if (next.length > 0) {
                setActiveClipId(next[0].id);
                try {
                  const gltfAnim = (next[0] as any).timeline?.gltfAnimation;
                  if (gltfAnim?.clip && root) {
                    const parsed = parseAnimationClipToTracks(gltfAnim.clip, root);
                    next[0] = { ...next[0], timeline: { ...next[0].timeline, visTracks: parsed.visTracks, trsTracks: parsed.trsTracks } };
                    setTimeline(tl => ({ ...tl, duration: gltfAnim.clip.duration || tl.duration, visTracks: parsed.visTracks, trsTracks: parsed.trsTracks }));
                  }
                } catch (e) { console.warn('首个原始动画懒解析失败（忽略）:', e); }
              }
              return next;
            });
          }
          
          console.log(`✅ 已加载${gltfClips.length}个原始动画到编辑器`);
        }
      }
      
      // 规整根节点：
      // 1) 若为 Scene 且仅有一个子节点，则直接下钻到子节点，避免反复保存出现"Object3D/Group"套层
      // 2) 若为 Scene 且有多个子节点，则合并到一个 Group 中作为导入根
      // 3) 🔧 统一FBX和GLB的层级结构：确保FBX也有Group包装层
      if ((root as any).isScene) {
        let candidate: THREE.Object3D = root;
        while ((candidate as any).isScene && candidate.children && candidate.children.length === 1) {
          candidate = candidate.children[0];
        }
        if ((candidate as any).isScene) {
          const container = new THREE.Group();
          container.name = root.name || '模型';
          const children = [...candidate.children];
          children.forEach((child) => container.add(child));
          root = container;
        } else {
          root = candidate;
        }
      } else {
        // 🔧 检查是否为FBX文件（通过URL判断，或通过根对象特征判断）
        // 注意：由于URL可能没有扩展名，我们也可以通过检查根对象特征来判断
        // FBX文件通常加载后根对象不是Scene，且可能有一些特定特征
        const urlHasFBX = actualSrc.toLowerCase().includes('.fbx') || 
                          actualSrc.toLowerCase().endsWith('.fbx');
        // 如果URL没有扩展名，尝试通过根对象特征判断（FBX通常不是Scene）
        const mightBeFBX = !(root as any).isScene && 
                           root.type !== 'Scene' && 
                           (root.children.length > 0 || (root as any).isMesh);
        
        if (urlHasFBX || mightBeFBX) {
          // 🔧 FBX特殊处理：统一层级结构，确保FBX也有Group包装层（与GLB保持一致）
          console.log('🔍 FBX层级结构检查（统一处理）:', {
            rootType: root.type,
            rootName: root.name,
            childrenCount: root.children.length,
            hasMesh: (root as any).isMesh || (root as any).geometry,
            urlHasFBX: urlHasFBX,
            mightBeFBX: mightBeFBX,
            actualSrc: actualSrc,
            rootPosition: root.position,
            rootRotation: root.rotation,
            rootScale: root.scale
          });
          
          // 确保根对象的变换矩阵是最新的
          root.updateMatrixWorld(true);
          
          // 强制为所有FBX创建Group包装层，确保层级结构统一
          const container = new THREE.Group();
          container.name = root.name || '模型';
          // 标记这是FBX创建的包装层，不应该被剥离
          (container as any).userData = { isFBXWrapper: true, ...((container as any).userData || {}) };
          
          // 先设置容器的变换，确保位置在原点
          container.position.set(0, 0, 0);
          container.rotation.set(0, 0, 0);
          container.scale.set(1, 1, 1);
          
          // 将根对象的所有子节点移动到新容器中
          // 重要：在移动前，记录每个子对象的世界位置，确保移动后世界位置不变
          root.updateMatrixWorld(true);
          const children = [...root.children];
          const childWorldPositions = new Map<THREE.Object3D, THREE.Vector3>();
          
          // 记录每个子对象的世界位置（相对于原root的世界坐标系）
          children.forEach((child) => {
            child.updateMatrixWorld(true);
            const worldPos = new THREE.Vector3();
            child.getWorldPosition(worldPos);
            childWorldPositions.set(child, worldPos);
          });
          
          // 移动子对象到新容器
          children.forEach((child) => {
            root.remove(child);
            container.add(child);
          });
          
          // 如果根对象本身有Mesh，也需要保留
          if ((root as any).isMesh || (root as any).geometry) {
            console.log('🔧 FBX根对象包含Mesh，保留根对象');
            container.add(root);
          }
          
          // 将容器设置为新的根对象
          root = container;
          
          // 更新新根对象的变换矩阵（现在容器已经是root了）
          root.updateMatrixWorld(true);
          
          // 重新计算每个子对象的本地位置，使其世界位置保持不变
          children.forEach((child) => {
            const worldPos = childWorldPositions.get(child);
            if (worldPos) {
              // 计算相对于新容器的本地位置
              // 由于容器现在在原点，世界位置就是本地位置
              child.position.copy(worldPos);
              child.updateMatrixWorld(true);
            }
          });
          
          console.log('🔧 FBX根对象已用Group替换');
          
          // 确保Group名称明确标识
          if (root.name && root.children.length > 0) {
            // 如果Group有名称且不是默认名称，保持原名称
            // 否则使用第一个子对象的名称或默认名称
            const firstChildName = root.children[0]?.name;
            if (!root.name || root.name === '模型') {
              root.name = firstChildName || '模型根节点';
            }
          }
          
          console.log('✅ FBX已创建Group包装层，统一层级结构', {
            newRootType: root.type,
            newRootName: root.name,
            childrenCount: root.children.length,
            newRootPosition: root.position,
            firstChildPosition: root.children[0]?.position,
            childrenNames: root.children.map(c => c.name || c.type).slice(0, 3)
          });
          
          // 验证Group层确实存在
          console.log('🔍 验证Group层结构:', {
            rootIsGroup: root.type === 'Group',
            rootHasUserData: !!(root as any).userData?.isFBXWrapper,
            rootChildren: root.children.length,
            rootName: root.name
          });
        }
      }

      // 继续剥离仅作为包裹的空容器（Group/Object3D 且仅一个子节点），并将父变换烘焙到子节点
      // 🔧 但是要保护FBX创建的包装层，不应该被剥离
      const isTrivialContainer = (o: THREE.Object3D) => {
        // 如果是FBX创建的包装层，不应该被剥离
        if ((o as any).userData?.isFBXWrapper) {
          return false;
        }
        const hasMesh = (o as any).isMesh || (o as any).geometry || (o as any).material;
        return !hasMesh && (o.type === 'Group' || o.type === 'Object3D') && (o.children?.length === 1);
      };
      let guard = 0; // 防止无限循环
      while (isTrivialContainer(root) && guard++ < 8) {
        const child = root.children[0];
        // 将父的本地变换应用到子节点
        child.applyMatrix4(root.matrix);
        child.updateMatrixWorld(true);
        // 提升子节点为新的根
        root = child;
      }

      // 检查并修复材质问题
      root.traverse((child) => {
        if ((child as any).isMesh) {
          const mesh = child as THREE.Mesh;
          try {
            if (!mesh.material) {
              // 如果材质为null，创建默认材质
              mesh.material = new THREE.MeshBasicMaterial({ color: 0x888888 });
            } else if (Array.isArray(mesh.material)) {
              // 如果是数组材质，过滤掉null值
              const validMaterials = mesh.material.filter(mat => mat != null);
              if (validMaterials.length === 0) {
                // 如果没有有效材质，创建一个默认材质
                mesh.material = new THREE.MeshBasicMaterial({ color: 0x888888 });
              } else {
                mesh.material = validMaterials;
              }
            }
            // 检查材质的shader相关属性
            if (mesh.material && !Array.isArray(mesh.material)) {
              const mat = mesh.material as any;
              if (mat.uniforms) {
                Object.keys(mat.uniforms).forEach(key => {
                  if (mat.uniforms[key] && mat.uniforms[key].value === null) {
                    console.warn(`修复材质 ${key} 的null值`);
                    mat.uniforms[key].value = '';
                  }
                });
              }
            }
          } catch (err) {
            console.warn('修复材质时出错:', err);
            // 创建安全的默认材质
            mesh.material = new THREE.MeshBasicMaterial({ color: 0x888888 });
          }
        }
      });

      modelRootRef.current = root;
      scene.add(root);
      setModelName(root.name || '模型');

      // 生成结构树
      const nodes: TreeNode[] = [];
      const map = keyToObject.current;
      function makeNode(obj: THREE.Object3D): TreeNode {
        const key = obj.uuid;
        map.set(key, obj);
        // 对于Group类型，确保名称明确
        let title = obj.name || obj.type || key.slice(0, 8);
        if (obj.type === 'Group' && (obj as any).userData?.isFBXWrapper) {
          // FBX包装层，确保名称可见
          if (!obj.name || obj.name === '模型') {
            title = obj.children[0]?.name ? `Group(${obj.children[0].name})` : 'Group(模型根节点)';
          }
        }
        return { title, key, children: obj.children?.map(makeNode) };
      }
      nodes.push(makeNode(root));
      setTreeData(nodes);
      
      // 调试：验证树结构
      console.log('🔍 树结构已更新:', {
        rootNodeTitle: nodes[0]?.title,
        rootNodeType: root.type,
        rootNodeChildrenCount: nodes[0]?.children?.length,
        firstChildTitle: nodes[0]?.children?.[0]?.title
      });

      focusObject(root);
      
      // 检查背景球体状态（模型加载后）
      const backgroundSphereAfterLoad = scene.getObjectByName('__background_sphere__') as THREE.Mesh | undefined;
      if (backgroundSphereAfterLoad) {
        const camera = cameraRef.current;
        if (camera) {
          const sphereRadius = (backgroundSphereAfterLoad.geometry as THREE.SphereGeometry).parameters.radius;
          const cameraDistance = camera.position.length();
          console.log(`✅ 模型加载完成，背景球体状态检查:`, {
            球体存在: true,
            球体半径: sphereRadius.toFixed(2),
            相机距离: cameraDistance.toFixed(2),
            相机Far: camera.far.toFixed(2),
            相机在球内: sphereRadius > cameraDistance ? '✅' : '❌',
            球体在Far内: sphereRadius < camera.far ? '✅' : '❌'
          });
        }
      } else {
        console.warn('⚠️ 模型加载完成，但背景球体不存在！');
      }
      
      message.destroy(); // 关闭加载消息
      message.success('模型已加载');
      // 若存在待恢复的标注，模型加载完成后尝试按路径绑定
      if (pendingImportRef.current) {
        tryRestoreFromPending();
      }
    } catch (e: any) {
      console.error(e);
      message.destroy(); // 关闭加载消息
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function tryRestoreFromPending() {
    const pending = pendingImportRef.current;
    if (!pending) return;
    try {
      // 首先恢复模型结构（重命名、可见性、删除等）
      if (pending.modelStructure) {
        const structure = pending.modelStructure;
        
        // 处理新格式（包含objects和deletedUUIDs）
        if (structure.objects && Array.isArray(structure.objects)) {
          console.log('开始恢复模型结构，共', structure.objects.length, '个对象,', 
                     (structure.deletedUUIDs || []).length, '个已删除对象');
        
        // 第一步：建立UUID到对象的映射
        const uuidToObject = new Map<string, THREE.Object3D>();
        const traverseForMapping = (obj: THREE.Object3D) => {
          uuidToObject.set(obj.uuid, obj);
          obj.children.forEach(traverseForMapping);
        };
        if (modelRootRef.current) traverseForMapping(modelRootRef.current);
        
          // 第二步：删除应该被删除的对象
          if (structure.deletedUUIDs && Array.isArray(structure.deletedUUIDs)) {
            console.log('需要删除的UUID列表:', structure.deletedUUIDs);
            const toDelete = [];
            
            // 通过路径查找需要删除的对象（因为UUID在重新加载后会变化）
            console.log('当前保存的对象数据:', structure.objects.length, '条');
            
            for (const item of structure.objects) {
              if (structure.deletedUUIDs.includes(item.uuid)) {
                console.log('找到需要删除的对象记录:', {
                  旧UUID: item.uuid,
                  路径: item.path,
                  名称: item.name
                });
                
                // 这个对象应该被删除，通过路径查找
                const obj = findByFlexiblePath(item.path || []);
                if (obj && obj !== modelRootRef.current) {
                  toDelete.push(obj);
                  console.log('✅ 通过路径找到待删除对象:', obj.name, '新UUID:', obj.uuid, '路径:', item.path);
                } else {
                  console.log('❌ 路径查找失败，找不到对象:', {
                    路径: item.path,
                    查找结果: obj ? '找到但是根对象' : '未找到'
                  });
                }
              }
            }
            
            // 执行删除
            toDelete.forEach(obj => {
              if (obj.parent) {
                obj.parent.remove(obj);
                console.log('恢复时删除对象:', obj.name, '新UUID:', obj.uuid);
              }
            });
            
            if (toDelete.length > 0) {
              console.log('恢复时删除了', toDelete.length, '个对象');
              console.log('删除记录更新前:', Array.from(deletedObjectsRef.current));
            }
            
            // 更新删除记录：记录新删除对象的新UUID
            console.log('从数据恢复删除记录（旧UUID）:', structure.deletedUUIDs);
            deletedObjectsRef.current.clear(); // 先清空
            
            // 记录刚删除对象的新UUID
            toDelete.forEach(obj => {
              deletedObjectsRef.current.add(obj.uuid);
              console.log('记录删除对象的新UUID:', obj.uuid);
            });
            
            console.log('删除记录更新后（新UUID）:', Array.from(deletedObjectsRef.current));
            
            // 重新构建对象映射
            if (toDelete.length > 0) {
              uuidToObject.clear();
              keyToObject.current.clear(); // 也清理全局映射
              const rebuildMapping = (obj: THREE.Object3D) => {
                uuidToObject.set(obj.uuid, obj);
                keyToObject.current.set(obj.uuid, obj); // 同时更新全局映射
                obj.children.forEach(rebuildMapping);
              };
              if (modelRootRef.current) rebuildMapping(modelRootRef.current);
            }
          }
          
          // 第三步：恢复剩余对象的属性（名称、可见性）
          structure.objects.forEach((item: any) => {
            const obj = uuidToObject.get(item.uuid) || findByFlexiblePath(item.path || []);
            if (obj && item.name !== undefined) {
              obj.name = item.name;
              if (item.visible !== undefined) obj.visible = item.visible;
            }
          });
          
        } else if (Array.isArray(structure)) {
          // 兼容旧格式
          console.log('恢复旧格式模型结构，共', structure.length, '个节点');
          structure.forEach((item: any) => {
            const obj = findByFlexiblePath(item.path || []);
            if (obj && item.name !== undefined) {
              obj.name = item.name;
              if (item.visible !== undefined) obj.visible = item.visible;
            }
          });
        }
        
        // 重建树结构
        rebuildTree();
        
        // 详细调试信息
        const currentNodeCount = Array.from(keyToObject.current.keys()).length;
        const sceneNodeCount = modelRootRef.current ? countSceneNodes(modelRootRef.current) : 0;
        console.log('模型结构恢复完成');
        console.log('- keyToObject映射节点数:', currentNodeCount);
        console.log('- 实际场景节点数:', sceneNodeCount);
        console.log('- 删除记录数:', deletedObjectsRef.current.size);
        
        // 强制触发UI刷新
        setPrsTick(prev => prev + 1);
      }
      
      const restored: Annotation[] = [];
      (pending.annotations || []).forEach((x: any) => {
        // 支持新的数据格式 (nodeKey + position)
        const nodeKey = x.nodeKey || x?.target?.namePath || x?.target?.path || '';
        const target = findByFlexiblePath(nodeKey);
        if (!target) return;
        
        // 支持新的position格式 {x, y, z}
        let offset = [0, 0, 0];
        if (x.position) {
          offset = [x.position.x || 0, x.position.y || 0, x.position.z || 0];
        } else if (x?.anchor?.offset) {
          offset = x.anchor.offset;
        }
        
        const labelOffsetArr = (x.labelOffset && typeof x.labelOffset === 'object')
          ? [Number(x.labelOffset.x||0), Number(x.labelOffset.y||0), Number(x.labelOffset.z||0)]
          : (Array.isArray(x?.label?.offset) ? x.label.offset : undefined);
        const labelOffsetSpace = (x as any).labelOffsetSpace || x?.label?.offsetSpace || 'local';
        
        // 调试：记录恢复时的偏移量信息
        if (labelOffsetArr) {
          console.log(`[Annotation/Restore] ${x.title}: offset=${JSON.stringify(labelOffsetArr)}, space=${labelOffsetSpace}`);
        }
        restored.push({
          id: String(x.id || generateUuid()),
          targetKey: target.uuid,
          targetPath: buildPath(target),
          anchor: { space: 'local', offset: [Number(offset[0]), Number(offset[1]), Number(offset[2])] },
          label: { 
            title: String(x.title || x?.label?.title || target.name || '未命名'), 
            summary: String(x.description || x?.label?.summary || ''),
            ...(labelOffsetArr ? { offset: [Number(labelOffsetArr[0]), Number(labelOffsetArr[1]), Number(labelOffsetArr[2])], offsetSpace: labelOffsetSpace } : {})
          }
        });
      });
      setAnnotations(restored);
      
      // 🎬 处理动画数据恢复 - 但如果已经从GLB加载则跳过
      if (pending.allAnimations && Array.isArray(pending.allAnimations) && !pending.animationMetadata) {
        console.log('开始恢复传统格式动画数据，共', pending.allAnimations.length, '个动画');
        
        // 恢复所有动画的时间线，重新映射UUID
        const restoredClips: Clip[] = pending.allAnimations.map((anim: any) => {
          const tl = anim.timeline;
          if (!tl) return anim;
          
          // 转换 visTracks：路径 -> 新UUID
          const visTracks: Record<string, VisibilityKeyframe[]> = {};
          if (Array.isArray(tl.visTracks)) {
            tl.visTracks.forEach((track: any) => {
              if (track.nodeKey && Array.isArray(track.keys)) {
                const target = findByFlexiblePath(track.nodeKey);
                if (target) {
                  visTracks[target.uuid] = track.keys.map((k: any) => ({
                    time: k.time,
                    value: k.visible
                  }));
                }
              }
            });
          } else if (tl.visTracks && typeof tl.visTracks === 'object') {
            // 🔥 处理新格式：对象路径 -> keyframes的对象
            console.log(`  📋 处理新格式显隐轨道: ${Object.keys(tl.visTracks).length}个轨道`);
            
            Object.entries(tl.visTracks).forEach(([pathOrUuid, keys]) => {
              let targetObject: THREE.Object3D | null = null;
              
              // 首先尝试作为UUID查找
              if (keyToObject.current.has(pathOrUuid)) {
                targetObject = keyToObject.current.get(pathOrUuid) || null;
                console.log(`    [UUID匹配] ${pathOrUuid} → 找到对象`);
              } else {
                // 作为对象路径查找
                keyToObject.current.forEach((obj, uuid) => {
                  const objPath = buildNamePath(obj) || obj.name;
                  if (objPath === pathOrUuid || obj.name === pathOrUuid) {
                    targetObject = obj;
                    console.log(`    [路径匹配] ${pathOrUuid} → ${obj.name} (${uuid.slice(0,8)})`);
                  }
                });
                
                // 如果还没找到，尝试灵活路径匹配
                if (!targetObject) {
                  targetObject = findByFlexiblePath(pathOrUuid) || null;
                  if (targetObject) {
                    console.log(`    [灵活匹配] ${pathOrUuid} → ${targetObject.name}`);
                  }
                }
              }
              
              if (targetObject) {
                visTracks[targetObject.uuid] = (keys as any[]).map((k: any) => ({
                  time: k.time,
                  value: k.visible !== undefined ? k.visible : k.value
                }));
                console.log(`    ✅ 恢复显隐轨道: ${pathOrUuid} → ${targetObject.name}, ${(keys as any[]).length}个关键帧`);
              } else {
                console.warn(`    ❌ 未找到对象: ${pathOrUuid}`);
              }
            });
          }

          // 转换 trsTracks：路径 -> 新UUID  
          const trsTracks: Record<string, TransformKeyframe[]> = {};
          if (Array.isArray(tl.trsTracks)) {
            tl.trsTracks.forEach((track: any) => {
              if (track.nodeKey && Array.isArray(track.keys)) {
                const target = findByFlexiblePath(track.nodeKey);
                if (target) {
                  trsTracks[target.uuid] = track.keys.map((k: any) => ({
                    time: k.time,
                    position: k.position,
                    rotationEuler: k.rotation,
                    scale: k.scale,
                    easing: k.easing || 'linear'
                  }));
                }
              }
            });
          } else if (tl.trsTracks && typeof tl.trsTracks === 'object') {
            // 🔥 处理新格式：对象路径 -> keyframes的对象
            console.log(`  📋 处理新格式变换轨道: ${Object.keys(tl.trsTracks).length}个轨道`);
            
            Object.entries(tl.trsTracks).forEach(([pathOrUuid, keys]) => {
              let targetObject: THREE.Object3D | null = null;
              
              // 首先尝试作为UUID查找
              if (keyToObject.current.has(pathOrUuid)) {
                targetObject = keyToObject.current.get(pathOrUuid) || null;
              } else {
                // 作为对象路径查找
                keyToObject.current.forEach((obj, uuid) => {
                  const objPath = buildNamePath(obj) || obj.name;
                  if (objPath === pathOrUuid || obj.name === pathOrUuid) {
                    targetObject = obj;
                  }
                });
                
                // 如果还没找到，尝试灵活路径匹配
                if (!targetObject) {
                  targetObject = findByFlexiblePath(pathOrUuid) || null;
                }
              }
              
              if (targetObject) {
                trsTracks[targetObject.uuid] = keys as TransformKeyframe[];
                console.log(`    ✅ 恢复变换轨道: ${pathOrUuid} → ${targetObject.name}, ${(keys as any[]).length}个关键帧`);
              } else {
                console.warn(`    ❌ 未找到对象: ${pathOrUuid}`);
              }
            });
          }

          return {
            ...anim,
            timeline: {
              ...tl,
              cameraKeys: Array.isArray(tl.cameraKeys) ? tl.cameraKeys : [],
              visTracks,
              trsTracks,
              annotationTracks: tl.annotationTracks || {}
            }
          };
        });
        
        // 更新clips
        setClips(restoredClips);
        console.log('动画数据恢复完成，共', restoredClips.length, '个动画');
        
        // 恢复活动动画和时间线
        const activeId = pending.activeAnimationId;
        if (activeId) {
          const activeClip = restoredClips.find(c => c.id === activeId);
          if (activeClip) {
            setActiveClipId(activeId);
            // 确保时间线数据的完整性
            const safeTimeline = {
              duration: activeClip.timeline.duration || 10,
              current: activeClip.timeline.current || 0,
              playing: activeClip.timeline.playing || false,
              cameraKeys: activeClip.timeline.cameraKeys || [],
              visTracks: activeClip.timeline.visTracks || {},
              trsTracks: activeClip.timeline.trsTracks || {},
              annotationTracks: activeClip.timeline.annotationTracks || {}
            };
            setTimeline(safeTimeline);
            console.log('恢复活动动画:', activeClip.name);
          }
        } else if (restoredClips.length > 0) {
          // 如果没有指定活动动画，使用第一个
          setActiveClipId(restoredClips[0].id);
                  const firstTimeline = restoredClips[0].timeline;
        // 确保时间线数据的完整性
        const safeTimeline = {
          duration: firstTimeline.duration || 10,
          current: firstTimeline.current || 0,
          playing: firstTimeline.playing || false,
          cameraKeys: firstTimeline.cameraKeys || [],
          visTracks: firstTimeline.visTracks || {},
          trsTracks: firstTimeline.trsTracks || {},
          annotationTracks: firstTimeline.annotationTracks || {}
        };
        setTimeline(safeTimeline);
        console.log('使用第一个动画:', restoredClips[0].name);
        }
      } else if (pending.timeline) {
        // 兼容旧的单时间线格式
        const tl = pending.timeline;
        
        // 转换 visTracks 和 trsTracks 格式，使用路径查找对象
        const visTracks: Record<string, VisibilityKeyframe[]> = {};
        if (Array.isArray(tl.visTracks)) {
          tl.visTracks.forEach((track: any) => {
            if (track.nodeKey && Array.isArray(track.keys)) {
              const target = findByFlexiblePath(track.nodeKey);
              if (target) {
                visTracks[target.uuid] = track.keys.map((k: any) => ({
                  time: k.time,
                  value: k.visible
                }));
              }
            }
          });
        }

        const trsTracks: Record<string, TransformKeyframe[]> = {};
        if (Array.isArray(tl.trsTracks)) {
          tl.trsTracks.forEach((track: any) => {
            if (track.nodeKey && Array.isArray(track.keys)) {
              const target = findByFlexiblePath(track.nodeKey);
              if (target) {
                trsTracks[target.uuid] = track.keys.map((k: any) => ({
                  time: k.time,
                  position: k.position,
                  rotationEuler: k.rotation,
                  scale: k.scale,
                  easing: k.easing || 'linear'
                }));
              }
            }
          });
        }

        setTimeline(prev => ({
          duration: tl.duration || 10,
          current: tl.current || 0,
          playing: tl.playing || false,
          cameraKeys: Array.isArray(tl.cameraKeys) ? tl.cameraKeys : [],
          visTracks,
          trsTracks,
          annotationTracks: tl.annotationTracks || {}
        }));
      }

      // 处理步骤数据
      if (pending.steps && Array.isArray(pending.steps)) {
        setSteps(pending.steps.map((s: any) => ({
          id: s.id,
          name: s.name,
          time: s.time
        })));
      }
      
      pendingImportRef.current = null;
      if (restored.length === 0) message.warning('已导入，但未找到匹配的节点（请确认模型一致或节点名称未变化）');
      else message.success(`已恢复 ${restored.length} 条标注和动画数据`);
    } catch (e:any) {
      message.error(e?.message || '恢复数据失败');
    }
  }

  function onPointerDown(event: PointerEvent) {
    const renderer = rendererRef.current!;
    const scene = sceneRef.current!;
    const camera = cameraRef.current!;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    
    console.log('onPointerDown触发，标注模式(ref):', isAnnotationPlacingRef.current, '目标对象:', placingAnnotationTargetRef.current?.name);
    
    // 记录初始位置，用于区分点击和拖拽
    const startX = event.clientX;
    const startY = event.clientY;
    let hasMoved = false;
    
    // 如果正在标注位置选择模式
    if (isAnnotationPlacingRef.current && placingAnnotationTargetRef.current) {
      const meshes: THREE.Object3D[] = [];
      // 只检测选中的目标对象及其子对象
      placingAnnotationTargetRef.current.traverse(o => { 
        const m = o as THREE.Mesh; 
        if (m.isMesh && m.geometry && m.visible) {
          meshes.push(m); 
        }
      });
      
      const hits = raycaster.intersectObjects(meshes, false);
      
      if (hits.length > 0) {
        const hit = hits[0];
        handleAnnotationPlacement(hit as any);
        return;
      } else {
        message.warning('请点击选中对象的表面');
        return;
      }
    }
    
    // 先检测标注点（非标注位置选择模式下）
    const markers = markersGroupRef.current;
    if (markers) {
      // 直接对整组递归拾取，避免因 children 为空或层级变化导致失效
      const markerHits = raycaster.intersectObjects([markers], true);
      if (markerHits.length > 0) {
        // 查找标注ID，可能在直接对象上或其父组上
        let annoId: string | undefined;
        let currentObj = markerHits[0].object;
        
        // 向上遍历找到标注ID
        while (currentObj && !annoId) {
          annoId = currentObj.userData?.annotationId;
          if (!annoId && currentObj.parent) {
            currentObj = currentObj.parent;
          } else {
            break;
          }
        }
        
        if (annoId) {
          const anno = annotations.find(a => a.id === annoId) || null;
          if (anno) {
            setEditingAnno(anno);
            const target = keyToObject.current.get(anno.targetKey);
            if (target) selectObject(target);
            return;
          }
        }
      }
    }
    // 若点击在 TransformControls 的 gizmo 上，不做射线选取，交给 gizmo 处理
    const tcontrols = tcontrolsRef.current;
    if (tcontrols && (tcontrols as any).dragging) return;
    
    // 直接进行一次网格拾取
    // 命中场景网格（标注或兜底）
    const meshes: THREE.Object3D[] = [];
    const root = modelRootRef.current;
    if (root) root.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh && (o as any).visible !== false) meshes.push(m); });
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      const obj = hits[0].object as THREE.Object3D;
      const add = event.ctrlKey || event.metaKey;
      selectObject(obj, add);
      return;
    }
    
    // 监听鼠标移动来区分点击和拖拽
    const onMove = (moveEvent: PointerEvent) => {
      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);
      // 如果移动超过5像素，认为是拖拽操作
      if (deltaX > 5 || deltaY > 5) {
        hasMoved = true;
      }
    };
    
    const onUp = () => {
      window.removeEventListener('pointermove', onMove as any);
      window.removeEventListener('pointerup', onUp);
      
      // 只有在纯点击（无拖拽）且不是Ctrl/Meta键（框选）的情况下才取消选择
      if (!hasMoved && !(event.ctrlKey || event.metaKey)) {
        // 点击空白：取消选中
        setSelectedKey(undefined);
        setSelectedSet(new Set());
        setSelectedCamKeyIdx(null);
        setSelectedTrs(null);
        setSelectedVis(null);
        const t = tcontrolsRef.current; if (t) { t.detach(); (t as any).visible = false; }
        const outline = outlineRef.current; if (outline) outline.selectedObjects = [];
        clearEmissiveHighlight();
        if (boxHelperRef.current) { const sc = sceneRef.current!; sc.remove(boxHelperRef.current); boxHelperRef.current = null; }
      }
    };
    
    window.addEventListener('pointermove', onMove as any);
    window.addEventListener('pointerup', onUp);
  }

  function syncHighlight() {
    const outline = outlineRef.current;
    const objs: THREE.Object3D[] = Array.from(selectedSet).map(k=> keyToObject.current.get(k)!).filter(Boolean);
    
    // 在高斯泼溅模式下强制使用自发光高亮，因为OutlinePass会严重影响性能
    const effectiveHighlightMode = (bgType === 'splat' && !bgTransparent) ? 'emissive' : highlightMode;
    
    if (outline && effectiveHighlightMode === 'outline') {
      outline.selectedObjects = objs;
      clearEmissiveHighlight();
    } else {
      if (outline) outline.selectedObjects = [];
      clearEmissiveHighlight();
      objs.forEach(o=> applyEmissiveHighlight(o));
    }
  }
  useEffect(()=>{ syncHighlight(); }, [selectedSet, highlightMode, bgType, bgTransparent]);

  function attachTransformForSelection(nextSet: Set<string>) {
    const tcontrols = tcontrolsRef.current;
    if (!tcontrols) return;
    if (mode === 'anim') {
      if (nextSet.size > 1) {
        // create or update pivot
        let pivot = multiPivotRef.current;
        if (!pivot) { pivot = new THREE.Object3D(); (pivot as any).name = 'multi_pivot'; (sceneRef.current as any)?.add(pivot); multiPivotRef.current = pivot; }
        // compute center of selected objects' bounding boxes
        const selObjs: THREE.Object3D[] = Array.from(nextSet).map(k=> keyToObject.current.get(k)!).filter(Boolean);
        const box = new THREE.Box3(); const tmp = new THREE.Box3();
        selObjs.forEach(o=>{ tmp.setFromObject(o); box.union(tmp); });
        const center = new THREE.Vector3(); box.getCenter(center);
        pivot.position.copy(center);
        pivot.rotation.set(0,0,0); // keep neutral rotation by default
        pivot.updateMatrixWorld(true);
        tcontrols.attach(pivot as any);
        tcontrols.setMode(gizmoMode);
        tcontrols.setSpace(gizmoSpace as any);
        (tcontrols as any).visible = true;
      } else if (nextSet.size === 1) {
        const only = keyToObject.current.get(Array.from(nextSet)[0]!)!;
        tcontrols.attach(only);
        tcontrols.setMode(gizmoMode);
        tcontrols.setSpace(gizmoSpace as any);
        (tcontrols as any).visible = true;
      } else {
        tcontrols.detach(); (tcontrols as any).visible = false;
      }
    } else {
      tcontrols.detach(); (tcontrols as any).visible = false;
    }
  }

  function selectObject(obj: THREE.Object3D, addToSelection: boolean = false) {
    const scene = sceneRef.current!;
    if (boxHelperRef.current) { scene.remove(boxHelperRef.current); boxHelperRef.current = null; }
    let nextSel: Set<string>;
    if (addToSelection) {
      nextSel = new Set(selectedSet);
      if (nextSel.has(obj.uuid)) nextSel.delete(obj.uuid);
      else nextSel.add(obj.uuid);
    } else {
      nextSel = new Set([obj.uuid]);
    }
    
    setSelectedKey(obj.uuid);
    setSelectedSet(nextSel);
    setSelectedCamKeyIdx(null);
    setSelectedTrs(null);
    setSelectedVis(null);
    attachTransformForSelection(nextSel);
    // outline highlight
    syncHighlight();
    setPrsTick(v=>v+1);
  }

  // --- 层级编辑工具 ---
  function rebuildTree() {
    const root = modelRootRef.current!;
    const nodes: TreeNode[] = [];
    const map = keyToObject.current; map.clear();
    const makeNode = (o: THREE.Object3D): TreeNode => {
      const k = o.uuid; map.set(k, o);
      // 首次建立映射时记录初始TRS与可见性
      if (!initialStateRef.current.has(k)) {
        initialStateRef.current.set(k, { pos: o.position.clone(), rot: o.rotation.clone(), scl: o.scale.clone(), visible: (o as any).visible !== false });
      }
      return { title: o.name || o.type || k.slice(0,8), key: k, children: o.children?.map(makeNode) };
    };
    nodes.push(makeNode(root));
    setTreeData(nodes);
  }

  // 复位：仅TRS与可见性，保持相机；并清空隔离效果
  const resetSceneToInitial = useCallback(() => {
    const map = initialStateRef.current;
    map.forEach((state, uuid) => {
      const obj = keyToObject.current.get(uuid);
      if (!obj) return;
      obj.position.copy(state.pos);
      obj.rotation.copy(state.rot as any);
      obj.scale.copy(state.scl);
      (obj as any).visible = state.visible;
      obj.updateMatrixWorld(true);
    });
    const root = modelRootRef.current;
    if (root) root.traverse(o => { if (map.has(o.uuid)) (o as any).visible = map.get(o.uuid)!.visible; });
    // 清理选中/高亮/隔离
    setSelectedKey(undefined);
    setSelectedSet(new Set());
    const t = tcontrolsRef.current; if (t) { t.detach(); (t as any).visible = false; }
    const outline = outlineRef.current; if (outline) outline.selectedObjects = [];
    clearEmissiveHighlight();
    if (boxHelperRef.current) { const sc = sceneRef.current!; sc.remove(boxHelperRef.current); boxHelperRef.current = null; }
    // 时间线停止并跳到0（不改相机）
    setTimeline(prev => ({ ...prev, playing: false, current: 0 }));
    applyTimelineAt(0);
    refreshMarkers();
  }, []);

  function groupNodes(nodeKeys: string[]) {
    const objs = nodeKeys.map(k => keyToObject.current.get(k)!).filter(Boolean);
    if (objs.length === 0) return;
    const parent = objs[0].parent as THREE.Object3D;
    const grp = new THREE.Group(); grp.name = `组${Math.floor(Math.random()*1000)}`; parent.add(grp); grp.updateMatrixWorld(true);
    objs.forEach(o => { const mw = o.matrixWorld.clone(); grp.add(o); o.updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(grp.matrixWorld).invert(); o.matrix.copy(inv.multiply(mw)); o.matrix.decompose(o.position, o.quaternion, o.scale); });
    rebuildTree();
    setSelectedSet(new Set([grp.uuid])); setSelectedKey(grp.uuid); syncHighlight(); setPrsTick(v=>v+1);
  }

  function ungroupNode(key: string) {
    const o = keyToObject.current.get(key); if (!o) return;
    if (!(o as any).isGroup) return;
    const parent = o.parent as THREE.Object3D; const kids = [...o.children];
    kids.forEach(k => { const mw = (k as any).matrixWorld.clone(); parent.add(k as any); (k as any).updateMatrixWorld(true); const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert(); (k as any).matrix.copy(inv.multiply(mw)); (k as any).matrix.decompose((k as any).position, (k as any).quaternion, (k as any).scale); });
    parent.remove(o);
    rebuildTree();
    setSelectedSet(new Set(kids.map(k => k.uuid))); setSelectedKey(kids[0]?.uuid); syncHighlight(); setPrsTick(v=>v+1);
  }

  function deleteNode(key: string) {
    const o = keyToObject.current.get(key); 
    if (!o) return; 
    if (o === modelRootRef.current) return;
    
    console.log('删除对象:', o.name, o.uuid);
    
    // 记录被删除的对象UUID
    deletedObjectsRef.current.add(o.uuid);
    
    const parent = o.parent as THREE.Object3D; 
    parent.remove(o);
    
    // 重建树结构（会自动清理并重建 keyToObject 映射）
    rebuildTree();
    
    // 清除选择状态
    setSelectedSet(new Set()); 
    setSelectedKey(undefined); 
    syncHighlight(); 
    setPrsTick(v=>v+1);
    
    console.log('对象删除完成，当前节点数:', Array.from(keyToObject.current.keys()).length);
  }

  function handleNodeAction(action: string, key: string) {
    if (action === 'rename') { const obj = keyToObject.current.get(key); if (!obj) return; setRenameOpen(true); renameForm.setFieldsValue({ name: obj.name || '' }); (window as any).__renameKey = key; return; }
    if (action === 'group') { const ids = selectedSet.size>0 ? Array.from(selectedSet) : [key]; groupNodes(ids); return; }
    if (action === 'ungroup') { ungroupNode(key); return; }
    if (action === 'delete') { deleteNode(key); return; }
  }

  // 更新高亮框位置（拖动时调用）
  function updateHighlightPosition() {
    if (!boxHelperRef.current || !sceneRef.current) return;
    
    // 如果是 BoxHelper，直接调用 update
    if (boxHelperRef.current instanceof THREE.BoxHelper) {
      boxHelperRef.current.update();
      return;
    }
    
    // 如果是 Group（边缘线），需要重新生成高亮
    // 获取当前选中的第一个对象
    const selIds = Array.from(selectedSetRef.current);
    if (selIds.length > 0) {
      const obj = keyToObject.current.get(selIds[0]);
      if (obj) {
        // 重新生成高亮
        applyEmissiveHighlight(obj);
      }
    }
  }

  // 清除边缘高亮
  function clearEmissiveHighlight() {
    if (boxHelperRef.current && sceneRef.current) {
      // 如果是 Group，需要遍历清理所有子对象
      if (boxHelperRef.current instanceof THREE.Group) {
        boxHelperRef.current.traverse((child) => {
          if ((child as any).geometry) (child as any).geometry.dispose();
          if ((child as any).material) (child as any).material.dispose();
        });
      } else {
        if ((boxHelperRef.current as any).geometry) (boxHelperRef.current as any).geometry.dispose();
        if ((boxHelperRef.current as any).material) (boxHelperRef.current as any).material.dispose();
      }
      sceneRef.current.remove(boxHelperRef.current);
      boxHelperRef.current = null;
    }
  }

  // 应用边缘线高亮（模型轮廓线，低性能消耗）
  function applyEmissiveHighlight(obj: THREE.Object3D) {
    clearEmissiveHighlight();
    if (!sceneRef.current) return;
    
    // 创建一个组来容纳所有边缘线
    const edgeGroup = new THREE.Group();
    edgeGroup.name = '__highlight_edges__';
    
    let totalEdgeVertices = 0;
    
    // 遍历对象，为每个 Mesh 创建边缘线
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        // 创建边缘几何体（只显示硬边缘，角度阈值15度，更敏感）
        const edgesGeometry = new THREE.EdgesGeometry(child.geometry, 15);
        const vertexCount = edgesGeometry.attributes.position?.count || 0;
        totalEdgeVertices += vertexCount;
        
        if (vertexCount > 0) {
          const edgesMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff6600, // 橙色
            linewidth: 2,
            transparent: true,
            opacity: 0.9
          });
          const edgeLines = new THREE.LineSegments(edgesGeometry, edgesMaterial);
          
          // 复制对象的世界变换矩阵
          child.updateWorldMatrix(true, false);
          edgeLines.applyMatrix4(child.matrixWorld);
          
          edgeGroup.add(edgeLines);
        }
      }
    });
    
    // 如果边缘线太少（比如球体等圆滑物体），使用 BoxHelper 作为后备
    if (totalEdgeVertices < 10) {
      // 清理空的 edgeGroup
      edgeGroup.traverse((child) => {
        if ((child as any).geometry) (child as any).geometry.dispose();
        if ((child as any).material) (child as any).material.dispose();
      });
      
      // 使用 BoxHelper 作为后备方案
      const boxHelper = new THREE.BoxHelper(obj, 0xff6600);
      boxHelper.name = '__highlight_box__';
      sceneRef.current.add(boxHelper);
      boxHelperRef.current = boxHelper;
      console.log('🔶 使用 BoxHelper 高亮（圆滑物体后备方案）');
    } else {
      sceneRef.current.add(edgeGroup);
      boxHelperRef.current = edgeGroup as any;
      console.log('🔶 使用边缘线高亮，边数:', totalEdgeVertices);
    }
  }

  function focusObject(obj: THREE.Object3D) {
    const camera = cameraRef.current!;
    const controls = controlsRef.current!;
    const scene = sceneRef.current;
    
    // 先检查是否存在背景球体
    const backgroundSphere = scene?.getObjectByName('__background_sphere__') as THREE.Mesh | undefined;
    const hasBackgroundSphere = backgroundSphere && backgroundSphere.geometry instanceof THREE.SphereGeometry;
    
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let dist = Math.abs(maxDim / Math.tan(fov / 2));
    dist = dist * 1.5;
    const dir = new THREE.Vector3(1, 0.8, 1).normalize();
    camera.position.copy(center.clone().add(dir.multiplyScalar(dist)));
    camera.near = Math.max(0.01, dist / 1000);
    
    // 如果存在背景球体，确保far值足够大以包含背景球体
    if (hasBackgroundSphere) {
      const cameraDistance = camera.position.length();
      // 计算背景球体所需的最小半径
      const minRadiusForCamera = cameraDistance * 1.5; // 确保相机在球体内，留50%余量
      const minRequiredFar = (minRadiusForCamera / 0.95) * 1.1; // 确保球体在far内，再留10%余量
      // 使用模型计算出的far值和背景球体所需far值中的较大者
      camera.far = Math.max(dist * 100, Math.max(minRequiredFar, 100000)); // 至少100000
      console.log(`🎯 模型聚焦时调整相机Far值以包含背景球体: ${camera.far.toFixed(2)} (模型所需: ${(dist * 100).toFixed(2)}, 背景球体所需: ${minRequiredFar.toFixed(2)})`);
    } else {
      camera.far = dist * 100;
    }
    
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
    
    // 如果存在背景球体，根据新的相机 far plane 和距离更新其尺寸
    if (hasBackgroundSphere && scene) {
      const oldRadius = (backgroundSphere.geometry as THREE.SphereGeometry).parameters.radius;
      const cameraDistance = camera.position.length();
      // 使用与创建时相同的计算逻辑
      const minRadiusForCamera = cameraDistance * 1.5; // 确保相机在球体内，留50%余量
      const maxRadiusForFar = camera.far * 0.95; // 确保球体在 far plane 内
      const newRadius = Math.max(10000, Math.max(minRadiusForCamera, maxRadiusForFar));
      // 只有当尺寸变化较大时才重新创建（避免频繁重建）
      if (Math.abs(oldRadius - newRadius) > 100) {
        const newGeometry = new THREE.SphereGeometry(newRadius, 64, 64);
        backgroundSphere.geometry.dispose();
        backgroundSphere.geometry = newGeometry;
        // 确保背景球体在原点
        backgroundSphere.position.set(0, 0, 0);
        // 确保渲染设置正确
        backgroundSphere.renderOrder = Infinity;
        backgroundSphere.frustumCulled = false;
        console.log(`🌐 背景球体尺寸已更新: ${oldRadius.toFixed(2)} -> ${newRadius.toFixed(2)} (相机距离: ${cameraDistance.toFixed(2)}, far: ${camera.far.toFixed(2)})`);
        
        // 强制重新渲染
        const r = rendererRef.current; const c = cameraRef.current; 
        if (r && c) { 
          const composer = composerRef.current; 
          if (composer) composer.render(); else r.render(scene, c); 
        }
      } else {
        console.log(`✅ 背景球体尺寸无需更新: ${oldRadius.toFixed(2)} (相机距离: ${cameraDistance.toFixed(2)}, far: ${camera.far.toFixed(2)})`);
      }
    }
  }

  const onTreeSelect = (keys: React.Key[], info: any) => {
    const key = info?.node?.key as string | undefined;
    if (!key) return;
    const add = !!info?.nativeEvent?.ctrlKey || !!info?.nativeEvent?.metaKey;
    const obj = keyToObject.current.get(key);
    if (obj) selectObject(obj, add);
  };

  const onFocusSelected = () => {
    if (!selectedKey) return;
    const obj = keyToObject.current.get(selectedKey);
    if (obj) focusObject(obj);
  };

  const onToggleHide = (key: string, hide: boolean) => {
    const obj = keyToObject.current.get(key);
    if (!obj) return;
    obj.visible = !hide;
    const next = new Set(hiddenKeys);
    if (hide) next.add(key); else next.delete(key);
    setHiddenKeys(next);
    // 强制刷新右侧显示开关的有效可见性
    setPrsTick(v=>v+1);
  };

  const onIsolateSelected = () => {
    const root = modelRootRef.current;
    if (!root || !selectedKey) return;
    const sel = keyToObject.current.get(selectedKey);
    if (!sel) return;
    const allowed = new Set<THREE.Object3D>();
    // 选中及其子孙
    sel.traverse(o => allowed.add(o));
    // 选中的祖先链
    let p: THREE.Object3D | null = sel;
    while (p) { allowed.add(p); p = p.parent as any; }
    root.traverse(o => {
      if (o === root) { (o as any).visible = true; return; }
      (o as any).visible = allowed.has(o);
    });
  };

  const onShowAll = () => {
    const root = modelRootRef.current;
    if (!root) return;
    root.traverse(o => { (o as any).visible = true; });
    setHiddenKeys(new Set());
  };

  function ensureMarkers() {
    const scene = sceneRef.current!;
    let group = markersGroupRef.current;
    if (!group) {
      group = new THREE.Group();
      group.name = 'annotation_markers';
      scene.add(group);
      markersGroupRef.current = group;
    }
    return group;
  }

  const refreshMarkers = useCallback(() => {
    const group = ensureMarkers();
    // 即使隐藏也重建一次，保证保存时能读取位置
    group.visible = showAnnotations;
    const camera = cameraRef.current;
    if (!camera) return;
    
    // clear
    while (group.children.length) {
      const c = group.children.pop()!;
      (c as any).geometry?.dispose?.();
      if ((c as any).material) {
        if (Array.isArray((c as any).material)) (c as any).material.forEach((m:any)=>m.dispose?.());
        else (c as any).material.dispose?.();
      }
    }
    
    // rebuild
    annotations.forEach(a => {
      const target = keyToObject.current.get(a.targetKey);
      if (!target) return;
      
      // 计算标注点的世界坐标（跟随父对象变换）
      const pos = new THREE.Vector3(a.anchor.offset[0], a.anchor.offset[1], a.anchor.offset[2]);
      target.updateWorldMatrix(true, true);
      const world = pos.clone().applyMatrix4(target.matrixWorld);
      
      // 创建标注组
      const annotationGroup = new THREE.Group();
      annotationGroup.userData.annotationId = a.id;
      annotationGroup.userData.targetKey = a.targetKey; // 便于查找
      
      // 1. 创建标注点（蓝色圆点）
      const pointGeom = new THREE.SphereGeometry(0.012, 16, 16);
      const pointMat = new THREE.MeshBasicMaterial({ 
        color: 0x1890ff,
        depthTest: true,
        transparent: true,
        opacity: 1.0
      });
      const pointMesh = new THREE.Mesh(pointGeom, pointMat);
      pointMesh.position.copy(world);
      pointMesh.renderOrder = 0;
      pointMesh.userData.annotationId = a.id; // 确保点击检测
      annotationGroup.add(pointMesh);
      
      // 2. 计算标签位置（使用保存的固定偏移量）
      let labelPos;
      if (a.label.offset) {
        // 根据偏移的坐标系生成世界位置
        if (a.label.offsetSpace === 'local') {
          const offsetLocal = new THREE.Vector3(a.label.offset[0], a.label.offset[1], a.label.offset[2]);
          // 将局部向量仅应用旋转到世界，忽略缩放，避免被非均匀缩放压扁
          const pos = new THREE.Vector3();
          const quat = new THREE.Quaternion();
          const scl = new THREE.Vector3();
          target.matrixWorld.decompose(pos, quat, scl);
          const offsetWorld = offsetLocal.clone().applyQuaternion(quat);
          labelPos = world.clone().add(offsetWorld);
        } else {
          // 旧数据：世界偏移
          labelPos = new THREE.Vector3(
            world.x + a.label.offset[0],
            world.y + a.label.offset[1], 
            world.z + a.label.offset[2]
          );
        }
      } else {
        // 对于没有偏移的旧标注，给一个固定的默认偏移（世界系）
        labelPos = new THREE.Vector3(
          world.x + 0.2,
          world.y + 0.1,
          world.z + 0.0
        );
        console.warn('标注缺少偏移信息，使用默认固定偏移:', a.id);
      }
      
      // 3. 创建连接线
      const lineGeom = new THREE.BufferGeometry().setFromPoints([world, labelPos]);
      const lineMat = new THREE.LineBasicMaterial({ 
        color: 0x1890ff,
        transparent: true,
        opacity: 0.8,
        depthTest: true
      });
      const line = new THREE.Line(lineGeom, lineMat);
      line.renderOrder = 0;
      line.userData.annotationId = a.id;
      annotationGroup.add(line);
      
      // 在组上记录标签世界位置，便于保存时兜底反推偏移
      (annotationGroup as any).userData.labelWorld = (labelPos as THREE.Vector3).clone();

      // 4. 创建改进的3D标签
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d')!;
      const fontSize = 32; // 增大字体
      const padding = 16; // 增大内边距
      const borderRadius = 8; // 圆角
      const text = a.label.title || '未命名';
      
      // 设置字体
      context.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      const textMetrics = context.measureText(text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;
      
      // 设置canvas大小
      canvas.width = textWidth + padding * 2;
      canvas.height = textHeight + padding * 2;
      
      // 重新设置字体（canvas resize后会丢失）
      context.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      
      // 绘制圆角背景
      const drawRoundedRect = (x: number, y: number, width: number, height: number, radius: number) => {
        context.beginPath();
        context.moveTo(x + radius, y);
        context.lineTo(x + width - radius, y);
        context.quadraticCurveTo(x + width, y, x + width, y + radius);
        context.lineTo(x + width, y + height - radius);
        context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        context.lineTo(x + radius, y + height);
        context.quadraticCurveTo(x, y + height, x, y + height - radius);
        context.lineTo(x, y + radius);
        context.quadraticCurveTo(x, y, x + radius, y);
        context.closePath();
      };
      
      // 半透明蓝色背景
      drawRoundedRect(0, 0, canvas.width, canvas.height, borderRadius);
      context.fillStyle = 'rgba(24, 144, 255, 0.85)';
      context.fill();
      
      // 白色边框
      context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      context.lineWidth = 2;
      context.stroke();
      
      // 绘制白色文字
      context.fillStyle = 'white';
      context.fillText(text, canvas.width / 2, canvas.height / 2);
      
      // 创建sprite（始终面向相机，但位置固定）
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      texture.anisotropy = 4;
      const spriteMat = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true,
        depthTest: true,
        depthWrite: false
      });
      const sprite = new THREE.Sprite(spriteMat);
      // 减少文字贴图阻挡拾取的概率：将拾取委托到父组
      sprite.userData.annotationId = a.id;
      const originalRaycast = (sprite as any).raycast;
      (sprite as any).raycast = function(raycaster: any, intersects: any[]) {
        // 仍保留最小的命中盒，避免完全失去拾取
        try { originalRaycast.call(this, raycaster, intersects); } catch {}
        // 同时将父组加入一个轻量的命中用于上层解析
        if (intersects && intersects.length === 0) {
          intersects.push({ object: annotationGroup, distance: 0, point: this.position.clone() });
        }
      };
      
      // 使用完全固定的位置（保存时的绝对位置）
      sprite.position.copy(labelPos);
      
      // 使用固定大小，不随距离变化
      const fixedScale = 0.002 * labelScale; // 固定基础缩放 * 用户设置
      sprite.scale.set(canvas.width * fixedScale, canvas.height * fixedScale, 1);
      
      sprite.renderOrder = 0;
      sprite.userData.annotationId = a.id;
      sprite.userData.clickable = true;
      annotationGroup.add(sprite);

      // 额外的不可见拾取代理，提升点击命中率
      const proxyGeom = new THREE.SphereGeometry(0.08, 8, 8);
      const proxyMat = new THREE.MeshBasicMaterial({ visible: false, transparent: true, opacity: 0 });
      const proxy = new THREE.Mesh(proxyGeom, proxyMat);
      proxy.position.copy(labelPos);
      proxy.userData.annotationId = a.id;
      annotationGroup.add(proxy);
      // 确保组本身也带有 id，任何子项命中都能向上找到它
      annotationGroup.userData.annotationId = a.id;
      
      group.add(annotationGroup);
    });
  }, [annotations, labelScale, showAnnotations]);

  useEffect(() => { refreshMarkers(); }, [refreshMarkers, selectedKey]);
  
  // 相机变化时更新标注位置
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    
    const handleCameraChange = () => {
      // 延迟更新避免过于频繁
      if ((handleCameraChange as any).timeout) {
        clearTimeout((handleCameraChange as any).timeout);
      }
      (handleCameraChange as any).timeout = setTimeout(() => {
        refreshMarkers();
      }, 100);
    };
    
    controls.addEventListener('change', handleCameraChange);
    return () => {
      controls.removeEventListener('change', handleCameraChange);
      if ((handleCameraChange as any).timeout) {
        clearTimeout((handleCameraChange as any).timeout);
      }
    };
  }, [refreshMarkers]);

  // 标注位置选择状态
  const [isAnnotationPlacing, setIsAnnotationPlacing] = useState(false);
  const [placingAnnotationTarget, setPlacingAnnotationTarget] = useState<THREE.Object3D | null>(null);
  const isAnnotationPlacingRef = useRef(false);
  const placingAnnotationTargetRef = useRef<THREE.Object3D | null>(null);

  const addAnnotationForSelected = () => {
    if (!selectedKey) {
      message.warning('请先选择一个对象');
      return;
    }
    const obj = keyToObject.current.get(selectedKey);
    if (!obj) {
      message.error('未找到选中的对象');
      return;
    }
    
    console.log('设置标注模式，对象:', obj.name, obj.uuid);
    
    // 进入标注位置选择模式
    setIsAnnotationPlacing(true);
    setPlacingAnnotationTarget(obj);
    isAnnotationPlacingRef.current = true;
    placingAnnotationTargetRef.current = obj;
    
    message.info('请点击对象表面选择标注位置');
    
    // 修改鼠标样式
    if (rendererRef.current?.domElement) {
      rendererRef.current.domElement.style.cursor = 'crosshair';
    }
    
    console.log('标注模式设置后(ref):', isAnnotationPlacingRef.current, placingAnnotationTargetRef.current?.name);
  };

  // 取消标注位置选择
  const cancelAnnotationPlacing = () => {
    setIsAnnotationPlacing(false);
    setPlacingAnnotationTarget(null);
    isAnnotationPlacingRef.current = false;
    placingAnnotationTargetRef.current = null;
    if (rendererRef.current?.domElement) {
      rendererRef.current.domElement.style.cursor = '';
    }
  };

  // 处理标注位置选择的点击
  const handleAnnotationPlacement = (intersection: any) => {
    if (!placingAnnotationTargetRef.current) return;
    const intersectionPoint: THREE.Vector3 = intersection.point?.clone?.() || intersection;
    const hitObject: THREE.Object3D = intersection.object || placingAnnotationTargetRef.current;
    
    // 检查击中的对象是否是目标对象或其子对象
    let isValidTarget = false;
    let currentObj: THREE.Object3D | null = hitObject;
    while (currentObj) {
      if (currentObj === placingAnnotationTargetRef.current) {
        isValidTarget = true;
        break;
      }
      currentObj = currentObj.parent;
    }
    
    if (!isValidTarget) {
      return;
    }
    
    // 将世界坐标转换为目标对象的本地坐标
    placingAnnotationTargetRef.current.updateWorldMatrix(true, true);
    const localPos = placingAnnotationTargetRef.current.worldToLocal(intersectionPoint.clone());
    const path = buildPath(placingAnnotationTargetRef.current);
    
    // 计算标签的固定偏移量（基于当前相机位置，保存为世界坐标偏移）
    const camera = cameraRef.current;
    let labelOffset: [number, number, number] = [0.2, 0.1, 0]; // 默认偏移（局部）
    let offsetSpace: 'local'|'world' = 'local';
    
    // 优先使用面法线，结合物体中心指向命中点的方向确保朝外
    try {
      const faceNormal = intersection.face?.normal as THREE.Vector3 | undefined;
      if (faceNormal) {
        // normal 是命中网格局部空间的，需要转成世界方向
        const normalWorld = faceNormal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix((intersection.object as any).matrixWorld)).normalize();
        // 由目标物体中心指向命中点，判定朝外方向
        const targetObj = placingAnnotationTargetRef.current;
        const bbox = new THREE.Box3().setFromObject(targetObj);
        const centerWorld = new THREE.Vector3();
        bbox.getCenter(centerWorld);
        const outwardWorld = intersectionPoint.clone().sub(centerWorld).normalize();
        const fixedWorld = (normalWorld.dot(outwardWorld) < 0) ? normalWorld.clone().multiplyScalar(-1) : normalWorld;
        // 将世界方向转为标注目标对象的局部方向
        const targetWorldQuat = new THREE.Quaternion();
        targetObj.getWorldQuaternion(targetWorldQuat);
        const localDir = fixedWorld.clone().applyQuaternion(targetWorldQuat.clone().invert()).normalize();
        const d = 0.22; // 标签距离
        labelOffset = [localDir.x * d, localDir.y * d, localDir.z * d];
        offsetSpace = 'local';
      } else if (camera) {
        // 兜底：沿相机方向
        const worldPos = intersectionPoint.clone();
        const cameraPos = camera.position.clone();
        const direction = cameraPos.clone().sub(worldPos).normalize();
        const labelDistance = 0.2;
        const targetObj = placingAnnotationTargetRef.current;
        const targetWorldQuat = new THREE.Quaternion();
        targetObj.getWorldQuaternion(targetWorldQuat);
        const localDir = direction.applyQuaternion(targetWorldQuat.clone().invert());
        labelOffset = [localDir.x * labelDistance, localDir.y * labelDistance, localDir.z * labelDistance];
        offsetSpace = 'local';
      }
    } catch {}
    
    // Debug: 打印锚点与偏移（局部与世界）
    try {
      const targetObj = placingAnnotationTargetRef.current;
      const anchorWorldDbg = localPos.clone().applyMatrix4(targetObj.matrixWorld);
      const pDbg = new THREE.Vector3(); const qDbg = new THREE.Quaternion(); const sDbg = new THREE.Vector3();
      targetObj.matrixWorld.decompose(pDbg, qDbg, sDbg);
      const offsetWorldDbg = new THREE.Vector3(labelOffset[0], labelOffset[1], labelOffset[2]).multiply(sDbg).applyQuaternion(qDbg);
      const labelWorldDbg = anchorWorldDbg.clone().add(offsetWorldDbg);
      console.log('[Annotation/Create] anchorLocal=', localPos.toArray(), 'anchorWorld=', anchorWorldDbg.toArray(), 'labelOffsetLocal=', labelOffset, 'labelWorld=', labelWorldDbg.toArray());
    } catch {}

    const anno: Annotation = {
      id: generateUuid(),
      targetKey: placingAnnotationTargetRef.current.uuid,
      targetPath: path,
      anchor: { space: 'local', offset: [localPos.x, localPos.y, localPos.z] },
      label: { 
        title: placingAnnotationTargetRef.current.name || '未命名', 
        summary: '',
        offset: labelOffset, // 保存固定的标签偏移量
        offsetSpace
      }
    };
    
    setAnnotations(prev => [...prev, anno]);
    setEditingAnno(anno);
    cancelAnnotationPlacing();
    message.success('标注点已创建');
  };

  // timeline actions
  const onTogglePlay = () => setTimeline(prev => { const playing = !prev.playing; if (playing) applyTimelineAt(prev.current); return { ...prev, playing }; });
  const onScrub = (val: number) => { 
    // 时间条拖动不进入撤销记录
    setTimeline(prev => ({ ...prev, current: val })); 
    applyTimelineAt(val); 
  };
  const onChangeDuration = (val: number | null) => setTimeline(prev => ({ ...prev, duration: Math.max(1, Number(val||10)) }));
  const addCameraKeyframe = () => {
    pushHistory();
    const camera = cameraRef.current!;
    const controls = controlsRef.current!;
    setTimeline(prev => ({
      ...prev,
      cameraKeys: [
        ...prev.cameraKeys,
        {
          time: prev.current,
          position: [camera.position.x, camera.position.y, camera.position.z] as [number, number, number],
          target: [controls.target.x, controls.target.y, controls.target.z] as [number, number, number],
          easing: cameraKeyEasing
        }
      ].sort((a,b)=>a.time-b.time)
    }));
  };
  const deleteCameraKey = (idx: number) => setTimeline(prev => ({ ...prev, cameraKeys: prev.cameraKeys.filter((_,i)=>i!==idx) }));
  const quickDeleteSelectedKeyframe = () => {
    // 相机关键帧优先
    if (selectedCamKeyIdx!=null) { setTimeline(prev=>({ ...prev, cameraKeys: prev.cameraKeys.filter((_,i)=>i!==selectedCamKeyIdx) })); setSelectedCamKeyIdx(null); return; }
    // TRS 关键帧
    if (selectedTrs) {
      const k = selectedTrs;
      setTimeline(prev=>{
        const tracks = { ...prev.trsTracks } as Record<string, TransformKeyframe[]>;
        const list = (tracks[k.key]||[]).slice();
        list.splice(k.index, 1);
        tracks[k.key] = list;
        return { ...prev, trsTracks: tracks };
      });
      setSelectedTrs(null);
    }
  };
  const bulkDeleteSelected = (): boolean => {
    const sel = selectionRef.current; const trackId = activeTrackIdRef.current;
    if (!sel || !trackId) return false;
    const start = Math.min(sel.start, sel.end);
    const end = Math.max(sel.start, sel.end);
    const inRange = (t:number)=> t>=start && t<=end;
    pushHistory();
    if (trackId === 'cam') {
      setTimeline(prev=>({ ...prev, cameraKeys: (prev.cameraKeys||[]).filter(k=>!inRange(k.time)) }));
      return true;
    }
    if (trackId.startsWith('vis:')) {
      const k = trackId.slice(4);
      setTimeline(prev=>{ const map={...prev.visTracks}; map[k]=(map[k]||[]).filter(v=>!inRange(v.time)); return { ...prev, visTracks: map }; });
      return true;
    }
    if (trackId.startsWith('trs:')) {
      const k = trackId.slice(4);
      setTimeline(prev=>{ const map={...prev.trsTracks}; map[k]=(map[k]||[]).filter(v=>!inRange(v.time)); return { ...prev, trsTracks: map }; });
      return true;
    }
    return false;
  };
  // --- 选择 / 复制粘贴 / 区间拉伸 ---
  const parseActiveTrack = (id: string | null): { kind: 'cam'|'vis'|'trs'; objKey?: string } | null => {
    if (!id) return null;
    if (id === 'cam') return { kind: 'cam' };
    if (id.startsWith('vis:')) return { kind: 'vis', objKey: id.slice(4) };
    if (id.startsWith('trs:')) return { kind: 'trs', objKey: id.slice(4) };
    return null;
  };
  const clearSelection = () => setSelection(null);
  const copySelection = () => {
    if (!selection) return message.warning('请先框选区间');
    const track = parseActiveTrack(activeTrackId);
    if (!track) return message.warning('请先点击一个轨道使其激活');
    const { start, end } = selection;
    const inRange = (t: number) => t >= Math.min(start, end) && t <= Math.max(start, end);
    if (track.kind === 'cam') {
      const list = (timeline.cameraKeys||[]).filter(k => inRange(k.time)).map(k => ({ ...k, time: k.time - Math.min(start,end) }));
      if (list.length === 0) return message.info('所选区间内没有相机关键帧');
      setClipboard({ anchor: 0, trackType: 'cam', keys: list });
      message.success(`已复制 ${list.length} 个相机关键帧`);
      return;
    }
    if (track.kind === 'vis' && track.objKey) {
      const src = timeline.visTracks[track.objKey] || [];
      const list = src.filter(k => inRange(k.time)).map(k => ({ ...k, time: k.time - Math.min(start,end) }));
      if (list.length === 0) return message.info('所选区间内没有显隐关键帧');
      setClipboard({ anchor: 0, trackType: 'vis', keys: list });
      message.success(`已复制 ${list.length} 个显隐关键帧`);
      return;
    }
    if (track.kind === 'trs' && track.objKey) {
      const src = timeline.trsTracks[track.objKey] || [];
      const list = src.filter(k => inRange(k.time)).map(k => ({ ...k, time: k.time - Math.min(start,end) }));
      if (list.length === 0) return message.info('所选区间内没有TRS关键帧');
      setClipboard({ anchor: 0, trackType: 'trs', keys: list });
      message.success(`已复制 ${list.length} 个TRS关键帧`);
      return;
    }
  };
  const pasteAtCurrent = () => {
    if (!clipboard) return message.warning('剪贴板为空');
    const track = parseActiveTrack(activeTrackId);
    if (!track) return message.warning('请先点击一个轨道使其激活');
    const current = timeline.current;
    const eps = 1e-3;
    const within = (t: number) => Math.max(0, Math.min(timeline.duration, t));
    pushHistory();
    if (clipboard.trackType === 'cam' && track.kind === 'cam') {
      const added = (clipboard.keys as CameraKeyframe[]).map(k => ({ ...k, time: within(current + k.time) }));
      setTimeline(prev => {
        const next = [...prev.cameraKeys];
        for (const k of added) {
          const i = next.findIndex(x => Math.abs(x.time - k.time) < eps);
          if (i >= 0) next[i] = { ...next[i], ...k } as CameraKeyframe; else next.push(k);
        }
        next.sort((a,b)=>a.time-b.time);
        return { ...prev, cameraKeys: next };
      });
      message.success(`已粘贴 ${added.length} 个相机关键帧`);
      return;
    }
    if (clipboard.trackType === 'vis' && track.kind === 'vis' && track.objKey) {
      const added = (clipboard.keys as VisibilityKeyframe[]).map(k => ({ ...k, time: within(current + k.time) }));
      setTimeline(prev => {
        const map = { ...prev.visTracks } as Record<string, VisibilityKeyframe[]>;
        const list = (map[track.objKey!] || []).slice();
        for (const k of added) {
          const i = list.findIndex(x => Math.abs(x.time - k.time) < eps);
          if (i >= 0) list[i] = { ...list[i], ...k }; else list.push(k);
        }
        map[track.objKey!] = list.sort((a,b)=>a.time-b.time);
        return { ...prev, visTracks: map };
      });
      message.success(`已粘贴 ${added.length} 个显隐关键帧`);
      return;
    }
    if (clipboard.trackType === 'trs' && track.kind === 'trs' && track.objKey) {
      const added = (clipboard.keys as TransformKeyframe[]).map(k => ({ ...k, time: within(current + k.time) }));
      setTimeline(prev => {
        const map = { ...prev.trsTracks } as Record<string, TransformKeyframe[]>;
        const list = (map[track.objKey!] || []).slice();
        for (const k of added) {
          const i = list.findIndex(x => Math.abs(x.time - k.time) < eps);
          if (i >= 0) list[i] = { ...list[i], ...k }; else list.push(k);
        }
        map[track.objKey!] = list.sort((a,b)=>a.time-b.time);
        return { ...prev, trsTracks: map };
      });
      message.success(`已粘贴 ${added.length} 个TRS关键帧`);
      return;
    }
    message.warning('轨道类型与剪贴板不匹配，无法粘贴');
  };
  const applyStretch = () => {
    if (!selection) return message.warning('请先框选区间');
    const track = parseActiveTrack(activeTrackId);
    if (!track) return message.warning('请先点击一个轨道使其激活');
    const factor = Number(stretchFactor||1);
    if (!(factor > 0)) return message.warning('倍率需大于 0');
    const start = Math.min(selection.start, selection.end);
    const end = Math.max(selection.start, selection.end);
    const scale = (t: number) => start + (t - start) * factor;
    pushHistory();
    if (track.kind === 'cam') {
      setTimeline(prev => {
        const next = prev.cameraKeys.map(k => (k.time >= start && k.time <= end) ? { ...k, time: scale(k.time) } : k).sort((a,b)=>a.time-b.time);
        return { ...prev, cameraKeys: next };
      });
    } else if (track.kind === 'vis' && track.objKey) {
      setTimeline(prev => {
        const map = { ...prev.visTracks } as Record<string, VisibilityKeyframe[]>;
        const list = (map[track.objKey!] || []).map(k => (k.time >= start && k.time <= end) ? { ...k, time: scale(k.time) } : k).sort((a,b)=>a.time-b.time);
        map[track.objKey!] = list;
        return { ...prev, visTracks: map };
      });
    } else if (track.kind === 'trs' && track.objKey) {
      setTimeline(prev => {
        const map = { ...prev.trsTracks } as Record<string, TransformKeyframe[]>;
        const list = (map[track.objKey!] || []).map(k => (k.time >= start && k.time <= end) ? { ...k, time: scale(k.time) } : k).sort((a,b)=>a.time-b.time);
        map[track.objKey!] = list;
        return { ...prev, trsTracks: map };
      });
    }
    setSelection({ start, end: start + (end - start) * factor });
    message.success('已应用区间拉伸');
  };
  const updateCameraKeyTime = (idx: number, time: number) => setTimeline(prev => {
    // 关键帧时间拖拽不进入撤销记录
    const keys = prev.cameraKeys.slice();
    const k = { ...keys[idx], time: Math.max(0, Math.min(prev.duration, Number(time)||0)) };
    keys[idx] = k;
    keys.sort((a,b)=>a.time-b.time);
    return { ...prev, cameraKeys: keys };
  });
  const ensureVisTrackForSelected = () => {
    if (!selectedKey) return;
    setTimeline(prev => ({ ...prev, visTracks: { ...prev.visTracks, [selectedKey]: prev.visTracks[selectedKey] || [] } }));
  };
  const addVisibilityKeyframeForSelected = () => {
    if (!selectedKey) return;
    const obj = keyToObject.current.get(selectedKey);
    if (!obj) return;
    ensureVisTrackForSelected();
    pushHistory();
    setTimeline(prev => {
      const track = prev.visTracks[selectedKey] || [];
      const nextTrack = [...track, { time: prev.current, value: obj.visible }].sort((a,b)=>a.time-b.time);
      console.log(`[Visibility/AddKey] 对象: ${obj.name || selectedKey.slice(0,8)}, 时间: ${prev.current}s, 可见性: ${obj.visible}, 轨道关键帧数: ${nextTrack.length}`);
      return { ...prev, visTracks: { ...prev.visTracks, [selectedKey]: nextTrack } };
    });
  };
  const setVisibilityAtCurrent = (key: string, visible: boolean) => {
    setTimeline(prev => {
      const list = (prev.visTracks[key] || []).slice();
      const eps = 1e-3; const i = list.findIndex(k => Math.abs(k.time - prev.current) < eps);
      const obj = keyToObject.current.get(key);
      const objName = obj?.name || key.slice(0,8);
      
      if (i < 0) {
        if (!autoKeyRef.current) {
          console.log(`[Visibility/SetCurrent] 跳过自动关键帧: ${objName}, 时间: ${prev.current}s, 目标可见性: ${visible}`);
          return prev;
        }
        const next = [...list, { time: prev.current, value: visible }].sort((a,b)=>a.time-b.time);
        console.log(`[Visibility/SetCurrent] 自动添加关键帧: ${objName}, 时间: ${prev.current}s, 可见性: ${visible}, 新轨道长度: ${next.length}`);
        return { ...prev, visTracks: { ...prev.visTracks, [key]: next } };
      }
      pushHistory();
      list[i] = { ...list[i], value: visible };
      console.log(`[Visibility/SetCurrent] 更新现有关键帧: ${objName}, 时间: ${prev.current}s, 可见性: ${visible}`);
      return { ...prev, visTracks: { ...prev.visTracks, [key]: list } };
    });
  };
  const setVisibilityAtCurrentForSelected = (visible: boolean) => { if (!selectedKey) return; setVisibilityAtCurrent(selectedKey, visible); };
  const ensureTrsTrackForSelected = () => {
    if (!selectedKey) return;
    setTimeline(prev => ({ ...prev, trsTracks: { ...prev.trsTracks, [selectedKey]: prev.trsTracks[selectedKey] || [] } }));
  };
  const writeBackTRSFromObject = (obj: THREE.Object3D) => {
    const key = obj.uuid;
    setTimeline(prev => {
      const tracks = { ...prev.trsTracks } as Record<string, TransformKeyframe[]>;
      const list = (tracks[key] || []).slice();
      const updateIndex = (() => {
        if (selectedTrs && selectedTrs.key === key) return selectedTrs.index;
        // 否则尝试找到与当前时间重合的关键帧
        const eps = 1e-3;
        const i = list.findIndex(k => Math.abs(k.time - prev.current) < eps);
        return i >= 0 ? i : -1;
      })();
      if (updateIndex < 0 || !list[updateIndex]) {
        if (!autoKeyRef.current) return prev;
        // 自动关键帧：若无当前帧，新增一帧
        const nextKey: TransformKeyframe = {
          time: prev.current,
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotationEuler: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
          easing: 'easeInOut'
        };
        const newList = [...list, nextKey].sort((a,b)=>a.time-b.time);
        return { ...prev, trsTracks: { ...prev.trsTracks, [key]: newList } };
      }
      const next: TransformKeyframe = {
        ...list[updateIndex],
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotationEuler: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z]
      };
      list[updateIndex] = next;
      tracks[key] = list;
      return { ...prev, trsTracks: tracks };
    });
  };
  const addTRSKeyForSelected = () => {
    if (!selectedKey) return;
    const obj = keyToObject.current.get(selectedKey);
    if (!obj) return;
    ensureTrsTrackForSelected();
    pushHistory();
    setTimeline(prev => {
      const track = prev.trsTracks[selectedKey] || [];
      const k: TransformKeyframe = {
        time: prev.current,
        position: [obj.position.x, obj.position.y, obj.position.z],
        rotationEuler: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        easing: cameraKeyEasing
      };
      const next = [...track, k].sort((a,b)=>a.time-b.time);
      return { ...prev, trsTracks: { ...prev.trsTracks, [selectedKey]: next } };
    });
  };
  const deleteTRSKey = (idx: number) => {
    if (!selectedKey) return;
    setTimeline(prev => {
      const track = prev.trsTracks[selectedKey] || [];
      const next = track.filter((_,i)=>i!==idx);
      return { ...prev, trsTracks: { ...prev.trsTracks, [selectedKey]: next } };
    });
  };
  const updateTRSKeyTime = (idx: number, time: number) => {
    if (!selectedKey) return;
    // 关键帧时间拖拽不进入撤销记录
    setTimeline(prev => {
      const track = (prev.trsTracks[selectedKey] || []).slice();
      if (!track[idx]) return prev;
      track[idx] = { ...track[idx], time: Math.max(0, Math.min(prev.duration, Number(time)||0)) };
      track.sort((a,b)=>a.time-b.time);
      return { ...prev, trsTracks: { ...prev.trsTracks, [selectedKey]: track } };
    });
  };
  const deleteVisibilityKey = (idx: number) => {
    if (!selectedKey) return;
    setTimeline(prev => {
      const track = prev.visTracks[selectedKey] || [];
      const next = track.filter((_,i)=>i!==idx);
      return { ...prev, visTracks: { ...prev.visTracks, [selectedKey]: next } };
    });
  };
  const updateVisibilityKeyTime = (idx: number, time: number) => {
    if (!selectedKey) return;
    setTimeline(prev => {
      const track = (prev.visTracks[selectedKey] || []).slice();
      if (!track[idx]) return prev;
      track[idx] = { ...track[idx], time: Math.max(0, Math.min(prev.duration, Number(time)||0)) };
      track.sort((a,b)=>a.time-b.time);
      return { ...prev, visTracks: { ...prev.visTracks, [selectedKey]: track } };
    });
  };
  const exportTimeline = () => {
    const data = { version: '1.1', duration: timeline.duration, cameraKeys: timeline.cameraKeys, visTracks: timeline.visTracks, trsTracks: timeline.trsTracks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'timeline.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  const importTimeline: UploadProps = {
    accept: '.json,application/json', showUploadList: false,
    beforeUpload: async (file) => { try { const text = await file.text(); const json = JSON.parse(text); setTimeline(prev => ({ ...prev, duration: Number(json?.duration||prev.duration), cameraKeys: Array.isArray(json?.cameraKeys)? (json.cameraKeys as CameraKeyframe[]) : prev.cameraKeys, visTracks: (json?.visTracks||prev.visTracks) as Record<string, VisibilityKeyframe[]>, trsTracks: (json?.trsTracks||prev.trsTracks) as Record<string, TransformKeyframe[]> })); message.success('时间线已导入'); } catch (e:any) { message.error(e?.message||'导入失败'); } return false; }
  };

  // 跟踪被删除的对象UUID
  const deletedObjectsRef = useRef<Set<string>>(new Set());
  
  // GLB导出器
  const exporterRef = useRef<GLTFExporter | null>(null);
  const lastUploadedFileIdRef = useRef<string | null>(null);
  const lastUploadedFilePathRef = useRef<string | null>(null);
  
  // GLTF动画相关
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const gltfActionsRef = useRef<THREE.AnimationAction[]>([]);
  
  // 动画导出相关
  const originalAnimationsRef = useRef<THREE.AnimationClip[]>([]);
  
  // 初始化导出器
  useEffect(() => {
    exporterRef.current = new GLTFExporter();
  }, []);
  
  // 🎬 将自定义动画转换为THREE.AnimationClip
  const convertTimelineToAnimationClip = (clip: Clip, rootObject: THREE.Object3D): THREE.AnimationClip | null => {
    try {
      const { timeline } = clip;
      const tracks: THREE.KeyframeTrack[] = [];
      
      console.log(`🎬 转换动画: ${clip.name}`);

      // 1. 处理变换轨道 (Transform Tracks)
      Object.entries(timeline.trsTracks || {}).forEach(([nodeUuid, keyframes]) => {
        const targetObject = keyToObject.current.get(nodeUuid);
        if (!targetObject || keyframes.length === 0) return;

        // 构建对象路径用于动画轨道命名
        const objectName = buildNamePath(targetObject) || targetObject.name || '';

        console.log(`  📍 处理对象: ${objectName} (${keyframes.length}个关键帧)`);

        // 按时间排序关键帧
        const sortedKeys = [...keyframes].sort((a, b) => a.time - b.time);

        // 分别处理位置、旋转、缩放
        const times = sortedKeys.map(k => k.time);
        
        // 位置轨道
        if (sortedKeys.some(k => k.position)) {
          const positions: number[] = [];
          sortedKeys.forEach(k => {
            if (k.position) {
              positions.push(k.position[0], k.position[1], k.position[2]);
            } else {
              // 使用当前位置作为默认值
              positions.push(targetObject.position.x, targetObject.position.y, targetObject.position.z);
            }
          });
          const positionTrack = new THREE.VectorKeyframeTrack(
            `${objectName}.position`,
            times,
            positions
          );
          tracks.push(positionTrack);
        }

        // 旋转轨道 (转换为四元数)
        if (sortedKeys.some(k => k.rotationEuler)) {
          const quaternions: number[] = [];
          sortedKeys.forEach(k => {
            if (k.rotationEuler) {
              const euler = new THREE.Euler(k.rotationEuler[0], k.rotationEuler[1], k.rotationEuler[2]);
              const quat = new THREE.Quaternion().setFromEuler(euler);
              quaternions.push(quat.x, quat.y, quat.z, quat.w);
            } else {
              // 使用当前旋转作为默认值
              quaternions.push(targetObject.quaternion.x, targetObject.quaternion.y, targetObject.quaternion.z, targetObject.quaternion.w);
            }
          });
          const rotationTrack = new THREE.QuaternionKeyframeTrack(
            `${objectName}.quaternion`,
            times,
            quaternions
          );
          tracks.push(rotationTrack);
        }

        // 缩放轨道
        if (sortedKeys.some(k => k.scale)) {
          const scales: number[] = [];
          sortedKeys.forEach(k => {
            if (k.scale) {
              scales.push(k.scale[0], k.scale[1], k.scale[2]);
            } else {
              // 使用当前缩放作为默认值
              scales.push(targetObject.scale.x, targetObject.scale.y, targetObject.scale.z);
            }
          });
          const scaleTrack = new THREE.VectorKeyframeTrack(
            `${objectName}.scale`,
            times,
            scales
          );
          tracks.push(scaleTrack);
        }
      });

      // 2. 处理可见性轨道 (Visibility Tracks)
      // 🔥 新策略：显隐数据已保存在JSON中，GLB中可选择性包含或跳过
      const includeVisibilityInGLB = false; // 设为false，因为Unity将从JSON读取显隐数据
      
      if (includeVisibilityInGLB) {
        Object.entries(timeline.visTracks || {}).forEach(([nodeUuid, keyframes]) => {
          const targetObject = keyToObject.current.get(nodeUuid);
          if (!targetObject || keyframes.length === 0) {
            console.log(`  ⚠️ 跳过可见性轨道: 对象不存在或无关键帧 (UUID: ${nodeUuid})`);
            return;
          }

          const objectName = buildNamePath(targetObject) || targetObject.name || targetObject.uuid.slice(0, 8);

          console.log(`  👁️ 处理可见性: ${objectName} (${keyframes.length}个关键帧)`);
          console.log(`    关键帧详情:`, keyframes.map(k => `${k.time}s: ${k.value ? '显示' : '隐藏'}`).join(', '));

          const sortedKeys = [...keyframes].sort((a, b) => a.time - b.time);
          const times = sortedKeys.map(k => k.time);

          // glTF 不支持 .visible 轨道。将可见性映射为缩放（仅在没有缩放关键帧时使用）。
          const hasScaleKeys = (timeline.trsTracks?.[nodeUuid] || []).some(k => !!k.scale);
          if (!hasScaleKeys) {
            const baseScale = targetObject.scale.clone(); // 克隆以避免修改原始数据
            const scales: number[] = [];
            sortedKeys.forEach(k => {
              if (k.value) {
                // 可见：使用对象原始缩放
                scales.push(baseScale.x, baseScale.y, baseScale.z);
              } else {
                // 不可见：缩放到极小值（避免0导致除0或阴影异常）
                const s = 1e-3;
                scales.push(s, s, s);
              }
            });
            const trackName = `${objectName}.scale`;
            const scaleTrackFromVisibility = new THREE.VectorKeyframeTrack(
              trackName,
              times,
              scales
            );
            tracks.push(scaleTrackFromVisibility);
            console.log(`    ✅ 已生成可见性→缩放轨道: ${trackName}, ${times.length}个时间点`);
          } else {
            console.log('  ⚠️ 该对象已有缩放关键帧，跳过可见性→缩放映射以避免冲突');
          }
        });
      } else {
        console.log(`  📋 跳过可见性轨道GLB导出 (${Object.keys(timeline.visTracks || {}).length}个轨道已保存在JSON中)`);
      }

      // 3. 创建AnimationClip
      if (tracks.length === 0) {
        console.warn(`动画 ${clip.name} 没有有效轨道`);
        return null;
      }

      const animationClip = new THREE.AnimationClip(
        clip.name,
        timeline.duration,
        tracks
      );

      console.log(`✅ 成功转换动画: ${clip.name}, 时长: ${timeline.duration}s, 轨道数: ${tracks.length}`);
      return animationClip;

    } catch (error) {
      console.error(`❌ 转换动画失败: ${clip.name}`, error);
      return null;
    }
  };

  // 🔄 从THREE.AnimationClip解析轨道数据为编辑器格式
  const parseAnimationClipToTracks = (clip: THREE.AnimationClip, rootObject: THREE.Object3D) => {
    const visTracks: Record<string, VisibilityKeyframe[]> = {};
    const trsTracks: Record<string, TransformKeyframe[]> = {};
    
    console.log(`  🔍 解析动画轨道: ${clip.name} (${clip.tracks.length}个轨道)`);
    
    clip.tracks.forEach(track => {
      const trackName = track.name;
      const times = track.times;
      const values = track.values;
      
      console.log(`    📊 轨道: ${trackName}, 类型: ${track.constructor.name}`);
      
      // 解析轨道名称，获取对象路径和属性
      const parts = trackName.split('.');
      const property = parts.pop(); // 最后一部分是属性
      const objectPath = parts.join('.'); // 前面是对象路径
      
      // 根据路径查找对象（使用名称路径匹配，避免UUID导致的不稳定）
      let targetObject: THREE.Object3D | null = null;
      rootObject.traverse((obj: THREE.Object3D) => {
        const namePath = buildNamePath(obj);
        if (namePath === objectPath || obj.name === objectPath) {
          targetObject = obj;
        }
      });
      
      if (!targetObject) {
        console.warn(`    ⚠️ 未找到目标对象: ${objectPath}`);
        return;
      }
      
      const targetUuid = (targetObject as THREE.Object3D).uuid;
      
      // 根据属性类型处理数据
      switch (property) {
        case 'visible':
          // 可见性轨道（从GLB中一般不会出现；若出现则解析为可见性布尔，供编辑器显示用）
          {
            const visKeys: VisibilityKeyframe[] = [];
            for (let i = 0; i < times.length; i++) {
              visKeys.push({
                time: times[i],
                value: (values as any)[i] > 0.5
              });
            }
            visTracks[targetUuid] = visKeys;
            console.log(`      👁️ 可见性关键帧: ${visKeys.length}个`);
            break;
          }
          
        case 'position':
          // 位置轨道
          if (!trsTracks[targetUuid]) trsTracks[targetUuid] = [];
          for (let i = 0; i < times.length; i++) {
            const existing = trsTracks[targetUuid].find(k => k.time === times[i]);
            if (existing) {
              existing.position = [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]];
            } else {
              trsTracks[targetUuid].push({
                time: times[i],
                position: [values[i * 3], values[i * 3 + 1], values[i * 3 + 2]]
              });
            }
          }
          console.log(`      📍 位置关键帧: ${times.length}个`);
          break;
          
        case 'quaternion':
          // 旋转轨道 (四元数转欧拉角)
          if (!trsTracks[targetUuid]) trsTracks[targetUuid] = [];
          for (let i = 0; i < times.length; i++) {
            const quat = new THREE.Quaternion(
              values[i * 4], values[i * 4 + 1], values[i * 4 + 2], values[i * 4 + 3]
            );
            const euler = new THREE.Euler().setFromQuaternion(quat);
            
            const existing = trsTracks[targetUuid].find(k => k.time === times[i]);
            if (existing) {
              existing.rotationEuler = [euler.x, euler.y, euler.z];
            } else {
              trsTracks[targetUuid].push({
                time: times[i],
                rotationEuler: [euler.x, euler.y, euler.z]
              });
            }
          }
          console.log(`      🔄 旋转关键帧: ${times.length}个`);
          break;
          
        case 'scale':
          // 缩放轨道（检测是否为可见性映射的缩放）
          if (!trsTracks[targetUuid]) trsTracks[targetUuid] = [];
          
          // 检测是否是可见性映射的缩放轨道（包含极小值）
          let isVisibilityTrack = false;
          const threshold = 1e-2; // 检测阈值
          const scaleValues: [number, number, number][] = [];
          
          for (let i = 0; i < times.length; i++) {
            const x = values[i * 3];
            const y = values[i * 3 + 1]; 
            const z = values[i * 3 + 2];
            scaleValues.push([x, y, z]);
            
            // 如果存在极小值，可能是可见性映射
            if (x < threshold && y < threshold && z < threshold) {
              isVisibilityTrack = true;
            }
          }
          
          if (isVisibilityTrack) {
            // 解析为可见性轨道
            const visKeys: VisibilityKeyframe[] = [];
            for (let i = 0; i < times.length; i++) {
              const [x, y, z] = scaleValues[i];
              const isVisible = x > threshold && y > threshold && z > threshold;
              visKeys.push({
                time: times[i],
                value: isVisible
              });
            }
            visTracks[targetUuid] = visKeys;
            console.log(`      👁️ 检测到可见性轨道（映射自缩放）: ${visKeys.length}个关键帧`);
          } else {
            // 正常的缩放轨道
            for (let i = 0; i < times.length; i++) {
              const existing = trsTracks[targetUuid].find(k => k.time === times[i]);
              if (existing) {
                existing.scale = scaleValues[i];
              } else {
                trsTracks[targetUuid].push({
                  time: times[i],
                  scale: scaleValues[i]
                });
              }
            }
            console.log(`      📏 缩放关键帧: ${times.length}个`);
          }
          break;
      }
    });
    
    // 对所有轨道按时间排序
    Object.values(trsTracks).forEach(track => {
      track.sort((a, b) => a.time - b.time);
    });
    Object.values(visTracks).forEach(track => {
      track.sort((a, b) => a.time - b.time);
    });
    
    console.log(`  ✅ 解析完成: ${Object.keys(visTracks).length}个可见性轨道, ${Object.keys(trsTracks).length}个变换轨道`);
    
    return { visTracks, trsTracks };
  };

  // 🔄 从GLB动画数据重建编辑器动画（显式接收rootObject，避免root为null）
  const loadAnimationsFromGLB = (gltfAnimations: THREE.AnimationClip[], animationMetadata: any[], rootObject: THREE.Object3D) => {
    console.log('🔄 从GLB重建动画数据...');
    console.log('📊 GLB动画列表:', gltfAnimations.map(c => c.name));
    console.log('📊 元数据列表:', animationMetadata.map((m: any) => m.name));
    
    const loadedClips: Clip[] = [];
    const matchedMetadataNames = new Set<string>(); // 追踪被名称匹配的元数据
    
    // 处理每个GLB动画
    gltfAnimations.forEach((clip, index) => {
      // 🔥 只通过名称匹配元数据，不再用索引回退（避免误匹配纯相机动画）
      const matchedMeta = animationMetadata.find((meta: any) => meta.name === clip.name);
      const metadata = matchedMeta || { id: generateUuid(), name: clip.name || `动画${index + 1}`, description: '', isOriginal: true };
      
      if (matchedMeta) {
        matchedMetadataNames.add(matchedMeta.name);
        console.log(`  📁 加载GLB动画: ${clip.name} (匹配到元数据)`);
      } else {
        console.log(`  📁 加载GLB动画: ${clip.name} (无匹配元数据，使用默认值)`);
      }
      
      // 解析动画轨道数据（使用传入的rootObject）
      const safeRoot = rootObject || modelRootRef.current;
      if (!safeRoot) {
        console.warn('  ⚠️ 解析动画时root未就绪，跳过该动画:', clip.name);
        return;
      }
      const { visTracks, trsTracks } = parseAnimationClipToTracks(clip, safeRoot);
      
      // 🔥 从JSON元数据中恢复显隐轨道（优先使用JSON数据）
      let finalVisTracks = visTracks; // 默认使用GLB解析的轨道
      let finalTrsTracks = trsTracks; // 默认使用GLB解析的轨道
      
      if (metadata.timeline) {
        console.log(`  📋 发现JSON轨道数据，优先使用JSON中的显隐轨道`);
        
        // 从JSON中恢复显隐轨道（支持新旧格式）
        if (metadata.timeline._unityFormat?.visibilityTracks || metadata.timeline.visTracks) {
          const jsonVisTracks: Record<string, VisibilityKeyframe[]> = {};
          
          // 优先使用Unity格式（对象路径映射）
          if (metadata.timeline._unityFormat?.visibilityTracks) {
            console.log(`    使用Unity格式显隐轨道`);
            Object.entries(metadata.timeline._unityFormat.visibilityTracks).forEach(([objectPath, keyframes]) => {
              let targetObject: THREE.Object3D | null = null;
              rootObject.traverse((obj) => {
                const objPath = buildNamePath(obj) || obj.name;
                if (objPath === objectPath || obj.name === objectPath) {
                  targetObject = obj;
                }
              });
              
              if (targetObject) {
                const obj = targetObject as THREE.Object3D;
                jsonVisTracks[obj.uuid] = (keyframes as any[]).map((k: any) => ({
                  time: k.time,
                  value: k.visible
                }));
                console.log(`    [Unity格式显隐轨道] ${objectPath} → ${obj.name}: ${(keyframes as any[]).length}个关键帧`);
              } else {
                console.warn(`    ⚠️ 未找到对象: ${objectPath}`);
              }
            });
          } 
          // 使用标准格式（数组）
          else if (metadata.timeline.visTracks && Array.isArray(metadata.timeline.visTracks)) {
            console.log(`    使用标准格式显隐轨道`);
            metadata.timeline.visTracks.forEach((track: any) => {
              let targetObject: THREE.Object3D | null = null;
              rootObject.traverse((obj) => {
                const objPath = buildNamePath(obj) || obj.name;
                if (objPath === track.nodeKey || obj.name === track.nodeKey) {
                  targetObject = obj;
                }
              });
              
              if (targetObject) {
                const obj = targetObject as THREE.Object3D;
                jsonVisTracks[obj.uuid] = track.keys.map((k: any) => ({
                  time: k.time,
                  value: k.visible
                }));
                console.log(`    [标准格式显隐轨道] ${track.nodeKey} → ${obj.name}: ${track.keys.length}个关键帧`);
              } else {
                console.warn(`    ⚠️ 未找到对象: ${track.nodeKey}`);
              }
            });
          }
          
          finalVisTracks = jsonVisTracks; // 使用JSON中的显隐轨道
        }
        
        // 🚫 不再从JSON恢复变换轨道 - TRS数据完全由GLB提供
        console.log(`    📋 TRS轨道将从GLB文件解析，不使用JSON数据`);
      }
      
      // 创建编辑器动画对象
      const editorClip: Clip = {
        id: metadata.id,
        name: metadata.name,
        description: metadata.description || '',
        timeline: {
          duration: clip.duration || metadata.duration || 10,
          current: 0,
          playing: false,
          cameraKeys: metadata.timeline?.cameraKeys || [],
          visTracks: finalVisTracks,
          trsTracks: finalTrsTracks,
          annotationTracks: {},
          // 标记动画类型
          gltfAnimation: {
            clip,
            mixer: null as any,
            isOriginal: metadata.isOriginal
          }
        },
        // 恢复步骤数据
        steps: metadata.steps || []
      } as any;
      
      loadedClips.push(editorClip);
    });
    
    // 🔥 处理不存在于GLB中的纯相机动画（用户自定义的动画）
    const loadedClipNames = new Set(loadedClips.map(c => c.name));
    const pureMetadataAnimations = animationMetadata.filter(meta => !loadedClipNames.has(meta.name));
    
    if (pureMetadataAnimations.length > 0) {
      console.log(`📷 发现${pureMetadataAnimations.length}个纯相机动画（不在GLB中）`);
      
      pureMetadataAnimations.forEach((metadata: any) => {
        console.log(`  📷 加载纯相机动画: ${metadata.name}`);
        
        // 创建纯相机动画的编辑器对象
        const pureClip: Clip = {
          id: metadata.id || generateUuid(),
          name: metadata.name || '未命名动画',
          description: metadata.description || '',
          timeline: {
            duration: metadata.timeline?.duration || metadata.duration || 10,
            current: 0,
            playing: false,
            cameraKeys: metadata.timeline?.cameraKeys || [],
            visTracks: {},
            trsTracks: {},
            annotationTracks: {}
          },
          steps: metadata.steps || []
        } as any;
        
        loadedClips.push(pureClip);
      });
    }
    
    // 如果GLB中有动画，保存原始动画供导出使用
    if (gltfAnimations.length > 0) {
      originalAnimationsRef.current = [...gltfAnimations];
    }
    
    console.log(`✅ 成功从GLB加载${loadedClips.length}个动画（含${pureMetadataAnimations.length}个纯相机动画）`);
    return loadedClips;
  };
  
  // 🚀 导出包含动画的完整GLB文件
  const exportCurrentModelAsGLB = async (): Promise<Blob | null> => {
    if (!modelRootRef.current || !exporterRef.current) {
      console.error('模型或导出器未初始化');
      return null;
    }
    
    try {
      console.log('🚀 开始导出包含动画的完整GLB文件...');
      
      // 1. 准备导出模型
      const source = modelRootRef.current;
      const s = new THREE.Scene();
      let exportRoot: THREE.Object3D = source.clone(true);
      
      // 简化层级结构
      const isTrivial = (o: THREE.Object3D) => {
        const hasMesh = (o as any).isMesh || (o as any).geometry || (o as any).material;
        return !hasMesh && (o.type === 'Group' || o.type === 'Object3D') && (o.children?.length === 1);
      };
      let pass = 0;
      while (isTrivial(exportRoot) && pass++ < 8) {
        exportRoot = exportRoot.children[0];
      }
      s.add(exportRoot);

      // 2. 🎬 准备动画数据
      const animationsToExport: THREE.AnimationClip[] = [];
      const exportedNames = new Set<string>(); // 防止重复导出同名动画
      
      // 先添加所有自定义动画（包括修改过的原始动画）
      const customAnimations = clips.filter(clip => 
        !clip.timeline.gltfAnimation || 
        !clip.timeline.gltfAnimation.isOriginal
      );
      console.log(`🎨 处理自定义动画: ${customAnimations.length}个`);
      console.log(`📊 动画分类详情:`, clips.map(c => ({
        name: c.name,
        hasGltfAnimation: !!c.timeline.gltfAnimation,
        isOriginal: c.timeline.gltfAnimation?.isOriginal,
        isCustom: !c.timeline.gltfAnimation || !c.timeline.gltfAnimation.isOriginal
      })));
      
      for (const clip of customAnimations) {
        console.log(`🔄 转换自定义动画: ${clip.name}`);
        console.log(`  可见性轨道数量: ${Object.keys(clip.timeline.visTracks || {}).length}`);
        console.log(`  变换轨道数量: ${Object.keys(clip.timeline.trsTracks || {}).length}`);
        
        const animationClip = convertTimelineToAnimationClip(clip, exportRoot);
        if (animationClip) {
          console.log(`  ✅ 成功转换，生成轨道数量: ${animationClip.tracks.length}`);
          animationsToExport.push(animationClip);
          exportedNames.add(animationClip.name); // 记录已导出的动画名称
        } else {
          console.log(`  ❌ 转换失败`);
        }
      }

      // 然后添加未被修改的原始GLB动画
      if (originalAnimationsRef.current.length > 0) {
        const originalToAdd = originalAnimationsRef.current.filter(orig => 
          !exportedNames.has(orig.name) // 只添加没有同名自定义版本的原始动画
        );
        console.log(`📁 添加未修改的原始动画: ${originalToAdd.length}/${originalAnimationsRef.current.length}个`);
        animationsToExport.push(...originalToAdd);
      }

      console.log(`📦 总计导出动画: ${animationsToExport.length}个`);
      
      // 详细显示每个动画的轨道信息
      animationsToExport.forEach((anim, i) => {
        console.log(`  [GLB导出动画 ${i+1}] ${anim.name}:`);
        console.log(`    轨道总数: ${anim.tracks.length}`);
        
        const tracksByType = {
          position: anim.tracks.filter(t => t.name.endsWith('.position')).length,
          rotation: anim.tracks.filter(t => t.name.endsWith('.quaternion')).length,
          scale: anim.tracks.filter(t => t.name.endsWith('.scale')).length,
        };
        
        console.log(`    位置轨道: ${tracksByType.position}, 旋转轨道: ${tracksByType.rotation}, 缩放轨道: ${tracksByType.scale}`);
        
        // 详细显示缩放轨道（可能包含可见性映射）
        const scaleTracks = anim.tracks.filter(t => t.name.endsWith('.scale'));
        scaleTracks.forEach(track => {
          const objectName = track.name.replace('.scale', '');
          const values = track.values as Float32Array;
          const hasSmallValues = Array.from(values).some(v => v < 0.01);
          console.log(`      缩放轨道 ${objectName}: ${track.times.length}个关键帧${hasSmallValues ? ' (可能为可见性映射)' : ''}`);
        });
      });

      // 3. 配置导出选项
      const exportOptions = {
        binary: true,
        animations: animationsToExport,
        // 确保包含动画数据
        includeCustomExtensions: true,
        // 优化选项
        truncateDrawRange: true,
        embedImages: true,
      };

      // 4. 执行导出
      const result = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporterRef.current!.parse(
          s, // 导出整个场景
          (gltf) => {
            if (gltf instanceof ArrayBuffer) {
              resolve(gltf);
            } else {
              reject(new Error('导出格式错误'));
            }
          },
          (error) => {
            console.error('GLTFExporter parse error:', error);
            reject(error);
          },
          exportOptions
        );
      });
      
      const blob = new Blob([result], { type: 'model/gltf-binary' });
      console.log(`✅ 完整GLB导出完成!`);
      console.log(`   📁 文件大小: ${(blob.size / 1024).toFixed(1)} KB`);
      console.log(`   🎬 动画数量: ${animationsToExport.length}`);
      console.log(`   📦 包含: 模型结构 + 所有动画数据`);
      
      return blob;
      
    } catch (error) {
      console.error('❌ GLB导出失败:', error);
      return null;
    }
  };
  
  // 🔍 检测是否需要重新导出GLB（结构变化或动画变化）
  const hasStructureChanges = (): boolean => {
    return deletedObjectsRef.current.size > 0; // 简化：主要检测删除操作
  };

  // 🎬 检测是否有动画变化需要重新导出GLB
  const hasAnimationChanges = (): boolean => {
    // 如果有自定义动画，需要导出
    const customAnimations = clips.filter(clip => 
      !clip.timeline.gltfAnimation || 
      !clip.timeline.gltfAnimation.isOriginal
    );
    return customAnimations.length > 0;
  };

  // 🎨 检测是否有材质变化需要重新导出GLB
  const hasMaterialChanges = (): boolean => {
    // 使用ref跟踪材质是否被用户修改
    return materialModifiedRef.current;
  };

  // 📦 检测是否需要重新导出完整GLB文件
  const needsGLBExport = (): boolean => {
    return hasStructureChanges() || hasAnimationChanges() || hasMaterialChanges();
  };
  
  // 构建模型结构信息（包含删除记录）
  const buildModelStructure = () => {
    const structure: any = {
      objects: [],
      deletedUUIDs: Array.from(deletedObjectsRef.current)
    };
    
    const root = modelRootRef.current;
    if (!root) return structure;
    
    const traverse = (obj: THREE.Object3D, parentPath: string[] = [], depth = 0) => {
      // 限制深度，避免过深的层级结构
      if (depth > 10) return;
      
      const currentPath = [...parentPath, obj.name || 'unnamed'];
      
      // 保存必要的信息
      structure.objects.push({
        path: currentPath,
        uuid: obj.uuid,
        name: obj.name,
        visible: obj.visible,
        type: obj.type
      });
      
      obj.children.forEach(child => traverse(child, currentPath, depth + 1));
    };
    
    traverse(root);
    console.log('模型结构数据:', {
      当前对象: structure.objects.length,
      已删除对象: structure.deletedUUIDs.length,
      '总计原始对象': structure.objects.length + structure.deletedUUIDs.length
    });
    console.log('删除记录详情:', Array.from(deletedObjectsRef.current));
    return structure;
  };

  // 保存课件到后端
  const saveCourseware = async () => {
    if (!coursewareId) {
      message.warning('没有课件ID，无法保存');
      return;
    }

    setSaving(true);
    try {
      // 确保标注几何存在，便于保存时反推偏移
      try { refreshMarkers(); } catch {}
      let modifiedModelUrl = null;
      
      // 🚀 如果模型结构或动画有变化，导出新的完整GLB文件
      if (modelRootRef.current && needsGLBExport()) {
        console.log('🚀 检测到变化，导出完整GLB文件...');
        console.log('   📁 结构变化:', hasStructureChanges());
        console.log('   🎬 动画变化:', hasAnimationChanges());
        console.log('   🎨 材质变化:', hasMaterialChanges());
        const glbBlob = await exportCurrentModelAsGLB();
        
        if (glbBlob) {
          // 上传新的GLB文件
          const formData = new FormData();
          formData.append('file', glbBlob, `courseware-${coursewareId}-modified.glb`);
          
          console.log('⬆️ 上传修改后的模型文件...');
          // 使用 getAPI_URL() 确保在公网环境下使用相对路径（避免混合内容错误）
          const baseUrl = getAPI_URL();
          const token = (typeof getToken === 'function' ? getToken() : localStorage.getItem('token')) as string | null;

          // 若存在旧文件，先删除，确保资源中只有一个当前版本
          try {
            const prev = (lastUploadedFilePathRef.current || coursewareData?.modifiedModelUrl || '') as string;
            
            if (prev) {
              // 先检查是否是相对路径格式（新格式）
              if (prev.startsWith('modifiedModels/')) {
                // 直接使用相对路径删除
                await fetch(`${baseUrl}/api/files/courseware-file?path=${encodeURIComponent(prev)}`, {
                  method: 'DELETE',
                  headers: token ? { Authorization: `Bearer ${token}` } : undefined
                });
              } else {
                // 检查是否是新格式的公网URL（包含modifiedModels路径）
                const publicUrlMatch = prev.match(/https:\/\/dl\.yf-xr\.com\/(.+)/);
                if (publicUrlMatch && publicUrlMatch[1].startsWith('modifiedModels/')) {
                  // 新格式：使用courseware-file删除接口
                  await fetch(`${baseUrl}/api/files/courseware-file?path=${encodeURIComponent(publicUrlMatch[1])}`, {
                    method: 'DELETE',
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined
                  });
                } else {
                  // 旧格式：尝试从File模型删除
                  const idMatch = prev.match(/\/api\/files\/([a-f0-9]{24})\//i);
                  const prevId = idMatch ? idMatch[1] : null;
                  if (prevId) {
                    await fetch(`${baseUrl}/api/files/${prevId}`, {
                      method: 'DELETE',
                      headers: token ? { Authorization: `Bearer ${token}` } : undefined
                    });
                  }
                }
              }
            }
          } catch (e) { console.warn('删除旧模型文件失败（忽略）：', e); }

          const uploadResponse = await fetch(`${baseUrl}/api/files/courseware-upload`, {
            method: 'POST',
            body: formData,
            headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
          });
          
          if (uploadResponse.ok) {
            const uploadResult = await uploadResponse.json();
            // 兼容后端返回的字段名（downloadUrl 或 url）
            modifiedModelUrl = uploadResult.downloadUrl || uploadResult.url;
            console.log('✅ 模型文件上传成功:', modifiedModelUrl);
            // 重置材质修改标记（导出成功后）
            materialModifiedRef.current = false;
            
            // 保存文件路径信息（用于删除）
            lastUploadedFilePathRef.current = modifiedModelUrl;
            if (uploadResult.path) {
              // 新格式：保存相对路径
              lastUploadedFilePathRef.current = uploadResult.path;
            } else {
              // 旧格式：尝试提取文件ID
              try {
                const m = String(modifiedModelUrl||'').match(/\/api\/files\/([a-f0-9]{24})\//i);
                lastUploadedFileIdRef.current = m ? m[1] : null;
              } catch {}
            }
          } else {
            console.error('❌ 模型文件上传失败');
            throw new Error('模型文件上传失败');
          }
        }
      }
      
      // 确保clips数据的完整性，同步当前激活动画的时间线和步骤数据
      const syncedClips = clips.map(c => {
        if (c && c.id && c.id === activeClipId) {
          // 🔥 同步当前时间线数据到活动动画中
          const currentTimeline = JSON.parse(JSON.stringify(timeline));
          console.log(`[课件保存] 同步活动动画 ${c.name} 的时间线数据:`);
          console.log(`  显隐轨道: ${Object.keys(currentTimeline.visTracks || {}).length}个`);
          console.log(`  变换轨道: ${Object.keys(currentTimeline.trsTracks || {}).length}个`);
          console.log(`  相机关键帧: ${(currentTimeline.cameraKeys || []).length}个`);
          
          return {
            ...c,
            timeline: currentTimeline,
            steps: JSON.parse(JSON.stringify(stepsRef.current || []))
          };
        }
        return c;
      });
      const validClips = syncedClips.filter(clip => clip && clip.id && clip.timeline);
      console.log('保存课件数据，clips数量:', validClips.length);
      console.log('保存数据预览:', {
        annotations: annotations.length,
        animations: validClips.length,
        modifiedModel: modifiedModelUrl ? '已更新' : '无变化'
      });
      
      // 构造保存数据
      const saveData = {
        annotations: annotations.map(a => {
          const obj = keyToObject.current.get(a.targetKey);
          const saveData: any = {
            id: a.id,
            nodeKey: obj ? buildPath(obj) : a.targetKey, // 保存路径而不是UUID
            title: a.label.title,
            description: a.label.summary || '',
            position: {
              x: a.anchor.offset[0],
              y: a.anchor.offset[1], 
              z: a.anchor.offset[2]
            }
          };
          
          // 保存标签偏移量（如果存在）
          if (a.label.offset) {
            saveData.labelOffset = {
              x: a.label.offset[0],
              y: a.label.offset[1],
              z: a.label.offset[2]
            };
            if (a.label.offsetSpace) {
              saveData.labelOffsetSpace = a.label.offsetSpace;
            }
          } else if (a.label && (a.label as any).offsetSpace) {
            // 兼容：若仅给出空间但无数组，仍写出空间字段
            saveData.labelOffsetSpace = (a.label as any).offsetSpace;
          }

          // 若运行时能从场景读到标签端点，则兜底补齐偏移
          if (!saveData.labelOffset) {
            const target = keyToObject.current.get(a.targetKey);
            const worldLabel = getAnnotationLabelWorldPosition(a.id);
            if (target) {
              target.updateWorldMatrix(true, true);
              const anchorWorld = new THREE.Vector3(a.anchor.offset[0], a.anchor.offset[1], a.anchor.offset[2]).applyMatrix4(target.matrixWorld);
              let offsetWorld: THREE.Vector3 | null = null;
              if (worldLabel) {
                offsetWorld = worldLabel.clone().sub(anchorWorld);
              } else if (cameraRef.current) {
                // 兜底：沿相机方向推一个固定距离
                const dir = cameraRef.current.position.clone().sub(anchorWorld).normalize();
                offsetWorld = dir.multiplyScalar(0.22);
              }
              if (offsetWorld) {
                const p = new THREE.Vector3(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
                target.matrixWorld.decompose(p, q, s);
                const local = offsetWorld.clone().applyQuaternion(q.clone().invert());
                local.divide(s);
                saveData.labelOffset = { x: local.x, y: local.y, z: local.z };
                saveData.labelOffsetSpace = 'local';
                console.log('[Annotation/Save-FillOffset]', a.id, { anchorWorld: anchorWorld.toArray(), labelWorld: worldLabel?.toArray?.(), offsetLocal: [local.x, local.y, local.z] });
              }
            }
          }

          // 兼容：在 label 内也冗余一份数组格式，便于观察与后端兼容
          if (saveData.labelOffset) {
            const lx = Number(saveData.labelOffset.x||0), ly = Number(saveData.labelOffset.y||0), lz = Number(saveData.labelOffset.z||0);
            (saveData as any).label = {
              title: a.label.title,
              summary: a.label.summary || '',
              offset: [lx, ly, lz],
              offsetSpace: saveData.labelOffsetSpace || 'local'
            };
            console.log('[Annotation/Save-Write]', a.id, { offset: [lx, ly, lz], offsetSpace: (saveData as any).label.offsetSpace });
          }
          
          return saveData;
        }),
        // 🎬 动画信息 - 包含完整轨道数据，特别是显隐轨道供Unity解析
        animations: validClips.map(clip => {
          const animData = {
            id: clip.id,
            name: clip.name,
            description: clip.description || '',
            isOriginal: !!clip.timeline.gltfAnimation?.isOriginal,
            duration: clip.timeline.duration,
            // 保存步骤信息
            steps: Array.isArray((clip as any).steps) ? (clip as any).steps.map((s:any)=>({ id: s.id, name: s.name, description: s.description ?? s.name, time: s.time })) : [],
            // 🎯 保存完整轨道数据到JSON，按后端Schema格式
            timeline: {
              duration: clip.timeline.duration,
              // 相机轨道
              cameraKeys: clip.timeline.cameraKeys || [],
              // 🔥 显隐轨道 - 转换为后端期望的数组格式
              visTracks: Object.entries(clip.timeline.visTracks || {}).map(([uuid, keyframes]) => {
                const obj = keyToObject.current.get(uuid);
                if (obj) {
                  const objectPath = buildNamePath(obj) || obj.name || uuid;
                  return {
                    nodeKey: objectPath,
                    keys: (keyframes as any[]).map((k: any) => ({
                      time: k.time,
                      visible: k.value,
                      easing: 'linear'
                    }))
                  };
                }
                return null;
              }).filter(Boolean),
              // 🚫 不保存TRS轨道 - 这些数据由GLB文件本身提供
              // trsTracks: [], // 注释掉，不上传TRS数据
              
              // 🎯 Unity专用格式 - 仅保存GLB无法存储的数据
              _unityFormat: {
                visibilityTracks: Object.entries(clip.timeline.visTracks || {}).reduce((acc, [uuid, keyframes]) => {
                  const obj = keyToObject.current.get(uuid);
                  if (obj) {
                    const objectPath = buildNamePath(obj) || obj.name || uuid;
                    acc[objectPath] = (keyframes as any[]).map((k: any) => ({
                      time: k.time,
                      visible: k.value,
                      _debug: { uuid, objectName: obj.name }
                    }));
                  }
                  return acc;
                }, {} as Record<string, any[]>)
                // transformTracks: {} // 注释掉，不保存TRS数据到JSON
              }
            }
          };
          
          // 调试信息
          const visCount = animData.timeline.visTracks.length;
          const cameraKeysCount = animData.timeline.cameraKeys.length;
          console.log(`[Animation/JSON保存] ${clip.name}: 显隐轨道${visCount}个, 相机关键帧${cameraKeysCount}个 (TRS轨道由GLB提供)`);
          
          // 详细显示显隐轨道内容
          if (visCount > 0) {
            console.log(`  显隐轨道详情:`);
            animData.timeline.visTracks.forEach((track: any) => {
              console.log(`    ${track.nodeKey}: ${track.keys.length}个关键帧 - ${track.keys.map((k:any) => `${k.time}s:${k.visible ? '显' : '隐'}`).join(' ')}`);
            });
          } else {
            console.warn(`  ⚠️ 动画 ${clip.name} 没有显隐轨道数据！`);
            console.log(`    原始时间线显隐轨道: ${Object.keys(clip.timeline.visTracks || {}).length}个`);
            Object.entries(clip.timeline.visTracks || {}).forEach(([uuid, keyframes]) => {
              const obj = keyToObject.current.get(uuid);
              console.log(`      ${uuid.slice(0,8)} (${obj?.name}): ${(keyframes as any[]).length}个关键帧`);
            });
          }
          
          return animData;
        }),
        settings: {
          cameraPosition: cameraRef.current ? {
            x: cameraRef.current.position.x,
            y: cameraRef.current.position.y,
            z: cameraRef.current.position.z
          } : undefined,
          cameraTarget: controlsRef.current ? {
            x: controlsRef.current.target.x,
            y: controlsRef.current.target.y,
            z: controlsRef.current.target.z
          } : undefined,
          background: bgColor,
          backgroundType: bgType,
          // 保存HDR环境光照路径（用于splat模式的环境光照）
          backgroundPanorama: bgType === 'splat' ? (bgPanorama || '/360background_7.hdr') : null,
          // 保存高斯泼溅模型路径和变换（如果bgType是splat）
          backgroundSplat: bgType === 'splat' ? (bgSplat || '/world/world_1') : null,
          splatTransform: bgType === 'splat' ? {
            position: splatPosition,
            rotation: splatRotation,
            scale: splatScale
          } : null,
          // 保存实际的亮度值
          backgroundPanoramaBrightness: bgPanoramaBrightness,
          // 保存实际的HDR环境设置
          useHDREnvironment: useHDREnvironment,
          lighting: {
            directional: dirLight,
            ambient: ambLight,
            hemisphere: hemiLight
          }
        },
        // 保存模型结构信息（重命名、可见性等）
        modelStructure: buildModelStructure(),
        // 如果有修改后的模型文件，保存其URL
        ...(modifiedModelUrl && { modifiedModelUrl })
      };
      
      console.log('最终保存数据大小:', JSON.stringify(saveData).length, '字符');

      // 最终序列化为纯JSON，确保调试可见且不受可枚举属性影响
      const payload = JSON.parse(JSON.stringify(saveData));
      // 再次兜底：若某条标注仍无偏移，直接附加数组格式（零向量）以便排查
      try {
        if (Array.isArray(payload.annotations)) {
          payload.annotations = payload.annotations.map((it:any)=>{
            if (!it.labelOffset && (!it.label || !Array.isArray(it.label.offset))) {
              it.label = it.label || { title: it.title, summary: it.description||'' };
              it.label.offset = [0,0,0];
              it.label.offsetSpace = it.label.offsetSpace || 'local';
            }
            return it;
          });
        }
      } catch {}
      // 额外的调试信息：检查最终payload中的标注偏移量
      if (payload.annotations && payload.annotations.length > 0) {
        console.log('[Courseware/Save-Payload] 标注偏移量检查:');
        payload.annotations.forEach((ann: any, i: number) => {
          console.log(`  [${i}] ${ann.title}: labelOffset=${JSON.stringify(ann.labelOffset)}, labelOffsetSpace=${ann.labelOffsetSpace}, label.offset=${JSON.stringify(ann.label?.offset)}`);
        });
      }
      console.log('[Courseware/Save-Payload]', payload);
      console.log('[Courseware/Save-Settings]', {
        backgroundType: payload.settings.backgroundType,
        backgroundPanorama: payload.settings.backgroundPanorama,
        backgroundPanoramaBrightness: payload.settings.backgroundPanoramaBrightness,
        useHDREnvironment: payload.settings.useHDREnvironment,
        currentState: {
          bgType,
          bgPanorama,
          bgPanoramaBrightness,
          useHDREnvironment
        }
      });
      await apiPut(`/api/coursewares/${coursewareId}`, payload);
      // 成功保存后，更新本地上一次上传记录
      try {
        if (modifiedModelUrl) {
          const m = String(modifiedModelUrl||'').match(/\/api\/files\/([a-f0-9]{24})\//i);
          lastUploadedFileIdRef.current = m ? m[1] : lastUploadedFileIdRef.current;
        }
      } catch {}
      setLastSaved(new Date());
      message.success('课件已保存');
    } catch (error: any) {
      console.error('Save courseware error:', error);
      message.error(error.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 保存设置到后端
  const saveSettings = async () => {
    if (!coursewareId) {
      message.warning('没有课件ID，无法保存设置');
      return;
    }

    console.log('💾 [Settings/Save-Start] 开始保存设置');
    console.log('💾 [Settings/Save-Start] 当前状态:', {
      bgType,
      bgPanorama,
      bgPanoramaBrightness,
      useHDREnvironment,
      dirLight,
      ambLight,
      hemiLight
    });

    setSaving(true);
    try {
      // 先获取当前的课件数据
      console.log('💾 [Settings/Save] 获取当前课件数据...');
      const currentCourseware = await apiGet<any>(`/api/coursewares/${coursewareId}`);
      console.log('💾 [Settings/Save] 当前课件数据获取成功:', {
        hasSettings: !!currentCourseware.settings,
        settingsKeys: currentCourseware.settings ? Object.keys(currentCourseware.settings) : []
      });
      
      // 构建只包含设置更新的payload
      const newSettings = {
        ...(currentCourseware.settings || {}),
        cameraPosition: cameraRef.current ? {
          x: cameraRef.current.position.x,
          y: cameraRef.current.position.y,
          z: cameraRef.current.position.z
        } : currentCourseware.settings?.cameraPosition,
        cameraTarget: controlsRef.current ? {
          x: controlsRef.current.target.x,
          y: controlsRef.current.target.y,
          z: controlsRef.current.target.z
        } : currentCourseware.settings?.cameraTarget,
        background: bgColor,
        backgroundType: bgType,
        // 保存HDR环境光照路径（用于splat模式的环境光照）
        backgroundPanorama: bgType === 'splat' ? (bgPanorama || '/360background_7.hdr') : null,
        // 保存高斯泼溅模型路径和变换（如果bgType是splat）
        backgroundSplat: bgType === 'splat' ? (bgSplat || '/world/world_1') : null,
        splatTransform: bgType === 'splat' ? {
          position: splatPosition,
          rotation: splatRotation,
          scale: splatScale
        } : null,
        // 保存实际的亮度值
        backgroundPanoramaBrightness: bgPanoramaBrightness,
        // 保存实际的HDR环境设置
        useHDREnvironment: useHDREnvironment,
        lighting: {
          directional: dirLight,
          ambient: ambLight,
          hemisphere: hemiLight
        }
      };
      
      console.log('💾 [Settings/Save] 构建的新设置对象:', {
        backgroundType: newSettings.backgroundType,
        backgroundPanorama: newSettings.backgroundPanorama,
        backgroundSplat: newSettings.backgroundSplat,
        splatTransform: newSettings.splatTransform,
        backgroundPanoramaBrightness: newSettings.backgroundPanoramaBrightness,
        useHDREnvironment: newSettings.useHDREnvironment,
        hasLighting: !!newSettings.lighting
      });
      
      const payload = {
        ...currentCourseware,
        settings: newSettings
      };

      console.log('💾 [Settings/Save] 准备发送的payload设置部分:', JSON.stringify(newSettings, null, 2));

      await apiPut(`/api/coursewares/${coursewareId}`, payload);
      
      console.log('✅ [Settings/Save-Success] 设置保存成功');
      console.log('✅ [Settings/Save-Success] 保存的设置:', {
        backgroundType: newSettings.backgroundType,
        backgroundPanorama: newSettings.backgroundPanorama,
        backgroundPanoramaBrightness: newSettings.backgroundPanoramaBrightness,
        useHDREnvironment: newSettings.useHDREnvironment
      });
      
      setLastSaved(new Date());
      message.success('设置已保存');
    } catch (error: any) {
      console.error('❌ [Settings/Save-Error] 保存设置失败:', error);
      console.error('❌ [Settings/Save-Error] 错误详情:', {
        message: error.message,
        stack: error.stack
      });
      message.error(error.message || '保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  // 自动保存（关闭）
  useEffect(() => {
    // 已按需关闭自动保存，避免模型未载入时写入空数据
    return;
  }, [coursewareId, saving]);

  // 快捷键保存（Ctrl+S）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveCourseware();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveCourseware]);

  // 从 coursewareData 初始化数据
  useEffect(() => {
    if (!coursewareData || initialDataLoadedRef.current) return;

    try {
      console.log('📥 [Settings/Load-Start] 开始加载课件数据');
      console.log('📥 [Settings/Load-Raw] 原始课件数据:', {
        hasSettings: !!coursewareData.settings,
        settingsType: typeof coursewareData.settings,
        settingsValue: coursewareData.settings,
        settingsKeys: coursewareData.settings ? Object.keys(coursewareData.settings) : [],
        fullSettings: JSON.stringify(coursewareData.settings, null, 2)
      });
      
      // 初始化课件名称
      setCoursewareName(coursewareData.name || '三维课件');
      
      // 初始化标注（延迟到模型加载后处理，因为需要通过路径查找对象）
      if (coursewareData.annotations && Array.isArray(coursewareData.annotations)) {
        // 存储到pending中，等模型加载后再处理
        pendingImportRef.current = { 
          annotations: coursewareData.annotations.map(a => ({
            id: a.id,
            nodeKey: a.nodeKey, // 新格式：直接使用nodeKey
            position: a.position, // 新格式：直接使用position对象
            title: a.title,
            description: a.description,
            labelOffset: a.labelOffset, // 标签偏移量
            labelOffsetSpace: (a as any).labelOffsetSpace,
            // 兼容老格式
            target: { path: a.nodeKey }, 
            anchor: { offset: [a.position?.x || 0, a.position?.y || 0, a.position?.z || 0] },
            label: { 
              title: a.title, 
              summary: a.description,
              offset: a.labelOffset ? [a.labelOffset.x, a.labelOffset.y, a.labelOffset.z] : undefined,
              offsetSpace: (a as any).labelOffsetSpace
            }
          })),
          // 包含模型结构数据
          modelStructure: coursewareData.modelStructure || (coursewareData as any).settings?.modelStructure
        };
      } else if (coursewareData.modelStructure || (coursewareData as any).settings?.modelStructure) {
        // 如果只有模型结构没有标注
        pendingImportRef.current = {
          annotations: [],
          modelStructure: coursewareData.modelStructure || (coursewareData as any).settings?.modelStructure
        };
      }

      // 🎬 动画初始化策略：优先从GLB，回退到数据库
      console.log('🎬 初始化动画系统...');
      
      if (coursewareData.animations && Array.isArray(coursewareData.animations)) {
        console.log('📊 发现动画元数据:', coursewareData.animations.length, '个');
        
        // 如果有修改后的GLB文件，动画数据应该在GLB中，这里只需要元数据
        if (coursewareData.modifiedModelUrl) {
          console.log('📁 检测到修改后的GLB文件，动画将从GLB加载');
          
          // 暂存动画元数据，等待模型加载后处理
          if (!pendingImportRef.current) pendingImportRef.current = {};
          pendingImportRef.current.animationMetadata = coursewareData.animations;
          
        } else {
          console.log('💾 从数据库加载传统动画格式');
          
          // 传统方式：从数据库加载动画（兼容旧版本，支持新JSON格式）
          const loadedClips: Clip[] = coursewareData.animations.map(anim => {
            let timeline = anim.timeline || { 
              duration: anim.duration || 10, 
              current: 0, 
              playing: false, 
              cameraKeys: [], 
              visTracks: {}, 
              trsTracks: {}, 
              annotationTracks: {} 
            };
            
            // 🔥 如果存在新格式的timeline数据，进行转换
            if (anim.timeline && (anim.timeline.visTracks || anim.timeline._unityFormat?.visibilityTracks)) {
              console.log(`[JSON加载] 检测到新格式显隐轨道数据: ${anim.name}`);
              
              const visTracks: Record<string, VisibilityKeyframe[]> = {};
              
              // 优先使用Unity格式（对象路径映射），否则使用标准格式（数组）
              if (anim.timeline._unityFormat?.visibilityTracks) {
                console.log(`  使用Unity格式显隐轨道`);
                Object.entries(anim.timeline._unityFormat.visibilityTracks).forEach(([objectPath, keyframes]) => {
                  console.log(`  [Unity格式显隐轨道] ${objectPath}: ${(keyframes as any[]).length}个关键帧`);
                  visTracks[objectPath] = (keyframes as any[]).map((k: any) => ({
                    time: k.time,
                    value: k.visible
                  }));
                });
              } else if (anim.timeline.visTracks && Array.isArray(anim.timeline.visTracks)) {
                console.log(`  使用标准格式显隐轨道`);
                anim.timeline.visTracks.forEach((track: any) => {
                  console.log(`  [标准格式显隐轨道] ${track.nodeKey}: ${track.keys.length}个关键帧`);
                  visTracks[track.nodeKey] = track.keys.map((k: any) => ({
                    time: k.time,
                    value: k.visible
                  }));
                });
              }
              
              timeline.visTracks = visTracks;
            }
            
            return {
              id: anim.id || generateUuid(),
              name: anim.name || '未命名动画',
              description: anim.description || '',
              timeline,
              steps: anim.steps || []
            };
          });
          
          // 去重处理
          const uniqueClips: Clip[] = [];
          const usedIds = new Set<string>();
          loadedClips.forEach(clip => {
            if (usedIds.has(clip.id)) {
              clip.id = generateUuid();
            }
            usedIds.add(clip.id);
            uniqueClips.push(clip);
          });
          
          setClips(uniqueClips);
          console.log('载入动画:', uniqueClips.length, '个');
          
          if (uniqueClips.length > 0) {
            setActiveClipId(uniqueClips[0].id);
            
            // 存储完整的动画数据到pending中
          if (!pendingImportRef.current) pendingImportRef.current = {};
            pendingImportRef.current.allAnimations = uniqueClips;
            pendingImportRef.current.activeAnimationId = uniqueClips[0].id;
            pendingImportRef.current.timeline = uniqueClips[0].timeline;
            // 将后端步骤写入对应clip（若存在）
            try {
              coursewareData.animations.forEach((a:any)=>{
                const clip = uniqueClips.find(c=>c.id===a.id || c.name===a.name);
                if (clip && Array.isArray(a.steps)) (clip as any).steps = a.steps;
              });
            } catch {}
          }
        }
      } else {
        console.log('📭 没有发现动画数据');
        setClips([]);
        setActiveClipId('');
      }

      // 初始化设置
      console.log('🔧 [Settings/Load-Process] 开始处理设置数据');
      console.log('🔧 [Settings/Load-Process] coursewareData.settings 存在:', !!coursewareData.settings);
      console.log('🔧 [Settings/Load-Process] coursewareData.settings 值:', coursewareData.settings);
      console.log('🔧 [Settings/Load-Process] coursewareData.settings 完整JSON:', JSON.stringify(coursewareData.settings, null, 2));
      
      if (coursewareData.settings) {
        const settings = coursewareData.settings;
        console.log('🔧 [Settings/Load-Process] 解析settings对象:', {
          background: settings.background,
          backgroundType: settings.backgroundType,
          backgroundPanorama: settings.backgroundPanorama,
          backgroundPanoramaBrightness: settings.backgroundPanoramaBrightness,
          useHDREnvironment: settings.useHDREnvironment,
          lighting: settings.lighting ? '存在' : '不存在'
        });
        
        // 检查全景图相关字段是否存在
        const hasPanoramaSettings = settings.backgroundType !== undefined || 
                                     settings.backgroundPanorama !== undefined ||
                                     settings.backgroundPanoramaBrightness !== undefined ||
                                     settings.useHDREnvironment !== undefined;
        
        if (!hasPanoramaSettings) {
          console.warn('⚠️ [Settings/Load-Process] 检测到全景图设置字段缺失！这些字段可能从未被保存过。');
          console.warn('⚠️ [Settings/Load-Process] 请点击"保存并应用设置"按钮来保存当前的全景图设置。');
        }
        
        // 设置背景颜色
        if (settings.background) {
          console.log('✅ [Settings/Load] 设置背景颜色:', settings.background);
          setBgColor(settings.background);
        } else {
          console.log('⚠️ [Settings/Load] 未找到背景颜色，使用默认值');
        }
        
        // 确保backgroundType被正确读取（如果没有则使用默认值'panorama'）
        const bgTypeValue = settings.backgroundType || 'panorama';
        console.log('✅ [Settings/Load] 设置背景类型:', bgTypeValue, '(原始值:', settings.backgroundType, ')');
        setBgType(bgTypeValue);
        
        // 确保backgroundPanorama被正确读取
        // 如果backgroundType是panorama，读取backgroundPanorama；否则使用默认值
        if (bgTypeValue === 'panorama') {
          const panoramaValue = settings.backgroundPanorama && settings.backgroundPanorama.trim() !== '' 
            ? settings.backgroundPanorama 
            : '/360background_7.hdr';
          console.log('✅ [Settings/Load] 设置全景图:', panoramaValue, '(原始值:', settings.backgroundPanorama, ')');
          setBgPanorama(panoramaValue);
        } else {
          console.log('✅ [Settings/Load] 背景类型不是panorama，设置默认全景图');
          setBgPanorama('/360background_7.hdr'); // 即使不是panorama类型，也保持默认值以便切换时使用
        }
        
        // 确保backgroundSplat被正确读取
        if (bgTypeValue === 'splat') {
          const splatValue = settings.backgroundSplat && settings.backgroundSplat.trim() !== ''
            ? settings.backgroundSplat
            : '/world/world_1'; // 默认使用第一个 world 场景
          console.log('✅ [Settings/Load] 设置高斯泼溅模型:', splatValue, '(原始值:', settings.backgroundSplat, ')');
          setBgSplat(splatValue);
          savedSettingsLoadedRef.current = true; // 标记已加载保存的设置
          
          // 加载高斯泼溅变换参数
          if (settings.splatTransform) {
            const transform = settings.splatTransform;
            if (transform.position) {
              setSplatPosition(transform.position);
              console.log('✅ [Settings/Load] 设置高斯泼溅位置:', transform.position);
            }
            if (transform.rotation) {
              setSplatRotation(transform.rotation);
              console.log('✅ [Settings/Load] 设置高斯泼溅旋转:', transform.rotation);
            }
            if (transform.scale !== undefined) {
              setSplatScale(transform.scale);
              console.log('✅ [Settings/Load] 设置高斯泼溅缩放:', transform.scale);
            }
          }
        } else {
          console.log('✅ [Settings/Load] 背景类型不是splat，设置默认高斯泼溅模型');
          setBgSplat('/world/world_1'); // 保持默认值以便切换时使用
        }
        
        // 确保backgroundPanoramaBrightness被正确读取（如果没有则使用默认值1.0）
        const brightnessValue = settings.backgroundPanoramaBrightness !== undefined && settings.backgroundPanoramaBrightness !== null 
          ? settings.backgroundPanoramaBrightness 
          : 1.0;
        console.log('✅ [Settings/Load] 设置全景图亮度:', brightnessValue, '(原始值:', settings.backgroundPanoramaBrightness, ')');
        setBgPanoramaBrightness(brightnessValue);
        
        // 确保useHDREnvironment被正确读取（如果没有则使用默认值true）
        const hdrEnvValue = settings.useHDREnvironment !== undefined && settings.useHDREnvironment !== null 
          ? settings.useHDREnvironment 
          : true;
        console.log('✅ [Settings/Load] 设置HDR环境光照:', hdrEnvValue, '(原始值:', settings.useHDREnvironment, ')');
        setUseHDREnvironment(hdrEnvValue);
        
        // 调试日志 - 汇总加载的设置
        console.log('📋 [Settings/Load-Summary] 设置加载汇总:', {
          backgroundType: bgTypeValue,
          backgroundPanorama: bgTypeValue === 'panorama' ? (settings.backgroundPanorama && settings.backgroundPanorama.trim() !== '' ? settings.backgroundPanorama : '/360background_7.hdr') : null,
          backgroundPanoramaBrightness: brightnessValue,
          useHDREnvironment: hdrEnvValue,
          lighting: settings.lighting ? '已加载' : '未找到'
        });
        
        // 加载灯光设置
        if (settings.lighting) {
          const lighting = settings.lighting;
          console.log('💡 [Settings/Load] 开始加载灯光设置:', {
            hasDirectional: !!lighting.directional,
            hasAmbient: !!lighting.ambient,
            hasHemisphere: !!lighting.hemisphere
          });
          
          if (lighting.directional) {
            console.log('✅ [Settings/Load] 设置平行光:', lighting.directional);
            setDirLight(lighting.directional);
          }
          if (lighting.ambient) {
            console.log('✅ [Settings/Load] 设置环境光:', lighting.ambient);
            setAmbLight(lighting.ambient);
          }
          if (lighting.hemisphere) {
            console.log('✅ [Settings/Load] 设置半球光:', lighting.hemisphere);
            setHemiLight(lighting.hemisphere);
          }
        } else {
          console.log('⚠️ [Settings/Load] 未找到灯光设置，使用默认值');
        }
      } else {
        // 如果没有settings，使用默认值
        console.log('⚠️ [Settings/Load] 课件数据中没有settings对象，使用默认值');
        console.log('⚠️ [Settings/Load] 默认设置:', {
          bgType: 'splat',
          bgPanorama: '/360background_7.hdr',
          bgPanoramaBrightness: 1.0,
          useHDREnvironment: true
        });
        setBgType('splat');
        setBgPanorama('/360background_7.hdr');
        setBgPanoramaBrightness(1.0);
        setUseHDREnvironment(true);
      }
      
      console.log('✅ [Settings/Load-Complete] 设置加载完成');

      initialDataLoadedRef.current = true;
      console.log('课件数据已初始化');
    } catch (error) {
      console.error('初始化课件数据失败:', error);
      message.error('初始化课件数据失败');
    }
  }, [coursewareData]);

  // 设置弹窗
  const SettingsModal = () => (
    <Modal title="系统设置" open={settingsOpen} maskClosable onCancel={()=>setSettingsOpen(false)} footer={null} width={600} zIndex={1000}>
      <Flex vertical gap={12}>
        <div style={{ fontWeight: 600 }}>背景</div>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Switch checkedChildren="透明" unCheckedChildren="不透明" checked={bgTransparent} onChange={(v)=>setBgTransparent(v)} />
          </Space>
          {!bgTransparent && (
            <>
              <Space>
                <span>背景类型：</span>
                <Select 
                  size="small" 
                  value={pendingSettings?.bgType ?? bgType} 
                  style={{ width: 160 }} 
                  onChange={(v)=>{ 
                    setPendingSettings(prev => ({
                      bgType: v,
                      bgColor: prev?.bgColor ?? bgColor,
                      bgSplat: prev?.bgSplat ?? bgSplat,
                      bgPanorama: prev?.bgPanorama ?? bgPanorama,
                      bgPanoramaBrightness: prev?.bgPanoramaBrightness ?? bgPanoramaBrightness,
                      splatPosition: prev?.splatPosition ?? splatPosition,
                      splatRotation: prev?.splatRotation ?? splatRotation,
                      splatScale: prev?.splatScale ?? splatScale,
                      dirLight: prev?.dirLight ?? dirLight,
                      ambLight: prev?.ambLight ?? ambLight,
                      hemiLight: prev?.hemiLight ?? hemiLight,
                    }));
                  }}
                  options={[
                    { label: '纯色背景', value: 'color' },
                    { label: '高斯场景+HDR光照', value: 'splat' }
                  ]} 
                />
              </Space>
              {(pendingSettings?.bgType ?? bgType) === 'color' ? (
                <Space>
                  <span>颜色：</span>
                  <Input 
                    size="small" 
                    type="color" 
                    value={pendingSettings?.bgColor ?? bgColor} 
                    onChange={(e) => setPendingSettings(prev => ({
                      ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                      bgColor: e.target.value
                    }))} 
                  />
                </Space>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <span>选择3D场景：</span>
                    <Select 
                      size="small" 
                      value={pendingSettings?.bgSplat ?? bgSplat} 
                      style={{ width: '100%' }} 
                      onChange={(v) => {
                        // 查找选中场景的配置，自动填充变换参数
                        const scene = worldScenes.find(s => s.path === v);
                        setPendingSettings(prev => ({
                          ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                          bgSplat: v,
                          splatPosition: scene?.position ?? prev?.splatPosition ?? splatPosition,
                          splatRotation: scene?.rotation ?? prev?.splatRotation ?? splatRotation,
                          splatScale: scene?.scale ?? prev?.splatScale ?? splatScale,
                        }));
                      }}
                      options={worldScenes.map(s => ({ label: s.name, value: s.path }))} 
                    />
                  </Space>
                  <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                    <span>HDR 亮度：</span>
                    <Slider
                      min={0}
                      max={3}
                      step={0.1}
                      value={pendingSettings?.bgPanoramaBrightness ?? bgPanoramaBrightness}
                      onChange={(v) => setPendingSettings(prev => ({
                        ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                        bgPanoramaBrightness: v
                      }))}
                      marks={{ 0: '0', 1: '1', 2: '2', 3: '3' }}
                    />
                  </Space>
                  {splatLoading && (
                    <div style={{ fontSize: '12px', color: '#1890ff', paddingLeft: 8 }}>
                      ⏳ 正在加载高斯泼溅模型...
                    </div>
                  )}
                  <Divider style={{ margin: '8px 0' }} />
                  <div style={{ fontWeight: 500, marginBottom: 4 }}>场景变换（手动调整）</div>
                  <Space wrap style={{ width: '100%' }}>
                    <span style={{ minWidth: 40 }}>位置：</span>
                    <span>X</span>
                    <InputNumber 
                      size="small" 
                      step={0.5} 
                      value={pendingSettings?.splatPosition?.x ?? splatPosition.x} 
                      style={{ width: 70 }}
                      onChange={(v) => setPendingSettings(prev => ({
                        ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                        splatPosition: { ...(prev?.splatPosition ?? splatPosition), x: Number(v || 0) }
                      }))} 
                    />
                    <span>Y</span>
                    <InputNumber 
                      size="small" 
                      step={0.5} 
                      value={pendingSettings?.splatPosition?.y ?? splatPosition.y} 
                      style={{ width: 70 }}
                      onChange={(v) => setPendingSettings(prev => ({
                        ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                        splatPosition: { ...(prev?.splatPosition ?? splatPosition), y: Number(v || 0) }
                      }))} 
                    />
                    <span>Z</span>
                    <InputNumber 
                      size="small" 
                      step={0.5} 
                      value={pendingSettings?.splatPosition?.z ?? splatPosition.z} 
                      style={{ width: 70 }}
                      onChange={(v) => setPendingSettings(prev => ({
                        ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                        splatPosition: { ...(prev?.splatPosition ?? splatPosition), z: Number(v || 0) }
                      }))} 
                    />
                  </Space>
                  <Space wrap style={{ width: '100%' }}>
                    <span style={{ minWidth: 40 }}>旋转：</span>
                    <span>X</span>
                    <InputNumber 
                      size="small" 
                      step={15} 
                      value={pendingSettings?.splatRotation?.x ?? splatRotation.x} 
                      style={{ width: 70 }}
                      onChange={(v) => setPendingSettings(prev => ({
                        ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                        splatRotation: { ...(prev?.splatRotation ?? splatRotation), x: Number(v || 0) }
                      }))} 
                    />
                    <span>Y</span>
                    <InputNumber 
                      size="small" 
                      step={15} 
                      value={pendingSettings?.splatRotation?.y ?? splatRotation.y} 
                      style={{ width: 70 }}
                      onChange={(v) => setPendingSettings(prev => ({
                        ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                        splatRotation: { ...(prev?.splatRotation ?? splatRotation), y: Number(v || 0) }
                      }))} 
                    />
                    <span>Z</span>
                    <InputNumber 
                      size="small" 
                      step={15} 
                      value={pendingSettings?.splatRotation?.z ?? splatRotation.z} 
                      style={{ width: 70 }}
                      onChange={(v) => setPendingSettings(prev => ({
                        ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                        splatRotation: { ...(prev?.splatRotation ?? splatRotation), z: Number(v || 0) }
                      }))} 
                    />
                    <span style={{ color: '#999', fontSize: 12 }}>°</span>
                  </Space>
                  <Space align="center" style={{ width: '100%' }}>
                    <span style={{ minWidth: 40 }}>缩放：</span>
                    <Slider 
                      style={{ flex: 1, minWidth: 120 }} 
                      min={0.1} 
                      max={5.0} 
                      step={0.1} 
                      value={pendingSettings?.splatScale ?? splatScale} 
                      onChange={(value: number) => setPendingSettings(prev => ({
                        ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
                        splatScale: value
                      }))} 
                    />
                    <span style={{ minWidth: 40, textAlign: 'right' }}>{(pendingSettings?.splatScale ?? splatScale).toFixed(1)}x</span>
                  </Space>
                  <div style={{ fontSize: '12px', color: '#999', paddingLeft: 8, marginTop: 8 }}>
                    高斯泼溅是一种新型3D表示技术，可以呈现逼真的环境效果。支持WebXR（VR/AR）查看。
                  </div>
                </Space>
              )}
              {/* 应用按钮 */}
              {pendingSettings && (
                <Space style={{ marginTop: 12, width: '100%', justifyContent: 'flex-end' }}>
                  <Button size="small" onClick={() => setPendingSettings(null)}>取消</Button>
                  <Button size="small" type="primary" onClick={() => {
                    // 应用待定设置
                    if (pendingSettings.bgType) setBgType(pendingSettings.bgType);
                    if (pendingSettings.bgColor) setBgColor(pendingSettings.bgColor);
                    if (pendingSettings.bgSplat) setBgSplat(pendingSettings.bgSplat);
                    if (pendingSettings.bgPanorama) setBgPanorama(pendingSettings.bgPanorama);
                    if (pendingSettings.bgPanoramaBrightness) setBgPanoramaBrightness(pendingSettings.bgPanoramaBrightness);
                    if (pendingSettings.splatPosition) setSplatPosition(pendingSettings.splatPosition);
                    if (pendingSettings.splatRotation) setSplatRotation(pendingSettings.splatRotation);
                    if (pendingSettings.splatScale) setSplatScale(pendingSettings.splatScale);
                    if (pendingSettings.dirLight) setDirLight(pendingSettings.dirLight);
                    if (pendingSettings.ambLight) setAmbLight(pendingSettings.ambLight);
                    if (pendingSettings.hemiLight) setHemiLight(pendingSettings.hemiLight);
                    setPendingSettings(null);
                    message.success('设置已应用');
                  }}>应用设置</Button>
                </Space>
              )}
            </>
          )}
        </Space>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ fontWeight: 600 }}>灯光</div>
        <Space wrap>
          <span>平行光</span>
          <Input size="small" type="color" value={pendingSettings?.dirLight?.color ?? dirLight.color} onChange={(e)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            dirLight: { ...(prev?.dirLight ?? dirLight), color: e.target.value }
          }))} />
          <InputNumber size="small" step={0.1} min={0} max={10} value={pendingSettings?.dirLight?.intensity ?? dirLight.intensity} onChange={(v)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            dirLight: { ...(prev?.dirLight ?? dirLight), intensity: Number(v||0) }
          }))} />
          <span>Px</span><InputNumber size="small" step={0.1} value={pendingSettings?.dirLight?.position?.x ?? dirLight.position.x} onChange={(v)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            dirLight: { ...(prev?.dirLight ?? dirLight), position: { ...(prev?.dirLight?.position ?? dirLight.position), x: Number(v||0) } }
          }))} />
          <span>Py</span><InputNumber size="small" step={0.1} value={pendingSettings?.dirLight?.position?.y ?? dirLight.position.y} onChange={(v)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            dirLight: { ...(prev?.dirLight ?? dirLight), position: { ...(prev?.dirLight?.position ?? dirLight.position), y: Number(v||0) } }
          }))} />
          <span>Pz</span><InputNumber size="small" step={0.1} value={pendingSettings?.dirLight?.position?.z ?? dirLight.position.z} onChange={(v)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            dirLight: { ...(prev?.dirLight ?? dirLight), position: { ...(prev?.dirLight?.position ?? dirLight.position), z: Number(v||0) } }
          }))} />
        </Space>
        <Space wrap>
          <span>环境光</span>
          <Input size="small" type="color" value={pendingSettings?.ambLight?.color ?? ambLight.color} onChange={(e)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            ambLight: { ...(prev?.ambLight ?? ambLight), color: e.target.value }
          }))} />
          <InputNumber size="small" step={0.1} min={0} max={10} value={pendingSettings?.ambLight?.intensity ?? ambLight.intensity} onChange={(v)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            ambLight: { ...(prev?.ambLight ?? ambLight), intensity: Number(v||0) }
          }))} />
        </Space>
        <Space wrap>
          <span>半球光</span>
          <Input size="small" type="color" value={pendingSettings?.hemiLight?.skyColor ?? hemiLight.skyColor} onChange={(e)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            hemiLight: { ...(prev?.hemiLight ?? hemiLight), skyColor: e.target.value }
          }))} />
          <Input size="small" type="color" value={pendingSettings?.hemiLight?.groundColor ?? hemiLight.groundColor} onChange={(e)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            hemiLight: { ...(prev?.hemiLight ?? hemiLight), groundColor: e.target.value }
          }))} />
          <InputNumber size="small" step={0.1} min={0} max={10} value={pendingSettings?.hemiLight?.intensity ?? hemiLight.intensity} onChange={(v)=>setPendingSettings(prev => ({
            ...(prev ?? { bgType, bgColor, bgSplat, bgPanorama, bgPanoramaBrightness, splatPosition, splatRotation, splatScale, dirLight, ambLight, hemiLight }),
            hemiLight: { ...(prev?.hemiLight ?? hemiLight), intensity: Number(v||0) }
          }))} />
        </Space>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ fontWeight: 600 }}>显示</div>
        <Space>
          <Switch checkedChildren="地面开" unCheckedChildren="地面关" checked={showGrid} onChange={setShowGrid} />
        </Space>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ fontWeight: 600 }}>高亮模式</div>
        <Select size="small" value={highlightMode} style={{ width: 160 }} onChange={(v)=>{ setHighlightMode(v); const sel = selectedKey ? keyToObject.current.get(selectedKey) : null; if (sel) selectObject(sel); }}
          options={[{label:'轮廓', value:'outline'},{label:'自发光', value:'emissive'}]} />
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ fontWeight: 600 }}>操作设置</div>
        <Space wrap>
          <InputNumber size="small" placeholder="平移吸附" value={gizmoSnap.t} min={0} step={0.01} onChange={(v)=>{ const n = (v==null? undefined: Number(v)); setGizmoSnap(s=>({ ...s, t: n })); tcontrolsRef.current?.setTranslationSnap((n as any) ?? null); }} />
          <InputNumber size="small" placeholder="旋转吸附°" value={gizmoSnap.r} min={0} step={1} onChange={(v)=>{ const n = (v==null? undefined: Number(v)*Math.PI/180); setGizmoSnap(s=>({ ...s, r: (v==null? undefined: Number(v)) })); tcontrolsRef.current?.setRotationSnap((n as any) ?? null); }} />
          <InputNumber size="small" placeholder="缩放吸附" value={gizmoSnap.s} min={0} step={0.01} onChange={(v)=>{ const n = (v==null? undefined: Number(v)); setGizmoSnap(s=>({ ...s, s: n })); tcontrolsRef.current?.setScaleSnap((n as any) ?? null); }} />
          <Select size="small" value={gizmoSpace} style={{ width: 120 }} onChange={(v)=>{ setGizmoSpace(v); tcontrolsRef.current?.setSpace(v as any); }} options={[{label:'局部', value:'local'},{label:'世界', value:'world'}]} />
        </Space>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ fontWeight: 600 }}>标注设置</div>
        <Space align="center">
          <span>标签大小</span>
          <Slider 
            style={{ width: 120 }} 
            min={0.2} 
            max={3.0} 
            step={0.1} 
            value={labelScale} 
            onChange={(value: number) => {
              setLabelScale(value);
            }} 
          />
          <span>{labelScale.toFixed(1)}x</span>
        </Space>
        <Divider style={{ margin: '16px 0' }} />
        <Flex justify="flex-end" gap={8}>
          <Button onClick={() => setSettingsOpen(false)}>取消</Button>
          <Button 
            type="primary" 
            icon={<SaveOutlined />}
            loading={saving}
            onClick={saveSettings}
          >
            保存并应用设置
          </Button>
        </Flex>
      </Flex>
    </Modal>
  );
  // --- 撤销 / 重做 ---
  type Snapshot = { timeline: TimelineState };
  const undoStack = useRef<Snapshot[]>([]);
  const redoStack = useRef<Snapshot[]>([]);
  const pushHistory = () => {
    undoStack.current.push({ timeline: JSON.parse(JSON.stringify(timelineRef.current)) });
    // 压栈后清空重做栈
    redoStack.current = [];
  };
  const undo = () => {
    // 优先检查TRS撤销栈
    if (trsUndoStack.current.length > 0) {
      trsUndo();
      return;
    }
    
    console.log('Undo called, stack size:', undoStack.current.length); // Debug
    const last = undoStack.current.pop();
    if (!last) {
      console.log('No undo history available'); // Debug
      return;
    }
    redoStack.current.push({ timeline: JSON.parse(JSON.stringify(timelineRef.current)) });
    setTimeline(last.timeline);
    applyTimelineAt(last.timeline.current);
    console.log('Undo applied'); // Debug
  };
  const redo = () => {
    // 优先检查TRS重做栈
    if (trsRedoStack.current.length > 0) {
      trsRedo();
      return;
    }
    
    console.log('Redo called, stack size:', redoStack.current.length); // Debug
    const last = redoStack.current.pop();
    if (!last) {
      console.log('No redo history available'); // Debug
      return;
    }
    undoStack.current.push({ timeline: JSON.parse(JSON.stringify(timelineRef.current)) });
    setTimeline(last.timeline);
    applyTimelineAt(last.timeline.current);
    console.log('Redo applied'); // Debug
  };

  // TRS 撤销/重做函数
  const trsSaveSnapshot = (objectKey: string) => {
    const obj = keyToObject.current.get(objectKey);
    if (!obj) return null;
    
    return {
      objectKey,
      position: [obj.position.x, obj.position.y, obj.position.z] as [number, number, number],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z] as [number, number, number],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z] as [number, number, number]
    };
  };

  const trsApplySnapshot = (snapshot: TRSSnapshot) => {
    const obj = keyToObject.current.get(snapshot.objectKey);
    if (!obj) return;
    
    obj.position.set(...snapshot.position);
    obj.rotation.set(...snapshot.rotation);
    obj.scale.set(...snapshot.scale);
  };

  const trsUndo = () => {
    const last = trsUndoStack.current.pop();
    if (!last) return;
    
    // 保存当前状态到重做栈
    const current = trsSaveSnapshot(last.objectKey);
    if (current) {
      trsRedoStack.current.push(current);
    }
    
    // 应用撤销状态
    trsApplySnapshot(last);
  };

  const trsRedo = () => {
    const last = trsRedoStack.current.pop();
    if (!last) return;
    
    // 保存当前状态到撤销栈
    const current = trsSaveSnapshot(last.objectKey);
    if (current) {
      trsUndoStack.current.push(current);
    }
    
    // 应用重做状态
    trsApplySnapshot(last);
  };

  function buildPath(object: THREE.Object3D): string {
    const names: string[] = [];
    let o: THREE.Object3D | null = object;
    while (o) { names.push(o.name || o.uuid); o = o.parent as any; }
    return names.reverse().join('/');
  }

  function buildNamePath(object: THREE.Object3D): string {
    const segs: string[] = [];
    let o: THREE.Object3D | null = object;
    while (o) { if (o.name) segs.push(o.name); o = o.parent as any; }
    return segs.reverse().join('/');
  }

  function isUuidLike(s: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
  }

  // 辅助函数：计算场景中的实际节点数
  function countSceneNodes(root: THREE.Object3D): number {
    let count = 0;
    root.traverse(() => count++);
    return count;
  }

  function findByFlexiblePath(path: string | string[]): THREE.Object3D | undefined {
    console.log('🔍 查找路径:', path);
    
    // 处理字符串路径
    if (typeof path === 'string') {
      const direct = findByPath(path);
      if (direct) {
        console.log('✅ 字符串路径直接找到:', direct.name);
        return direct;
      }
      const segs = path.split('/').filter(Boolean);
      console.log('🔄 字符串路径转换为段:', segs);
      return findByPathSegments(segs);
    }
    
    // 处理数组路径
    if (Array.isArray(path)) {
      const filteredPath = path.filter(Boolean);
      console.log('🔄 数组路径过滤后:', filteredPath);
      return findByPathSegments(filteredPath);
    }
    
    console.log('❌ 无效路径类型');
    return undefined;
  }
  
  function findByPathSegments(segs: string[]): THREE.Object3D | undefined {
    const nameSegs = segs.filter(s => !isUuidLike(s));
    if (nameSegs.length === 0) return undefined;
    const leafName = nameSegs[nameSegs.length - 1];
    const candidates: THREE.Object3D[] = [];
    (modelRootRef.current || sceneRef.current)?.traverse(o => { if ((o as any).name === leafName) candidates.push(o as THREE.Object3D); });
    const isSubsequence = (full: string[], sub: string[]) => { let i = 0; for (let j = 0; j < full.length && i < sub.length; j++) { if (full[j] === sub[i]) i++; } return i === sub.length; };
    for (const c of candidates) {
      const chain: string[] = [];
      let p: THREE.Object3D | null = c;
      while (p) { if (p.name) chain.push(p.name); p = p.parent as any; }
      chain.reverse();
      if (isSubsequence(chain, nameSegs)) return c;
    }
    return undefined;
  }

  const exportAnnotations = () => {
    const data = {
      version: '1.0',
      model: (urlForm.getFieldValue('url') as string) || '',
      annotations: annotations.map(a => ({
        id: a.id,
        target: { path: a.targetPath, namePath: (() => { const obj = keyToObject.current.get(a.targetKey); return obj ? buildNamePath(obj) : undefined; })() },
        anchor: a.anchor,
        label: a.label
      }))
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'annotations.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importProps: UploadProps = {
    accept: '.json,application/json',
    showUploadList: false,
    beforeUpload: async (file) => {
      try {
        const text = await file.text();
        const json = JSON.parse(text);
        if (!Array.isArray(json?.annotations)) throw new Error('文件格式不正确');
        if (!modelRootRef.current) {
          pendingImportRef.current = json;
          message.info('已读取标注，待模型加载后自动恢复');
        } else {
          pendingImportRef.current = json;
          tryRestoreFromPending();
        }
      } catch (e: any) { message.error(e?.message || '导入失败'); }
      return false;
    }
  };

  // 根据场景中的标注可视对象，反推出标签的世界位置
  function getAnnotationLabelWorldPosition(annoId: string): THREE.Vector3 | null {
    const group = markersGroupRef.current;
    if (!group) return null;
    let pos: THREE.Vector3 | null = null;
    group.traverse((obj: any) => {
      if (pos) return;
      if (obj && obj.userData && obj.userData.annotationId === annoId) {
        // 先读组上缓存
        if (obj.userData.labelWorld) {
          pos = (obj.userData.labelWorld as THREE.Vector3).clone();
        } else if ((obj as any).isSprite) {
          pos = (obj as any).position.clone();
        } else if ((obj as any).isLine) {
          // 线段的第二个点是标签端
          try {
            const arr = (obj as any).geometry.attributes.position.array;
            pos = new THREE.Vector3(arr[3], arr[4], arr[5]);
          } catch {}
        }
      }
    });
    return pos;
  }

  function findByPath(path: string): THREE.Object3D | undefined {
    if (!path) return undefined;
    const names = path.split('/');
    let cur: THREE.Object3D | undefined = modelRootRef.current || undefined;
    for (let i = 1; i < names.length; i++) {
      const name = names[i];
      if (!cur) return undefined;
      cur = (cur.children || []).find(c => (c.name || c.uuid) === name);
    }
    return cur;
  }

  const colLeft = showLeft ? '340px' : '0px';
  const colRight = showRight ? '320px' : '0px';
  const isTimelineCollapsed = mode !== 'anim';
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'grid', gridTemplateRows: `minmax(0, 1fr) ${isTimelineCollapsed ? 0 : timelineHeight}px`, gridTemplateColumns: `${colLeft} 1fr ${colRight}` as any, gridTemplateAreas: `'left center right' 'timeline timeline timeline'`, columnGap: 12, rowGap: isTimelineCollapsed ? 0 : 12, padding: 12, boxSizing: 'border-box', overflow: 'hidden', transition: 'grid-template-rows 220ms ease, grid-template-columns 220ms ease, row-gap 220ms ease', userSelect: 'none' }}
      onMouseDown={(e)=>{
        const target = e.target as HTMLElement;
        const tag = target.tagName.toLowerCase();
        const editable = target.isContentEditable || ['input','textarea'].includes(tag);
        if (!editable) { (document.activeElement as HTMLElement | null)?.blur?.(); }
      }}
    >
      <Card title={coursewareName || '三维课件'} bodyStyle={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} style={{ overflow: 'hidden', height: '100%', gridArea: 'left', opacity: showLeft ? 1 : 0, visibility: showLeft ? 'visible' : 'hidden', pointerEvents: showLeft ? 'auto' : 'none', transition: 'opacity 200ms ease, visibility 200ms linear', minWidth: 0 }}>
        <Space wrap size={[8, 8]} style={{ marginBottom: 12 }}>
          <Button onClick={onFocusSelected} disabled={!selectedKey}>对焦所选</Button>
          <Button onClick={onIsolateSelected} disabled={!selectedKey}>隔离所选</Button>
          <Button onClick={onShowAll}>显示全部</Button>
        </Space>
        <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
          <Input.Search placeholder="搜索节点名" allowClear onChange={(e)=>setTreeFilter(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{
            '--tree-row-h': '28px',
            '--icon-w': '22px'
          } as any}>
            <Tree
              className="three-tree"
              showLine={{ showLeafIcon: false }}
              blockNode
              multiple
              draggable
              onDrop={(info)=>{
                const dragKey = String(info.dragNode.key);
                const dropKey = String(info.node.key);
                if (dragKey===dropKey) return;
                const dragObj = keyToObject.current.get(dragKey);
                const dropObj = keyToObject.current.get(dropKey);
                if (!dragObj || !dropObj) return;
                let p: THREE.Object3D | null = dropObj as any; while (p) { if (p===dragObj) return; p = p.parent as any; }
                const mat = dragObj.matrixWorld.clone();
                dropObj.add(dragObj);
                dragObj.updateMatrixWorld(true);
                const parentInv = new THREE.Matrix4().copy(dropObj.matrixWorld).invert();
                dragObj.matrix.copy(parentInv.multiply(mat));
                dragObj.matrix.decompose(dragObj.position, dragObj.quaternion, dragObj.scale);
                const root = modelRootRef.current!; const nodes: TreeNode[] = []; const map = keyToObject.current; map.clear(); const makeNode=(obj:THREE.Object3D):TreeNode=>{ const key=obj.uuid; map.set(key,obj); return { title: obj.name || obj.type || key.slice(0,8), key, children: obj.children?.map(makeNode) }; }; nodes.push(makeNode(root)); setTreeData(nodes); setPrsTick(v=>v+1);
              }}
              treeData={filterTree(treeData, treeFilter) as any}
              onSelect={onTreeSelect}
              selectedKeys={Array.from(selectedSet)}
              titleRender={(node: any) => (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr var(--icon-w)', alignItems: 'center', height: 'var(--tree-row-h)' }}>
                  <Dropdown trigger={["contextMenu"]} menu={{
                    onClick: ({ key })=> handleNodeAction(String(key), String(node.key)),
                    items:[
                      { key:'rename', label:'重命名' },
                      { type:'divider' },
                      { key:'group', label:'打组(含多选)' },
                      { key:'ungroup', label:'解组' },
                      { type:'divider' },
                      { key:'delete', danger:true, label:'删除' }
                    ]
                  }}>
                    <span title={node.title} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor:'context-menu' }}>{node.title}</span>
                  </Dropdown>
                  <Button size="small" type="text" style={{ width: 'var(--icon-w)', textAlign: 'center' }} onClick={(e)=>{ e.stopPropagation(); onToggleHide(String(node.key), !hiddenKeys.has(String(node.key))); }} icon={hiddenKeys.has(String(node.key)) ? <EyeInvisibleOutlined /> : <EyeOutlined />} />
                </div>
              )}
            />
            <style>{`
              .three-tree .ant-tree-treenode { padding: 0 4px; }
              .three-tree .ant-tree-node-content-wrapper { width: 100%; }
              .three-tree .ant-tree-node-content-wrapper:hover { background: rgba(148,163,184,0.08); }
              .three-tree .ant-tree-indent-unit { width: 10px; }
              .three-tree .ant-tree-switcher, .three-tree .ant-tree-iconEle { width: 18px; }
              .three-tree .ant-tree-switcher-line-icon { color: #64748b; }
            `}</style>
          </div>
        </div>
      </Card>
      <Card title={<div style={{ position:'relative', display:'flex', alignItems:'center', minHeight: 36 }}>
        <span style={{ fontWeight: 600 }}>三维视窗</span>
        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)' }}>
          <Segmented
            size="large"
            value={mode}
            onChange={(v)=>{ const next=v as any; if (next==='annot') { resetSceneToInitial(); } setMode(next); }}
            options={[{label:'添加标注', value:'annot'},{label:'制作动画', value:'anim'}]}
            className="mode-seg"
            style={{ padding: 4, borderRadius: 999 }}
          />
        </div>
        <style>{`.mode-seg .ant-segmented-item-selected{background:#06b6d4;color:#fff}`}</style>
      </div>} bodyStyle={{ padding: 0, height: '100%' }} style={{ height: '100%', gridArea: 'center', display: 'flex', flexDirection: 'column', minWidth: 0 }}
        extra={(
          <Space>
            <Switch checkedChildren="标签开" unCheckedChildren="标签关" checked={showAnnotations} onChange={(v)=>{ setShowAnnotations(v); refreshMarkers(); }} />
            {coursewareId && (
              <>
                <Tooltip title={lastSaved ? `上次保存: ${lastSaved.toLocaleTimeString()}` : '点击保存 (Ctrl+S)'}>
                  <Button 
                    size="small" 
                    icon={saving ? <ClockCircleOutlined spin /> : <SaveOutlined />} 
                    onClick={saveCourseware}
                    loading={saving}
                    type={lastSaved ? 'default' : 'primary'}
                  >
                    {saving ? '保存中' : '保存'}
                  </Button>
                </Tooltip>
              </>
            )}
            <Button size="small" icon={<SettingOutlined />} onClick={()=>setSettingsOpen(true)}>设置</Button>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'export-glb',
                    label: '导出 GLB',
                    onClick: async () => {
                      // 导出前的调试信息
                      console.log('🎯 [手动GLB导出] 当前动画状态:');
                      console.log(`  活动动画: ${activeClipId}`);
                      console.log(`  动画总数: ${clips.length}`);
                      
                      const activeClip = clips.find(c => c.id === activeClipId);
                      if (activeClip) {
                        console.log(`  当前动画显隐轨道数: ${Object.keys(activeClip.timeline.visTracks || {}).length}`);
                        Object.entries(activeClip.timeline.visTracks || {}).forEach(([uuid, keyframes]) => {
                          const obj = keyToObject.current.get(uuid);
                          const objName = obj?.name || uuid.slice(0,8);
                          console.log(`    [显隐轨道] ${objName}: ${keyframes.length}个关键帧 - ${keyframes.map(k => `${k.time}s:${k.value ? '显' : '隐'}`).join(' ')}`);
                        });
                      }
                      
                      const blob = await exportCurrentModelAsGLB();
                      if (!blob) { message.error('导出失败'); return; }
                      const a = document.createElement('a');
                      a.href = URL.createObjectURL(blob);
                      a.download = `${coursewareName||'模型'}.glb`;
                      a.click();
                      URL.revokeObjectURL(a.href);
                      
                      console.log('✅ [手动GLB导出] 文件已下载，请在Windows模型查看器中检查显隐动画效果');
                    }
                  },
                  {
                    key: 'export-png',
                    label: '导出 PNG 截图',
                    onClick: async () => {
                      const renderer = rendererRef.current;
                      if (!renderer) { message.error('渲染器未初始化'); return; }
                      renderer.render(sceneRef.current!, cameraRef.current!);
                      rendererRef.current!.domElement.toBlob((blob)=>{
                        if (!blob) { message.error('截图失败'); return; }
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = `${coursewareName||'视图'}.png`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      });
                    }
                  }
                ]
              }}
            >
              <Button size="small">导出</Button>
            </Dropdown>
          </Space>
        )}
      >
        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', top: 56, zIndex: 5, background:'rgba(15,23,42,0.7)', backdropFilter:'blur(6px)', padding:8, borderRadius:8, display:'flex', alignItems:'center', gap:8, boxShadow:'0 2px 8px rgba(0,0,0,0.25)' }}>
          <Tooltip title="平移"><Button size="small" type={gizmoMode==='translate'?'primary':'default'} icon={<IconTranslate />} onClick={()=>{ setGizmoMode('translate'); tcontrolsRef.current?.setMode('translate'); }} /></Tooltip>
          <Tooltip title="旋转"><Button size="small" type={gizmoMode==='rotate'?'primary':'default'} icon={<IconRotate />} onClick={()=>{ setGizmoMode('rotate'); tcontrolsRef.current?.setMode('rotate'); }} /></Tooltip>
          <Tooltip title="缩放"><Button size="small" type={gizmoMode==='scale'?'primary':'default'} icon={<IconScale />} onClick={()=>{ setGizmoMode('scale'); tcontrolsRef.current?.setMode('scale'); }} /></Tooltip>
          <Segmented size="small" value={gizmoSpace} onChange={(v)=>{ const s=v as 'local'|'world'; setGizmoSpace(s); tcontrolsRef.current?.setSpace(s as any); }} options={[{label:'局部', value:'local'},{label:'世界', value:'world'}]} />
          <Divider type="vertical" />
          <Tooltip title="正视"><Button size="small" icon={<IconViewFront />} onClick={()=>{ const c=cameraRef.current!, ctl=controlsRef.current!; const t=ctl.target.clone(); c.position.set(t.x, t.y, t.z+3); c.up.set(0,1,0); c.lookAt(t); ctl.update(); }} /></Tooltip>
          <Tooltip title="俯视"><Button size="small" icon={<IconViewTop />} onClick={()=>{ const c=cameraRef.current!, ctl=controlsRef.current!; const t=ctl.target.clone(); c.position.set(t.x, t.y+3, t.z); c.up.set(0,0,-1); c.lookAt(t); ctl.update(); }} /></Tooltip>
          <Tooltip title="左视"><Button size="small" icon={<IconViewLeft />} onClick={()=>{ const c=cameraRef.current!, ctl=controlsRef.current!; const t=ctl.target.clone(); c.position.set(t.x-3, t.y, t.z); c.up.set(0,1,0); c.lookAt(t); ctl.update(); }} /></Tooltip>
          <Tooltip title="等轴测"><Button size="small" icon={<IconViewIso />} onClick={()=>{ const c=cameraRef.current!, ctl=controlsRef.current!; const t=ctl.target.clone(); c.position.copy(t.clone().add(new THREE.Vector3(2,2,2))); c.up.set(0,1,0); c.lookAt(t); ctl.update(); }} /></Tooltip>
          <Divider type="vertical" />
          <Tooltip title="对焦所选"><Button size="small" icon={<IconFocus />} onClick={onFocusSelected} disabled={!selectedKey} /></Tooltip>
          <Tooltip title="隔离所选"><Button size="small" icon={<IconIsolate />} onClick={onIsolateSelected} disabled={!selectedKey} /></Tooltip>
          <Tooltip title="显示全部"><Button size="small" icon={<IconShowAll />} onClick={onShowAll} /></Tooltip>
        </div>
        {/* 播放控制组 */}
        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', bottom: 8, zIndex: 5, background:'rgba(15,23,42,0.7)', backdropFilter:'blur(6px)', padding:8, borderRadius:8, display:'flex', alignItems:'center', gap:8, boxShadow:'0 2px 8px rgba(0,0,0,0.25)' }}>
          <Space>
            <Button size="small" onClick={()=>{ setTimeline(v=>({ ...v, current: 0, playing: false })); applyTimelineAt(0); }}>复位</Button>
            <Button size="small" onClick={onTogglePlay}>{timeline.playing ? '暂停' : '播放'}</Button>
            <Button size="small" onClick={()=>{ // 上一步
              if (steps.length===0) return; const t = timeline.current; const prev = [...steps].filter(s=>s.time < t).sort((a,b)=>a.time-b.time).pop(); if (!prev) { setTimeline(v=>({ ...v, current: 0, playing:false })); applyTimelineAt(0); return; } setTimeline(v=>({ ...v, current: prev.time, playing:false })); applyTimelineAt(prev.time);
            }}>上一步</Button>
            <Button size="small" onClick={()=>{ // 下一步
              if (steps.length===0) return; const t = timeline.current; const next = [...steps].filter(s=>s.time > t).sort((a,b)=>a.time-b.time)[0]; if (!next) { setTimeline(v=>({ ...v, current: v.duration, playing:false })); applyTimelineAt(timeline.duration); return; } setTimeline(v=>({ ...v, current: next.time, playing:false })); applyTimelineAt(next.time);
            }}>下一步</Button>
            <span style={{ color:'#94a3b8' }}>当前步骤：{(()=>{ if (steps.length===0) return '无'; const t=timeline.current; let idx=-1; for(let i=0;i<steps.length;i++){ if (steps[i].time<=t) idx=i; } return idx>=0 ? `${idx+1}. ${steps[idx].name}` : '未到步骤'; })()}</span>
          </Space>
        </div>
        <div ref={mountRef} style={{ flex: 1, width: '100%', height: '100%', minHeight: 420, position:'relative' }}
          onMouseDown={(e)=>{
            if (!(e.ctrlKey||e.metaKey)) return;
            const host = e.currentTarget as HTMLDivElement;
            const rect = host.getBoundingClientRect();
            const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
            setBoxSel({ x0:sx, y0:sy, x1:sx, y1:sy });
            const onMove=(ev:MouseEvent)=>{ setBoxSel(prev=> prev? { ...prev, x1: ev.clientX - rect.left, y1: ev.clientY - rect.top } : null); };
            const onUp=(ev:MouseEvent)=>{
              window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp);
              const sel = boxSelRef.current; if (!sel) { setBoxSel(null); return; }
              // 计算与选择框相交的网格对象
              const r = rendererRef.current!, c = cameraRef.current!; const scene = sceneRef.current!;
              const meshes: THREE.Object3D[] = []; (modelRootRef.current)?.traverse(o=>{ const m=o as any; if (m.isMesh && (o as any).visible!==false) meshes.push(o); });
              const xMin=Math.min(sel.x0,sel.x1), xMax=Math.max(sel.x0,sel.x1); const yMin=Math.min(sel.y0,sel.y1), yMax=Math.max(sel.y0,sel.y1);
              const added: string[] = [];
              const proj = new THREE.Vector3();
              meshes.forEach(o=>{
                const box = new THREE.Box3().setFromObject(o);
                const pts=[new THREE.Vector3(box.min.x,box.min.y,box.min.z), new THREE.Vector3(box.max.x,box.min.y,box.min.z), new THREE.Vector3(box.min.x,box.max.y,box.min.z), new THREE.Vector3(box.max.x,box.max.y,box.max.z)];
                let inside=false; for (const p of pts){ proj.copy(p).project(c); const sxp=(proj.x*0.5+0.5)*r.domElement.clientWidth; const syp=(-proj.y*0.5+0.5)*r.domElement.clientHeight; if (sxp>=xMin&&sxp<=xMax&&syp>=yMin&&syp<=yMax){ inside=true; break; } }
                if (inside) added.push(o.uuid);
              });
              const newSel = new Set(selectedSet);
              added.forEach(id=>newSel.add(id));
              setSelectedSet(newSel);
              if (added.length > 0) setSelectedKey(added[0]);
              attachTransformForSelection(newSel);
              setBoxSel(null); syncHighlight(); setPrsTick(v=>v+1);
            };
            window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
          }}
        >
          {boxSel && (
            <div ref={boxLayerRef} style={{ position:'absolute', left: Math.min(boxSel.x0, boxSel.x1), top: Math.min(boxSel.y0, boxSel.y1), width: Math.abs(boxSel.x1-boxSel.x0), height: Math.abs(boxSel.y1-boxSel.y0), border:'1px dashed #60a5fa', background:'rgba(96,165,250,0.15)', pointerEvents:'none' }} />
          )}
        </div>
      </Card>
      <Card title="属性 / 选中信息" bodyStyle={{ padding: 0 }} style={{ height: '100%', overflow: 'hidden', gridArea: 'right', display: 'flex', flexDirection: 'column', opacity: showRight ? 1 : 0, visibility: showRight ? 'visible' : 'hidden', pointerEvents: showRight ? 'auto' : 'none', transition: 'opacity 200ms ease, visibility 200ms linear', minWidth: 0 }}>
        {mode==='annot' && (
            <div style={{ padding: 12, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
              <Flex vertical gap={12}>
                {selectedKey ? (
                  <Flex vertical gap={8}>
                    <div>已选中：{keyToObject.current.get(selectedKey)?.name || selectedKey}</div>
                    <Button onClick={onFocusSelected}>相机对焦</Button>
                    
                    {/* TRS编辑面板 */}
                    {(() => {
                      const obj = keyToObject.current.get(selectedKey);
                      if (!obj) return null;
                      return (
                        <>
                          <Divider style={{ margin: '8px 0' }} />
                          <div style={{ fontWeight: 600 }}>变换属性</div>
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#666' }}>位置</span>
                              <InputNumber
                                size="small"
                                value={Number(obj.position.x.toFixed(3))}
                                onChange={(v) => {
                                  obj.position.x = Number(v) || 0;
                                  setPrsTick(t => t + 1);
                                }}
                                style={{ width: '100%' }}
                                step={0.1}
                                placeholder="X"
                              />
                              <InputNumber
                                size="small"
                                value={Number(obj.position.y.toFixed(3))}
                                onChange={(v) => {
                                  obj.position.y = Number(v) || 0;
                                  setPrsTick(t => t + 1);
                                }}
                                style={{ width: '100%' }}
                                step={0.1}
                                placeholder="Y"
                              />
                              <InputNumber
                                size="small"
                                value={Number(obj.position.z.toFixed(3))}
                                onChange={(v) => {
                                  obj.position.z = Number(v) || 0;
                                  setPrsTick(t => t + 1);
                                }}
                                style={{ width: '100%' }}
                                step={0.1}
                                placeholder="Z"
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#666' }}>旋转</span>
                              <InputNumber
                                size="small"
                                value={Number((obj.rotation.x * 180 / Math.PI).toFixed(1))}
                                onChange={(v) => {
                                  obj.rotation.x = (Number(v) || 0) * Math.PI / 180;
                                  setPrsTick(t => t + 1);
                                }}
                                style={{ width: '100%' }}
                                step={1}
                                placeholder="X°"
                              />
                              <InputNumber
                                size="small"
                                value={Number((obj.rotation.y * 180 / Math.PI).toFixed(1))}
                                onChange={(v) => {
                                  obj.rotation.y = (Number(v) || 0) * Math.PI / 180;
                                  setPrsTick(t => t + 1);
                                }}
                                style={{ width: '100%' }}
                                step={1}
                                placeholder="Y°"
                              />
                              <InputNumber
                                size="small"
                                value={Number((obj.rotation.z * 180 / Math.PI).toFixed(1))}
                                onChange={(v) => {
                                  obj.rotation.z = (Number(v) || 0) * Math.PI / 180;
                                  setPrsTick(t => t + 1);
                                }}
                                style={{ width: '100%' }}
                                step={1}
                                placeholder="Z°"
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr', gap: 4, alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: '#666' }}>缩放</span>
                              <InputNumber
                                size="small"
                                value={Number(obj.scale.x.toFixed(3))}
                                onChange={(v) => {
                                  obj.scale.x = Number(v) || 1;
                                  setPrsTick(t => t + 1);
                                }}
                                style={{ width: '100%' }}
                                step={0.1}
                                min={0.001}
                                placeholder="X"
                              />
                              <InputNumber
                                size="small"
                                value={Number(obj.scale.y.toFixed(3))}
                                onChange={(v) => {
                                  obj.scale.y = Number(v) || 1;
                                  setPrsTick(t => t + 1);
                                }}
                                style={{ width: '100%' }}
                                step={0.1}
                                min={0.001}
                                placeholder="Y"
                              />
                              <InputNumber
                                size="small"
                                value={Number(obj.scale.z.toFixed(3))}
                                onChange={(v) => {
                                  obj.scale.z = Number(v) || 1;
                                  setPrsTick(t => t + 1);
                                }}
                                style={{ width: '100%' }}
                                step={0.1}
                                min={0.001}
                                placeholder="Z"
                              />
                            </div>
                          </Space>
                          <Divider style={{ margin: '8px 0' }} />
                          
                          {/* 材质属性编辑面板 */}
                          <div style={{ fontWeight: 600 }}>材质属性</div>
                          {(() => {
                            // 查找对象的Mesh及其材质
                            let meshFound: THREE.Mesh | undefined;
                            obj.traverse((child) => {
                              if (child instanceof THREE.Mesh && !meshFound) {
                                meshFound = child;
                              }
                            });
                            
                            if (!meshFound || !meshFound.material) {
                              return <div style={{ fontSize: '12px', color: '#999' }}>该对象没有材质</div>;
                            }
                            
                            const targetMesh = meshFound;
                            const materials = Array.isArray(targetMesh.material) ? targetMesh.material : [targetMesh.material];
                            const material = materials[materialIndex] || materials[0];
                            
                            // 检测材质类型
                            const materialType = material.type;
                            const isMeshBasic = material instanceof THREE.MeshBasicMaterial;
                            const isMeshLambert = material instanceof THREE.MeshLambertMaterial;
                            const isMeshPhong = material instanceof THREE.MeshPhongMaterial;
                            const isMeshStandard = material instanceof THREE.MeshStandardMaterial;
                            
                            return (
                              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                {materials.length > 1 && (
                                  <Select
                                    size="small"
                                    value={materialIndex}
                                    onChange={setMaterialIndex}
                                    style={{ width: '100%' }}
                                  >
                                    {materials.map((_, idx) => (
                                      <Select.Option key={idx} value={idx}>材质 {idx + 1}</Select.Option>
                                    ))}
                                  </Select>
                                )}
                                
                                <div style={{ fontSize: '12px', color: '#666' }}>
                                  类型: {materialType}
                                </div>
                                
                                {/* 所有材质共有属性 */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px' }}>颜色</span>
                                  <Input
                                    size="small"
                                    type="color"
                                    value={`#${(material as any).color?.getHexString() || 'ffffff'}`}
                                    onChange={(e) => {
                                      if ((material as any).color) {
                                        (material as any).color.setStyle(e.target.value);
                                        material.needsUpdate = true;
                                        materialModifiedRef.current = true; // 标记材质已修改
                                        // 立即渲染更新
                                        const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; 
                                        if (r && s && c) { 
                                          const comp = composerRef.current; 
                                          if (comp) comp.render(); 
                                          else r.render(s, c); 
                                        }
                                      }
                                    }}
                                  />
                                </div>
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px' }}>透明</span>
                                  <Switch
                                    size="small"
                                    checked={material.transparent}
                                    onChange={(checked) => {
                                      material.transparent = checked;
                                      material.needsUpdate = true;
                                      materialModifiedRef.current = true; // 标记材质已修改
                                      // 立即渲染更新
                                      const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; 
                                      if (r && s && c) { 
                                        const comp = composerRef.current; 
                                        if (comp) comp.render(); 
                                        else r.render(s, c); 
                                      }
                                    }}
                                  />
                                </div>
                                
                                {material.transparent && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px', minWidth: 60 }}>透明度</span>
                                      <Slider
                                        style={{ minWidth: 100 }}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={material.opacity}
                                        onChange={(value: number) => {
                                          material.opacity = value;
                                          material.needsUpdate = true;
                                          materialModifiedRef.current = true; // 标记材质已修改
                                          // 立即渲染更新
                                          const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; 
                                          if (r && s && c) { 
                                            const comp = composerRef.current; 
                                            if (comp) comp.render(); 
                                            else r.render(s, c); 
                                          }
                                        }}
                                      />
                                    </div>
                                )}
                                
                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                  <span style={{ fontSize: '12px' }}>渲染面</span>
                                  <Select
                                    size="small"
                                    value={material.side}
                                    onChange={(value) => {
                                      material.side = value;
                                      material.needsUpdate = true;
                                    }}
                                    style={{ width: '100%' }}
                                  >
                                    <Select.Option value={THREE.FrontSide}>正面</Select.Option>
                                    <Select.Option value={THREE.BackSide}>背面</Select.Option>
                                    <Select.Option value={THREE.DoubleSide}>双面</Select.Option>
                                  </Select>
                                </div>
                                
                                {/* MeshStandardMaterial 特有属性 */}
                                {isMeshStandard && (
                                  <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px', minWidth: 60 }}>金属度</span>
                                      <Slider
                                        key={`metalness-${materialPropsKey}-${materialIndex}`}
                                        style={{ minWidth: 100 }}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={Number((material as THREE.MeshStandardMaterial).metalness) || 0}
                                        onChange={(val) => {
                                          const value = typeof val === 'number' ? val : Number(val);
                                          if (!isNaN(value)) {
                                            (material as THREE.MeshStandardMaterial).metalness = value;
                                            material.needsUpdate = true;
                                            materialModifiedRef.current = true; // 标记材质已修改
                                            setMaterialPropsKey(k => k + 1); // 强制更新
                                            const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; if (r && s && c) { const comp = composerRef.current; if (comp) comp.render(); else r.render(s, c); }
                                          }
                                        }}
                                      />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px', minWidth: 60 }}>粗糙度</span>
                                      <Slider
                                        key={`roughness-${materialPropsKey}-${materialIndex}`}
                                        style={{ minWidth: 100 }}
                                        min={0}
                                        max={1}
                                        step={0.01}
                                        value={Number((material as THREE.MeshStandardMaterial).roughness) || 0}
                                        onChange={(val) => {
                                          const value = typeof val === 'number' ? val : Number(val);
                                          if (!isNaN(value)) {
                                            (material as THREE.MeshStandardMaterial).roughness = value;
                                            material.needsUpdate = true;
                                            materialModifiedRef.current = true; // 标记材质已修改
                                            setMaterialPropsKey(k => k + 1); // 强制更新
                                            const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; if (r && s && c) { const comp = composerRef.current; if (comp) comp.render(); else r.render(s, c); }
                                          }
                                        }}
                                      />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px' }}>自发光</span>
                                      <Input
                                        size="small"
                                        type="color"
                                        value={`#${(material as THREE.MeshStandardMaterial).emissive?.getHexString() || '000000'}`}
                                        onChange={(e) => {
                                          (material as THREE.MeshStandardMaterial).emissive?.setStyle(e.target.value);
                                          material.needsUpdate = true;
                                          materialModifiedRef.current = true; // 标记材质已修改
                                          // 立即渲染更新
                                          const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; 
                                          if (r && s && c) { 
                                            const comp = composerRef.current; 
                                            if (comp) comp.render(); 
                                            else r.render(s, c); 
                                          }
                                        }}
                                      />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px', minWidth: 60 }}>自发光强度</span>
                                      <Slider
                                        key={`emissiveIntensity-${materialPropsKey}-${materialIndex}`}
                                        style={{ minWidth: 100 }}
                                        min={0}
                                        max={10}
                                        step={0.1}
                                        value={Number((material as THREE.MeshStandardMaterial).emissiveIntensity) || 0}
                                        onChange={(val) => {
                                          const value = typeof val === 'number' ? val : Number(val);
                                          if (!isNaN(value)) {
                                            (material as THREE.MeshStandardMaterial).emissiveIntensity = value;
                                            material.needsUpdate = true;
                                            materialModifiedRef.current = true; // 标记材质已修改
                                            setMaterialPropsKey(k => k + 1); // 强制更新
                                            const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; if (r && s && c) { const comp = composerRef.current; if (comp) comp.render(); else r.render(s, c); }
                                          }
                                        }}
                                      />
                                    </div>
                                  </>
                                )}
                                
                                {/* MeshPhongMaterial 特有属性 */}
                                {isMeshPhong && (
                                  <>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px' }}>高光颜色</span>
                                      <Input
                                        size="small"
                                        type="color"
                                        value={`#${(material as THREE.MeshPhongMaterial).specular?.getHexString() || 'ffffff'}`}
                                        onChange={(e) => {
                                          (material as THREE.MeshPhongMaterial).specular?.setStyle(e.target.value);
                                          material.needsUpdate = true;
                                        }}
                                      />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px', minWidth: 60 }}>光泽度</span>
                                      <Slider
                                        key={`shininess-${materialPropsKey}-${materialIndex}`}
                                        style={{ minWidth: 100 }}
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={Number((material as THREE.MeshPhongMaterial).shininess) || 0}
                                        onChange={(val) => {
                                          const value = typeof val === 'number' ? val : Number(val);
                                          if (!isNaN(value)) {
                                            (material as THREE.MeshPhongMaterial).shininess = value;
                                            material.needsUpdate = true;
                                            setMaterialPropsKey(k => k + 1); // 强制更新
                                            const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; if (r && s && c) { const comp = composerRef.current; if (comp) comp.render(); else r.render(s, c); }
                                          }
                                        }}
                                      />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                      <span style={{ fontSize: '12px' }}>自发光</span>
                                      <Input
                                        size="small"
                                        type="color"
                                        value={`#${(material as THREE.MeshPhongMaterial).emissive?.getHexString() || '000000'}`}
                                        onChange={(e) => {
                                          (material as THREE.MeshPhongMaterial).emissive?.setStyle(e.target.value);
                                          material.needsUpdate = true;
                                          materialModifiedRef.current = true; // 标记材质已修改
                                          // 立即渲染更新
                                          const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; 
                                          if (r && s && c) { 
                                            const comp = composerRef.current; 
                                            if (comp) comp.render(); 
                                            else r.render(s, c); 
                                          }
                                        }}
                                      />
                                    </div>
                                  </>
                                )}
                                
                                {/* MeshLambertMaterial 特有属性 */}
                                {isMeshLambert && (
                                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 4, alignItems: 'center' }}>
                                    <span style={{ fontSize: '12px' }}>自发光</span>
                                    <Input
                                      size="small"
                                      type="color"
                                      value={`#${(material as THREE.MeshLambertMaterial).emissive?.getHexString() || '000000'}`}
                                      onChange={(e) => {
                                        (material as THREE.MeshLambertMaterial).emissive?.setStyle(e.target.value);
                                        material.needsUpdate = true;
                                        materialModifiedRef.current = true; // 标记材质已修改
                                        // 立即渲染更新
                                        const r = rendererRef.current; const s = sceneRef.current; const c = cameraRef.current; 
                                        if (r && s && c) { 
                                          const comp = composerRef.current; 
                                          if (comp) comp.render(); 
                                          else r.render(s, c); 
                                        }
                                      }}
                                    />
                                  </div>
                                )}
                              </Space>
                            );
                          })()}
                          <Divider style={{ margin: '8px 0' }} />
                        </>
                      );
                    })()}
                    
                    {isAnnotationPlacing ? (
                      <Flex vertical gap={8}>
                        <div style={{ color: '#1890ff', fontWeight: 'bold' }}>
                          📍 请点击对象表面选择标注位置
                        </div>
                        <div style={{ fontSize: '12px', color: '#666' }}>
                          目标对象: {placingAnnotationTarget?.name || '未知'}
                        </div>
                        <Button danger onClick={cancelAnnotationPlacing}>取消选择位置</Button>
                      </Flex>
                    ) : (
                      <Button type="primary" onClick={addAnnotationForSelected}>为所选添加标注</Button>
                    )}
                  </Flex>
                ) : <div>点击结构树或视窗选择对象</div>}
                <Divider />
                <div style={{ fontWeight: 600 }}>标注列表</div>
                <div>
                  {(annotations||[]).map(a => (
                    <div key={a.id} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', alignItems:'center', gap:8, padding:'6px 0', borderBottom:'1px dashed rgba(148,163,184,0.2)' }}>
                      <div title={a.label.title} style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.label.title}</div>
                      <Button size="small" onClick={()=>{ setEditingAnno(a); const target=keyToObject.current.get(a.targetKey); if(target) selectObject(target); }}>编辑</Button>
                      <Button size="small" danger onClick={()=> setAnnotations(prev=>prev.filter(x=>x.id!==a.id))}>删除</Button>
                    </div>
                  ))}
                </div>
              </Flex>
            </div>
        )}
        {mode==='anim' && (
            <div style={{ padding: 12, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
              {selectedKey ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ color: '#94a3b8', marginBottom: 6 }}>对象：{keyToObject.current.get(selectedKey)?.name || selectedKey}</div>
                  <Space direction="vertical" size={6}>
                    <Space>
                      <InputNumber addonBefore="Px" step={0.01} value={keyToObject.current.get(selectedKey)?.position.x} onChange={(v)=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return; obj.position.x=Number(v||0); obj.updateMatrixWorld(); if (autoKeyRef.current) setVisibilityAtCurrent(selectedKey!, obj.visible); }} />
                      <InputNumber addonBefore="Py" step={0.01} value={keyToObject.current.get(selectedKey)?.position.y} onChange={(v)=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return; obj.position.y=Number(v||0); obj.updateMatrixWorld(); }} />
                      <InputNumber addonBefore="Pz" step={0.01} value={keyToObject.current.get(selectedKey)?.position.z} onChange={(v)=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return; obj.position.z=Number(v||0); obj.updateMatrixWorld(); }} />
                    </Space>
                    <Space>
                      <InputNumber addonBefore="Rx" step={0.01} value={keyToObject.current.get(selectedKey)?.rotation.x} onChange={(v)=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return; obj.rotation.x=Number(v||0); obj.updateMatrixWorld(); }} />
                      <InputNumber addonBefore="Ry" step={0.01} value={keyToObject.current.get(selectedKey)?.rotation.y} onChange={(v)=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return; obj.rotation.y=Number(v||0); obj.updateMatrixWorld(); }} />
                      <InputNumber addonBefore="Rz" step={0.01} value={keyToObject.current.get(selectedKey)?.rotation.z} onChange={(v)=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return; obj.rotation.z=Number(v||0); obj.updateMatrixWorld(); }} />
                    </Space>
                    <Space>
                      <InputNumber addonBefore="Sx" step={0.01} value={keyToObject.current.get(selectedKey)?.scale.x} onChange={(v)=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return; obj.scale.x=Number(v||1); obj.updateMatrixWorld(); }} />
                      <InputNumber addonBefore="Sy" step={0.01} value={keyToObject.current.get(selectedKey)?.scale.y} onChange={(v)=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return; obj.scale.y=Number(v||1); obj.updateMatrixWorld(); }} />
                      <InputNumber addonBefore="Sz" step={0.01} value={keyToObject.current.get(selectedKey)?.scale.z} onChange={(v)=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return; obj.scale.z=Number(v||1); obj.updateMatrixWorld(); }} />
                    </Space>
                    <div>
                      <span style={{ marginRight: 8 }}>显示</span>
                      <Switch checked={(()=>{ const obj=keyToObject.current.get(selectedKey!); if(!obj) return false; // 计算有效可见性：自身和祖先都可见
                        let p: THREE.Object3D | null = obj; while (p) { if ((p as any).visible === false) return false; p = p.parent as any; } return true; })()}
                        onChange={(checked)=>{
                          const obj = keyToObject.current.get(selectedKey!); if(!obj) return; obj.visible = checked; setPrsTick(v=>v+1); if (autoKeyRef.current) setVisibilityAtCurrent(selectedKey!, checked); }} />
                    </div>
                  </Space>
                  {selectedSet.size>1 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ color:'#94a3b8', marginBottom: 4 }}>批量操作</div>
                      <Space wrap>
                        <Input placeholder="前缀" style={{ width:120 }} onChange={(e)=>{ (window as any).__rn_prefix = e.target.value; }} />
                        <Input placeholder="后缀" style={{ width:120 }} onChange={(e)=>{ (window as any).__rn_suffix = e.target.value; }} />
                        <Button size="small" onClick={()=>{
                          const prefix=String((window as any).__rn_prefix||''); const suffix=String((window as any).__rn_suffix||'');
                          Array.from(selectedSet).forEach(k=>{ const o=keyToObject.current.get(k); if (o) o.name = `${prefix}${o.name||k.slice(0,8)}${suffix}`;});
                          setPrsTick(v=>v+1); rebuildTree();
                        }}>批量重命名</Button>
                        <Divider type="vertical" />
                        <InputNumber size="small" placeholder="平移吸附" step={0.01} onChange={(v)=>{ setGizmoSnap(s=>({ ...s, t: (v==null? undefined: Number(v)) })); tcontrolsRef.current?.setTranslationSnap(((v==null)? null: Number(v)) as any); }} />
                        <InputNumber size="small" placeholder="旋转吸附°" step={1} onChange={(v)=>{ setGizmoSnap(s=>({ ...s, r: (v==null? undefined: Number(v)) })); tcontrolsRef.current?.setRotationSnap(((v==null)? null: Number(v)*Math.PI/180) as any); }} />
                        <InputNumber size="small" placeholder="缩放吸附" step={0.01} onChange={(v)=>{ setGizmoSnap(s=>({ ...s, s: (v==null? undefined: Number(v)) })); tcontrolsRef.current?.setScaleSnap(((v==null)? null: Number(v)) as any); }} />
                        <Divider type="vertical" />
                        <Button size="small" onClick={()=>{ const ids=Array.from(selectedSet); if (ids.length<2) return; const base=keyToObject.current.get(ids[0])!; const bx=base.position.clone(), br=base.rotation.clone(), bs=base.scale.clone(); ids.slice(1).forEach(id=>{ const o=keyToObject.current.get(id)!; o.position.copy(bx); o.rotation.copy(br); o.scale.copy(bs); o.updateMatrixWorld(); }); setPrsTick(v=>v+1); }}>对齐到首个</Button>
                      </Space>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 6, color: '#94a3b8' }}>未选中对象</div>
              )}
            </div>
        )}
      </Card>
      <Card title={
        <div style={{ display:'flex', alignItems:'center', gap: 12 }}>
          <span>时间线</span>
          <Button size="middle" onClick={()=>setAutoKey(v=>!v)}
            style={{ background: autoKey ? '#ef4444' : '#22c55e', borderColor: autoKey ? '#ef4444' : '#22c55e', color: '#fff', boxShadow: 'none', padding: '4px 12px', fontWeight: 600, animation: autoKey ? 'blink 0.9s linear infinite' : undefined }}>
            {autoKey?'录制中':'开始录制'}
          </Button>
          <style>{`@keyframes blink { 0%{opacity:1} 50%{opacity:.6} 100%{opacity:1} }`}</style>
        </div>
      } bodyStyle={{ padding: 12, position: 'relative', minHeight: 0, display: 'flex', flexDirection: 'column' }} style={{ gridArea: 'timeline', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -1px 0 #334155 inset', minHeight: 0 }}>
          <div onMouseDown={(e)=>{
            const startY = e.clientY; const start = timelineHeight;
            const onMove = (ev: MouseEvent) => { setTimelineHeight(Math.max(160, Math.min(window.innerHeight-120, start + (startY - ev.clientY)))); };
            const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
            title="拖拽调整时间线高度"
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 12, cursor: 'row-resize', zIndex: 10, background: 'rgba(148,163,184,0.15)' }}
          />
          <Flex justify="space-between" align="center" wrap style={{ flex: '0 0 auto' }} onMouseDown={(e)=>{ if ((e.target as HTMLElement).closest('.track-area')) return; (window as any).__selectedKeyId = undefined; setSelectedCamKeyIdx(null); setSelectedTrs(null); setSelectedVis(null); }}>
            <Space>
              {/* 删除：播放/导入/导出，转移到三维视窗底部控件 */}
            </Space>
            <Space>
              <span style={{ color: '#94a3b8' }}>动画</span>
              <Select size="small" placeholder="选择动画" style={{ width: 160 }} value={activeClipId||undefined} onChange={onSelectClip}
                options={(clips||[]).map(c=>({ label: c.name, value: c.id }))} />
              <Button size="small" onClick={createClip}>新建</Button>
              <Button size="small" type="primary" onClick={saveClip}>保存</Button>
              {activeClipId && (
                <Button 
                  size="small" 
                  onClick={() => {
                    const clip = clips.find(c => c.id === activeClipId);
                    if (clip) editClip(clip);
                  }}
                >
                  编辑
                </Button>
              )}
              <Divider type="vertical" />
              <span style={{ color: '#94a3b8' }}>激活轨道：</span>
              <span style={{ minWidth: 120, color: activeTrackId ? '#e2e8f0' : '#94a3b8' }}>{(()=>{ const t = activeTrackId; if(!t) return '未选择'; if(t==='cam') return '相机'; if(t.startsWith('vis:')){ const k=t.slice(4); return `显隐: ${keyToObject.current.get(k)?.name||k.slice(0,8)}`;} if(t.startsWith('trs:')){ const k=t.slice(4); return `TRS: ${keyToObject.current.get(k)?.name||k.slice(0,8)}`;} return t; })()}</span>
              <Divider type="vertical" />
              <span style={{ color: '#94a3b8' }}>已选择: </span>
              <span style={{ color: selectedKeyframes.length > 0 ? '#22d3ee' : '#94a3b8', fontWeight: selectedKeyframes.length > 0 ? 600 : 400 }}>
                {selectedKeyframes.length} 关键帧
              </span>
              <Divider type="vertical" />
              <InputNumber size="small" min={0.01} step={0.01} value={stretchFactor} onChange={(v)=>setStretchFactor(Number(v||1))} addonBefore="倍率" />
              <Button size="small" onClick={applyStretch} disabled={!selection || !activeTrackId}>拉伸</Button>
              <Button size="small" onClick={copySelection} disabled={!selection || !activeTrackId}>复制</Button>
              <Button size="small" onClick={pasteAtCurrent} disabled={!activeTrackId || !clipboard}>粘贴</Button>
              <Button size="small" danger onClick={()=>{ if (bulkDeleteSelected()) { setSelection(null); } }} disabled={!selection || !activeTrackId}>删除</Button>
              <Button size="small" onClick={()=>setSelection(null)} disabled={!selection}>清选</Button>
              <Divider type="vertical" />
              <Button size="small" onClick={copySelectedKeyframes} disabled={selectedKeyframes.length === 0}>复制(Ctrl+C)</Button>
              <Button size="small" onClick={pasteKeyframes} disabled={!keyframeClipboard}>粘贴(Ctrl+V)</Button>
              {keyframeClipboard && <span style={{ color: '#94a3b8', fontSize: '12px' }}>剪贴板: {keyframeClipboard.keyframes.length}帧</span>}
            </Space>
          </Flex>
          <div style={{ marginTop: 8, flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
            <Flex align="center" gap={8}>
              <span>时长(s)</span>
              <InputNumber min={1} max={600} value={timeline.duration} onChange={onChangeDuration} />
              <span>时间(s)</span>
              <InputNumber min={0} max={timeline.duration} step={0.01} value={Number((timeline.current || 0).toFixed(2))} onChange={(v)=> onScrub(Number(v||0))} />
            </Flex>
            <div style={{ paddingLeft: 80 + trackLabelWidth }}>
              <div ref={rulerScrollRef} style={{ overflowX:'auto', overflowY:'hidden' }}
                onScroll={(e)=>{ if (tracksScrollRef.current) tracksScrollRef.current.scrollLeft = (e.target as HTMLDivElement).scrollLeft; }}
                onWheel={(e)=>{ if (e.ctrlKey) return; e.preventDefault(); const el=e.currentTarget as HTMLDivElement; const rect = el.getBoundingClientRect(); const mouseX = e.clientX - rect.left + el.scrollLeft; const timeAtMouse = mouseX / Math.max(1, pxPerSec); const factor = e.deltaY>0 ? 0.9 : 1.1; const next = Math.max(20, Math.min(400, pxPerSec*factor)); const centerPxBefore = timeAtMouse * pxPerSec; const centerPxAfter = timeAtMouse * next; const scrollLeft = el.scrollLeft + (centerPxAfter - centerPxBefore); setPxPerSec(next); requestAnimationFrame(()=>{ if (rulerScrollRef.current) rulerScrollRef.current.scrollLeft = scrollLeft; if (tracksScrollRef.current) tracksScrollRef.current.scrollLeft = scrollLeft; }); }}
              >
                <div style={{ position:'relative', height: 46, minWidth: `${pxPerSec*timeline.duration}px` }}>
                  {/* ruler at bottom */}
                  <div style={{ position:'absolute', left:0, right:0, bottom:0 }}>
                    <TimeRuler duration={timeline.duration} pxPerSec={pxPerSec} current={timeline.current} onScrub={onScrub} />
                  </div>
                  {/* 步骤标记（仅显示序号，悬浮显示名称，点击或拖拽） */}
                  <div style={{ position:'absolute', left:0, right:0, top: 4, height: 16, pointerEvents:'none' }}>
                    {steps.map((s, i)=> (
                      <div key={s.id}
                        title={`${i+1}. ${s.name||''}`}
                        onMouseDown={(e)=>{ 
                          e.stopPropagation(); e.preventDefault();
                          const sc = rulerScrollRef.current; if (!sc) return;
                          let moved=false;
                          const rect = sc.getBoundingClientRect();
                          const toTime=(clientX:number)=>{ const x = Math.max(0, clientX - rect.left + sc.scrollLeft); return Math.max(0, Math.min(timeline.duration, x/Math.max(1, pxPerSec))); };
                          const onMove=(ev:MouseEvent)=>{ moved=true; const t = toTime(ev.clientX); setSteps(prev=>prev.map(x=>x.id===s.id?{...x,time:t}:x).sort((a,b)=>a.time-b.time)); };
                          const onUp=(ev:MouseEvent)=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); if (!moved) { setEditingStep(s); stepForm.setFieldsValue({ name: s.name||`步骤${i+1}` }); setStepModalOpen(true); } };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                        style={{ position:'absolute', left: `${s.time*pxPerSec}px`, transform:'translateX(-50%)', top: 0, background:'#0ea5b7', color:'#fff', borderRadius: 8, width:16, height:16, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, pointerEvents:'auto', boxShadow:'0 2px 4px rgba(0,0,0,0.25)', cursor:'ew-resize' }}>
                        {i+1}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* spacer reserved for future timeline zoom bar */}
          </div>
          <div className="track-area" style={{ marginTop: 8, flex: '1 1 auto', minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', paddingRight: 8 }} onMouseDown={(e)=>{ if ((e.target as HTMLElement).closest('[data-keyframe]')) return; (window as any).__selectedKeyId = undefined; setSelectedCamKeyIdx(null); setSelectedTrs(null); setSelectedVis(null); }}>
            {/* 固定不滚动的操作按钮区域 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ width: 80 }}>步骤</strong>
                <Button size="small" onClick={()=>{ setStepDraftTime(timeline.current); setEditingStep(null); stepForm.setFieldsValue({ name: `步骤${steps.length+1}` }); setStepModalOpen(true); }}>添加步骤</Button>
                <span style={{ color:'#94a3b8' }}>当前动画：</span>
                <span style={{ color: clips.find(c=>c.id===activeClipId)?.name ? '#e2e8f0' : '#94a3b8' }}>{clips.find(c=>c.id===activeClipId)?.name || '未选择'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ width: 80 }}>相机</strong>
                <Button size="small" onClick={addCameraKeyframe}>添加关键帧</Button>
                <span style={{ color: '#94a3b8' }}>缓动</span>
                <Select size="small" value={cameraKeyEasing} style={{ width: 110 }} onChange={(v)=>setCameraKeyEasing(v)}
                  options={[{label:'easeInOut', value:'easeInOut'},{label:'linear', value:'linear'}]} />
                <span style={{ color: '#94a3b8' }}>关键帧数：{timeline.cameraKeys.length}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ width: 80 }}>显隐(所选)</strong>
                <Button size="small" disabled={!selectedKey} onClick={addVisibilityKeyframeForSelected}>添加关键帧</Button>
                <Button size="small" disabled={!selectedKey} onClick={()=> setVisibilityAtCurrentForSelected(true)}>设为显示</Button>
                <Button size="small" disabled={!selectedKey} onClick={()=> setVisibilityAtCurrentForSelected(false)}>设为隐藏</Button>
                <span style={{ color: '#94a3b8' }}>轨道数：{Object.keys(timeline.visTracks).length}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ width: 80 }}>TRS(所选)</strong>
                <Button size="small" disabled={!selectedKey} onClick={addTRSKeyForSelected}>添加关键帧</Button>
                <span style={{ color: '#94a3b8' }}>轨道数：{Object.keys(timeline.trsTracks).length}</span>
              </div>
            </div>
            
            {/* 轨道区域：真正的两列布局 */}
            <div style={{ display: 'flex' }}>
              {/* 左侧固定标签列 */}
              <div style={{ width: 80 + trackLabelWidth, flexShrink: 0 }}>
                <Flex vertical gap={8}>
                  {/* 相机轨道标签 */}
                  <div style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, color: '#94a3b8' }}>
                    <span title="相机">相机</span>
                  </div>
                  
                  {/* 显隐轨道标签 */}
                  {Object.entries(timeline.visTracks).map(([objKey]) => (
                    <div key={`vis-label-${objKey}`} style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, color: '#94a3b8', marginBottom: 8 }}>
                      <span title={keyToObject.current.get(objKey)?.name || objKey.slice(0,8)} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {keyToObject.current.get(objKey)?.name || objKey.slice(0,8)}
                      </span>
                    </div>
                  ))}
                  
                  {/* TRS轨道标签 */}
                  {Object.entries(timeline.trsTracks).map(([objKey]) => (
                    <div key={`trs-label-${objKey}`} style={{ height: 22, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 8, color: '#94a3b8', marginBottom: 8 }}>
                      <span title={keyToObject.current.get(objKey)?.name || objKey.slice(0,8)} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {keyToObject.current.get(objKey)?.name || objKey.slice(0,8)}
                      </span>
                    </div>
                  ))}
                </Flex>
              </div>
              
              {/* 右侧可滚动轨道列 - 确保有滚动条显示 */}
              <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <div ref={tracksScrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%' }} onScroll={(e)=>{ if (rulerScrollRef.current) rulerScrollRef.current.scrollLeft = (e.target as HTMLDivElement).scrollLeft; }}>
                  <div style={{ minWidth: `${pxPerSec*timeline.duration}px`, position: 'relative' }}>

                    {/* 全局选择区域显示 */}
                    {globalSel && (
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${Math.min(globalSel.start, globalSel.end) * pxPerSec}px`,
                        width: `${Math.abs(globalSel.end - globalSel.start) * pxPerSec}px`,
                        background: 'rgba(96,165,250,0.2)',
                        border: '1px solid rgba(59,130,246,0.6)',
                        pointerEvents: 'none',
                        zIndex: 15
                      }} />
                    )}
                    <Flex vertical gap={8}>
                      {/* 相机轨道 */}
                      <div style={{ position:'relative' }} onClick={()=>{ setSelectedTrs(null); setSelectedVis(null); setSelectedCamKeyIdx(null); setActiveTrackId('cam'); }}>
                        <DraggableMiniTrack
                          duration={timeline.duration}
                          keys={(timeline.cameraKeys||[]).map(k=>k.time)}
                          color="#60a5fa"
                          trackId={`cam`}
                          pxPerSec={pxPerSec}
                          scrollerRef={tracksScrollRef}
                          selection={activeTrackId==='cam'?selection:null}
                          onSelectionChange={(sel)=>{ setActiveTrackId('cam'); setSelection(sel); }}
                          onActivate={()=> setActiveTrackId('cam') }
                          onChangeKeyTime={(idx, t)=> { (window as any).__selectedKeyId = `cam:${idx}`; setSelectedTrs(null); setSelectedVis(null); setSelectedCamKeyIdx(idx); updateCameraKeyTime(idx, t); }}
                          onSelectKey={(idx)=>{ (window as any).__selectedKeyId = `cam:${idx}`; setMode('anim'); setSelectedTrs(null); setSelectedVis(null); setSelectedCamKeyIdx(idx); setActiveTrackId('cam'); }}
                          onGlobalSelectionStart={handleGlobalSelectionStart}
                          trackType="cam"
                          selectedKeyframes={selectedKeyframes}
                          setSelectedKeyframes={setSelectedKeyframes}
                          moveSelectedKeyframes={moveSelectedKeyframes}
                        />
                      </div>
                      
                      {/* 显示所有对象的显隐轨道 */}
                      {Object.entries(timeline.visTracks).map(([objKey, list]) => (
                        <div key={objKey} style={{ position:'relative', marginBottom: 8 }} onClick={()=>{ setSelectedKey(objKey); setSelectedTrs(null); setSelectedCamKeyIdx(null); setActiveTrackId(`vis:${objKey}`); }}>
                          <DraggableMiniTrack
                            duration={timeline.duration}
                            keys={(list||[]).map(k=>k.time)}
                            color="#34d399"
                            trackId={`vis:${objKey}`}
                            pxPerSec={pxPerSec}
                            scrollerRef={tracksScrollRef}
                            selection={activeTrackId===`vis:${objKey}`?selection:null}
                            onSelectionChange={(sel)=>{ setActiveTrackId(`vis:${objKey}`); setSelection(sel); }}
                            onActivate={()=> setActiveTrackId(`vis:${objKey}`)}
                            onChangeKeyTime={(idx, t)=>{ (window as any).__selectedKeyId = `vis:${objKey}:${idx}`; setSelectedCamKeyIdx(null); setSelectedTrs(null); setSelectedVis({ key: objKey, index: idx }); if (selectedKey===objKey) updateVisibilityKeyTime(idx, t); else { setSelectedKey(objKey); updateVisibilityKeyTime(idx, t); } }}
                            onSelectKey={(idx)=>{ (window as any).__selectedKeyId = `vis:${objKey}:${idx}`; setMode('anim'); setSelectedCamKeyIdx(null); setSelectedTrs(null); setSelectedVis({ key: objKey, index: idx }); if (selectedKey!==objKey) setSelectedKey(objKey); setActiveTrackId(`vis:${objKey}`); }}
                            onGlobalSelectionStart={handleGlobalSelectionStart}
                            trackType="vis"
                            selectedKeyframes={selectedKeyframes}
                            setSelectedKeyframes={setSelectedKeyframes}
                            moveSelectedKeyframes={moveSelectedKeyframes}
                          />
                        </div>
                      ))}
                      
                      {/* 显示所有对象的 TRS 轨道 */}
                      {Object.entries(timeline.trsTracks).map(([objKey, list]) => (
                        <div key={objKey} style={{ position:'relative', marginBottom: 8 }} onClick={()=>{ setSelectedKey(objKey); setActiveTrackId(`trs:${objKey}`); }}>
                          <DraggableMiniTrack
                            duration={timeline.duration}
                            keys={(list||[]).map(k=>k.time)}
                            color="#f59e0b"
                            trackId={`trs:${objKey}`}
                            pxPerSec={pxPerSec}
                            scrollerRef={tracksScrollRef}
                            selection={activeTrackId===`trs:${objKey}`?selection:null}
                            onSelectionChange={(sel)=>{ setActiveTrackId(`trs:${objKey}`); setSelection(sel); }}
                            onActivate={()=> setActiveTrackId(`trs:${objKey}`)}
                            onChangeKeyTime={(idx, t)=>{ (window as any).__selectedKeyId = `trs:${objKey}:${idx}`; setSelectedCamKeyIdx(null); setSelectedVis(null); setSelectedTrs({ key: objKey, index: idx }); if (selectedKey!==objKey) setSelectedKey(objKey); updateTRSKeyTime(idx, t);} }
                            onSelectKey={(idx)=>{ (window as any).__selectedKeyId = `trs:${objKey}:${idx}`; setMode('anim'); setSelectedCamKeyIdx(null); setSelectedVis(null); setSelectedTrs({ key: objKey, index: idx }); if (selectedKey!==objKey) setSelectedKey(objKey); setActiveTrackId(`trs:${objKey}`); }}
                            onGlobalSelectionStart={handleGlobalSelectionStart}
                            trackType="trs"
                            selectedKeyframes={selectedKeyframes}
                            setSelectedKeyframes={setSelectedKeyframes}
                            moveSelectedKeyframes={moveSelectedKeyframes}
                          />
                        </div>
                      ))}
                      {/* 标注全局轨道已移除，不在动画编辑中显示 */}
                    </Flex>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </Card>
      <AnnotationEditor open={!!editingAnno} value={editingAnno} onCancel={()=>setEditingAnno(null)} onOk={(v)=>{ if (!v) return; setAnnotations(prev => prev.map(x => x.id === v.id ? v : x)); setEditingAnno(null); }} onDelete={(id)=>{ setAnnotations(prev=>prev.filter(a=>a.id!==id)); setEditingAnno(null); }} />
      <SettingsModal />
      <Modal title="重命名" open={renameOpen} onCancel={()=>setRenameOpen(false)} onOk={async ()=>{ const v=await renameForm.validateFields(); const key=(window as any).__renameKey as string; const obj=keyToObject.current.get(key); if(obj){ obj.name=String(v.name||''); setPrsTick(x=>x+1); const root=modelRootRef.current!; const nodes:TreeNode[]=[]; const map=keyToObject.current; map.clear(); const makeNode=(o:THREE.Object3D):TreeNode=>{ const k=o.uuid; map.set(k,o); return { title:o.name||o.type||k.slice(0,8), key:k, children:o.children?.map(makeNode) }; }; nodes.push(makeNode(root)); setTreeData(nodes); } setRenameOpen(false); }} destroyOnClose>
        <Form layout="vertical" form={renameForm} preserve={false}>
          <Form.Item name="name" label="名称" rules={[{ required:true, message:'请输入名称' }]}>
            <Input />
          </Form.Item>
        </Form>
      </Modal>
      <StepEditor
        open={stepModalOpen}
        value={editingStep ? { id: editingStep.id, name: editingStep.name } : null}
        defaultTime={stepDraftTime}
        onCancel={()=>{ setStepModalOpen(false); setEditingStep(null); }}
        onDelete={()=>{ if (!editingStep) return; setSteps(prev=>prev.filter(s=>s.id!==editingStep.id)); setStepModalOpen(false); setEditingStep(null); }}
        onSave={(name)=>{
          if (editingStep) {
            setSteps(prev=>prev.map(s=>s.id===editingStep.id?{...s,name}:s));
            setEditingStep(null);
            setStepModalOpen(false);
          } else {
            const newStep: StepMarker = { id: generateUuid(), time: Math.max(0, Math.min(timeline.duration, stepDraftTime)), name: name||`步骤${steps.length+1}` };
            setSteps(prev=>[...prev, newStep].sort((a,b)=>a.time-b.time));
            setStepModalOpen(false);
          }
        }}
      />
      <Modal title="从 URL 导入模型" open={urlImportOpen} onCancel={()=>setUrlImportOpen(false)} onOk={()=>{ urlForm.validateFields().then(v=>{ setUrlImportOpen(false); loadModel(v.url); }); }} destroyOnClose>
        <Form layout="vertical" form={urlForm}>
          <Form.Item name="url" label="GLB URL" rules={[{ required: true, message: '请输入 GLB 直链 URL' }]}>
            <Input placeholder="https://.../model.glb" allowClear />
          </Form.Item>
          <div style={{ color:'#94a3b8' }}>支持后端代理域名以解决 CORS（已适配）</div>
        </Form>
      </Modal>
      <AnimationEditor
        open={animationModalOpen}
        value={editingAnimation}
        onCancel={() => { setAnimationModalOpen(false); setEditingAnimation(null); }}
        onSave={handleAnimationSave}
        onDelete={handleAnimationDelete}
      />
    </div>
  );
}

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  if (!q) return nodes;
  const lower = q.toLowerCase();
  const match = (n: TreeNode): boolean => (n.title||'').toLowerCase().includes(lower) || (n.children||[]).some(match);
  const mapNode = (n: TreeNode): TreeNode | null => {
    const kids = (n.children||[]).map(mapNode).filter(Boolean) as TreeNode[];
    if ((n.title||'').toLowerCase().includes(lower) || kids.length) return { ...n, children: kids };
    return null;
  };
  return nodes.map(mapNode).filter(Boolean) as TreeNode[];
}

function AnnotationEditor({ open, value, onCancel, onOk, onDelete }: { open: boolean; value: Annotation | null; onCancel: ()=>void; onOk: (v: Annotation | null)=>void; onDelete?: (id: string)=>void }) {
  const [form] = Form.useForm();
  useEffect(() => {
    if (open && value) {
      form.setFieldsValue({ title: value.label.title, summary: value.label.summary });
    }
  }, [open, value, form]);
  return (
    <Modal title="编辑标注" open={open} onCancel={onCancel} footer={null} destroyOnClose>
      <Form layout="vertical" form={form} preserve={false}>
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标注标题' }]}> 
          <Input placeholder="例如：发动机组件" />
        </Form.Item>
        <Form.Item name="summary" label="简介">
          <Input.TextArea 
            rows={4} 
            placeholder="简要描述此标注内容的作用、特点或注意事项..." 
            showCount 
            maxLength={500}
          />
        </Form.Item>
        <Space style={{ width:'100%', justifyContent:'flex-end' }}>
          {value && onDelete && <Button danger onClick={()=> onDelete(value.id)}>删除</Button>}
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" onClick={async ()=>{ const v = await form.validateFields(); if (!value) return onOk(null); onOk({ ...value, label: { ...value.label, title: v.title, summary: v.summary } }); }}>确定</Button>
        </Space>
      </Form>
    </Modal>
  );
}

function DraggableMiniTrack({ duration, keys, color, onChangeKeyTime, onSelectKey, trackId, trackType, selection, onSelectionChange, onActivate, pxPerSec=80, scrollerRef, onGlobalSelectionStart, selectedKeyframes, setSelectedKeyframes, moveSelectedKeyframes }: { duration: number; keys: number[]; color: string; onChangeKeyTime: (index: number, t: number)=>void; onSelectKey?: (index: number)=>void; trackId: string; trackType: 'cam' | 'vis' | 'trs'; selection?: { start: number; end: number } | null; onSelectionChange?: (sel: { start: number; end: number } | null)=>void; onActivate?: ()=>void; pxPerSec?: number; scrollerRef?: React.RefObject<HTMLDivElement>; onGlobalSelectionStart?: (startTime: number, e: React.MouseEvent) => void; selectedKeyframes?: SelectedKeyframe[]; setSelectedKeyframes?: (kfs: SelectedKeyframe[]) => void; moveSelectedKeyframes?: (deltaTime: number) => void }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const toTime = (clientX: number) => {
    const el = ref.current; if (!el) return 0; 
    const rect = el.getBoundingClientRect(); 
    const scrollLeft = scrollerRef?.current?.scrollLeft || 0; 
    const x = Math.max(0, clientX - rect.left + scrollLeft);
    return x / Math.max(1, pxPerSec);
  };
  const onDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    
    // 检查当前关键帧是否在多选中
    const isCurrentInMultiSelection = selectedKeyframes?.some(kf => kf.trackType === trackType && kf.trackId === trackId && kf.index === idx);
    
    if (isCurrentInMultiSelection && selectedKeyframes && selectedKeyframes.length > 1 && moveSelectedKeyframes) {
      // 拖拽多选关键帧
      const initialTime = keys[idx];
      let lastDeltaTime = 0; // 记录上次的偏移量
      
      const onMove = (ev: MouseEvent) => {
        const newTime = Math.max(0, Math.min(duration, toTime(ev.clientX)));
        const deltaTime = newTime - initialTime;
        
        // 计算本次相对于上次的增量
        const incrementalDelta = deltaTime - lastDeltaTime;
        lastDeltaTime = deltaTime;
        
        // 使用增量移动，避免累积误差
        moveSelectedKeyframes(incrementalDelta);
      };
      const onUp = () => { 
        window.removeEventListener('mousemove', onMove); 
        window.removeEventListener('mouseup', onUp); 
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    } else {
      // 单个关键帧拖拽（原有逻辑）
      (window as any).__selectedKeyId = `${trackId}:${idx}`;
      onActivate?.();
      onSelectKey?.(idx);
      const onMove = (ev: MouseEvent) => { onChangeKeyTime(idx, Math.max(0, Math.min(duration, toTime(ev.clientX)))); };
      const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  };
  return (
    <div ref={ref} style={{ position: 'relative', height: 22, background: '#1f2937', border: '1px solid #334155', borderRadius: 4, minWidth: `${duration*pxPerSec}px` }}
                            onMouseDown={(e)=>{ 
                        if ((e.target as HTMLElement).hasAttribute('data-keyframe')) return; 
                        e.stopPropagation(); 
                        onActivate?.(); 
                        
                        // 检查是否需要启动全局选择
                        if (onGlobalSelectionStart && e.shiftKey) {
                          const startTime = toTime(e.clientX);
                          onGlobalSelectionStart(startTime, e);
                          return;
                        }
                        
                        // 点击空白区域取消关键帧选择（只有当不是Shift键时才清除）
                        if (!e.shiftKey && selectedKeyframes && selectedKeyframes.length > 0 && setSelectedKeyframes) {
                          // 清除选择的关键帧
                          setSelectedKeyframes([]);
                        }
                        
                        // 本地轨道选择
                        const start = toTime(e.clientX); 
                        onSelectionChange?.({ start, end: start }); 
                        const onMove = (ev: MouseEvent)=>{ onSelectionChange?.({ start, end: toTime(ev.clientX) }); }; 
                        const onUp = ()=>{ 
                          window.removeEventListener('mousemove', onMove); 
                          window.removeEventListener('mouseup', onUp); 
                          
                          // 获取最终选择范围内的关键帧
                          const finalSelection = { start, end: toTime((window.event as MouseEvent)?.clientX || e.clientX) };
                          const minT = Math.min(finalSelection.start, finalSelection.end);
                          const maxT = Math.max(finalSelection.start, finalSelection.end);
                          
                          // 将范围内的关键帧添加到多选状态
                          if (setSelectedKeyframes && Math.abs(maxT - minT) > 0.01) { // 防止点击误选
                            const newSelectedKeyframes: SelectedKeyframe[] = [];
                            keys.forEach((keyTime, idx) => {
                              if (keyTime >= minT && keyTime <= maxT) {
                                newSelectedKeyframes.push({ trackType, trackId, index: idx });
                              }
                            });
                            
                            if (newSelectedKeyframes.length > 0) {
                              const combined = [...(selectedKeyframes || [])];
                              newSelectedKeyframes.forEach(newKf => {
                                const exists = combined.some(kf => 
                                  kf.trackType === newKf.trackType && 
                                  kf.trackId === newKf.trackId && 
                                  kf.index === newKf.index
                                );
                                if (!exists) combined.push(newKf);
                              });
                              setSelectedKeyframes(combined);
                            }
                          }
                          
                          // 延时隐藏单轨道选择框
                          setTimeout(() => {
                            onSelectionChange?.(null);
                          }, 0);
                        }; 
                        window.addEventListener('mousemove', onMove); 
                        window.addEventListener('mouseup', onUp); 
                      }}
      onDoubleClick={(e)=>{ e.stopPropagation(); onActivate?.(); /* 预留：双击快速创建关键帧 */ }}
    >
      {selection && (
        <div title={`选择: ${Math.min(selection.start, selection.end).toFixed(2)}s - ${Math.max(selection.start, selection.end).toFixed(2)}s`}
          style={{ position: 'absolute', top: 2, bottom: 2, left: `${Math.min(selection.start, selection.end)*pxPerSec}px`, width: `${Math.abs(selection.end - selection.start)*pxPerSec}px`, background: 'rgba(96,165,250,0.25)', border: '1px solid rgba(59,130,246,0.8)', pointerEvents: 'none' }} />
      )}
      {keys.map((t, idx) => {
        // 检查多选状态
        const currentTrackId = trackType === 'cam' ? 'cam' : trackId;
        const isMultiSelected = selectedKeyframes?.some(kf => 
          kf.trackType === trackType && 
          kf.trackId === currentTrackId && 
          kf.index === idx
        );
        const isSingleSelected = (window as any).__selectedKeyId === `${trackId}:${idx}`;
        const isInRange = selection && t >= Math.min(selection.start, selection.end) && t <= Math.max(selection.start, selection.end);
        
        let boxShadow = 'none';
        if (isMultiSelected) {
          boxShadow = '0 0 0 2px #ff6b6b'; // 多选：红色
        } else if (isSingleSelected) {
          boxShadow = '0 0 0 2px #fff'; // 单选：白色
        } else if (isInRange) {
          boxShadow = '0 0 0 2px rgba(147,197,253,0.9)'; // 范围选择：蓝色
        }
        
        return (
          <div key={idx} data-keyframe title={`t=${t.toFixed(2)}s`} onMouseDown={(e)=>onDown(e, idx)}
            style={{ 
              position: 'absolute', 
              left: `${t*pxPerSec}px`, 
              top: 2, 
              width: 12, 
              height: 18, 
              marginLeft: -6, 
              borderRadius: 3, 
              background: color, 
              cursor: 'ew-resize', 
              boxShadow,
              zIndex: (isMultiSelected || isSingleSelected) ? 10 : 1
            }} 
          />
        );
      })}
    </div>
  );
}


