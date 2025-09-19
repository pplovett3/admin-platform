import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { 
  publishCourse, 
  getPublishStatus, 
  updatePublishConfig, 
  unpublishCourse,
  getPublicCourse,
  getPublicCourseStats,
  listPublishedCourses
} from '../controllers/publish.controller';

const router = Router();

// 需要认证的发布管理路由
router.use('/ai-courses/:courseId/publish', authenticate);

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

export default router;
