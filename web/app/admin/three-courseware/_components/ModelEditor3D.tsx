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
import { Button, Card, Flex, Form, Input, Space, Tree, App, Modal, Upload } from 'antd';
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
    controls?.update();
    const composer = composerRef.current;
    if (composer) composer.render(); else renderer.render(scene, camera);
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
    } catch (e: any) {
      console.error(e);
      message.error(e?.message || '加载失败');
    } finally {
      setLoading(false);
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
    if (outline) {
      outline.selectedObjects = [obj];
    }
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

  function buildPath(object: THREE.Object3D): string {
    const names: string[] = [];
    let o: THREE.Object3D | null = object;
    while (o) { names.push(o.name || o.uuid); o = o.parent as any; }
    return names.reverse().join('/');
  }

  const exportAnnotations = () => {
    const data = {
      version: '1.0',
      model: (urlForm.getFieldValue('url') as string) || '',
      annotations: annotations.map(a => ({
        id: a.id,
        target: { path: a.targetPath },
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
        if (Array.isArray(json?.annotations)) {
          // 以路径匹配目标（简单实现）
          const restored: Annotation[] = [];
          json.annotations.forEach((x: any) => {
            const target = findByPath(String(x?.target?.path || ''));
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
          message.success('已导入标注');
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
          <Space>
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


