// 客户端模型转换：将 FBX / OBJ / STL 转换为 GLB（glTF-binary）
// 目的：网页编辑器用 three.js 能直接加载这些格式，但 Unity 端只能解析 glTF/GLB，
// 因此在上传时统一转换为 GLB，保证后续任何端（含 Unity 元宇宙大厅）都能加载。

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { TGALoader } from 'three/examples/jsm/loaders/TGALoader.js';
import { unzipSync } from 'fflate';

// 外部资源表：键为文件名（小写 basename），值为该文件的二进制。
// 用于在转换 FBX/OBJ 时解析其引用的外部贴图、.mtl 等。
export type ResourceMap = Map<string, Uint8Array>;

// 需要客户端转换为 GLB 的扩展名
export const CONVERTIBLE_MODEL_EXTS = ['.fbx', '.obj', '.stl'];

// 资源管理器支持入库的扩展名（与后端单文件上传保持一致）
export const SUPPORTED_RESOURCE_EXTS = ['.mp4', '.jpg', '.jpeg', '.png', '.pdf', '.ppt', '.pptx', '.doc', '.docx', '.glb', '.fbx', '.obj', '.stl'];

export function getExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function needsGlbConversion(name: string): boolean {
  return CONVERTIBLE_MODEL_EXTS.includes(getExt(name));
}

function readAsArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as ArrayBuffer);
    fr.onerror = () => reject(fr.error || new Error('读取文件失败'));
    fr.readAsArrayBuffer(file);
  });
}

function readAsText(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(fr.error || new Error('读取文件失败'));
    fr.readAsText(file);
  });
}

// 根据外部资源表创建一个 LoadingManager：FBX/OBJ/MTL 引用贴图时，
// 按文件名（basename，忽略大小写）映射到资源表里的 blob URL。
// 1x1 透明 PNG，用于兜底未找到的贴图，避免向页面发起 404 请求
const TRANSPARENT_PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQAB3eL3AAAAAElFTkSuQmCC';

function makeManager(resources: ResourceMap | undefined, objectUrls: string[]): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();
  if (resources && resources.size) {
    manager.setURLModifier((url) => {
      try {
        if (url.startsWith('data:') || url.startsWith('blob:')) return url;
        const clean = decodeURIComponent(url.split('?')[0].split('#')[0]);
        const bn = baseName(clean).toLowerCase();
        const data = resources.get(bn);
        if (data) {
          const blob = new Blob([data.slice().buffer]);
          const obj = URL.createObjectURL(blob);
          objectUrls.push(obj);
          return obj;
        }
        // 包内没有该贴图：返回透明像素，避免相对页面路径发起 404
        // eslint-disable-next-line no-console
        console.warn('[modelConvert] 贴图未在压缩包内找到，已用透明占位：', bn);
        return TRANSPARENT_PX;
      } catch { /* ignore，回退原始 url */ }
      return url;
    });
  }
  return manager;
}

// 统计模型几何体规模，用于诊断「模型不显示/空模型」类问题
function logModelStats(object: THREE.Object3D, label: string): { meshes: number; vertices: number } {
  let meshes = 0; let vertices = 0; const types: Record<string, number> = {};
  object.traverse((child: any) => {
    types[child.type] = (types[child.type] || 0) + 1;
    if (child.isMesh || child.isSkinnedMesh || child.isPoints || child.isLine) {
      meshes++;
      vertices += child.geometry?.attributes?.position?.count || 0;
    }
  });
  try {
    // eslint-disable-next-line no-console
    console.info(`[modelConvert] ${label} 模型统计`, { 网格数: meshes, 顶点数: vertices, 节点类型: types });
  } catch { /* noop */ }
  return { meshes, vertices };
}

// 收集对象上用到的所有贴图
function collectTextures(object: THREE.Object3D): THREE.Texture[] {
  const set = new Set<THREE.Texture>();
  const keys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'bumpMap', 'specularMap', 'alphaMap', 'displacementMap'];
  object.traverse((child: any) => {
    const mat = child.material;
    if (!mat) return;
    const mats = Array.isArray(mat) ? mat : [mat];
    for (const m of mats) {
      for (const k of keys) { if (m && m[k]) set.add(m[k]); }
    }
  });
  return Array.from(set);
}

