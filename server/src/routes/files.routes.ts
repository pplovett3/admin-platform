import { Router } from 'express';
import { Readable } from 'stream';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate } from '../middlewares/auth';
import { config } from '../config/env';
import { FileModel, FileVisibility, FileKind } from '../models/File';
import mongoose from 'mongoose';
import os from 'os';
import { convertStepToGlb, isStepFile } from '../services/step-converter';

const router = Router();
const tempDir = path.join(os.tmpdir(), 'uploads');
const chunkTempDir = path.join(os.tmpdir(), 'chunk-uploads');
try { fs.mkdirSync(tempDir, { recursive: true }); } catch {}
try { fs.mkdirSync(chunkTempDir, { recursive: true }); } catch {}
const upload = multer({ dest: tempDir });
const chunkUpload = multer({ dest: chunkTempDir });

// 分块上传状态存储（生产环境建议用 Redis）
const chunkUploadSessions = new Map<string, {
  uploadId: string;
  originalName: string;
  totalChunks: number;
  totalSize: number;
  uploadedChunks: Set<number>;
  visibility: FileVisibility;
  userId: string;
  userRole: string;
  createdAt: Date;
}>();

// 定期清理过期的分块上传会话（1小时过期）
setInterval(() => {
  const now = Date.now();
  for (const [uploadId, session] of chunkUploadSessions) {
    if (now - session.createdAt.getTime() > 3600000) {
      // 清理临时分块文件
      const sessionDir = path.join(chunkTempDir, uploadId);
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
      chunkUploadSessions.delete(uploadId);
    }
  }
}, 600000); // 每10分钟检查一次

function detectKindByExt(ext: string): FileKind {
  switch (ext) {
    case '.mp4':
      return 'video';
    case '.jpg':
    case '.jpeg':
    case '.png':
      return 'image';
    case '.pdf':
      return 'pdf';
    case '.ppt':
    case '.pptx':
      return 'ppt';
    case '.doc':
    case '.docx':
      return 'word';
    case '.glb':
    case '.fbx':
    case '.obj':
    case '.stl':
    case '.step':
    case '.stp':
      return 'model';
    default:
      return 'other';
  }
}

function kindToZh(kind: FileKind): string {
  switch (kind) {
    case 'video': return '视频';
    case 'image': return '图片';
    case 'model': return '模型';
    case 'pdf': return 'PDF';
    case 'ppt': return 'PPT';
    case 'word': return 'WORD';
    default: return '其他';
  }
}

