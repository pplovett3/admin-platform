import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { 
  publishCourse, 
  getPublishStatus, 
  updatePublishConfig, 
  unpublishCourse,
  getPublicCourse,
  getPublicCourseStats
} from '../controllers/publish.controller';

const router = Router();

// 需要认证的发布管理路由
router.use('/ai-courses/:courseId/publish', authenticate);

// 发布管理 API
router.post('/ai-courses/:courseId/publish', requireRole(['superadmin', 'schoolAdmin', 'teacher']), publishCourse);
router.get('/ai-courses/:courseId/publish', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getPublishStatus);
router.put('/ai-courses/:courseId/publish', requireRole(['superadmin', 'schoolAdmin', 'teacher']), updatePublishConfig);
router.delete('/ai-courses/:courseId/publish', requireRole(['superadmin', 'schoolAdmin', 'teacher']), unpublishCourse);

// 公开访问 API（无需认证）
router.get('/public/course/:publishId', getPublicCourse);
router.get('/public/course/:publishId/stats', getPublicCourseStats);

export default router;