// 等待所有贴图图片加载完成（含内嵌与外部），避免 parse 后立即导出导致贴图丢失。
function waitForTextures(object: THREE.Object3D, timeoutMs = 20000): Promise<void> {
  const textures = collectTextures(object);
  const waits = textures.map((tex) => new Promise<void>((resolve) => {
    const img: any = tex.image;
    if (!img) { resolve(); return; }
    if (img.complete === true || (img.width && img.height)) { tex.needsUpdate = true; resolve(); return; }
    if (typeof img.addEventListener === 'function') {
      const done = () => { tex.needsUpdate = true; resolve(); };
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    } else { resolve(); }
  }));
  const all = Promise.all(waits).then(() => undefined);
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs));
  return Promise.race([all, timeout]);
}

async function loadObject3D(file: File, resources: ResourceMap | undefined, manager: THREE.LoadingManager): Promise<THREE.Object3D> {
  const ext = getExt(file.name);
  if (ext === '.fbx') {
    const buf = await readAsArrayBuffer(file);
    // path 传 '' ，外部贴图通过 manager 的 URLModifier 按文件名解析
    const obj = new FBXLoader(manager).parse(buf, '');
    return obj;
  }
  if (ext === '.obj') {
    const text = await readAsText(file);
    const objLoader = new OBJLoader(manager);
    // 若资源里带有 .mtl，则解析材质（含贴图）后再应用
    if (resources && resources.size) {
      const base = file.name.replace(/\.obj$/i, '').toLowerCase();
      let mtlKey = `${base}.mtl`;
      if (!resources.has(mtlKey)) {
        const anyMtl = Array.from(resources.keys()).find((k) => k.endsWith('.mtl'));
        if (anyMtl) mtlKey = anyMtl;
      }
      const mtlData = resources.get(mtlKey);
      if (mtlData) {
        try {
          const mtlText = new TextDecoder().decode(mtlData);
          const mtlLoader = new MTLLoader(manager);
          const materials = mtlLoader.parse(mtlText, '');
          materials.preload();
          objLoader.setMaterials(materials);
        } catch { /* 材质解析失败则用默认材质 */ }
      }
    }
    return objLoader.parse(text);
  }
  if (ext === '.stl') {
    const buf = await readAsArrayBuffer(file);
    const geometry = new STLLoader().parse(buf);
    const material = new THREE.MeshStandardMaterial({ color: 0xbfbfbf, metalness: 0.1, roughness: 0.7 });
    const mesh = new THREE.Mesh(geometry, material);
    const group = new THREE.Group();
    group.add(mesh);
    return group;
  }
  throw new Error(`不支持的模型格式：${ext}`);
}

function exportGlb(object: THREE.Object3D): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();
    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) resolve(result);
        else reject(new Error('GLB 导出结果异常'));
      },
      (error) => reject(error instanceof Error ? error : new Error('GLB 导出失败')),
      { binary: true, embedImages: true }
    );
  });
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.gif', '.tga'];
function isImageName(n: string): boolean { return IMAGE_EXTS.includes(getExt(n)); }

// 从 FBX 二进制里读出它「自身引用」的贴图文件名（对标 Unity：按 FBX 内嵌的
// RelativeFilename/Filename 找同名贴图）。返回资源表里确实存在的图片 key（小写 basename）。
// three.js 的 FBXLoader 对 3ds Max 的贴图槽位识别不全，常导致贴图未连上；
// 这里直接从字节流里捞出引用名，再补绑，最贴近 DCC/Unity 的真实行为。
async function extractFbxTextureRefs(file: File, resources: ResourceMap): Promise<string[]> {
  try {
    const buf = await readAsArrayBuffer(file);
    // 用 latin1 解码以保留任意字节为可匹配字符（FBX 为二进制容器）
    const text = new TextDecoder('latin1').decode(new Uint8Array(buf));
    const found: string[] = [];
    for (const key of resources.keys()) {
      if (!isImageName(key)) continue;
      const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // 文件名前应为路径分隔符 / 起始 / 非文件名字符，避免 base.png 误命中 database.png
      const re = new RegExp('(?:^|[^a-z0-9_])' + esc, 'i');
      if (re.test(text) && !found.includes(key)) found.push(key);
    }
    return found;
  } catch { return []; }
}

