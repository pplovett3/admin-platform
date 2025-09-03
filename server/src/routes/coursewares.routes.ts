import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  listCoursewares,
  getCourseware,
  createCourseware,
  updateCourseware,
  deleteCourseware,
  exportCourseware,
  importCourseware,
  getAvailableModels
} from '../controllers/coursewares.controller';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

// 课件 CRUD 操作
router.get('/', requireRole(['superadmin', 'schoolAdmin', 'teacher']), listCoursewares);
router.get('/:id', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getCourseware);
router.post('/', requireRole(['superadmin', 'schoolAdmin', 'teacher']), createCourseware);
router.put('/:id', requireRole(['superadmin', 'schoolAdmin', 'teacher']), updateCourseware);
router.delete('/:id', requireRole(['superadmin', 'schoolAdmin', 'teacher']), deleteCourseware);

// 导入导出功能
router.get('/:id/export', requireRole(['superadmin', 'schoolAdmin', 'teacher']), exportCourseware);
router.post('/import', requireRole(['superadmin', 'schoolAdmin', 'teacher']), importCourseware);

// 模型资源
router.get('/resources/models', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getAvailableModels);

export default router;
