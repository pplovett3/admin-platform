// 客户端模型截图：把 GLB（glTF-binary）渲染成一张 PNG 封面图。
// 用途：资源上传时自动生成模型缩略图作为卡片封面，避免人工上传截图。
// 在浏览器端用 three.js 离屏渲染（服务器无 GPU，放到前端最稳妥）。

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

function toArrayBuffer(input: ArrayBuffer | Blob): Promise<ArrayBuffer> {
  if (input instanceof ArrayBuffer) return Promise.resolve(input);
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error || new Error('读取模型失败'));
    fr.readAsArrayBuffer(input);
  });
}

export interface ThumbnailOptions {
  size?: number;       // 输出正方形边长（像素），默认 512
  background?: number | null; // 背景色；null = 透明，默认 null
  mime?: 'image/png' | 'image/webp'; // 输出格式，默认 png
}

// 渲染 GLB 并返回 PNG/WEBP 封面 Blob
export async function captureGlbThumbnail(
  input: ArrayBuffer | Blob,
  opts: ThumbnailOptions = {},
): Promise<Blob> {
  const size = opts.size ?? 512;
  const mime = opts.mime ?? 'image/png';
  const transparent = opts.background == null;

  const buffer = await toArrayBuffer(input);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: transparent,
    preserveDrawingBuffer: true, // 渲染后才能从画布读出像素
  });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  if (transparent) renderer.setClearColor(0x000000, 0);
  else renderer.setClearColor(opts.background as number, 1);

  const scene = new THREE.Scene();
  if (!transparent) scene.background = new THREE.Color(opts.background as number);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 10000);

  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  const dir = new THREE.DirectionalLight(0xffffff, 1.6);
  dir.position.set(5, 10, 7.5);
  scene.add(dir);
  const dir2 = new THREE.DirectionalLight(0xffffff, 0.7);
  dir2.position.set(-5, -3, -5);
  scene.add(dir2);

  const cleanup = () => {
    try {
      scene.traverse((obj: any) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m: any) => {
            Object.keys(m).forEach((k) => { if (m[k] && m[k].isTexture) m[k].dispose?.(); });
            m.dispose?.();
          });
        }
      });
    } catch { /* noop */ }
    renderer.dispose();
  };

  try {
    const model: THREE.Object3D = await new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.parse(
        buffer,
        '',
        (gltf) => resolve(gltf.scene),
        (e: any) => reject(e instanceof Error ? e : new Error(e?.message || '模型解析失败')),
      );
    });

    // 居中并自适应相机（与预览查看器一致的取景）
    const box = new THREE.Box3().setFromObject(model);
    const sizeVec = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    model.position.sub(center);
    const maxDim = Math.max(sizeVec.x, sizeVec.y, sizeVec.z) || 1;
    const dist = maxDim * 1.6;
    camera.position.set(dist, dist * 0.7, dist);
    camera.near = maxDim / 100;
    camera.far = maxDim * 100;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    scene.add(model);

    renderer.render(scene, camera);

    const blob: Blob | null = await new Promise((resolve) => {
      if (canvas.toBlob) canvas.toBlob((b) => resolve(b), mime, 0.92);
      else resolve(null);
    });
    if (!blob) throw new Error('截图生成失败');
    return blob;
  } finally {
    cleanup();
  }
}