// 浏览器原生 <img>（TextureLoader 底层）无法解码 TGA。
// 这里在加载前把资源表里所有 .tga 就地转码为 PNG 字节（保留原 key），
// 这样 FBX 内部引用与我们的贴图绑定两条路径都统一走浏览器可解码的 PNG。
// TGALoader 解出的数据为左上角原点，与普通 PNG 一致，方向不会颠倒。
const _tgaTranscoded = new WeakSet<ResourceMap>();
async function transcodeTgaResources(resources: ResourceMap): Promise<void> {
  if (_tgaTranscoded.has(resources)) return;
  _tgaTranscoded.add(resources);
  const loader = new TGALoader();
  for (const [name, data] of Array.from(resources.entries())) {
    if (getExt(name) !== '.tga') continue;
    try {
      const ab = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
      const texData: any = (loader as any).parse(ab);
      if (!texData || !texData.data || !texData.width || !texData.height) continue;
      const canvas = document.createElement('canvas');
      canvas.width = texData.width;
      canvas.height = texData.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.putImageData(new ImageData(new Uint8ClampedArray(texData.data), texData.width, texData.height), 0, 0);
      const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/png'));
      if (!blob) continue;
      const buf = new Uint8Array(await blob.arrayBuffer());
      resources.set(name, buf); // 同 key 替换为 PNG 字节
    } catch {
      // 解析失败（如已是 PNG 或非法 TGA）则跳过
    }
  }
}

// 解析 Unity .meta：guid（小写） -> 它描述的资源文件名（小写 basename）
function parseMetaGuids(resources: ResourceMap): Map<string, string> {
  const map = new Map<string, string>();
  for (const [name, data] of resources) {
    if (!name.endsWith('.meta')) continue;
    try {
      const text = new TextDecoder().decode(data);
      const m = text.match(/guid:\s*([0-9a-fA-F]{8,})/);
      if (m) {
        const asset = name.slice(0, -'.meta'.length); // 去掉 .meta 后即资源本体名
        map.set(m[1].toLowerCase(), asset);
      }
    } catch { /* ignore */ }
  }
  return map;
}

// 解析 Unity .mat：材质名（小写） -> 主贴图文件名（小写）。
// 优先取 _MainTex / _BaseMap 引用的贴图，否则取首个能解析为图片的 guid。
function parseMatTextures(resources: ResourceMap, guidToAsset: Map<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const [name, data] of resources) {
    if (!name.endsWith('.mat')) continue;
    const matName = baseName(name).replace(/\.mat$/i, '').toLowerCase();
    try {
      const text = new TextDecoder().decode(data);
      let chosen = '';
      const pref = /(?:_MainTex|_BaseMap|_BaseColorMap)[\s\S]{0,240}?guid:\s*([0-9a-fA-F]{8,})/g;
      let pm: RegExpExecArray | null;
      while ((pm = pref.exec(text))) {
        const asset = guidToAsset.get(pm[1].toLowerCase());
        if (asset && isImageName(asset)) { chosen = asset.toLowerCase(); break; }
      }
      if (!chosen) {
        const any = /guid:\s*([0-9a-fA-F]{8,})/g;
        let gm: RegExpExecArray | null;
        while ((gm = any.exec(text))) {
          const asset = guidToAsset.get(gm[1].toLowerCase());
          if (asset && isImageName(asset)) { chosen = asset.toLowerCase(); break; }
        }
      }
      if (chosen) map.set(matName, chosen);
    } catch { /* ignore */ }
  }
  return map;
}

// 解析 Unity .mat 的基础颜色：材质名（小写） -> {r,g,b,a}（0~1）。
// Unity Standard/URP 着色器分别用 _Color / _BaseColor 存基础色（含透明度）。
function parseMatColors(resources: ResourceMap): Map<string, { r: number; g: number; b: number; a: number }> {
  const map = new Map<string, { r: number; g: number; b: number; a: number }>();
  for (const [name, data] of resources) {
    if (!name.endsWith('.mat')) continue;
    const matName = baseName(name).replace(/\.mat$/i, '').toLowerCase();
    try {
      const text = new TextDecoder().decode(data);
      // 形如：- _BaseColor: {r: 1, g: 0.5, b: 0.2, a: 1}
      const re = /-\s*(_BaseColor|_Color)\s*:\s*\{([^}]*)\}/g;
      let best: { r: number; g: number; b: number; a: number } | null = null;
      let bestKey = '';
      let mm: RegExpExecArray | null;
      while ((mm = re.exec(text))) {
        const key = mm[1];
        const body = mm[2];
        const num = (k: string, d: number) => {
          const m2 = new RegExp(`${k}\\s*:\\s*(-?[0-9.eE]+)`).exec(body);
          return m2 ? parseFloat(m2[1]) : d;
        };
        const c = { r: num('r', 1), g: num('g', 1), b: num('b', 1), a: num('a', 1) };
        // _BaseColor 优先于 _Color
        if (!best || (bestKey === '_Color' && key === '_BaseColor')) { best = c; bestKey = key; }
      }
      if (best) map.set(matName, best);
    } catch { /* ignore */ }
  }
  return map;
}

