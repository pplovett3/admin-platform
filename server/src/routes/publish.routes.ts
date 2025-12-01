import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { 
  publishCourse, 
  getPublishStatus, 
  updatePublishConfig, 
  unpublishCourse,
  getPublicCourse,
  getPublicCourseStats,
  listPublishedCourses,
  listPublishedCoursesForClient
} from '../controllers/publish.controller';

const router = Router();

// 需要认证的发布管理路由
router.use('/ai-courses/:courseId/publish', authenticate);

// Unity客户端专用接口（只返回基本信息）
router.get('/published-courses/client/list', authenticate, requireRole(['superadmin', 'schoolAdmin', 'teacher']), listPublishedCoursesForClient);

// 发布课程列表 API（需要认证）
router.get('/published-courses', authenticate, requireRole(['superadmin', 'schoolAdmin', 'teacher']), listPublishedCourses);

// 发布管理 API
router.post('/ai-courses/:courseId/publish', requireRole(['superadmin', 'schoolAdmin', 'teacher']), publishCourse);
router.get('/ai-courses/:courseId/publish', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getPublishStatus);
router.put('/ai-courses/:courseId/publish', requireRole(['superadmin', 'schoolAdmin', 'teacher']), updatePublishConfig);
router.delete('/ai-courses/:courseId/publish', requireRole(['superadmin', 'schoolAdmin', 'teacher']), unpublishCourse);

// 公开访问 API（无需认证）
router.get('/public/course/:publishId', getPublicCourse);
router.get('/public/course/:publishId/stats', getPublicCourseStats);

// 公开代理 API（无需认证）- 仅用于公开课程的资源加载
router.get('/public/proxy', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ message: 'URL parameter is required' });
    }
    
    // 只允许代理我们自己的NAS域名
    if (!url.startsWith('https://dl.yf-xr.com/') && !url.startsWith('https://video.yf-xr.com/')) {
      return res.status(403).json({ message: 'Only whitelisted domains are allowed' });
    }
    
    console.log('Public proxy request:', url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('Proxy fetch failed:', response.status, response.statusText);
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    // 流式传输响应（使用Node.js兼容的方式）
    if (response.body) {
      const { Readable } = await import('stream');
      const nodeStream = Readable.fromWeb(response.body as any);
      nodeStream.pipe(res);
    } else {
      res.status(500).json({ message: 'No response body' });
    }
    
  } catch (error) {
    console.error('Public proxy error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 公开文件下载 API（无需认证）- 用于公开课程的文件访问
router.get('/public/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const fs = await import('fs');
    const path = await import('path');
    const mongoose = await import('mongoose');
    const { config } = await import('../config/env');
    const { FileModel } = await import('../models/File');
    
    if (!mongoose.Types.ObjectId.isValid(fileId)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    const file = await FileModel.findById(fileId).lean();
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // 公开课程的文件无需检查 visibility，允许访问
    // （此路由专门用于已发布课程的资源访问）
    
    const filePath = path.join(config.storageRoot, file.storageRelPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File content not found' });
    }
    
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    
    // 支持范围请求（用于大文件和流媒体）
    if (range && /^bytes=/.test(range)) {
      const [startStr, endStr] = range.replace('bytes=', '').split('-');
      let start = parseInt(startStr, 10) || 0;
      let end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      if (start > end) start = 0;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', String(end - start + 1));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }
    
    // 普通请求
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(filePath).pipe(res);
    
  } catch (error) {
    console.error('Public file download error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 公开课件文件下载 API（无需认证）
router.get('/public/courseware-file', async (req, res) => {
  try {
    const { path: relPath } = req.query;
    const fs = await import('fs');
    const path = await import('path');
    const { config } = await import('../config/env');
    
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
    const range = req.headers.range;
    
    // 支持范围请求
    if (range && /^bytes=/.test(range)) {
      const [startStr, endStr] = range.replace('bytes=', '').split('-');
      let start = parseInt(startStr, 10) || 0;
      let end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      if (start > end) start = 0;
      
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Length', String(end - start + 1));
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      fs.createReadStream(fullPath, { start, end }).pipe(res);
      return;
    }
    
    // 普通请求
    res.setHeader('Content-Length', String(stat.size));
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    fs.createReadStream(fullPath).pipe(res);
    
  } catch (error) {
    console.error('Public courseware file download error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

export default router;
