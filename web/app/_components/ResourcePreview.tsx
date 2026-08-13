"use client";
import { useEffect, useRef, useState } from 'react';
import { Modal, Spin, Alert } from 'antd';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getAPI_BASE } from '@/app/_utils/api';

export interface PreviewFile {
  id: string;
  type: string; // 中文：图片/视频/模型/PDF/...
  originalName: string;
  downloadUrl: string;
}

function extOf(name: string) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

type Kind = 'image' | 'model' | 'video' | 'pdf' | 'unsupported';
function detectKind(f: PreviewFile): Kind {
  const ext = extOf(f.originalName);
  if (f.type === '图片' || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) return 'image';
  if (f.type === '模型' || ['.glb', '.gltf'].includes(ext)) return 'model';
  if (f.type === '视频' || ['.mp4', '.webm', '.mov'].includes(ext)) return 'video';
  if (f.type === 'PDF' || ext === '.pdf') return 'pdf';
  return 'unsupported';
}

// 本地 three.js GLB 查看器（离线可用，不依赖 CDN）
function GlbViewer({ url }: { url: string }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let raf = 0;
    let disposed = false;

    const width = mount.clientWidth || 760;
    const height = 520;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 5000);
    camera.position.set(2, 2, 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 1.5);
    dir.position.set(5, 10, 7.5);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.6);
    dir2.position.set(-5, -3, -5);
    scene.add(dir2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        // 居中并自适应相机
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const dist = maxDim * 1.8;
        camera.position.set(dist, dist * 0.8, dist);
        camera.near = maxDim / 100;
        camera.far = maxDim * 100;
        camera.updateProjectionMatrix();
        controls.target.set(0, 0, 0);
        controls.update();
        scene.add(model);
        setLoading(false);
      },
      undefined,
      (e: any) => { if (!disposed) { setErr(e?.message || '模型加载失败'); setLoading(false); } },
    );

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      controls.dispose();
      renderer.dispose();
      try { mount.removeChild(renderer.domElement); } catch { /* noop */ }
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => m.dispose?.());
        }
      });
    };
  }, [url]);

  return (
    <div>
      {loading && !err && <div style={{ textAlign: 'center', padding: 12 }}><Spin tip="加载模型中..." /></div>}
      {err && <Alert type="error" message={err} />}
      <div ref={mountRef} style={{ width: '100%', height: 520, borderRadius: 8, overflow: 'hidden' }} />
    </div>
  );
}

export default function ResourcePreview({ file, onClose }: { file: PreviewFile | null; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let revoked = '';
    if (!file) { setBlobUrl(''); setErr(''); return; }
    setLoading(true);
    setErr('');
    setBlobUrl('');
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    const url = file.downloadUrl.startsWith('http') ? file.downloadUrl : `${getAPI_BASE()}${file.downloadUrl}`;
    (async () => {
      try {
        // 注意：必须 cache:'no-store' + 流式读取再拼成 Blob。
        // Chrome 对大响应直接 res.blob() 会触发磁盘缓存物化失败（net::ERR_FAILED / Failed to fetch），
        // 而逐块读到内存再 new Blob([..]) 不受影响。
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`下载失败 (${res.status})`);
        let blob: Blob;
        if (res.body && typeof res.body.getReader === 'function') {
          const reader = res.body.getReader();
          const parts: Uint8Array[] = [];
          let total = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) { parts.push(value); total += value.length; }
          }
          const merged = new Uint8Array(total);
          let off = 0;
          for (const p of parts) { merged.set(p, off); off += p.length; }
          blob = new Blob([merged.buffer]);
        } else {
          blob = await res.blob();
        }
        const obj = URL.createObjectURL(blob);
        revoked = obj;
        setBlobUrl(obj);
      } catch (e: any) {
        setErr(e?.message || '加载失败');
      } finally {
        setLoading(false);
      }
    })();
    return () => { if (revoked) { try { URL.revokeObjectURL(revoked); } catch { /* noop */ } } };
  }, [file]);

  const kind = file ? detectKind(file) : 'unsupported';

  return (
    <Modal open={!!file} onCancel={onClose} footer={null} width={820} style={{ top: 20 }} title={file?.originalName} destroyOnClose>
      {loading && <div style={{ textAlign: 'center', padding: 40 }}><Spin tip="加载中..." /></div>}
      {err && <Alert type="error" message={err} />}
      {!loading && !err && blobUrl && (
        <div style={{ textAlign: 'center' }}>
          {kind === 'image' && <img src={blobUrl} alt={file?.originalName} style={{ maxWidth: '100%', maxHeight: '70vh' }} />}
          {kind === 'model' && <GlbViewer url={blobUrl} />}
          {kind === 'video' && <video src={blobUrl} controls style={{ maxWidth: '100%', maxHeight: '70vh' }} />}
          {kind === 'pdf' && <iframe src={blobUrl} style={{ width: '100%', height: '75vh', border: 'none' }} title="pdf" />}
          {kind === 'unsupported' && <Alert type="info" message="该文件类型暂不支持在线预览，请下载后查看" />}
        </div>
      )}
    </Modal>
  );
}