// 给 GLB 导出准备的贴图（sRGB + glTF 约定 flipY=false）
function makeTexLoader(resources: ResourceMap, manager: THREE.LoadingManager, objectUrls: string[]) {
  const cache = new Map<string, THREE.Texture | null>();
  return async (fname: string): Promise<THREE.Texture | null> => {
    if (cache.has(fname)) return cache.get(fname)!;
    const data = resources.get(fname);
    if (!data) { cache.set(fname, null); return null; }
    const blob = new Blob([data.slice().buffer]);
    const url = URL.createObjectURL(blob);
    objectUrls.push(url);
    try {
      const tex = await new Promise<THREE.Texture>((res, rej) =>
        new THREE.TextureLoader(manager).load(url, res, undefined, rej));
      if ((THREE as any).SRGBColorSpace) (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
      // 用 TextureLoader 默认的 flipY=true（FBX/3ds Max UV 约定）；
      // GLTFExporter 会把该竖直翻转烘焙进导出图片，UV 保持 glTF 标准，
      // 因此生成的 GLB 在网页预览与 Unity 中都能正确显示。
      tex.flipY = true;
      cache.set(fname, tex);
      return tex;
    } catch { cache.set(fname, null); return null; }
  };
}

// 自动为模型材质补漫反射贴图。处理两类常见情况：
//   1) Unity 资源包：贴图由 .mat 经 guid 绑定（FBX 自身可能无引用）。
//   2) 3ds Max 导出 FBX：贴图挂在 three.js 不识别的 `3dsMax|maps|texmap_diffuse` 槽位被跳过。
// 策略：先按「材质名 ↔ .mat 名」精确匹配；匹配不到时，若整包只有一张漫反射贴图，
// 则套到「顶点数最多」的主体材质上（排除被 .mat 标记为无贴图的材质，如金属）。
async function applyUnityTextures(
  object: THREE.Object3D,
  resources: ResourceMap,
  manager: THREE.LoadingManager,
  objectUrls: string[],
  fbxRefImages: string[] = [],
): Promise<void> {
  const guidToAsset = parseMetaGuids(resources);
  const matTex = guidToAsset.size ? parseMatTextures(resources, guidToAsset) : new Map<string, string>();
  const matColors = parseMatColors(resources);
  // 所有 .mat 名（用于识别「明确无贴图」的材质，如金属）
  const allMatNames = new Set<string>();
  for (const name of resources.keys()) {
    if (name.endsWith('.mat')) allMatNames.add(baseName(name).replace(/\.mat$/i, '').toLowerCase());
  }
  const texturelessMatNames = new Set(Array.from(allMatNames).filter((n) => !matTex.has(n)));

  // 整包里的图片（用于无 .mat 信息时的兜底）
  const imageFiles = Array.from(resources.keys()).filter(isImageName);
  // 候选的「唯一漫反射贴图」
  const distinctMatTex = new Set(matTex.values());
  let singleTexture = '';
  if (distinctMatTex.size === 1) singleTexture = Array.from(distinctMatTex)[0];
  else if (matTex.size === 0 && imageFiles.length === 1) singleTexture = imageFiles[0];

  const loadTex = makeTexLoader(resources, manager, objectUrls);

  // 收集材质 + 每个材质对应几何体的顶点数（取最大值），用于挑选主体材质
  const mats: any[] = [];
  const matVerts = new Map<any, number>();
  object.traverse((child: any) => {
    if (!child.material) return;
    const list = Array.isArray(child.material) ? child.material : [child.material];
    const verts = child.geometry?.attributes?.position?.count || 0;
    for (const m of list) {
      if (!mats.includes(m)) mats.push(m);
      matVerts.set(m, Math.max(matVerts.get(m) || 0, verts));
    }
  });

  let applied = 0;
  // Pass 1：按材质名精确匹配 .mat
  for (const m of mats) {
    if (m.map) { applied++; continue; }
    const key = (m.name || '').toLowerCase().trim();
    const fname = matTex.get(key);
    if (fname) { const t = await loadTex(fname); if (t) { m.map = t; m.needsUpdate = true; applied++; } }
  }

  // Pass 1.5：FBX 自身内嵌引用的贴图（最强信号，对标 Unity 的按文件名绑定）。
  // 3ds Max 导出的单图集（atlas）模型：FBXLoader 常识别不到贴图槽位导致全灰，
  // 这里把 FBX 引用的漫反射图铺到所有仍无贴图的材质上（图集 UV 已区分各部位）。
  if (fbxRefImages.length) {
    const diffuse =
      fbxRefImages.find((n) => /(diffuse|albedo|basecolor|base[_-]?color|color|base|_d)\b/i.test(n)) ||
      fbxRefImages.find((n) => !/(normal|_n|rough|metal|_ao|occlusion|emiss|_e)\b/i.test(n)) ||
      fbxRefImages[0];
    if (diffuse) {
      for (const m of mats) {
        if (m.map) continue;
        const t = await loadTex(diffuse);
        if (t) { m.map = t; m.needsUpdate = true; applied++; }
      }
    }
  }

  // Pass 2：名字没匹配上但有「唯一漫反射贴图」→ 贴到顶点数最多的非金属材质
  if (applied === 0 && singleTexture) {
    const candidates = mats.filter((m) => !m.map && !texturelessMatNames.has((m.name || '').toLowerCase().trim()));
    const pool = candidates.length ? candidates : mats.filter((m) => !m.map);
    pool.sort((a, b) => (matVerts.get(b) || 0) - (matVerts.get(a) || 0));
    const target = pool[0];
    if (target) {
      const t = await loadTex(singleTexture);
      if (t) { target.map = t; target.needsUpdate = true; applied++; }
    }
  }

  // Pass 3：PBR 多通道贴图——按文件名后缀（_BC/_N/_R/_M/_AO）分组，
  // 再用「贴图组名 ↔ 材质名」做包含匹配，绑定 map/normalMap/roughnessMap 等。
  const TEX_KINDS: { re: RegExp; slot: string }[] = [
    { re: /[_-](basecolor|albedo|diffuse|color|col|bc|d)$/i, slot: 'map' },
    { re: /[_-](normal|nrm|nor|n)$/i, slot: 'normalMap' },
    { re: /[_-](roughness|rough|r)$/i, slot: 'roughnessMap' },
    { re: /[_-](metallic|metalness|metal|m)$/i, slot: 'metalnessMap' },
    { re: /[_-](occlusion|ao)$/i, slot: 'aoMap' },
    { re: /[_-](emissive|emiss|e)$/i, slot: 'emissiveMap' },
  ];
  const groups = new Map<string, Record<string, string>>(); // 组名(小写) -> {slot: 图片名}
  for (const img of imageFiles) {
    const base = img.replace(/\.[^.]+$/, '');
    for (const k of TEX_KINDS) {
      if (k.re.test(base)) {
        const group = base.replace(k.re, '').toLowerCase();
        const g = groups.get(group) || {};
        if (!g[k.slot]) g[k.slot] = img;
        groups.set(group, g);
        break;
      }
    }
  }
  if (groups.size) {
    // 剥掉命名前缀 token（如 MI_/M_/T_/SM_/MAT_/TEX_），只比对核心名。
    // 典型命名：材质 MI_RotaryDrill_Arm ↔ 贴图 T_RotaryDrill_Arm_BC，
    // 前缀不同导致直接 includes 匹配不上，需先归一化。
    const stripPrefix = (s: string) =>
      s.replace(/^(mi|mat|material|m|tex|texture|tx|t|sm|mesh|inst|obj)[_-]/i, '');
    const groupNames = Array.from(groups.keys());
    for (const m of mats) {
      if (m.map) continue;
      const nm = (m.name || '').toLowerCase().trim();
      const ncore = stripPrefix(nm);
      let gname = '';
      if (nm) {
        gname =
          groupNames.find((g) => {
            const gcore = stripPrefix(g);
            return (
              g === nm ||
              g.includes(nm) ||
              nm.includes(g) ||
              (!!ncore && (gcore === ncore || gcore.includes(ncore) || ncore.includes(gcore)))
            );
          }) || '';
      }
      // 整个包只有一组贴图、且只有一个待贴材质时兜底
      if (!gname && groups.size === 1 && mats.filter((x) => !x.map).length === 1) gname = groupNames[0];
      if (!gname) continue;
      const slots = groups.get(gname)!;
      for (const [slot, fname] of Object.entries(slots)) {
        const t = await loadTex(fname);
        if (t) {
          if (slot !== 'map' && slot !== 'emissiveMap' && (THREE as any).NoColorSpace !== undefined) {
            (t as any).colorSpace = (THREE as any).NoColorSpace; // 数据贴图（法线/粗糙度等）用线性
          }
          (m as any)[slot] = t;
          m.needsUpdate = true;
        }
      }
      applied++;
    }
  }

  // Pass 4：应用 Unity .mat 的基础颜色（_Color/_BaseColor）。
  // Unity 中基础色会与主贴图相乘；无贴图时即为纯色。透明度 a<1 时开启透明。
  let coloredCount = 0;
  if (matColors.size) {
    const srgb = (THREE as any).SRGBColorSpace;
    for (const m of mats) {
      const key = (m.name || '').toLowerCase().trim();
      const c = matColors.get(key);
      if (!c || !m.color) continue;
      try {
        if (srgb !== undefined && (m.color as any).setRGB.length >= 4) {
          (m.color as any).setRGB(c.r, c.g, c.b, srgb);
        } else {
          m.color.setRGB(c.r, c.g, c.b);
        }
      } catch { m.color.setRGB(c.r, c.g, c.b); }
      if (c.a < 1) { m.transparent = true; m.opacity = c.a; }
      m.needsUpdate = true;
      coloredCount++;
    }
  }

  try {
    // eslint-disable-next-line no-console
    console.info('[modelConvert] 贴图绑定', {
      材质: mats.map((m) => ({ name: m.name, hasMap: !!m.map })),
      mat颜色映射: Array.from(matColors.keys()),
      已上色数: coloredCount,
      mat贴图映射: Array.from(matTex.entries()),
      无贴图材质: Array.from(texturelessMatNames),
      包内图片: imageFiles,
      FBX内嵌引用: fbxRefImages,
      已绑定数: applied,
    });
  } catch { /* noop */ }
}

// 把非标准材质（如 FBX 默认的 Phong）转换为 MeshStandardMaterial，
// 保留贴图与基础属性，确保 GLTFExporter 能可靠导出贴图。
function normalizeMaterials(object: THREE.Object3D): void {
  const convert = (m: any): any => {
    if (!m) return m;
    if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial || m.isMeshBasicMaterial) return m;
    const std = new THREE.MeshStandardMaterial();
    std.name = m.name || '';
    if (m.color) std.color.copy(m.color);
    if (m.map) std.map = m.map;
    if (m.normalMap) std.normalMap = m.normalMap;
    if (m.normalScale && std.normalScale) std.normalScale.copy(m.normalScale);
    if (m.roughnessMap) std.roughnessMap = m.roughnessMap;
    if (m.metalnessMap) std.metalnessMap = m.metalnessMap;
    if (m.bumpMap) std.bumpMap = m.bumpMap;
    if (typeof m.bumpScale === 'number') std.bumpScale = m.bumpScale;
    if (m.displacementMap) std.displacementMap = m.displacementMap;
    if (m.aoMap) std.aoMap = m.aoMap;
    if (m.emissive) std.emissive.copy(m.emissive);
    if (m.emissiveMap) std.emissiveMap = m.emissiveMap;
    if (typeof m.emissiveIntensity === 'number') std.emissiveIntensity = m.emissiveIntensity;
    if (m.alphaMap) std.alphaMap = m.alphaMap;
    std.transparent = !!m.transparent;
    std.opacity = typeof m.opacity === 'number' ? m.opacity : 1;
    std.side = m.side ?? THREE.FrontSide;
    std.vertexColors = !!m.vertexColors;
    if (typeof m.alphaTest === 'number') std.alphaTest = m.alphaTest;
    // 有金属/粗糙度贴图时，对应系数置 1 让贴图驱动；否则用合理缺省。
    std.metalness = m.metalnessMap ? 1 : (typeof m.metalness === 'number' ? m.metalness : 0);
    std.roughness = m.roughnessMap ? 1 : (typeof m.roughness === 'number' ? m.roughness : 1);
    return std;
  };
  object.traverse((child: any) => {
    if (!child.material) return;
    child.material = Array.isArray(child.material) ? child.material.map(convert) : convert(child.material);
  });
}

