import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { CoursewareModel } from '../models/Courseware';
import { generateCourseWithDeepSeek, searchImagesWithMetaso } from '../utils/ai-services';

// 生成AI课程
export async function generateCourse(req: Request, res: Response) {
  try {
    const { coursewareId, theme, audience, durationTarget, language } = req.body || {};
    
    if (!coursewareId || !Types.ObjectId.isValid(coursewareId)) {
      return res.status(400).json({ message: 'Valid coursewareId is required' });
    }
    
    if (!theme?.trim()) {
      return res.status(400).json({ message: 'Theme is required' });
    }

    // 获取课件数据
    const courseware = await CoursewareModel.findById(coursewareId).lean();
    if (!courseware) {
      return res.status(404).json({ message: 'Courseware not found' });
    }

    // 权限检查
    const user = (req as any).user;
    if (user.role !== 'superadmin' && courseware.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 准备课件数据
    const coursewareData = {
      name: courseware.name,
      description: courseware.description || '',
      annotations: (courseware.annotations || []).map((ann: any) => ({
        id: ann.id,
        title: ann.title,
        description: ann.description,
        nodeKey: ann.nodeKey
      })),
      animations: (courseware.animations || []).map((anim: any) => ({
        id: anim.id,
        name: anim.name,
        description: anim.description,
        steps: (anim.steps || []).map((step: any) => ({
          name: step.name,
          description: step.description
        }))
      }))
    };

    // 调用 DeepSeek 生成课程
    const generatedCourse = await generateCourseWithDeepSeek({
      coursewareData,
      theme: theme.trim(),
      audience: audience?.trim() || '初学者',
      durationTarget: parseInt(durationTarget) || 10,
      language: language || 'zh-CN'
    });

    // 构造完整的课程数据
    const courseData = {
      version: '1.0',
      title: `${courseware.name} - AI讲解`,
      theme: theme.trim(),
      audience: audience?.trim() || '初学者',
      durationTarget: parseInt(durationTarget) || 10,
      language: language || 'zh-CN',
      voice: {
        provider: 'azure',
        voice: 'zh-CN-XiaoyiNeural',
        rate: 1.0,
        style: 'general'
      },
      coursewareId,
      coursewareVersion: courseware.version || 1,
      modelHash: '', // TODO: 计算模型哈希
      outline: generatedCourse.outline || [],
      assets: {
        images: [],
        audio: []
      }
    };

    res.json(courseData);
  } catch (error) {
    console.error('Generate course error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 搜索图片
export async function searchImages(req: Request, res: Response) {
  try {
    const { keywords, context } = req.body || {};
    
    if (!keywords?.trim()) {
      return res.status(400).json({ message: 'Keywords are required' });
    }

    // 调用秘塔搜索
    const images = await searchImagesWithMetaso(keywords.trim());

    res.json({
      keywords: keywords.trim(),
      context: context || '',
      images,
      total: images.length
    });
  } catch (error) {
    console.error('Search images error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// TTS 预览合成（占位实现）
export async function ttsPreview(req: Request, res: Response) {
  try {
    const { text, voice } = req.body || {};
    
    if (!text?.trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }

    // TODO: 实现真实的TTS合成
    // 目前返回占位数据
    const mockAudioUrl = `https://via.placeholder.com/1x1.mp3?text=${encodeURIComponent(text.slice(0, 50))}`;
    
    res.json({
      text: text.trim(),
      voice: voice || { provider: 'azure', voice: 'zh-CN-XiaoyiNeural' },
      audioUrl: mockAudioUrl,
      duration: Math.max(2, text.trim().length * 0.1), // 粗略估算时长
      isPreview: true
    });
  } catch (error) {
    console.error('TTS preview error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}