function decodeOriginalName(name: string): string {
  try {
    // Multer on some platforms reads as latin1 for non-ASCII; convert to utf8
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

function ensureNestedDir(root: string, relDir: string): void {
  const segs = relDir.replace(/^[\\/]+|[\\/]+$/g, '').split(/[\\/]+|\//g).filter(Boolean);
  let curr = root;
  for (const seg of segs) {
    curr = path.join(curr, seg);
    try {
      if (!fs.existsSync(curr)) {
        try {
          fs.mkdirSync(curr);
        } catch (e: any) {
          // WebDAV/WebClient may return EPERM/EEXIST even if dir exists; re-check then continue
          if ((e && (e.code === 'EEXIST' || e.code === 'EPERM')) && fs.existsSync(curr)) {
            continue;
          }
          throw e;
        }
      }
    } catch (err) {
      throw err;
    }
  }
}

router.get('/_debug', (_req, res) => {
  res.json({ storageRoot: config.storageRoot, env: process.env.STORAGE_ROOT });
});

// 简单代理：用于前端三维编辑器加载跨域 GLB 等静态资源
// 限定白名单域名，避免被用于开放代理
router.get('/proxy', authenticate as any, async (req, res) => {
  try {
    const raw = String((req.query as any).url || '').trim();
    if (!raw) return res.status(400).json({ message: 'url is required' });
    let u: URL;
    try { u = new URL(raw); } catch { return res.status(400).json({ message: 'invalid url' }); }
    const allowHosts = new Set([
      'video.yf-xr.com',
      'dl.yf-xr.com',
    ]);
    if (!(u.protocol === 'https:' || u.protocol === 'http:')) return res.status(400).json({ message: 'unsupported protocol' });
    if (allowHosts.size && !allowHosts.has(u.hostname)) return res.status(403).json({ message: 'host not allowed' });

    const r = await fetch(u.toString());
    if (!r.ok || !r.body) {
      return res.status(r.status || 502).end();
    }
    const ct = r.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', ct);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    // Pipe WebReadableStream → Node Readable → res
    const nodeStream = Readable.fromWeb(r.body as any);
    nodeStream.pipe(res);
  } catch (e: any) {
    res.status(500).json({ message: e?.message || 'proxy failed' });
  }
});

router.get('/mine', authenticate as any, async (req, res) => {
  const current = (req as any).user as { userId: string };
  const { type, q, page = '1', pageSize = '20' } = req.query as any;
  const filter: any = { 
    ownerUserId: new mongoose.Types.ObjectId(current.userId), 
    visibility: 'private',
    storageDir: { $not: /^tts\// }, // 排除TTS目录下的文件（AI课件配音）
    $and: [
      { originalName: { $not: /^courseware-.*-modified\.glb$/i } }, // 排除编辑器临时文件
      { originalName: { $not: /^thumbnail-/i } } // 排除课件封面图
    ]
  };
  if (type) filter.type = type;
  if (q) {
    // 搜索时添加搜索条件
    filter.$and.push({ originalName: { $regex: String(q), $options: 'i' } });
  }
  const p = Math.max(parseInt(String(page), 10) || 1, 1);
  const ps = Math.min(Math.max(parseInt(String(pageSize), 10) || 20, 1), 100);
  const [rows, total] = await Promise.all([
    FileModel.find(filter).sort({ createdAt: -1 }).skip((p - 1) * ps).limit(ps).lean(),
    FileModel.countDocuments(filter),
  ]);
  const mapped = rows.map((r: any) => ({
    id: r._id,
    type: kindToZh(r.type),
    originalName: r.originalName,
    size: r.size,
    createdAt: r.createdAt,
    downloadUrl: config.publicDownloadBase ? `${config.publicDownloadBase.replace(/\/$/,'')}/${(r.storageRelPath as any)}` : `/api/files/${r._id}/download/${encodeURIComponent(r.originalName)}`,
    viewUrl: (r.type==='image'||r.type==='video'||r.type==='model') && config.publicViewBase ? `${config.publicViewBase.replace(/\/$/,'')}/${(r.storageRelPath as any)}` : undefined,
    visibility: r.visibility,
  }));
  res.json({ rows: mapped, total, page: p, pageSize: ps });
});

router.get('/public', authenticate as any, async (_req, res) => {
  const { type, q, page = '1', pageSize = '20' } = _req.query as any;
  const filter: any = { 
    visibility: 'public',
    storageDir: { $not: /^tts\// }, // 排除TTS目录下的文件（AI课件配音）
    $and: [
      { originalName: { $not: /^courseware-.*-modified\.glb$/i } }, // 排除编辑器临时文件
      { originalName: { $not: /^thumbnail-/i } } // 排除课件封面图
    ]
  };
  if (type) filter.type = type;
  if (q) {
    // 搜索时添加搜索条件
    filter.$and.push({ originalName: { $regex: String(q), $options: 'i' } });
  }
  const p = Math.max(parseInt(String(page), 10) || 1, 1);
  const ps = Math.min(Math.max(parseInt(String(pageSize), 10) || 20, 1), 100);
  const [rows, total] = await Promise.all([
    FileModel.find(filter).sort({ createdAt: -1 }).skip((p - 1) * ps).limit(ps).lean(),
    FileModel.countDocuments(filter),
  ]);
  res.json({ rows: rows.map((r: any) => ({ id: r._id, type: kindToZh(r.type), originalName: r.originalName, size: r.size, createdAt: r.createdAt, downloadUrl: config.publicDownloadBase ? `${config.publicDownloadBase.replace(/\/$/,'')}/${(r.storageRelPath as any)}` : `/api/files/${r._id}/download/${encodeURIComponent(r.originalName)}`, viewUrl: (r.type==='image'||r.type==='video'||r.type==='model') && config.publicViewBase ? `${config.publicViewBase.replace(/\/$/,'')}/${(r.storageRelPath as any)}` : undefined })), total, page: p, pageSize: ps });
});

router.get('/client/mine', authenticate as any, async (req, res) => {
  const current = (req as any).user as { userId: string };
  // 排除 TTS 自动生成的音频文件（AI课件配音）
  // 排除编辑器自动保存的临时GLB文件
  // 排除课件封面图
  const rows = await FileModel.find({ 
    ownerUserId: new mongoose.Types.ObjectId(current.userId),
    storageDir: { $not: /^tts\// }, // 排除TTS目录下的文件
    $and: [
      { originalName: { $not: /^courseware-.*-modified\.glb$/i } }, // 排除编辑器临时文件
      { originalName: { $not: /^thumbnail-/i } } // 排除课件封面图
    ]
  }).sort({ createdAt: -1 }).lean();
  const base = config.publicDownloadBase.replace(/\/$/, '');
  const mapped = rows.map((r: any) => ({ name: r.originalName, type: kindToZh(r.type), download: base ? `${base}/${r.storageRelPath}` : `/api/files/${r._id}/download/${encodeURIComponent(r.originalName)}` }));
  res.json({ rows: mapped });
});

router.get('/client/public', authenticate as any, async (_req, res) => {
  // 排除 TTS 自动生成的音频文件（AI课件配音）
  // 排除编辑器自动保存的临时GLB文件
  // 排除课件封面图
  const rows = await FileModel.find({ 
    visibility: 'public',
    storageDir: { $not: /^tts\// }, // 排除TTS目录下的文件
    $and: [
      { originalName: { $not: /^courseware-.*-modified\.glb$/i } }, // 排除编辑器临时文件
      { originalName: { $not: /^thumbnail-/i } } // 排除课件封面图
    ]
  }).sort({ createdAt: -1 }).lean();
  const base = config.publicDownloadBase.replace(/\/$/, '');
  const mapped = rows.map((r: any) => ({ name: r.originalName, type: kindToZh(r.type), download: base ? `${base}/${r.storageRelPath}` : `/api/files/${r._id}/download/${encodeURIComponent(r.originalName)}` }));
  res.json({ rows: mapped });
});

// 支持带文件名和不带文件名的下载URL
const handleDownload = async (req: any, res: any) => {
  const current = (req as any).user as { userId: string; role: string };
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'Not found' });
  const doc = await FileModel.findById(id).lean();
  if (!doc) return res.status(404).json({ message: 'Not found' });
  const isOwner = String((doc as any).ownerUserId) === String(current.userId);
  const isPublic = (doc as any).visibility === 'public';
  const isSuper = current.role === 'superadmin';
  if (!isOwner && !isPublic && !isSuper) return res.status(403).json({ message: 'Forbidden' });

  const abs = path.join(config.storageRoot, (doc as any).storageRelPath.replace(/\\/g, '/'));
  if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File content missing' });

  const stat = fs.statSync(abs);
  
  // 设置 Content-Disposition 响应头，让客户端知道文件名和扩展名
  const filename = (doc as any).originalName || `file.${(doc as any).ext}`;
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
  
  const range = (req.headers.range || '').toString();
  if (range && /^bytes=/.test(range)) {
    const [startStr, endStr] = range.replace('bytes=', '').split('-');
    let start = parseInt(startStr, 10) || 0;
    let end = endStr ? parseInt(endStr, 10) : stat.size - 1;
    if (start > end) start = 0;
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', String(end - start + 1));
    fs.createReadStream(abs, { start, end }).pipe(res);
    return;
  }
  res.setHeader('Content-Length', String(stat.size));
  fs.createReadStream(abs).pipe(res);
};

router.get('/:id/download/:filename', authenticate as any, handleDownload);
router.get('/:id/download', authenticate as any, handleDownload);

// 公开的缩略图/图片访问接口（不需要认证）- 仅限图片文件
router.get('/thumbnail/:id', async (req: any, res: any) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'Not found' });
    
    const doc = await FileModel.findById(id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found' });
    
    // 安全检查：只允许访问图片文件
    const filename = (doc as any).originalName || '';
    const ext = path.extname(filename).toLowerCase();
    const allowedImageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
    if (!allowedImageExts.includes(ext)) {
      return res.status(403).json({ message: 'Access denied - only images allowed' });
    }
    
    const rel = (doc as any).storageRelPath;
    if (!rel) return res.status(404).json({ message: 'File path not found' });
    
    const abs = path.join(config.storageRoot, rel);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found on disk' });
    
    const stat = fs.statSync(abs);
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    res.setHeader('Content-Type', contentTypes[ext] || 'image/png');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存1年
    fs.createReadStream(abs).pipe(res);
  } catch (e: any) {
    console.error('Thumbnail access error:', e);
    res.status(500).json({ message: 'Internal error' });
  }
});

// 公开的模型文件下载接口（不需要认证）- 仅限已审核通过课件的模型
router.get('/public-model/:id', async (req: any, res: any) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'Not found' });
    
    const doc = await FileModel.findById(id).lean();
    if (!doc) return res.status(404).json({ message: 'Not found' });
    
    // 安全检查：只允许访问模型文件
    const filename = (doc as any).originalName || '';
    const ext = path.extname(filename).toLowerCase();
    const allowedModelExts = ['.glb', '.gltf', '.fbx', '.obj'];
    if (!allowedModelExts.includes(ext)) {
      return res.status(403).json({ message: 'Access denied - only model files allowed' });
    }
    
    const rel = (doc as any).storageRelPath;
    if (!rel) return res.status(404).json({ message: 'File path not found' });
    
    const abs = path.join(config.storageRoot, rel);
    if (!fs.existsSync(abs)) return res.status(404).json({ message: 'File not found on disk' });
    
    const stat = fs.statSync(abs);
    const contentTypes: Record<string, string> = {
      '.glb': 'model/gltf-binary',
      '.gltf': 'model/gltf+json',
      '.fbx': 'application/octet-stream',
      '.obj': 'text/plain',
    };
    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存1天
    fs.createReadStream(abs).pipe(res);
  } catch (e: any) {
    console.error('Public model access error:', e);
    res.status(500).json({ message: 'Internal error' });
  }
});

