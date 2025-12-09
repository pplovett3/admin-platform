import { Router } from 'express';
import { authenticate, optionalAuthenticate, requireRole } from '../middlewares/auth';
import { 
  submitQuizResult, 
  getQuizRecords, 
  getAllQuizRecords, 
  getCourseQuestions,
  getAdminCourseQuizRecords,
  getAdminAllQuizStats
} from '../controllers/quiz.controller';

const router = Router();

// 获取课程考题（可选认证，游客也能获取题目）
router.get('/questions/:courseId', optionalAuthenticate, getCourseQuestions);

// 以下接口需要登录
router.use(authenticate);

// 提交答题结果
router.post('/submit', submitQuizResult);

// 获取用户在某课程的答题记录
router.get('/records/:courseId', getQuizRecords);

// 获取用户所有答题记录
router.get('/records', getAllQuizRecords);

// 【管理员】获取所有课程的答题统计
router.get('/admin/stats', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getAdminAllQuizStats);

// 【管理员】获取某课程所有学生的答题成绩
router.get('/admin/course/:courseId', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getAdminCourseQuizRecords);

export default router;

