import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { generateCourse, searchImages, ttsPreview, queryTTS, getTTSProviders, generateQuestions, updateQuestions, organizeModelStructure, identifySinglePart, generateAnnotationSummary } from '../controllers/ai.controller';

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

// AI 考题生成
router.post('/generate-questions', requireRole(['superadmin', 'schoolAdmin', 'teacher']), generateQuestions);

// 更新考题（手动编辑）
router.put('/questions', requireRole(['superadmin', 'schoolAdmin', 'teacher']), updateQuestions);

// AI智能整理模型结构（使用通义千问VL多模态模型）
router.post('/organize-structure', requireRole(['superadmin', 'schoolAdmin', 'teacher']), organizeModelStructure);

// AI识别单个部件（逐个请求，提高识别准确率）
router.post('/identify-part', requireRole(['superadmin', 'schoolAdmin', 'teacher']), identifySinglePart);

// AI生成标注简介
router.post('/generate-annotation-summary', requireRole(['superadmin', 'schoolAdmin', 'teacher']), generateAnnotationSummary);

export default router;