// STEP 文件上传并转换为 GLB
router.post('/upload-step', authenticate as any, upload.single('file'), async (req, res) => {
  try {
    const current = (req as any).user as { userId: string; role: string };
    const file = (req as any).file as any;
    if (!file) return res.status(400).json({ message: 'file is required' });

    const decodedName = decodeOriginalName(file.originalname as string);
    const ext = path.extname(decodedName).toLowerCase();
    
    if (ext !== '.step' && ext !== '.stp') {
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: 'Only STEP/STP files are supported' });
    }

    console.log(`[STEP Converter] Starting conversion for: ${decodedName}`);

    // 转换 STEP 为 GLB
    const glbFileName = decodedName.replace(/\.(step|stp)$/i, '.glb');
    const glbTempPath = path.join(tempDir, `converted_${Date.now()}_${glbFileName}`);
    
    const result = await convertStepToGlb(file.path, glbTempPath);
    
    // 清理原始 STEP 文件
    fs.unlinkSync(file.path);

    if (!result.success || !result.glbPath) {
      return res.status(400).json({ 
        message: 'STEP conversion failed', 
        error: result.error 
      });
    }

    console.log(`[STEP Converter] Conversion successful: ${result.meshInfo?.vertexCount} vertices, ${result.meshInfo?.faceCount} faces`);

    // 计算 GLB 文件的 SHA256
    const glbBuffer = fs.readFileSync(glbTempPath);
    const sha256 = crypto.createHash('sha256').update(glbBuffer).digest('hex');
    const glbSize = glbBuffer.length;

    // 存储 GLB 文件
    let visibility: FileVisibility = 'private';
    const v = (req.body?.visibility || '').toString();
    if (v === 'public') {
      if (current.role !== 'superadmin') {
        fs.unlinkSync(glbTempPath);
        return res.status(403).json({ message: 'only superadmin can upload public resource' });
      }
      visibility = 'public';
    }

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const id = new mongoose.Types.ObjectId().toString();
    const rel = visibility === 'public'
      ? path.posix.join('public', yyyy, mm, id, glbFileName)
      : path.posix.join('users', current.userId, yyyy, mm, id, glbFileName);

    const relDir = path.posix.dirname(rel);
    const targetDir = path.join(config.storageRoot, relDir);
    try { ensureNestedDir(config.storageRoot, relDir); } catch (mkErr: any) {
      console.error('ensure dir failed:', targetDir, mkErr?.message);
      throw mkErr;
    }
    const finalPath = path.join(config.storageRoot, rel);

    // 移动文件到最终位置
    await new Promise<void>((resolve, reject) => {
      const rs = fs.createReadStream(glbTempPath);
      const ws = fs.createWriteStream(finalPath, { flags: 'w' });
      rs.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', () => resolve());
      rs.pipe(ws);
    });
    fs.unlinkSync(glbTempPath);

    // 保存到数据库
    const saved = await FileModel.create({
      ownerUserId: new mongoose.Types.ObjectId(current.userId),
      ownerRole: current.role as any,
      visibility,
      type: 'model' as FileKind,
      originalName: glbFileName,
      originalNameSaved: glbFileName,
      ext: '.glb',
      size: glbSize,
      sha256,
      storageRelPath: rel.replace(/\\/g, '/'),
      storageDir: relDir.replace(/\\/g, '/'),
    } as any);

    const savedId = ((saved as any)._id || '').toString();
    const downloadUrl = `/api/files/${savedId}/download/${encodeURIComponent(glbFileName)}`;
    
    return res.json({ 
      ok: true, 
      file: saved, 
      downloadUrl,
      originalStepFile: decodedName,
      convertedGlbFile: glbFileName,
      meshInfo: result.meshInfo,
    });
  } catch (e: any) {
    console.error('STEP upload/convert failed:', e);
    return res.status(500).json({ message: e?.message || 'STEP conversion failed' });
  }
});

