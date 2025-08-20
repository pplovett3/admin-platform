import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate } from '../middlewares/auth';
import { config } from '../config/env';
import { FileModel, FileVisibility, FileKind } from '../models/File';
import mongoose from 'mongoose';
import os from 'os';

const router = Router();
const tempDir = path.join(os.tmpdir(), 'uploads');
try { fs.mkdirSync(tempDir, { recursive: true }); } catch {}
const upload = multer({ dest: tempDir });

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
    default:
      return 'other';
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

router.get('/mine', authenticate as any, async (req, res) => {
  const current = (req as any).user as { userId: string };
  const { type, q, page = '1', pageSize = '20' } = req.query as any;
  const filter: any = { ownerUserId: new mongoose.Types.ObjectId(current.userId), visibility: 'private' };
  if (type) filter.type = type;
  if (q) filter.originalName = { $regex: String(q), $options: 'i' };
  const p = Math.max(parseInt(String(page), 10) || 1, 1);
  const ps = Math.min(Math.max(parseInt(String(pageSize), 10) || 20, 1), 100);
  const [rows, total] = await Promise.all([
    FileModel.find(filter).sort({ createdAt: -1 }).skip((p - 1) * ps).limit(ps).lean(),
    FileModel.countDocuments(filter),
  ]);
  const mapped = rows.map((r: any) => ({
    id: r._id,
    type: r.type,
    originalName: r.originalName,
    size: r.size,
    createdAt: r.createdAt,
    downloadUrl: `/api/files/${r._id}/download`,
    visibility: r.visibility,
  }));
  res.json({ rows: mapped, total, page: p, pageSize: ps });
});

router.get('/public', authenticate as any, async (_req, res) => {
  const { type, q, page = '1', pageSize = '20' } = _req.query as any;
  const filter: any = { visibility: 'public' };
  if (type) filter.type = type;
  if (q) filter.originalName = { $regex: String(q), $options: 'i' };
  const p = Math.max(parseInt(String(page), 10) || 1, 1);
  const ps = Math.min(Math.max(parseInt(String(pageSize), 10) || 20, 1), 100);
  const [rows, total] = await Promise.all([
    FileModel.find(filter).sort({ createdAt: -1 }).skip((p - 1) * ps).limit(ps).lean(),
    FileModel.countDocuments(filter),
  ]);
  res.json({ rows: rows.map((r: any) => ({ id: r._id, type: r.type, originalName: r.originalName, size: r.size, createdAt: r.createdAt, downloadUrl: `/api/files/${r._id}/download` })), total, page: p, pageSize: ps });
});

router.get('/:id/download', authenticate as any, async (req, res) => {
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
});

router.post('/upload', authenticate as any, upload.single('file'), async (req, res) => {
  try {
    const current = (req as any).user as { userId: string; role: string };
    const file = (req as any).file as any;
    if (!file) return res.status(400).json({ message: 'file is required' });

    const originalName = file.originalname as string;
    const ext = path.extname(originalName).toLowerCase();
    const allowed = ['.mp4','.jpg','.jpeg','.png','.pdf','.ppt','.pptx','.doc','.docx'];
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
      ? path.posix.join('public', yyyy, mm, id, `original${ext}`)
      : path.posix.join('users', current.userId, yyyy, mm, id, `original${ext}`);

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
      originalName,
      ext,
      size: file.size,
      sha256,
      storageRelPath: rel.replace(/\\/g, '/'),
    } as any);

    const savedId = ((saved as any)._id || '').toString();
    const downloadUrl = `/api/files/${savedId}/download`;
    return res.json({ ok: true, file: saved, downloadUrl });
  } catch (e: any) {
    console.error('upload failed:', e);
    return res.status(500).json({ message: e?.message || 'upload failed' });
  }
});

export default router; 