// 清理无效贴图：image 为空或尺寸为 0 的贴图槽位置空，
// 避免 GLTFExporter 因「No valid image data」中断整个模型导出。
function sanitizeTextures(object: THREE.Object3D): number {
  const keys = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap', 'bumpMap', 'specularMap', 'alphaMap', 'displacementMap', 'lightMap', 'envMap'];
  let removed = 0;
  const isValid = (tex: any): boolean => {
    if (!tex || !tex.isTexture) return true; // 非贴图不处理
    const img = tex.image;
    if (!img) return false;
    if (img.data !== undefined) return !!(img.data && img.width > 0 && img.height > 0); // DataTexture
    return (img.width > 0 && img.height > 0) || img.complete === true && img.naturalWidth > 0;
  };
  object.traverse((child: any) => {
    if (!child.material) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const m of mats) {
      for (const k of keys) {
        if (m[k] && !isValid(m[k])) { m[k] = null; m.needsUpdate = true; removed++; }
      }
    }
  });
  return removed;
}

export interface ConvertOptions {
  // 缩放比例：导出前对模型整体缩放。例如 0.001 表示缩小 1000 倍（mm→m 常见场景）。默认 1（不缩放）。
  scale?: number;
  // 朝向校正：导出前绕 X 轴旋转的角度（度）。FBX 常为 Z-up，转 glTF(Y-up) 时模型会躺平/转 90°，
  // 设为 -90 可矫正为竖直。默认 0（不旋转）。
  rotateXDeg?: number;
}

