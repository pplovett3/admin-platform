import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  activateCourse,
  getMyActivations,
  verifyCourseAccess,
  revokeActivation,
  listActivations
} from '../controllers/activation.controller';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

// 激活课程（所有用户）
router.post('/activate', activateCourse);

// 我的激活列表（所有用户）
router.get('/my-activations', getMyActivations);

// 验证课程访问权限（所有用户，启动器使用）
router.get('/verify', verifyCourseAccess);

// 激活记录列表（超管/校管/教师）
router.get('/list', requireRole(['superadmin', 'schoolAdmin', 'teacher']), listActivations);

// 撤销激活（仅超管）
router.delete('/revoke/:userId/:courseId', requireRole(['superadmin']), revokeActivation);

export default router;

