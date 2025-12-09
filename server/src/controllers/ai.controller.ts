import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { CoursewareModel } from '../models/Courseware';
import { AICourseModel } from '../models/AICourse';
import { generateCourseWithDeepSeek, searchImagesWithMetaso, generateTTSWithMinimax, queryTTSStatus, getFileDownloadUrl, generateTTSWithAzure, getAzureVoices, generateQuestionsWithDeepSeek } from '../utils/ai-services';

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

// TTS 预览合成 - 支持多供应商
export async function ttsPreview(req: Request, res: Response) {
  try {
    const { text, provider, ...providerParams } = req.body || {};
    
    if (!text?.trim()) {
      return res.status(400).json({ message: 'Text is required' });
    }

    if (!provider || !['minimax', 'azure'].includes(provider)) {
      return res.status(400).json({ message: 'Valid provider (minimax/azure) is required' });
    }

    if (provider === 'minimax') {
      const { voice_id, speed, vol, pitch, model } = providerParams;
      
      if (!voice_id) {
        return res.status(400).json({ message: 'voice_id is required for Minimax' });
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
        provider: 'minimax',
        text: text.trim(),
        voice_id,
        taskId: result.task_id,
        fileId: result.file_id,
        usageCharacters: result.usage_characters,
        isAsync: true,
        message: 'TTS任务已创建，请使用taskId查询生成状态'
      });
    } else if (provider === 'azure') {
      const { voiceName, language, rate, pitch, style } = providerParams;
      
      if (!voiceName) {
        return res.status(400).json({ message: 'voiceName is required for Azure' });
      }

      // 调用Azure TTS同步API
      const result = await generateTTSWithAzure({
        text: text.trim(),
        voiceName,
        language: language || 'zh-CN',
        rate: rate || '+0%',
        pitch: pitch || '+0Hz',
        style: style || 'general'
      });

      if (!result.success) {
        throw new Error(result.error || 'Azure TTS生成失败');
      }
      
      res.json({
        provider: 'azure',
        text: text.trim(),
        voiceName,
        audioUrl: result.audioUrl,
        duration: result.duration,
        isAsync: false,
        message: 'TTS生成成功，可直接播放'
      });
    }
  } catch (error) {
    console.error('TTS preview error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 查询TTS任务状态（仅用于Minimax）
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
        ? await getFileDownloadUrl(result.file_id) 
        : null
    });
  } catch (error) {
    console.error('Query TTS error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取TTS供应商和音色列表
export async function getTTSProviders(req: Request, res: Response) {
  try {
    const providers = [];

    // Minimax 音色列表（基于之前提供的音色列表）
    const minimaxVoices = [
      { id: 'presenter_female', name: '女播音员', gender: 'female', locale: 'zh-CN' },
      { id: 'presenter_male', name: '男播音员', gender: 'male', locale: 'zh-CN' },
      { id: 'audiobook_male_1', name: '男有声书1', gender: 'male', locale: 'zh-CN' },
      { id: 'audiobook_male_2', name: '男有声书2', gender: 'male', locale: 'zh-CN' },
      { id: 'audiobook_female_1', name: '女有声书1', gender: 'female', locale: 'zh-CN' },
      { id: 'audiobook_female_2', name: '女有声书2', gender: 'female', locale: 'zh-CN' },
      { id: 'male-qn-jingying', name: '精英男声', gender: 'male', locale: 'zh-CN' },
      { id: 'female-shaonv', name: '少女音', gender: 'female', locale: 'zh-CN' },
      { id: 'female-yujie', name: '御姐音', gender: 'female', locale: 'zh-CN' },
      { id: 'male-qn-qingse', name: '青涩男声', gender: 'male', locale: 'zh-CN' },
      { id: 'male-qn-badao', name: '霸道男声', gender: 'male', locale: 'zh-CN' },
      { id: 'female-qn-daxuesheng', name: '大学生女声', gender: 'female', locale: 'zh-CN' }
    ];

    providers.push({
      id: 'minimax',
      name: 'Minimax TTS',
      description: '海螺AI语音合成服务',
      isAsync: true,
      voices: minimaxVoices,
      supportedFeatures: ['speed', 'volume', 'pitch'],
      responseTime: '1-2分钟'
    });

    // Azure 音色列表
    try {
      const azureVoices = await getAzureVoices();
      providers.push({
        id: 'azure',
        name: 'Azure TTS',
        description: '微软Azure语音合成服务',
        isAsync: false,
        voices: azureVoices.map(voice => ({
          id: voice.Name,
          name: voice.LocalName || voice.DisplayName,
          gender: voice.Gender,
          locale: voice.Locale,
          styles: voice.StyleList || []
        })),
        supportedFeatures: ['rate', 'pitch', 'style'],
        responseTime: '3-5秒'
      });
    } catch (error) {
      console.warn('Failed to get Azure voices, adding minimal provider info:', error);
      providers.push({
        id: 'azure',
        name: 'Azure TTS',
        description: '微软Azure语音合成服务（配置不完整）',
        isAsync: false,
        voices: [],
        supportedFeatures: ['rate', 'pitch', 'style'],
        responseTime: '3-5秒',
        error: 'API配置不完整'
      });
    }

    res.json({
      providers,
      recommendation: {
        fastResponse: 'azure',
        highQuality: 'minimax',
        default: 'azure'
      }
    });
  } catch (error) {
    console.error('Get TTS providers error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 生成AI考题
export async function generateQuestions(req: Request, res: Response) {
  try {
    const { courseId, questionCount = 10, theoryRatio = 0.6 } = req.body || {};
    
    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Valid courseId is required' });
    }

    // 获取AI课程数据
    const aiCourse = await AICourseModel.findById(courseId).lean();
    if (!aiCourse) {
      return res.status(404).json({ message: 'AI Course not found' });
    }

    // 权限检查
    const user = (req as any).user;
    if (user.role !== 'superadmin' && aiCourse.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 获取关联的课件数据
    const courseware = await CoursewareModel.findById(aiCourse.coursewareId).lean();
    if (!courseware) {
      return res.status(404).json({ message: 'Associated courseware not found' });
    }

    // 检查大纲是否存在
    if (!aiCourse.outline || aiCourse.outline.length === 0) {
      return res.status(400).json({ message: 'Course outline is required. Please generate outline first.' });
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

    // 调用 DeepSeek 生成考题
    const questions = await generateQuestionsWithDeepSeek({
      coursewareData,
      outline: aiCourse.outline,
      questionCount: Math.min(Math.max(parseInt(String(questionCount)), 1), 50), // 限制1-50题
      theoryRatio: Math.min(Math.max(parseFloat(String(theoryRatio)), 0), 1),    // 限制0-1
      language: aiCourse.language || 'zh-CN'
    });

    // 更新AI课程的考题
    await AICourseModel.findByIdAndUpdate(courseId, {
      questions,
      updatedBy: new Types.ObjectId(user.userId)
    });

    res.json({
      success: true,
      courseId,
      questionCount: questions.length,
      theoryCount: questions.filter(q => q.type === 'theory').length,
      interactiveCount: questions.filter(q => q.type === 'interactive').length,
      questions
    });
  } catch (error) {
    console.error('Generate questions error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 更新考题（手动编辑）
export async function updateQuestions(req: Request, res: Response) {
  try {
    const { courseId, questions } = req.body || {};
    
    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Valid courseId is required' });
    }

    if (!Array.isArray(questions)) {
      return res.status(400).json({ message: 'Questions array is required' });
    }

    // 获取AI课程数据
    const aiCourse = await AICourseModel.findById(courseId);
    if (!aiCourse) {
      return res.status(404).json({ message: 'AI Course not found' });
    }

    // 权限检查
    const user = (req as any).user;
    if (user.role !== 'superadmin' && aiCourse.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 更新考题
    aiCourse.questions = questions;
    aiCourse.updatedBy = new Types.ObjectId(user.userId);
    await aiCourse.save();

    res.json({
      success: true,
      courseId,
      questionCount: questions.length
    });
  } catch (error) {
    console.error('Update questions error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}