router.post('/upload', authenticate as any, upload.single('file'), async (req, res) => {
  try {
    const current = (req as any).user as { userId: string; role: string };
    const file = (req as any).file as any;
    if (!file) return res.status(400).json({ message: 'file is required' });

    const decodedName = decodeOriginalName(file.originalname as string);
    const ext = path.extname(decodedName).toLowerCase();
    const allowed = ['.mp4','.jpg','.jpeg','.png','.pdf','.ppt','.pptx','.doc','.docx','.glb','.fbx','.obj','.stl','.step','.stp'];
    if (!allowed.includes(ext)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: 'unsupported file type' });
    }

    let visibility: FileVisibility = 'private';
    const v = (req.body?.visibility || '').toString();
    if (v === 'public') {
      if (current.role !== 'superadmin') {
        fs.unlinkSync(file.path);
        return res.status(403).json({ message: 'only superadmin can upload public resource' });
      }
      visibility = 'public';
    }

    const sha256 = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      fs.createReadStream(file.path)
        .on('data', (d) => hash.update(d))
        .on('end', () => resolve(hash.digest('hex')))
        .on('error', reject);
    });

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const id = new mongoose.Types.ObjectId().toString();
    const rel = visibility === 'public'
      ? path.posix.join('public', yyyy, mm, id, decodedName)
      : path.posix.join('users', current.userId, yyyy, mm, id, decodedName);

    const relDir = path.posix.dirname(rel);
    const targetDir = path.join(config.storageRoot, relDir);
    try { ensureNestedDir(config.storageRoot, relDir); } catch (mkErr: any) {
      console.error('ensure dir failed:', targetDir, mkErr?.message);
      throw mkErr;
    }
    const finalPath = path.join(config.storageRoot, rel);

    await new Promise<void>((resolve, reject) => {
      const rs = fs.createReadStream(file.path);
      const ws = fs.createWriteStream(finalPath, { flags: 'w' });
      rs.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', () => resolve());
      rs.pipe(ws);
    });
    fs.unlinkSync(file.path);

    const saved = await FileModel.create({
      ownerUserId: new mongoose.Types.ObjectId(current.userId),
      ownerRole: current.role as any,
      visibility,
      type: detectKindByExt(ext),
      originalName: decodedName,
      originalNameSaved: decodedName,
      ext,
      size: file.size,
      sha256,
      storageRelPath: rel.replace(/\\/g, '/'),
      storageDir: relDir.replace(/\\/g, '/'),
    } as any);

    const savedId = ((saved as any)._id || '').toString();
    const downloadUrl = `/api/files/${savedId}/download/${encodeURIComponent(decodedName)}`;
    return res.json({ ok: true, file: saved, downloadUrl });
  } catch (e: any) {
    console.error('upload failed:', e);
    return res.status(500).json({ message: e?.message || 'upload failed' });
  }
});

