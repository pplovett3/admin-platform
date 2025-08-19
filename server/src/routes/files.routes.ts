import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { authenticate } from '../middlewares/auth';
import { config } from '../config/env';

const router = Router();
const upload = multer({ dest: '/tmp/uploads' });

router.post('/upload', authenticate as any, upload.single('file'), async (req, res) => {
  try {
    const file = (req as any).file as any;
    if (!file) return res.status(400).json({ message: 'file is required' });

    const originalName = file.originalname as string;
    const ext = path.extname(originalName).toLowerCase();
    const allowed = ['.mp4','.jpg','.jpeg','.png','.pdf','.ppt','.pptx','.doc','.docx'];
    if (!allowed.includes(ext)) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ message: 'unsupported file type' });
    }

    // hash
    const sha256 = await new Promise<string>((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      fs.createReadStream(file.path)
        .on('data', (d) => hash.update(d))
        .on('end', () => resolve(hash.digest('hex')))
        .on('error', reject);
    });

    const targetDir = path.join(config.storageRoot, 'test-uploads');
    fs.mkdirSync(targetDir, { recursive: true });
    const finalName = `${Date.now()}-${sha256.slice(0,8)}${ext}`;
    const finalPath = path.join(targetDir, finalName);

    // Use copy + unlink to support cross-volume/WebDAV targets
    fs.copyFileSync(file.path, finalPath);
    fs.unlinkSync(file.path);

    return res.json({ ok: true, name: originalName, size: file.size, sha256, savedPath: finalPath });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || 'upload failed' });
  }
});

export default router; 