// 将 fbx/obj/stl 文件转换为 GLB 文件；若已是 glb 或不可转换，原样返回。
// resources：可选的外部资源表（贴图、.mtl、Unity .mat/.meta 等），用于让贴图随模型一起嵌入 GLB。
// options.scale：导出前整体缩放比例（默认 1）。
// options.rotateXDeg：导出前绕 X 轴旋转角度（默认 0）。
export async function convertModelToGlb(file: File, resources?: ResourceMap, options?: ConvertOptions): Promise<File> {
  if (!needsGlbConversion(file.name)) return file;
  const scale = options?.scale && options.scale > 0 ? options.scale : 1;
  const rotateXDeg = typeof options?.rotateXDeg === 'number' ? options.rotateXDeg : 0;
  const objectUrls: string[] = [];
  try {
    // 先把 .tga 贴图转码为 PNG（浏览器无法直接解码 TGA）
    if (resources && resources.size) await transcodeTgaResources(resources);
    const manager = makeManager(resources, objectUrls);
    const object = await loadObject3D(file, resources, manager);
    const stats = logModelStats(object, file.name);
    if (stats.meshes === 0 || stats.vertices === 0) {
      throw new Error(`模型几何体为空（网格 ${stats.meshes}、顶点 ${stats.vertices}），该 FBX 可能使用了浏览器端 FBXLoader 不支持的特性`);
    }
    // Unity 资源包：按 .mat/.meta 把贴图补到对应材质（FBX 自身常无贴图引用）
    if (resources && resources.size) {
      // 读取 FBX 内嵌引用的贴图（仅 .fbx），作为最强绑定信号
      let fbxRefImages: string[] = [];
      if (getExt(file.name) === '.fbx') {
        fbxRefImages = await extractFbxTextureRefs(file, resources);
      }
      try { await applyUnityTextures(object, resources, manager, objectUrls, fbxRefImages); } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[modelConvert] 贴图绑定异常', e);
      }
    }
    // 统一材质为标准材质，确保贴图能被导出
    normalizeMaterials(object);
    // 等贴图加载完再导出，避免贴图丢失
    await waitForTextures(object);
    // 清理无效贴图，避免单张坏图导致整模型导出失败
    const removed = sanitizeTextures(object);
    if (removed) {
      // eslint-disable-next-line no-console
      console.warn(`[modelConvert] 已清理 ${removed} 个无效贴图槽位（缺图/加载失败）`);
    }
    // 应用缩放比例与朝向校正：用一个父 Group 承载变换，GLTFExporter 会把它写入导出的根节点
    let exportRoot: THREE.Object3D = object;
    if (scale !== 1 || rotateXDeg !== 0) {
      const wrapper = new THREE.Group();
      wrapper.add(object);
      if (scale !== 1) wrapper.scale.set(scale, scale, scale);
      if (rotateXDeg !== 0) wrapper.rotation.x = (rotateXDeg * Math.PI) / 180;
      wrapper.updateMatrixWorld(true);
      exportRoot = wrapper;
      // eslint-disable-next-line no-console
      console.info(`[modelConvert] 应用缩放 ${scale} / 朝向校正 ${rotateXDeg}°（${file.name}）`);
    }
    const glbBuffer = await exportGlb(exportRoot);
    const baseName = file.name.replace(/\.(fbx|obj|stl)$/i, '');
    const glbName = `${baseName}.glb`;
    return new File([glbBuffer], glbName, { type: 'model/gltf-binary' });
  } finally {
    for (const u of objectUrls) { try { URL.revokeObjectURL(u); } catch { /* noop */ } }
  }
}