// ==================== 分块上传接口 ====================

// 1. 初始化分块上传
router.post('/chunk/init', authenticate as any, async (req, res) => {
  try {
    const current = (req as any).user as { userId: string; role: string };
    const { fileName, fileSize, totalChunks, visibility = 'private' } = req.body;

    if (!fileName || !fileSize || !totalChunks) {
      return res.status(400).json({ message: 'fileName, fileSize, totalChunks are required' });
    }

    const ext = path.extname(fileName).toLowerCase();
    const allowed = ['.mp4','.jpg','.jpeg','.png','.pdf','.ppt','.pptx','.doc','.docx','.glb','.fbx','.obj','.stl'];
    if (!allowed.includes(ext)) {
      return res.status(400).json({ message: 'unsupported file type' });
    }

    if (visibility === 'public' && current.role !== 'superadmin') {
      return res.status(403).json({ message: 'only superadmin can upload public resource' });
    }

    const uploadId = crypto.randomUUID();
    const sessionDir = path.join(chunkTempDir, uploadId);
    fs.mkdirSync(sessionDir, { recursive: true });

    chunkUploadSessions.set(uploadId, {
      uploadId,
      originalName: fileName,
      totalChunks: parseInt(totalChunks),
      totalSize: parseInt(fileSize),
      uploadedChunks: new Set(),
      visibility: visibility as FileVisibility,
      userId: current.userId,
      userRole: current.role,
      createdAt: new Date(),
    });

    return res.json({ ok: true, uploadId, message: 'Chunk upload initialized' });
  } catch (e: any) {
    console.error('chunk init failed:', e);
    return res.status(500).json({ message: e?.message || 'init failed' });
  }
});

