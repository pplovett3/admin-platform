"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { Button, Card, Flex, Form, Input, Space, Tree, App, Modal, Upload, Slider, InputNumber, Select } from 'antd';
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
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointer = useMemo(() => new THREE.Vector2(), []);
  const { message } = App.useApp();

  const [urlForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
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
  const materialBackup = useRef<WeakMap<any, { emissive?: THREE.Color, emissiveIntensity?: number }>>(new WeakMap());
  const highlightedMats = useRef<Set<any>>(new Set());

  useEffect(() => {
    initRenderer();
    animate();
    const handleResize = () => resize();
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.forceContextLoss();
        rendererRef.current.domElement.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    scene.background = new THREE.Color(0x0b1220);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 1000);
    camera.position.set(2.6, 1.8, 2.6);
    cameraRef.current = camera;

    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(3, 5, 2);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.6);
    hemi.position.set(0, 1, 0);
    scene.add(hemi);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controlsRef.current = controls;

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
    // camera
    const camKeys = timeline.cameraKeys.sort((a,b)=>a.time-b.time);
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
    const visTracks = timeline.visTracks || {};
    for (const key of Object.keys(visTracks)) {
      const obj = keyToObject.current.get(key);
      if (!obj) continue;
      const keys = (visTracks[key] || []).sort((a,b)=>a.time-b.time);
      if (keys.length === 0) continue;
      let value = keys[0].value;
      for (let i = 0; i < keys.length; i++) { if (keys[i].time <= t) value = keys[i].value; else break; }
      obj.visible = value;
    }
    // TRS
    const trsTracks = timeline.trsTracks || {};
    for (const key of Object.keys(trsTracks)) {
      const obj = keyToObject.current.get(key);
      if (!obj) continue;
      const keys = (trsTracks[key] || []).sort((a,b)=>a.time-b.time);
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
    const annTracks = timeline.annotationTracks || {};
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
    // 命中场景网格
    const meshes: THREE.Object3D[] = [];
    scene.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh) meshes.push(m); });
    const hits = raycaster.intersectObjects(meshes, true);
    if (hits.length > 0) {
      const obj = hits[0].object as THREE.Object3D;
      selectObject(obj);
    }
  }

  function selectObject(obj: THREE.Object3D) {
    const scene = sceneRef.current!;
    if (boxHelperRef.current) { scene.remove(boxHelperRef.current); boxHelperRef.current = null; }
    const box = new THREE.Box3().setFromObject(obj);
    const helper = new THREE.Box3Helper(box, new THREE.Color(0x22d3ee));
    scene.add(helper);
    boxHelperRef.current = helper;
    setSelectedKey(obj.uuid);
    // outline highlight
    const outline = outlineRef.current;
    if (outline && highlightMode === 'outline') {
      outline.selectedObjects = [obj];
      clearEmissiveHighlight();
    } else {
      if (outline) outline.selectedObjects = [];
      applyEmissiveHighlight(obj);
    }
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

  const onTreeSelect = (_keys: React.Key[], info: any) => {
    const key = info?.node?.key as string | undefined;
    if (!key) return;
    const obj = keyToObject.current.get(key);
    if (obj) selectObject(obj);
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
  };

  const onIsolateSelected = () => {
    const root = modelRootRef.current;
    if (!root || !selectedKey) return;
    const sel = keyToObject.current.get(selectedKey);
    root.traverse(o => {
      if (o === root) return;
      if ((o as any).isObject3D) {
        const isChildOfSel = (() => {
          if (!sel) return false;
          let p: THREE.Object3D | null = o;
          while (p) { if (p === sel) return true; p = p.parent as any; }
          return false;
        })();
        (o as any).visible = sel ? (o === sel || isChildOfSel) : true;
      }
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
  const onTogglePlay = () => setTimeline(prev => ({ ...prev, playing: !prev.playing }));
  const onScrub = (val: number) => { setTimeline(prev => ({ ...prev, current: val })); applyTimelineAt(val); };
  const onChangeDuration = (val: number | null) => setTimeline(prev => ({ ...prev, duration: Math.max(1, Number(val||10)) }));
  const addCameraKeyframe = () => {
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
  const updateCameraKeyTime = (idx: number, time: number) => setTimeline(prev => {
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
    setTimeline(prev => {
      const track = prev.visTracks[selectedKey] || [];
      const nextTrack = [...track, { time: prev.current, value: obj.visible }].sort((a,b)=>a.time-b.time);
      return { ...prev, visTracks: { ...prev.visTracks, [selectedKey]: nextTrack } };
    });
  };
  const ensureTrsTrackForSelected = () => {
    if (!selectedKey) return;
    setTimeline(prev => ({ ...prev, trsTracks: { ...prev.trsTracks, [selectedKey]: prev.trsTracks[selectedKey] || [] } }));
  };
  const addTRSKeyForSelected = () => {
    if (!selectedKey) return;
    const obj = keyToObject.current.get(selectedKey);
    if (!obj) return;
    ensureTrsTrackForSelected();
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

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr 320px', gap: 12, height: 'calc(100vh - 140px)' }}>
      <Card title="模型与结构树" bodyStyle={{ padding: 12 }} style={{ overflow: 'hidden', height: '100%' }}>
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
        <div style={{ marginTop: 12, height: 'calc(100% - 150px)', overflow: 'auto' }}>
          <Input.Search placeholder="搜索节点名" allowClear onChange={(e)=>setTreeFilter(e.target.value)} style={{ marginBottom: 8 }} />
          <Tree treeData={filterTree(treeData, treeFilter) as any} onSelect={onTreeSelect} selectedKeys={selectedKey ? [selectedKey] : []}
            titleRender={(node: any) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{node.title}</span>
                <Button size="small" type="text" onClick={(e)=>{ e.stopPropagation(); onToggleHide(String(node.key), !hiddenKeys.has(String(node.key))); }}>
                  {hiddenKeys.has(String(node.key)) ? '显示' : '隐藏'}
                </Button>
              </div>
            )}
          />
        </div>
      </Card>
      <Card title="三维视窗" bodyStyle={{ padding: 0, height: '100%' }} style={{ height: '100%' }}>
        <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 480 }} />
      </Card>
      <Card title="属性 / 选中信息" bodyStyle={{ padding: 12 }} style={{ height: '100%', overflow: 'auto' }}>
        {selectedKey ? (
          <Flex vertical gap={8}>
            <div>已选中：{selectedKey}</div>
            <Button onClick={onFocusSelected}>相机对焦</Button>
            <Button type="primary" onClick={addAnnotationForSelected}>为所选添加标注</Button>
          </Flex>
        ) : <div>点击结构树或视窗选择对象</div>}
        <div style={{ marginTop: 12 }}>
          <Flex justify="space-between" align="center">
            <strong>标注</strong>
            <Space>
              <Upload {...importProps}><Button>导入</Button></Upload>
              <Button onClick={exportAnnotations}>导出</Button>
            </Space>
          </Flex>
          <div style={{ marginTop: 8 }}>
            {(annotations || []).map(a => (
              <div key={a.id} style={{ padding: '6px 8px', border: '1px solid #334155', borderRadius: 6, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{a.label.title}</span>
                  <Space>
                    <Button size="small" onClick={()=>{ setEditingAnno(a); const t = keyToObject.current.get(a.targetKey); if (t) selectObject(t); }}>编辑</Button>
                    <Button size="small" danger onClick={()=> setAnnotations(prev => prev.filter(x => x.id !== a.id))}>删除</Button>
                  </Space>
                </div>
                <div style={{ color: '#94a3b8', marginTop: 4 }}>{a.label.summary || '-'}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #334155' }}>
          <Flex justify="space-between" align="center">
            <strong>时间线</strong>
            <Space>
              <Button onClick={onTogglePlay}>{timeline.playing ? '暂停' : '播放'}</Button>
              <Upload {...importTimeline}><Button>导入</Button></Upload>
              <Button onClick={exportTimeline}>导出</Button>
              <span style={{ color: '#94a3b8' }}>高亮</span>
              <Select size="small" value={highlightMode} style={{ width: 110 }} onChange={(v)=>{ setHighlightMode(v); const sel = selectedKey ? keyToObject.current.get(selectedKey) : null; if (sel) selectObject(sel); }}
                options={[{label:'轮廓', value:'outline'},{label:'自发光', value:'emissive'}]} />
            </Space>
          </Flex>
          <div style={{ marginTop: 8 }}>
            <Flex align="center" gap={8}>
              <span>时长(s)</span>
              <InputNumber min={1} max={600} value={timeline.duration} onChange={onChangeDuration} />
              <span>时间(s)</span>
              <InputNumber min={0} max={timeline.duration} step={0.01} value={Number(timeline.current.toFixed(2))} onChange={(v)=> onScrub(Number(v||0))} />
            </Flex>
            <Slider min={0} max={timeline.duration} step={0.01} value={timeline.current}
              marks={{
                ...Object.fromEntries((timeline.cameraKeys||[]).map(k=>[Number(k.time.toFixed(2)), '•'])),
                ...(selectedKey ? Object.fromEntries(((timeline.visTracks[selectedKey]||[]) as VisibilityKeyframe[]).map(k=>[Number(k.time.toFixed(2)), '•'])) : {})
              }}
              onChange={(v)=> onScrub(Number(v))}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <Flex vertical gap={8}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ width: 80 }}>相机</strong>
                <Button size="small" onClick={addCameraKeyframe}>添加关键帧</Button>
                <span style={{ color: '#94a3b8' }}>缓动</span>
                <Select size="small" value={cameraKeyEasing} style={{ width: 110 }} onChange={(v)=>setCameraKeyEasing(v)}
                  options={[{label:'easeInOut', value:'easeInOut'},{label:'linear', value:'linear'}]} />
                <span style={{ color: '#94a3b8' }}>关键帧数：{timeline.cameraKeys.length}</span>
              </div>
              {/* MiniTrack for camera */}
              <div style={{ paddingLeft: 80 }}>
                <DraggableMiniTrack
                  duration={timeline.duration}
                  keys={(timeline.cameraKeys||[]).map(k=>k.time)}
                  color="#60a5fa"
                  onChangeKeyTime={(idx, t)=> updateCameraKeyTime(idx, t)}
                />
              </div>
              <div style={{ paddingLeft: 80 }}>
                {(timeline.cameraKeys||[]).sort((a,b)=>a.time-b.time).map((k,idx)=> (
                  <div key={`ck-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ width: 60 }}>t={k.time.toFixed(2)}</span>
                    <span style={{ width: 90 }}>easing={k.easing||'easeInOut'}</span>
                    <Button size="small" onClick={()=> updateCameraKeyTime(idx, timeline.current)}>设为当前时间</Button>
                    <Button size="small" danger onClick={()=> deleteCameraKey(idx)}>删除</Button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ width: 80 }}>显隐(所选)</strong>
                <Button size="small" disabled={!selectedKey} onClick={addVisibilityKeyframeForSelected}>添加关键帧</Button>
                <span style={{ color: '#94a3b8' }}>轨道数：{Object.keys(timeline.visTracks).length}</span>
              </div>
              {selectedKey && (
                <div style={{ paddingLeft: 80 }}>
                  <DraggableMiniTrack
                    duration={timeline.duration}
                    keys={((timeline.visTracks[selectedKey]||[]) as VisibilityKeyframe[]).map(k=>k.time)}
                    color="#34d399"
                    onChangeKeyTime={(idx, t)=> updateVisibilityKeyTime(idx, t)}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ width: 80 }}>TRS(所选)</strong>
                <Button size="small" disabled={!selectedKey} onClick={addTRSKeyForSelected}>添加关键帧</Button>
                <span style={{ color: '#94a3b8' }}>轨道数：{Object.keys(timeline.trsTracks).length}</span>
              </div>
              {selectedKey && (
                <div style={{ paddingLeft: 80 }}>
                  <DraggableMiniTrack
                    duration={timeline.duration}
                    keys={((timeline.trsTracks[selectedKey]||[]) as TransformKeyframe[]).map(k=>k.time)}
                    color="#f59e0b"
                    onChangeKeyTime={(idx, t)=> updateTRSKeyTime(idx, t)}
                  />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong style={{ width: 80 }}>标注(全局)</strong>
                <Button size="small" disabled={annotations.length===0} onClick={()=>{
                  // 为全部标注当前状态添加关键帧（可视/不可视由当前 markers 可见决定）
                  const group = markersGroupRef.current; if (!group) return;
                  setTimeline(prev => {
                    const next = { ...prev.annotationTracks } as Record<string, VisibilityKeyframe[]>;
                    for (const child of group.children) {
                      const id = (child as any).userData?.annotationId as string | undefined; if (!id) continue;
                      const vis = (child as any).visible !== false;
                      const list = next[id] || [];
                      next[id] = [...list, { time: prev.current, value: vis }].sort((a,b)=>a.time-b.time);
                    }
                    return { ...prev, annotationTracks: next };
                  });
                }}>添加关键帧(全部)</Button>
                <span style={{ color: '#94a3b8' }}>轨道数：{Object.keys(timeline.annotationTracks).length}</span>
              </div>
              {selectedKey && (
                <div style={{ paddingLeft: 80 }}>
                  {((timeline.visTracks[selectedKey]||[]) as VisibilityKeyframe[]).sort((a,b)=>a.time-b.time).map((k,idx)=> (
                    <div key={`vk-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ width: 60 }}>t={k.time.toFixed(2)}</span>
                      <span style={{ width: 60 }}>{k.value ? '显示' : '隐藏'}</span>
                      <Button size="small" onClick={()=> updateVisibilityKeyTime(idx, timeline.current)}>设为当前时间</Button>
                      <Button size="small" danger onClick={()=> deleteVisibilityKey(idx)}>删除</Button>
                    </div>
                  ))}
                  {((timeline.trsTracks[selectedKey]||[]) as TransformKeyframe[]).sort((a,b)=>a.time-b.time).map((k,idx)=> (
                    <div key={`tk-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ width: 60 }}>t={k.time.toFixed(2)}</span>
                      <span style={{ width: 160 }}>pos={k.position?.map(n=>n.toFixed(2)).join(',')||'-'}</span>
                      <span style={{ width: 160 }}>rot={k.rotationEuler?.map(n=>n.toFixed(2)).join(',')||'-'}</span>
                      <span style={{ width: 120 }}>scl={k.scale?.map(n=>n.toFixed(2)).join(',')||'-'}</span>
                      <Button size="small" onClick={()=> updateTRSKeyTime(idx, timeline.current)}>设为当前时间</Button>
                      <Button size="small" danger onClick={()=> deleteTRSKey(idx)}>删除</Button>
                    </div>
                  ))}
                </div>
              )}
            </Flex>
          </div>
        </div>
      </Card>
      <AnnotationEditor open={!!editingAnno} value={editingAnno} onCancel={()=>setEditingAnno(null)} onOk={(v)=>{ if (!v) return; setAnnotations(prev => prev.map(x => x.id === v.id ? v : x)); setEditingAnno(null); }} />
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

function DraggableMiniTrack({ duration, keys, color, onChangeKeyTime }: { duration: number; keys: number[]; color: string; onChangeKeyTime: (index: number, t: number)=>void }) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const toTime = (clientX: number) => {
    const el = ref.current; if (!el) return 0; const rect = el.getBoundingClientRect(); const p = Math.max(0, Math.min(rect.width, clientX - rect.left));
    return (p / Math.max(1, rect.width)) * duration;
  };
  const onDown = (e: React.MouseEvent, idx: number) => {
    const onMove = (ev: MouseEvent) => { onChangeKeyTime(idx, Math.max(0, Math.min(duration, toTime(ev.clientX)))); };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  return (
    <div ref={ref} style={{ position: 'relative', height: 22, background: '#1f2937', border: '1px solid #334155', borderRadius: 4 }}>
      {keys.map((t, idx) => (
        <div key={idx} title={`t=${t.toFixed(2)}s`} onMouseDown={(e)=>onDown(e, idx)}
          style={{ position: 'absolute', left: `${(t/Math.max(0.0001, duration))*100}%`, top: 2, width: 10, height: 18, marginLeft: -5, borderRadius: 2, background: color, cursor: 'ew-resize' }} />
      ))}
    </div>
  );
}


