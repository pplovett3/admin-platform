import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { generateCourse, searchImages, ttsPreview, queryTTS, getTTSProviders } from '../controllers/ai.controller';

const router = Router();

router.use(authenticate);

// AI 课程生成
router.post('/generate-course', requireRole(['superadmin', 'schoolAdmin', 'teacher']), generateCourse);

// 图片搜索
router.post('/search-images', requireRole(['superadmin', 'schoolAdmin', 'teacher']), searchImages);

// TTS 预览
router.post('/tts', requireRole(['superadmin', 'schoolAdmin', 'teacher']), ttsPreview);

// 查询TTS任务状态
router.get('/tts/status', requireRole(['superadmin', 'schoolAdmin', 'teacher']), queryTTS);

// 获取TTS供应商和音色列表
router.get('/tts/providers', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getTTSProviders);

export default router;