// 2. 上传单个分块
router.post('/chunk/upload', authenticate as any, chunkUpload.single('chunk'), async (req, res) => {
  try {
    const current = (req as any).user as { userId: string };
    const { uploadId, chunkIndex } = req.body;
    const file = (req as any).file;

    if (!uploadId || chunkIndex === undefined || !file) {
      return res.status(400).json({ message: 'uploadId, chunkIndex, chunk are required' });
    }

    const session = chunkUploadSessions.get(uploadId);
    if (!session) {
      fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Upload session not found or expired' });
    }

    if (session.userId !== current.userId) {
      fs.unlinkSync(file.path);
      return res.status(403).json({ message: 'Forbidden' });
    }

    const idx = parseInt(chunkIndex);
    if (idx < 0 || idx >= session.totalChunks) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: 'Invalid chunk index' });
    }

    // 移动分块到会话目录
    const chunkPath = path.join(chunkTempDir, uploadId, `chunk_${idx}`);
    fs.renameSync(file.path, chunkPath);
    session.uploadedChunks.add(idx);

    const progress = Math.round((session.uploadedChunks.size / session.totalChunks) * 100);

    return res.json({
      ok: true,
      chunkIndex: idx,
      uploadedChunks: session.uploadedChunks.size,
      totalChunks: session.totalChunks,
      progress,
    });
  } catch (e: any) {
    console.error('chunk upload failed:', e);
    return res.status(500).json({ message: e?.message || 'chunk upload failed' });
  }
});

