import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { config } from '../config/env';
import { CoursewareModel } from '../models/Courseware';
import { AICourseModel } from '../models/AICourse';
import { generateCourseWithDeepSeek, searchImagesWithMetaso, generateTTSWithMinimax, queryTTSStatus, getFileDownloadUrl, generateTTSWithAzure, generateTTSWithDoubao, DOUBAO_TTS_VOICES, generateQuestionsWithDeepSeek, organizeModelStructureWithQwenVL, identifySinglePartWithQwenVL, generateAnnotationSummaryWithAI, ModelStructureNode, PartImageData, generateImageWithDoubao, generateImagePromptWithDoubao } from '../utils/ai-services';

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

    if (!provider || !['minimax', 'azure', 'doubao'].includes(provider)) {
      return res.status(400).json({ message: 'Valid provider (minimax/azure/doubao) is required' });
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
    } else if (provider === 'doubao') {
      const { speaker, speedRatio, speed, format } = providerParams;

      if (!speaker) {
        return res.status(400).json({ message: 'speaker is required for Doubao TTS' });
      }

      // 调用豆包语音合成-2.0（同步流式，返回音频Buffer）
      const result = await generateTTSWithDoubao({
        text: text.trim(),
        speaker,
        speedRatio: speedRatio ?? speed ?? 1.0,
        format: format || 'mp3'
      });

      if (!result.success) {
        throw new Error(result.error || '豆包TTS生成失败');
      }

      res.json({
        provider: 'doubao',
        text: text.trim(),
        speaker,
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

    // 仅保留豆包语音合成-2.0（按需求：只用豆包配音，停用 Azure / Minimax）
    providers.push({
      id: 'doubao',
      name: '豆包语音合成 2.0',
      description: '火山引擎豆包语音合成（Doubao-语音合成-2.0）',
      isAsync: false,
      voices: DOUBAO_TTS_VOICES.map(v => ({
        id: v.id,
        name: v.name,
        gender: v.gender,
        locale: v.locale,
        desc: v.desc
      })),
      supportedFeatures: ['speedRatio'],
      responseTime: '1-3秒',
      configured: !!(config.doubaoTtsAppId && config.doubaoTtsAccessKey)
    });

    res.json({
      providers,
      recommendation: {
        fastResponse: 'doubao',
        highQuality: 'doubao',
        default: 'doubao'
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

// AI智能整理模型结构
export async function organizeModelStructure(req: Request, res: Response) {
  try {
    const { structureData, globalImage, partImages } = req.body || {};
    
    // 验证结构数据
    if (!structureData || !structureData.tree || !Array.isArray(structureData.tree)) {
      return res.status(400).json({ message: '结构数据格式不正确，需要包含tree数组' });
    }

    // 验证全局截图
    if (!globalImage || typeof globalImage !== 'string') {
      return res.status(400).json({ message: '需要提供全局截图（base64格式）' });
    }

    // 验证部件截图（可选，但如果提供需要是数组）
    const validPartImages: PartImageData[] = [];
    if (partImages && Array.isArray(partImages)) {
      for (const part of partImages) {
        if (part.path && part.imageBase64) {
          validPartImages.push({
            path: part.path,
            imageBase64: part.imageBase64
          });
        }
      }
    }

    console.log(`[AI整理] 收到请求: ${structureData.tree.length} 个根节点, ${validPartImages.length} 张部件截图`);

    // 调用通义千问VL服务
    const result = await organizeModelStructureWithQwenVL({
      structureData: {
        tree: structureData.tree as ModelStructureNode[]
      },
      globalImageBase64: globalImage,
      partImages: validPartImages
    });

    console.log(`[AI整理] 完成: 返回 ${result.nodes.length} 个根节点`);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Organize model structure error:', error);
    const message = (error as any)?.message || '模型结构整理失败';
    res.status(500).json({ message });
  }
}

// AI识别单个部件
export async function identifySinglePart(req: Request, res: Response) {
  try {
    const { path, imageBase64, focusImageBase64, coursewareName } = req.body || {};
    
    // 验证必要参数
    if (!path || typeof path !== 'string') {
      return res.status(400).json({ message: '需要提供部件路径(path)' });
    }
    
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ message: '需要提供位置图(imageBase64)' });
    }

    console.log(`[AI识别] 单个部件: ${path}${coursewareName ? ` (课件: ${coursewareName})` : ''}`);

    // 调用AI识别服务
    const result = await identifySinglePartWithQwenVL({
      path,
      imageBase64,
      focusImageBase64,
      coursewareName
    });

    console.log(`[AI识别] 完成: ${path} -> ${result.new_name} (${result.confidence})`);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Identify single part error:', error);
    const message = (error as any)?.message || '部件识别失败';
    res.status(500).json({ message });
  }
}

// AI生成标注简介
export async function generateAnnotationSummary(req: Request, res: Response) {
  try {
    const { coursewareName, annotationTitle, imageBase64 } = req.body || {};
    
    // 验证必要参数
    if (!coursewareName || typeof coursewareName !== 'string') {
      return res.status(400).json({ message: '需要提供课件名称(coursewareName)' });
    }
    
    if (!annotationTitle || typeof annotationTitle !== 'string') {
      return res.status(400).json({ message: '需要提供标注标题(annotationTitle)' });
    }

    console.log(`[AI简介] 课件: ${coursewareName}, 标注: ${annotationTitle}`);

    // 调用AI生成简介服务
    const result = await generateAnnotationSummaryWithAI({
      coursewareName,
      annotationTitle,
      imageBase64
    });

    console.log(`[AI简介] 完成: ${result.summary.substring(0, 50)}...`);

    res.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Generate annotation summary error:', error);
    const message = (error as any)?.message || '生成简介失败';
    res.status(500).json({ message });
  }
}

// AI 生成图片（豆包 Seedream 文生图）
export const generateImage = async (req: Request, res: Response) => {
  try {
    const { coursewareName, segmentTitle, say, imageKeywords, prompt, size } = req.body;

    let finalPrompt = prompt;

    // 如果没有直接提供提示词，则用豆包 LLM 根据上下文生成提示词
    if (!finalPrompt || !finalPrompt.trim()) {
      if (!imageKeywords && !say) {
        return res.status(400).json({ message: '请提供 prompt 或 imageKeywords/say 上下文' });
      }
      console.log('[AI生图] 生成提示词...');
      const promptResult = await generateImagePromptWithDoubao({
        coursewareName,
        segmentTitle,
        say,
        imageKeywords
      });
      if (!promptResult.success || !promptResult.prompt) {
        return res.status(500).json({ message: promptResult.error || '提示词生成失败' });
      }
      finalPrompt = promptResult.prompt;
    }

    console.log(`[AI生图] 提示词: ${finalPrompt.substring(0, 100)}...`);
    console.log(`[AI生图] 尺寸: ${size || '2048x2048'}`);

    // 调用豆包 Seedream 生成图片
    const imageResult = await generateImageWithDoubao(finalPrompt, size || '2048x2048');
    if (!imageResult.success || !imageResult.url) {
      return res.status(500).json({ message: imageResult.error || '图片生成失败' });
    }

    console.log(`[AI生图] 成功: ${imageResult.url.substring(0, 80)}...`);

    res.json({
      success: true,
      result: {
        url: imageResult.url,
        prompt: finalPrompt,
        title: imageKeywords || segmentTitle || 'AI生成图片',
        source: 'AI生成 (豆包 Seedream)'
      }
    });
  } catch (error: any) {
    console.error('Generate image error:', error);
    res.status(500).json({ message: error?.message || '图片生成失败' });
  }
};
