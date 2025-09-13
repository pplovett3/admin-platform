import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { CoursewareModel } from '../models/Courseware';
import { generateCourseWithDeepSeek, searchImagesWithMetaso, generateTTSWithMinimax, queryTTSStatus } from '../utils/ai-services';

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

// TTS 预览合成 - 使用Minimax异步API
export async function ttsPreview(req: Request, res: Response) {
  try {
    const { text, voice_id, speed, vol, pitch, model } = req.body || {};
    
    if (!text?.trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }

    if (!voice_id) {
      return res.status(400).json({ message: 'voice_id is required' });
    }

    // 调用Minimax TTS异步API
    const result = await generateTTSWithMinimax({
      text: text.trim(),
      model: model || 'speech-01-turbo',
      voice_setting: {
        voice_id,
        speed: speed || 1.0,
        vol: vol || 1.0,
        pitch: pitch || 0
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 2
      }
    });

    if (result.base_resp?.status_code !== 0) {
      const errorMsg = result.base_resp?.status_msg || 'TTS generation failed';
      // 处理常见错误信息
      if (errorMsg.includes('insufficient balance')) {
        throw new Error('Minimax账户余额不足，请充值后重试');
      } else if (errorMsg.includes('rate limit')) {
        throw new Error('请求频率过高，请稍后重试');
      } else if (errorMsg.includes('authentication')) {
        throw new Error('API密钥验证失败，请检查配置');
      }
      throw new Error(`TTS生成失败: ${errorMsg}`);
    }
    
    res.json({
      text: text.trim(),
      voice_id,
      taskId: result.task_id,
      fileId: result.file_id,
      usageCharacters: result.usage_characters,
      isPreview: true,
      message: 'TTS任务已创建，请使用taskId查询生成状态'
    });
  } catch (error) {
    console.error('TTS preview error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 查询TTS任务状态
export async function queryTTS(req: Request, res: Response) {
  try {
    const { task_id } = req.query;
    
    if (!task_id) {
      return res.status(400).json({ message: 'task_id is required' });
    }

    const result = await queryTTSStatus(task_id as string);

    if (result.base_resp?.status_code !== 0) {
      const errorMsg = result.base_resp?.status_msg || 'Query TTS status failed';
      // 处理常见错误信息
      if (errorMsg.includes('insufficient balance')) {
        throw new Error('Minimax账户余额不足，请充值后重试');
      } else if (errorMsg.includes('rate limit')) {
        throw new Error('请求频率过高，请稍后重试');
      } else if (errorMsg.includes('authentication')) {
        throw new Error('API密钥验证失败，请检查配置');
      }
      throw new Error(`查询TTS状态失败: ${errorMsg}`);
    }
    
    res.json({
      taskId: result.task_id,
      status: result.status,
      fileId: result.file_id,
      // 如果任务完成，返回文件下载信息
      downloadUrl: result.status === 'Success' && result.file_id 
        ? `https://api.minimaxi.com/v1/files/${result.file_id}/content` 
        : null
    });
  } catch (error) {
    console.error('Query TTS error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}