// 3. 完成分块上传（合并文件）
router.post('/chunk/complete', authenticate as any, async (req, res) => {
  try {
    const current = (req as any).user as { userId: string };
    const { uploadId } = req.body;

    if (!uploadId) {
      return res.status(400).json({ message: 'uploadId is required' });
    }

    const session = chunkUploadSessions.get(uploadId);
    if (!session) {
      return res.status(404).json({ message: 'Upload session not found or expired' });
    }

    if (session.userId !== current.userId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 检查所有分块是否已上传
    if (session.uploadedChunks.size !== session.totalChunks) {
      return res.status(400).json({
        message: `Missing chunks: uploaded ${session.uploadedChunks.size}/${session.totalChunks}`,
      });
    }

    // 合并分块
    const sessionDir = path.join(chunkTempDir, uploadId);
    const mergedPath = path.join(tempDir, `merged_${uploadId}_${session.originalName}`);
    const writeStream = fs.createWriteStream(mergedPath);

    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(sessionDir, `chunk_${i}`);
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
    }
    writeStream.end();

    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // 计算 SHA256
    const sha256 = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      fs.createReadStream(mergedPath)
        .on('data', (d) => hash.update(d))
        .on('end', () => resolve(hash.digest('hex')))
        .on('error', reject);
    });

    // 构建存储路径
    const decodedName = session.originalName;
    const ext = path.extname(decodedName).toLowerCase();
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const id = new mongoose.Types.ObjectId().toString();
    const rel = session.visibility === 'public'
      ? path.posix.join('public', yyyy, mm, id, decodedName)
      : path.posix.join('users', session.userId, yyyy, mm, id, decodedName);

    const relDir = path.posix.dirname(rel);
    try { ensureNestedDir(config.storageRoot, relDir); } catch (mkErr: any) {
      console.error('ensure dir failed:', mkErr?.message);
      throw mkErr;
    }
    const finalPath = path.join(config.storageRoot, rel);

    // 移动合并后的文件到最终位置
    await new Promise<void>((resolve, reject) => {
      const rs = fs.createReadStream(mergedPath);
      const ws = fs.createWriteStream(finalPath, { flags: 'w' });
      rs.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', () => resolve());
      rs.pipe(ws);
    });

    // 清理临时文件
    fs.unlinkSync(mergedPath);
    fs.rmSync(sessionDir, { recursive: true, force: true });
    chunkUploadSessions.delete(uploadId);

    // 获取实际文件大小
    const finalStat = fs.statSync(finalPath);

    // 保存到数据库
    const saved = await FileModel.create({
      ownerUserId: new mongoose.Types.ObjectId(session.userId),
      ownerRole: session.userRole as any,
      visibility: session.visibility,
      type: detectKindByExt(ext),
      originalName: decodedName,
      originalNameSaved: decodedName,
      ext,
      size: finalStat.size,
      sha256,
      storageRelPath: rel.replace(/\\/g, '/'),
      storageDir: relDir.replace(/\\/g, '/'),
    } as any);

    const savedId = ((saved as any)._id || '').toString();
    const downloadUrl = `/api/files/${savedId}/download/${encodeURIComponent(decodedName)}`;

    return res.json({ ok: true, file: saved, downloadUrl });
  } catch (e: any) {
    console.error('chunk complete failed:', e);
    return res.status(500).json({ message: e?.message || 'complete failed' });
  }
});

// 4. 取消/清理分块上传
router.delete('/chunk/:uploadId', authenticate as any, async (req, res) => {
  try {
    const current = (req as any).user as { userId: string };
    const { uploadId } = req.params;

    const session = chunkUploadSessions.get(uploadId);
    if (session && session.userId === current.userId) {
      const sessionDir = path.join(chunkTempDir, uploadId);
      try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
      chunkUploadSessions.delete(uploadId);
    }

    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'cleanup failed' });
  }
});

// ==================== 分块上传接口结束 ====================