function baseName(p: string): string {
  const norm = p.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/');
  return i >= 0 ? norm.slice(i + 1) : norm;
}

// 单个待上传项：文件 + 它在 ZIP 内的相对目录层级（segments，空数组=根）
export interface ZipEntryItem { file: File; dir: string[]; }

export interface ZipExtractResult {
  items: ZipEntryItem[];   // 待上传项（模型已转成 glb，保留目录层级）
  skipped: string[];       // 跳过的不支持文件
  convertFailed: string[]; // 转换失败的模型
}

function dirSegments(p: string): string[] {
  const norm = p.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/');
  if (i < 0) return [];
  return norm.slice(0, i).split('/').filter(Boolean);
}

// 在浏览器端解压 ZIP：仅保留平台支持的格式，把 fbx/obj/stl 转成 glb，
// 并按 ZIP 内目录层级返回，供调用方建文件夹后逐个上传。
export async function extractZipToFiles(
  zipFile: File,
  onProgress?: (current: number, total: number, name: string) => void,
  options?: ConvertOptions,
): Promise<ZipExtractResult> {
  const buf = new Uint8Array(await readAsArrayBuffer(zipFile));
  const entries = unzipSync(buf);

  // 构建外部资源表：ZIP 内所有文件按 basename（小写）索引，
  // 供模型转换时解析其引用的贴图 / .mtl（同名覆盖时后者生效）。
  const resources: ResourceMap = new Map();
  for (const name of Object.keys(entries)) {
    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue;
    const bn = baseName(name);
    if (!bn || bn.startsWith('.')) continue;
    resources.set(bn.toLowerCase(), entries[name]);
  }

  const names = Object.keys(entries).filter((name) => {
    if (name.endsWith('/')) return false; // 目录
    const bn = baseName(name);
    if (!bn || bn.startsWith('.')) return false; // 隐藏文件
    if (name.startsWith('__MACOSX/')) return false;
    return SUPPORTED_RESOURCE_EXTS.includes(getExt(bn));
  });

  const result: ZipExtractResult = { items: [], skipped: [], convertFailed: [] };
  // 统计被跳过的（不支持的）文件
  for (const name of Object.keys(entries)) {
    if (name.endsWith('/') || name.startsWith('__MACOSX/')) continue;
    const bn = baseName(name);
    if (!bn || bn.startsWith('.')) continue;
    if (!SUPPORTED_RESOURCE_EXTS.includes(getExt(bn))) result.skipped.push(bn);
  }

  let i = 0;
  for (const name of names) {
    i++;
    const bn = baseName(name);
    const dir = dirSegments(name);
    onProgress?.(i, names.length, bn);
    const bytes = entries[name];
    // 复制成独立 ArrayBuffer，避免共享底层 buffer
    const ab = bytes.slice().buffer;
    const raw = new File([ab], bn);
    if (needsGlbConversion(bn)) {
      try {
        const glb = await convertModelToGlb(raw, resources, options);
        result.items.push({ file: glb, dir });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[modelConvert] 转换失败：${bn}`, e);
        result.convertFailed.push(bn);
      }
    } else {
      result.items.push({ file: raw, dir });
    }
  }
  return result;
}
