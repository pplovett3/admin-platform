"use client";

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
      <div title={`当前: ${current.toFixed(2)}s`} style={{ position:'absolute', left: `${current*pxPerSec}px`, top: 0, bottom: 0, width: 2, background:'#ef4444' }} />
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
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { Button, Card, Flex, Form, Input, Space, Tree, App, Modal, Upload, Slider, InputNumber, Select, Tabs, Switch, Dropdown, Segmented, Tooltip, Divider } from 'antd';
import { UploadOutlined, LinkOutlined, InboxOutlined, FolderOpenOutlined, AimOutlined, EyeOutlined, ScissorOutlined, DragOutlined, ReloadOutlined, ExpandOutlined, AppstoreOutlined, ArrowUpOutlined, ArrowLeftOutlined, SettingOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { getToken } from '@/app/_lib/api';
import type { UploadProps } from 'antd';

type TreeNode = {
  title: string;
  key: string;
  children?: TreeNode[];
};

type AnnotationMedia = { type: 'image'|'video'; src: string };
type Annotation = {
  id: string;
  targetKey: string; // object.uuid
  targetPath: string; // name path
  anchor: { space: 'local'; offset: [number,number,number] };
  label: { title: string; summary?: string };
  media: AnnotationMedia[];
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
};

type TransformKeyframe = {
  time: number;
  position?: [number, number, number];
  rotationEuler?: [number, number, number]; // radians
  scale?: [number, number, number];
  easing?: 'linear' | 'easeInOut';
};

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

export default function ModelEditor3D({ initialUrl }: { initialUrl?: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const outlineRef = useRef<OutlinePass | null>(null);
  const modelRootRef = useRef<THREE.Object3D | null>(null);
  const boxHelperRef = useRef<THREE.Box3Helper | null>(null);
  const tcontrolsRef = useRef<TransformControls | null>(null);
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
  const [treeFilter, setTreeFilter] = useState<string>('');
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [editingAnno, setEditingAnno] = useState<Annotation | null>(null);
  const keyToObject = useRef<Map<string, THREE.Object3D>>(new Map());
  const markersGroupRef = useRef<THREE.Group | null>(null);
  const pendingImportRef = useRef<any | null>(null); // 缓存导入的 JSON，待模型加载后再解析
  const [timeline, setTimeline] = useState<TimelineState>({ duration: 10, current: 0, playing: false, cameraKeys: [], visTracks: {}, trsTracks: {}, annotationTracks: {} });
  const lastTickRef = useRef<number>(performance.now());
  const [cameraKeyEasing, setCameraKeyEasing] = useState<'linear'|'easeInOut'>('easeInOut');
  const [highlightMode, setHighlightMode] = useState<'outline'|'emissive'>('outline');
  const [gizmoMode, setGizmoMode] = useState<'translate'|'rotate'|'scale'>('translate');
  const [gizmoSpace, setGizmoSpace] = useState<'local'|'world'>('local');
  const [gizmoSnap, setGizmoSnap] = useState<{ t?: number; r?: number; s?: number }>({ t: undefined, r: undefined, s: undefined });
  const [bgTransparent, setBgTransparent] = useState<boolean>(false);
  const [bgColor, setBgColor] = useState<string>('#919191');
  const [dirLight, setDirLight] = useState<{ color: string; intensity: number; position: { x: number; y: number; z: number } }>({ color: '#ffffff', intensity: 1.2, position: { x: 3, y: 5, z: 2 } });
  const [ambLight, setAmbLight] = useState<{ color: string; intensity: number }>({ color: '#ffffff', intensity: 0.6 });
  const [hemiLight, setHemiLight] = useState<{ skyColor: string; groundColor: string; intensity: number }>({ skyColor: '#ffffff', groundColor: '#404040', intensity: 0.6 });
  const [autoKey, setAutoKey] = useState<boolean>(false);
  const autoKeyRef = useRef<boolean>(false);
  useEffect(()=>{ autoKeyRef.current = autoKey; }, [autoKey]);
  const trackLabelWidth = 160;
  const materialBackup = useRef<WeakMap<any, { emissive?: THREE.Color, emissiveIntensity?: number }>>(new WeakMap());
  const highlightedMats = useRef<Set<any>>(new Set());
  const [showLeft, setShowLeft] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [mode, setMode] = useState<'annot'|'anim'>('annot');
  const [modelName, setModelName] = useState<string>('未加载模型');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [urlImportOpen, setUrlImportOpen] = useState(false);
  const localFileInputRef = useRef<HTMLInputElement | null>(null);
  const [localFileInputKey, setLocalFileInputKey] = useState<number>(0);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const gridRef = useRef<THREE.GridHelper | null>(null);
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
  type StepMarker = { id: string; time: number; name: string };
  const [steps, setSteps] = useState<StepMarker[]>([]);
  const stepsRef = useRef<StepMarker[]>([]);
  useEffect(()=>{ stepsRef.current = steps; }, [steps]);
  const [stepModalOpen, setStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<StepMarker | null>(null);
  const [stepDraftTime, setStepDraftTime] = useState<number>(0);
  const [stepForm] = Form.useForm();
  // 重命名弹窗
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameForm] = Form.useForm();
  const tracksScrollRef = useRef<HTMLDivElement | null>(null);
  const innerScrollRef = useRef<HTMLDivElement | null>(null);
  const rulerScrollRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);
  const activeTrackIdRef = useRef<string | null>(null);
  useEffect(()=>{ selectionRef.current = selection; }, [selection]);
  useEffect(()=>{ activeTrackIdRef.current = activeTrackId; }, [activeTrackId]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('three_courseware_clips');
      if (raw) {
        const arr = JSON.parse(raw) as Clip[];
        if (Array.isArray(arr)) { setClips(arr); setActiveClipId(arr[0]?.id || null); if (arr[0]?.timeline) setTimeline(arr[0].timeline); }
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('three_courseware_clips', JSON.stringify(clips)); } catch {}
  }, [clips]);

  // 依据模式/选中对象/坐标系，统一管理 TransformControls 的挂载与可见
  useEffect(() => {
    const t = tcontrolsRef.current;
    if (!t) return;
    const obj = selectedKey ? keyToObject.current.get(selectedKey) : undefined;
    if (mode === 'anim' && obj) {
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
    const name = window.prompt('新建动画名称', `动画${clips.length + 1}`) || '';
    if (!name.trim()) return;
    const description = window.prompt('动画描述（可选）', '') || '';
    const id = generateUuid();
    const clip: Clip = { id, name, description, timeline: JSON.parse(JSON.stringify(timeline)) };
    setClips(prev => [clip, ...prev]);
    setActiveClipId(id);
  };

  const saveClip = () => {
    if (!activeClipId) return message.warning('请先选择或新建动画');
    setClips(prev => prev.map(c => c.id === activeClipId ? { ...c, timeline: JSON.parse(JSON.stringify(timeline)) } : c));
    message.success('动画已保存');
  };

  const onSelectClip = (id: string) => {
    setActiveClipId(id);
    const c = clips.find(x => x.id === id);
    if (c) setTimeline(JSON.parse(JSON.stringify(c.timeline)));
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

  // 背景与灯光设置实时应用（不关闭弹窗，不销毁组件）
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.background = bgTransparent ? null : new THREE.Color(bgColor);
    const r = rendererRef.current; const c = cameraRef.current; if (r && c) {
      const composer = composerRef.current; if (composer) composer.render(); else r.render(scene, c);
    }
  }, [bgTransparent, bgColor]);

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
      loadModel(initialUrl);
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

    const scene = new THREE.Scene();
    scene.background = bgTransparent ? null : new THREE.Color(bgColor);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
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
        const rec: CameraKeyframe = { time: prev.current, position: [camera.position.x, camera.position.y, camera.position.z], target: [ctrl.target.x, ctrl.target.y, ctrl.target.z], easing: cameraKeyEasing };
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
      // 撤销：拖拽开始/结束各入栈一次
      if (e.value) { pushHistory(); }
    });
    tcontrols.addEventListener('objectChange', () => {
      const obj = tcontrols.object as THREE.Object3D | null;
      if (!obj) return;
      setPrsTick(v=>v+1);
      const key = obj.uuid;
      setTimeline(prev => {
        const tracks = { ...prev.trsTracks } as Record<string, TransformKeyframe[]>;
        const list = (tracks[key] || []).slice();
        const eps = 1e-3; let idx = list.findIndex(k => Math.abs(k.time - prev.current) < eps);
        if (idx < 0) {
          if (!autoKeyRef.current) return prev;
          // 自动落帧
          const newKey: TransformKeyframe = {
            time: prev.current,
            position: [obj.position.x, obj.position.y, obj.position.z],
            rotationEuler: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
            scale: [obj.scale.x, obj.scale.y, obj.scale.z],
            easing: 'easeInOut'
          };
          const newList = [...list, newKey].sort((a,b)=>a.time-b.time);
          tracks[key] = newList;
          return { ...prev, trsTracks: tracks };
        }
        // 写回现有帧
        const next = { ...list[idx], position: [obj.position.x, obj.position.y, obj.position.z], rotationEuler: [obj.rotation.x, obj.rotation.y, obj.rotation.z], scale: [obj.scale.x, obj.scale.y, obj.scale.z] } as TransformKeyframe;
        list[idx] = next; tracks[key] = list;
        return { ...prev, trsTracks: tracks };
      });
      // 拖拽结束再入一次撤销快照
      if (!(tcontrols as any).dragging) pushHistory();
    });
    scene.add(tcontrols as any);
    tcontrolsRef.current = tcontrols;
    // 初始化 gizmo 配置
    tcontrols.setMode(gizmoMode);
    tcontrols.setSpace(gizmoSpace);
    tcontrols.setTranslationSnap(gizmoSnap.t ?? null as any);
    tcontrols.setRotationSnap(gizmoSnap.r ?? null as any);
    tcontrols.setScaleSnap(gizmoSnap.s ?? null as any);

    renderer.domElement.addEventListener('pointerdown', onPointerDown);

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
      if (!prev.playing) { controls?.update(); return prev; }
      const nextTime = Math.min(prev.duration, prev.current + dt);
      applyTimelineAt(nextTime);
      controls?.update();
      if (nextTime >= prev.duration) return { ...prev, current: prev.duration, playing: false };
      return { ...prev, current: nextTime };
    });
    const composer = composerRef.current;
    if (composer) composer.render(); else renderer.render(scene, camera);
  }

  function applyTimelineAt(t: number) {
    const tl = timelineRef.current;
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
      const pos: [number,number,number] = [
        lerp(k0.position[0], k1.position[0], s),
        lerp(k0.position[1], k1.position[1], s),
        lerp(k0.position[2], k1.position[2], s)
      ];
      const tar: [number,number,number] = [
        lerp(k0.target[0], k1.target[0], s),
        lerp(k0.target[1], k1.target[1], s),
        lerp(k0.target[2], k1.target[2], s)
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
      if (!obj) continue;
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
      if (!obj) continue;
      const keys = [...(trsTracks[key] || [])].sort((a,b)=>a.time-b.time);
      if (keys.length === 0) continue;
      let k0 = keys[0]; let k1 = keys[keys.length-1];
      for (let i=0;i<keys.length;i++){ if (keys[i].time <= t) k0 = keys[i]; if (keys[i].time >= t) { k1 = keys[i]; break; } }
      const lerp = (a:number,b:number,s:number)=>a+(b-a)*s;
      let s = Math.max(0, Math.min(1, (k1.time === k0.time) ? 0 : (t - k0.time) / (k1.time - k0.time)));
      const ease = k0.easing || 'easeInOut';
      if (ease === 'easeInOut') s = s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2;
      if (k0.position && k1.position) {
        obj.position.set(
          lerp(k0.position[0], k1.position[0], s),
          lerp(k0.position[1], k1.position[1], s),
          lerp(k0.position[2], k1.position[2], s)
        );
      }
      if (k0.rotationEuler && k1.rotationEuler) {
        obj.rotation.set(
          lerp(k0.rotationEuler[0], k1.rotationEuler[0], s),
          lerp(k0.rotationEuler[1], k1.rotationEuler[1], s),
          lerp(k0.rotationEuler[2], k1.rotationEuler[2], s)
        );
      }
      if (k0.scale && k1.scale) {
        obj.scale.set(
          lerp(k0.scale[0], k1.scale[0], s),
          lerp(k0.scale[1], k1.scale[1], s),
          lerp(k0.scale[2], k1.scale[2], s)
        );
      }
      obj.updateMatrixWorld();
    }
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

  async function loadModel(src: string) {
    const scene = sceneRef.current!;
    setLoading(true);
    try {
      // 清除旧模型
      if (modelRootRef.current) {
        scene.remove(modelRootRef.current);
        modelRootRef.current.traverse((o: any) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.());
            else o.material.dispose?.();
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
      const ktx2 = new KTX2Loader(manager)
        .setTranscoderPath('https://unpkg.com/three@0.164.0/examples/jsm/libs/basis/')
        .detectSupport(rendererRef.current!);
      const draco = new DRACOLoader(manager)
        .setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      const loader = new GLTFLoader(manager)
        .setKTX2Loader(ktx2)
        .setDRACOLoader(draco);

      // 如果通过后端代理加载（/api/files/proxy?...）需要携带鉴权头
      try {
        const token = getToken?.();
        if (token) {
          (loader as any).setRequestHeader?.({ Authorization: `Bearer ${token}` });
          (ktx2 as any).setRequestHeader?.({ Authorization: `Bearer ${token}` });
          (draco as any).setRequestHeader?.({ Authorization: `Bearer ${token}` });
        }
      } catch {}
      const gltf = await loader.loadAsync(src);
      const root = gltf.scene || gltf.scenes[0];
      modelRootRef.current = root;
      scene.add(root);
      setModelName(root.name || '模型');

      // 生成结构树
      const nodes: TreeNode[] = [];
      const map = keyToObject.current;
      function makeNode(obj: THREE.Object3D): TreeNode {
        const key = obj.uuid;
        map.set(key, obj);
        return { title: obj.name || obj.type || key.slice(0, 8), key, children: obj.children?.map(makeNode) };
      }
      nodes.push(makeNode(root));
      setTreeData(nodes);

      focusObject(root);
      message.success('模型已加载');
      // 若存在待恢复的标注，模型加载完成后尝试按路径绑定
      if (pendingImportRef.current) {
        tryRestoreFromPending();
      }
    } catch (e: any) {
      console.error(e);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }

  function tryRestoreFromPending() {
    const pending = pendingImportRef.current;
    if (!pending) return;
    try {
      const restored: Annotation[] = [];
      (pending.annotations || []).forEach((x: any) => {
        const pathRaw = String(x?.target?.path || '');
        const namePathRaw = String(x?.target?.namePath || '');
        const target = findByFlexiblePath(pathRaw) || findByFlexiblePath(namePathRaw);
        if (!target) return;
        const offset = x?.anchor?.offset || [0,0,0];
        restored.push({
          id: String(x.id || generateUuid()),
          targetKey: target.uuid,
          targetPath: buildPath(target),
          anchor: { space: 'local', offset: [Number(offset[0]||0), Number(offset[1]||0), Number(offset[2]||0)] },
          label: { title: String(x?.label?.title || target.name || '未命名'), summary: String(x?.label?.summary || '') },
          media: Array.isArray(x?.media) ? x.media.filter((m:any)=>m?.src).map((m:any)=>({ type: m.type==='video'?'video':'image', src: String(m.src)})) : []
        });
      });
      setAnnotations(restored);
      pendingImportRef.current = null;
      if (restored.length === 0) message.warning('已导入，但未找到匹配的节点（请确认模型一致或节点名称未变化）');
      else message.success(`已恢复 ${restored.length} 条标注`);
    } catch (e:any) {
      message.error(e?.message || '恢复标注失败');
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
    // 先检测标注点
    const markers = markersGroupRef.current;
    if (markers) {
      const markerHits = raycaster.intersectObjects(markers.children, true);
      if (markerHits.length > 0) {
        const mkObj = markerHits[0].object;
        const annoId = (mkObj.userData?.annotationId) as string | undefined;
        if (annoId) {
          const anno = annotations.find(a => a.id === annoId) || null;
          setEditingAnno(anno);
          const target = anno ? keyToObject.current.get(anno.targetKey) : undefined;
          if (target) selectObject(target);
          return;
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

  function syncHighlight() {
    const outline = outlineRef.current;
    const objs: THREE.Object3D[] = Array.from(selectedSet).map(k=> keyToObject.current.get(k)!).filter(Boolean);
    if (outline && highlightMode === 'outline') {
      outline.selectedObjects = objs;
      clearEmissiveHighlight();
    } else {
      if (outline) outline.selectedObjects = [];
      clearEmissiveHighlight();
      objs.forEach(o=> applyEmissiveHighlight(o));
    }
  }

  function selectObject(obj: THREE.Object3D, addToSelection: boolean = false) {
    const scene = sceneRef.current!;
    if (boxHelperRef.current) { scene.remove(boxHelperRef.current); boxHelperRef.current = null; }
    setSelectedKey(obj.uuid);
    setSelectedSet(prev => {
      const next = new Set(prev);
      if (addToSelection) { if (next.has(obj.uuid)) next.delete(obj.uuid); else next.add(obj.uuid); }
      else { next.clear(); next.add(obj.uuid); }
      return next;
    });
    setSelectedCamKeyIdx(null);
    setSelectedTrs(null);
    setSelectedVis(null);
    // attach transform controls
    const tcontrols = tcontrolsRef.current;
    if (tcontrols) {
      if (mode === 'anim') {
        tcontrols.attach(obj);
        tcontrols.setMode(gizmoMode);
        tcontrols.setSpace(gizmoSpace as any);
        (tcontrols as any).visible = true;
      } else {
        tcontrols.detach();
        (tcontrols as any).visible = false;
      }
    }
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
      return { title: o.name || o.type || k.slice(0,8), key: k, children: o.children?.map(makeNode) };
    };
    nodes.push(makeNode(root));
    setTreeData(nodes);
  }

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
    const o = keyToObject.current.get(key); if (!o) return; if (o === modelRootRef.current) return;
    const parent = o.parent as THREE.Object3D; parent.remove(o);
    rebuildTree();
    setSelectedSet(new Set()); setSelectedKey(undefined); syncHighlight(); setPrsTick(v=>v+1);
  }

  function handleNodeAction(action: string, key: string) {
    if (action === 'rename') { const obj = keyToObject.current.get(key); if (!obj) return; setRenameOpen(true); renameForm.setFieldsValue({ name: obj.name || '' }); (window as any).__renameKey = key; return; }
    if (action === 'group') { const ids = selectedSet.size>0 ? Array.from(selectedSet) : [key]; groupNodes(ids); return; }
    if (action === 'ungroup') { ungroupNode(key); return; }
    if (action === 'delete') { deleteNode(key); return; }
  }

  function clearEmissiveHighlight() {
    for (const m of Array.from(highlightedMats.current)) {
      const backup = materialBackup.current.get(m);
      if (backup) {
        if ('emissive' in m && backup.emissive) m.emissive.copy(backup.emissive);
        if ('emissiveIntensity' in m && typeof backup.emissiveIntensity === 'number') m.emissiveIntensity = backup.emissiveIntensity;
      }
    }
    highlightedMats.current.clear();
  }

  function applyEmissiveHighlight(obj: THREE.Object3D) {
    clearEmissiveHighlight();
    obj.traverse(o => {
      const mesh = o as any;
      if (mesh.material) {
        const materials: any[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        materials.forEach(mat => {
          const b = { emissive: (mat.emissive ? mat.emissive.clone() : undefined), emissiveIntensity: mat.emissiveIntensity };
          materialBackup.current.set(mat, b);
          try {
            if (mat.emissive) mat.emissive.set(0x22d3ee);
            if ('emissiveIntensity' in mat) mat.emissiveIntensity = Math.max(mat.emissiveIntensity || 0.2, 0.6);
            highlightedMats.current.add(mat);
          } catch {}
        });
      }
    });
  }

  function focusObject(obj: THREE.Object3D) {
    const camera = cameraRef.current!;
    const controls = controlsRef.current!;
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
    camera.far = dist * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
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

  function refreshMarkers() {
    const group = ensureMarkers();
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
      const pos = new THREE.Vector3(a.anchor.offset[0], a.anchor.offset[1], a.anchor.offset[2]);
      target.updateWorldMatrix(true, true);
      const world = pos.clone().applyMatrix4((target as any).matrixWorld);
      const geom = new THREE.SphereGeometry(0.012, 16, 16);
      const mat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(world);
      mesh.userData.annotationId = a.id;
      group.add(mesh);
    });
  }

  useEffect(() => { refreshMarkers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [annotations, selectedKey]);

  const addAnnotationForSelected = () => {
    if (!selectedKey) return;
    const obj = keyToObject.current.get(selectedKey);
    if (!obj) return;
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const local = obj.worldToLocal(center.clone());
    const path = buildPath(obj);
    const anno: Annotation = {
      id: generateUuid(),
      targetKey: obj.uuid,
      targetPath: path,
      anchor: { space: 'local', offset: [local.x, local.y, local.z] },
      label: { title: obj.name || '未命名', summary: '' },
      media: []
    };
    setAnnotations(prev => [...prev, anno]);
    setEditingAnno(anno);
  };

  // timeline actions
  const onTogglePlay = () => setTimeline(prev => { const playing = !prev.playing; if (playing) applyTimelineAt(prev.current); return { ...prev, playing }; });
  const onScrub = (val: number) => { pushHistory(); setTimeline(prev => ({ ...prev, current: val })); applyTimelineAt(val); };
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
    pushHistory();
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
      return { ...prev, visTracks: { ...prev.visTracks, [selectedKey]: nextTrack } };
    });
  };
  const setVisibilityAtCurrent = (key: string, visible: boolean) => {
    setTimeline(prev => {
      const list = (prev.visTracks[key] || []).slice();
      const eps = 1e-3; const i = list.findIndex(k => Math.abs(k.time - prev.current) < eps);
      if (i < 0) {
        if (!autoKeyRef.current) return prev;
        const next = [...list, { time: prev.current, value: visible }].sort((a,b)=>a.time-b.time);
        return { ...prev, visTracks: { ...prev.visTracks, [key]: next } };
      }
      pushHistory();
      list[i] = { ...list[i], value: visible };
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
        if (!autoKey) return prev;
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
      pushHistory();
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
    pushHistory();
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

  // 设置弹窗
  const SettingsModal = () => (
    <Modal title="系统设置" open={settingsOpen} maskClosable onCancel={()=>setSettingsOpen(false)} footer={null} destroyOnClose={false} forceRender getContainer={false} transitionName="" maskTransitionName="">
      <Flex vertical gap={12}>
        <div style={{ fontWeight: 600 }}>背景</div>
        <Space>
          <Switch checkedChildren="透明" unCheckedChildren="不透明" checked={bgTransparent} onChange={(v)=>setBgTransparent(v)} />
          <Input size="small" type="color" value={bgColor} onChange={(e)=>setBgColor(e.target.value)} disabled={bgTransparent} />
        </Space>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ fontWeight: 600 }}>灯光</div>
        <Space wrap>
          <span>平行光</span>
          <Input size="small" type="color" value={dirLight.color} onChange={(e)=>setDirLight(v=>({ ...v, color: e.target.value }))} />
          <InputNumber size="small" step={0.1} min={0} max={10} value={dirLight.intensity} onChange={(v)=>setDirLight(val=>({ ...val, intensity: Number(v||0) }))} />
          <span>Px</span><InputNumber size="small" step={0.1} value={dirLight.position.x} onChange={(v)=>setDirLight(val=>({ ...val, position: { ...val.position, x: Number(v||0) } }))} />
          <span>Py</span><InputNumber size="small" step={0.1} value={dirLight.position.y} onChange={(v)=>setDirLight(val=>({ ...val, position: { ...val.position, y: Number(v||0) } }))} />
          <span>Pz</span><InputNumber size="small" step={0.1} value={dirLight.position.z} onChange={(v)=>setDirLight(val=>({ ...val, position: { ...val.position, z: Number(v||0) } }))} />
        </Space>
        <Space wrap>
          <span>环境光</span>
          <Input size="small" type="color" value={ambLight.color} onChange={(e)=>setAmbLight(v=>({ ...v, color: e.target.value }))} />
          <InputNumber size="small" step={0.1} min={0} max={10} value={ambLight.intensity} onChange={(v)=>setAmbLight(val=>({ ...val, intensity: Number(v||0) }))} />
        </Space>
        <Space wrap>
          <span>半球光</span>
          <Input size="small" type="color" value={hemiLight.skyColor} onChange={(e)=>setHemiLight(v=>({ ...v, skyColor: e.target.value }))} />
          <Input size="small" type="color" value={hemiLight.groundColor} onChange={(e)=>setHemiLight(v=>({ ...v, groundColor: e.target.value }))} />
          <InputNumber size="small" step={0.1} min={0} max={10} value={hemiLight.intensity} onChange={(v)=>setHemiLight(val=>({ ...val, intensity: Number(v||0) }))} />
        </Space>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ fontWeight: 600 }}>显示</div>
        <Space>
          <Switch checkedChildren="地面开" unCheckedChildren="地面关" checked={showGrid} onChange={(v)=>{ setShowGrid(v); resize(); }} />
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
    const last = undoStack.current.pop();
    if (!last) return;
    redoStack.current.push({ timeline: JSON.parse(JSON.stringify(timelineRef.current)) });
    setTimeline(last.timeline);
    applyTimelineAt(last.timeline.current);
  };
  const redo = () => {
    const last = redoStack.current.pop();
    if (!last) return;
    undoStack.current.push({ timeline: JSON.parse(JSON.stringify(timelineRef.current)) });
    setTimeline(last.timeline);
    applyTimelineAt(last.timeline.current);
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

  function findByFlexiblePath(path: string): THREE.Object3D | undefined {
    const direct = findByPath(path);
    if (direct) return direct;
    const segs = String(path).split('/').filter(Boolean);
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
        label: a.label,
        media: a.media
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
      <Card title="模型与结构树" bodyStyle={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} style={{ overflow: 'hidden', height: '100%', gridArea: 'left', opacity: showLeft ? 1 : 0, visibility: showLeft ? 'visible' : 'hidden', pointerEvents: showLeft ? 'auto' : 'none', transition: 'opacity 200ms ease, visibility 200ms linear', minWidth: 0 }}>
        <Form layout="vertical" form={urlForm} onFinish={(v)=> loadModel(v.url)}>
          <Form.Item name="url" label="GLB URL" rules={[{ required: true, message: '请输入 GLB 直链 URL' }]}>
            <Input placeholder="https://.../model.glb" allowClear />
          </Form.Item>
          <Space wrap size={[8, 8]}>
            <Button type="primary" htmlType="submit" loading={loading}>加载</Button>
            <Button onClick={onFocusSelected} disabled={!selectedKey}>对焦所选</Button>
            <Button onClick={onIsolateSelected} disabled={!selectedKey}>隔离所选</Button>
            <Button onClick={onShowAll}>显示全部</Button>
          </Space>
        </Form>
        <div style={{ marginTop: 12, flex: '1 1 0', minHeight: 0, overflowY: 'auto' }}>
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
            onChange={(v)=>setMode(v as any)}
            options={[{label:'添加标注', value:'annot'},{label:'制作动画', value:'anim'}]}
            className="mode-seg"
            style={{ padding: 4, borderRadius: 999 }}
          />
        </div>
        <style>{`.mode-seg .ant-segmented-item-selected{background:#06b6d4;color:#fff}`}</style>
      </div>} bodyStyle={{ padding: 0, height: '100%' }} style={{ height: '100%', gridArea: 'center', display: 'flex', flexDirection: 'column', minWidth: 0 }}
        extra={(
          <Space>
            <Button size="small" icon={<SettingOutlined />} onClick={()=>setSettingsOpen(true)}>设置</Button>
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
        <div ref={mountRef} style={{ flex: 1, width: '100%', height: '100%', minHeight: 420, position:'relative' }} />
      </Card>
      <Card title="属性 / 选中信息" bodyStyle={{ padding: 0 }} style={{ height: '100%', overflow: 'hidden', gridArea: 'right', display: 'flex', flexDirection: 'column', opacity: showRight ? 1 : 0, visibility: showRight ? 'visible' : 'hidden', pointerEvents: showRight ? 'auto' : 'none', transition: 'opacity 200ms ease, visibility 200ms linear', minWidth: 0 }}>
        {mode==='annot' && (
            <div style={{ padding: 12, height: '100%', boxSizing: 'border-box', overflow: 'auto' }}>
              {selectedKey ? (
                <Flex vertical gap={8}>
                  <div>已选中：{keyToObject.current.get(selectedKey)?.name || selectedKey}</div>
                  <Button onClick={onFocusSelected}>相机对焦</Button>
                  <Button type="primary" onClick={addAnnotationForSelected}>为所选添加标注</Button>
                </Flex>
              ) : <div>点击结构树或视窗选择对象</div>}
              {/* 全局标注列表暂时隐藏 */}
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
              <Divider type="vertical" />
              <span style={{ color: '#94a3b8' }}>激活轨道：</span>
              <span style={{ minWidth: 120, color: activeTrackId ? '#e2e8f0' : '#94a3b8' }}>{(()=>{ const t = activeTrackId; if(!t) return '未选择'; if(t==='cam') return '相机'; if(t.startsWith('vis:')){ const k=t.slice(4); return `显隐: ${keyToObject.current.get(k)?.name||k.slice(0,8)}`;} if(t.startsWith('trs:')){ const k=t.slice(4); return `TRS: ${keyToObject.current.get(k)?.name||k.slice(0,8)}`;} return t; })()}</span>
              <Divider type="vertical" />
              <InputNumber size="small" min={0.01} step={0.01} value={stretchFactor} onChange={(v)=>setStretchFactor(Number(v||1))} addonBefore="倍率" />
              <Button size="small" onClick={applyStretch} disabled={!selection || !activeTrackId}>拉伸</Button>
              <Button size="small" onClick={copySelection} disabled={!selection || !activeTrackId}>复制</Button>
              <Button size="small" onClick={pasteAtCurrent} disabled={!activeTrackId || !clipboard}>粘贴</Button>
              <Button size="small" danger onClick={()=>{ if (bulkDeleteSelected()) { setSelection(null); } }} disabled={!selection || !activeTrackId}>删除</Button>
              <Button size="small" onClick={()=>setSelection(null)} disabled={!selection}>清选</Button>
            </Space>
          </Flex>
          <div style={{ marginTop: 8, flex: '0 0 auto', display: 'flex', flexDirection: 'column' }}>
            <Flex align="center" gap={8}>
              <span>时长(s)</span>
              <InputNumber min={1} max={600} value={timeline.duration} onChange={onChangeDuration} />
              <span>时间(s)</span>
              <InputNumber min={0} max={timeline.duration} step={0.01} value={Number(timeline.current.toFixed(2))} onChange={(v)=> onScrub(Number(v||0))} />
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
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div ref={tracksScrollRef} style={{ overflowX: 'auto', overflowY: 'hidden', width: '100%' }} onScroll={(e)=>{ if (rulerScrollRef.current) rulerScrollRef.current.scrollLeft = (e.target as HTMLDivElement).scrollLeft; }}>
                  <div style={{ minWidth: `${pxPerSec*timeline.duration}px` }}>
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
      <AnnotationEditor open={!!editingAnno} value={editingAnno} onCancel={()=>setEditingAnno(null)} onOk={(v)=>{ if (!v) return; setAnnotations(prev => prev.map(x => x.id === v.id ? v : x)); setEditingAnno(null); }} />
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

function AnnotationEditor({ open, value, onCancel, onOk }: { open: boolean; value: Annotation | null; onCancel: ()=>void; onOk: (v: Annotation | null)=>void }) {
  const [form] = Form.useForm();
  useEffect(() => {
    if (open && value) {
      form.setFieldsValue({ title: value.label.title, summary: value.label.summary });
    }
  }, [open, value, form]);
  return (
    <Modal title="编辑标注" open={open} onCancel={onCancel} onOk={async ()=>{
      const v = await form.validateFields();
      if (!value) return onOk(null);
      onOk({ ...value, label: { title: v.title, summary: v.summary } });
    }} destroyOnClose>
      <Form layout="vertical" form={form} preserve={false}>
        <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="summary" label="简介"><Input.TextArea rows={4} /></Form.Item>
      </Form>
      {/* 媒体资源编辑可后续补充：此处先保留结构 */}
    </Modal>
  );
}

function DraggableMiniTrack({ duration, keys, color, onChangeKeyTime, onSelectKey, trackId, selection, onSelectionChange, onActivate, pxPerSec=80, scrollerRef }: { duration: number; keys: number[]; color: string; onChangeKeyTime: (index: number, t: number)=>void; onSelectKey?: (index: number)=>void; trackId: string; selection?: { start: number; end: number } | null; onSelectionChange?: (sel: { start: number; end: number } | null)=>void; onActivate?: ()=>void; pxPerSec?: number; scrollerRef?: React.RefObject<HTMLDivElement> }) {
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
    (window as any).__selectedKeyId = `${trackId}:${idx}`;
    onActivate?.();
    onSelectKey?.(idx);
    const onMove = (ev: MouseEvent) => { onChangeKeyTime(idx, Math.max(0, Math.min(duration, toTime(ev.clientX)))); };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  return (
    <div ref={ref} style={{ position: 'relative', height: 22, background: '#1f2937', border: '1px solid #334155', borderRadius: 4, minWidth: `${duration*pxPerSec}px` }}
      onMouseDown={(e)=>{ if ((e.target as HTMLElement).hasAttribute('data-keyframe')) return; e.stopPropagation(); onActivate?.(); const start = toTime(e.clientX); onSelectionChange?.({ start, end: start }); const onMove = (ev: MouseEvent)=>{ onSelectionChange?.({ start, end: toTime(ev.clientX) }); }; const onUp = ()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }; window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }}
    >
      {selection && (
        <div title={`选择: ${Math.min(selection.start, selection.end).toFixed(2)}s - ${Math.max(selection.start, selection.end).toFixed(2)}s`}
          style={{ position: 'absolute', top: 2, bottom: 2, left: `${Math.min(selection.start, selection.end)*pxPerSec}px`, width: `${Math.abs(selection.end - selection.start)*pxPerSec}px`, background: 'rgba(96,165,250,0.25)', border: '1px solid rgba(59,130,246,0.8)', pointerEvents: 'none' }} />
      )}
      {keys.map((t, idx) => (
        <div key={idx} data-keyframe title={`t=${t.toFixed(2)}s`} onMouseDown={(e)=>onDown(e, idx)}
          style={{ position: 'absolute', left: `${t*pxPerSec}px`, top: 2, width: 12, height: 18, marginLeft: -6, borderRadius: 3, background: color, cursor: 'ew-resize', boxShadow: ((window as any).__selectedKeyId===`${trackId}:${idx}`) ? '0 0 0 2px #fff' : (selection && t>=Math.min(selection.start, selection.end) && t<=Math.max(selection.start, selection.end) ? '0 0 0 2px rgba(147,197,253,0.9)' : 'none') }} />
      ))}
    </div>
  );
}


