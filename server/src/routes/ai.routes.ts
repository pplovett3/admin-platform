import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { generateCourse, searchImages, ttsPreview } from '../controllers/ai.controller';

const router = Router();

router.use(authenticate);

// AI 课程生成
router.post('/generate-course', requireRole(['superadmin', 'schoolAdmin', 'teacher']), generateCourse);

// 图片搜索
router.post('/search-images', requireRole(['superadmin', 'schoolAdmin', 'teacher']), searchImages);

// TTS 预览
router.post('/tts', requireRole(['superadmin', 'schoolAdmin', 'teacher']), ttsPreview);

export default router;
