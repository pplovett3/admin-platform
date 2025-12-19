import { Router } from 'express';
import { getPortalCourses, getMyStudy, getCoursewareDetail, getAICourseDetail } from '../controllers/portal.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 公开接口 - 获取所有已发布的课程（需要学生登录）
router.get('/courses', authenticate, getPortalCourses);

// 获取课件详情（学生可访问，只返回审核通过的）
router.get('/courseware/:id', authenticate, getCoursewareDetail);
router.get('/ai-course/:id', authenticate, getAICourseDetail);

// 获取学生学习记录
router.get('/my-study', authenticate, getMyStudy);

export default router;