router.delete('/:id', authenticate as any, async (req, res) => {
  const current = (req as any).user as { userId: string; role: string };
  const id = req.params.id;
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(404).json({ message: 'Not found' });
  const doc = await FileModel.findById(id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  const isOwner = String((doc as any).ownerUserId) === String(current.userId);
  const isSuper = current.role === 'superadmin';
  if (!isOwner && !isSuper) return res.status(403).json({ message: 'Forbidden' });
  // best-effort remove file
  try {
    const abs = path.join(config.storageRoot, (doc as any).storageRelPath.replace(/\\/g, '/'));
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch {}
  await (doc as any).deleteOne();
  res.json({ ok: true });
});

// 专门用于上传三维课件修改后的模型文件
router.post('/courseware-upload', authenticate as any, upload.single('file'), async (req, res) => {
  try {
    const current = (req as any).user as { userId: string; role: string };
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'No file provided' });

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    
    // 只允许GLB文件
    if (ext !== '.glb') {
      return res.status(400).json({ message: 'Only GLB files are allowed for courseware models' });
    }

    // 生成文件哈希
    const buffer = fs.readFileSync(file.path);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // 构建专门的modified模型存储路径: modifiedModels/用户ID/年月/文件名
    const now = new Date();
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const relDir = `modifiedModels/${current.userId}/${yearMonth}`;
    const filename = `${sha256}${ext}`;
    const rel = `${relDir}/${filename}`;

    // 确保目录存在
    const targetDir = path.join(config.storageRoot, relDir);
    try { 
      fs.mkdirSync(targetDir, { recursive: true }); 
    } catch (mkErr: any) {
      console.error('ensure dir failed:', targetDir, mkErr?.message);
      throw mkErr;
    }
    const finalPath = path.join(config.storageRoot, rel);

    // 移动文件
    await new Promise<void>((resolve, reject) => {
      const rs = fs.createReadStream(file.path);
      const ws = fs.createWriteStream(finalPath, { flags: 'w' });
      rs.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', () => resolve());
      rs.pipe(ws);
    });
    fs.unlinkSync(file.path);

    // 不保存到File模型，直接返回下载地址
    const publicUrl = config.publicDownloadBase 
      ? `${config.publicDownloadBase.replace(/\/$/, '')}/${rel.replace(/\\/g, '/')}`
      : `/api/files/courseware-download?path=${encodeURIComponent(rel.replace(/\\/g, '/'))}`;

    return res.json({ 
      ok: true, 
      downloadUrl: publicUrl,
      filename: originalName,
      size: file.size,
      path: rel.replace(/\\/g, '/')
    });
  } catch (e: any) {
    console.error('courseware upload failed:', e);
    return res.status(500).json({ message: e?.message || 'upload failed' });
  }
});

// 下载三维课件修改后的模型文件
router.get('/courseware-download', authenticate as any, async (req, res) => {
  try {
    const { path: relPath } = req.query;
    if (!relPath || typeof relPath !== 'string') {
      return res.status(400).json({ message: 'Path parameter is required' });
    }

    // 安全检查：只允许访问modifiedModels目录下的文件
    if (!relPath.startsWith('modifiedModels/')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const fullPath = path.join(config.storageRoot, relPath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    const stat = fs.statSync(fullPath);
    const filename = path.basename(relPath);
    
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    const stream = fs.createReadStream(fullPath);
    stream.pipe(res);
  } catch (error) {
    console.error('Courseware download error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 删除三维课件修改后的模型文件
router.delete('/courseware-file', authenticate as any, async (req, res) => {
  try {
    const { path: relPath } = req.query;
    if (!relPath || typeof relPath !== 'string') {
      return res.status(400).json({ message: 'Path parameter is required' });
    }

    // 安全检查：只允许删除modifiedModels目录下的文件
    if (!relPath.startsWith('modifiedModels/')) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const fullPath = path.join(config.storageRoot, relPath);
    
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Courseware file delete error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 代理接口：解决公网URL的CORS问题
router.get('/proxy', authenticate as any, async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'URL parameter is required' });
    }
    
    // 只允许代理我们自己的公网域名
    if (!url.startsWith('https://dl.yf-xr.com/') && !url.startsWith('https://video.yf-xr.com/')) {
      return res.status(403).json({ message: 'Only whitelisted domains are allowed' });
    }
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return res.status(response.status).json({ message: `Failed to fetch: ${response.statusText}` });
    }
    
    // 转发所有相关的头部
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    // 添加CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    
    // 流式传输响应
    const stream = Readable.fromWeb(response.body as any);
    stream.pipe(res);
    
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router; 