import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { PublishedCourseModel, IPublishConfig } from '../models/PublishedCourse';
import { AICourseModel } from '../models/AICourse';
import { CoursewareModel } from '../models/Courseware';
import { config } from '../config/env';
import { batchGenerateTTSForCourse } from '../utils/ai-services';
import * as crypto from 'crypto';
import * as path from 'path';

// 发布AI课程
export async function publishCourse(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const { publishConfig = {}, ttsConfig } = req.body;
    const user = (req as any).user;

    console.log('=== 发布请求参数 ===');
    console.log('courseId:', courseId);
    console.log('publishConfig:', JSON.stringify(publishConfig));
    console.log('ttsConfig:', JSON.stringify(ttsConfig));
    console.log('==================');

    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Valid courseId is required' });
    }

    // 获取AI课程数据
    const aiCourse = await AICourseModel.findById(courseId);
    if (!aiCourse) {
      return res.status(404).json({ message: 'AI Course not found' });
    }

    // 权限检查
    if (user.role !== 'superadmin' && aiCourse.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 获取关联的课件数据
    const courseware = await CoursewareModel.findById(aiCourse.coursewareId);
    if (!courseware) {
      return res.status(404).json({ message: 'Courseware not found' });
    }

    // 检查是否已有发布记录
    let existingPublish = await PublishedCourseModel.findOne({ originalCourseId: courseId });

    // 如果提供了TTS配置，批量生成并保存配音
    let courseDataWithAudio = aiCourse.toObject();
    let resourcePaths = {
      audio: [] as string[],
      images: [] as string[],
      thumbnail: undefined as string | undefined
    };

    // 调试：检查课程原始数据中的图片URL
    console.log('原始课程数据检查:');
    if (courseDataWithAudio.outline) {
      courseDataWithAudio.outline.forEach((segment: any, segIndex: number) => {
        if (segment.items) {
          segment.items.forEach((item: any, itemIndex: number) => {
            if (item.type === 'image.explain') {
              console.log(`段落${segIndex}-步骤${itemIndex} (${item.type}):`, {
                hasImageUrl: !!item.imageUrl,
                imageUrl: item.imageUrl,
                allKeys: Object.keys(item)
              });
            }
          });
        }
      });
    }

    console.log('检查TTS生成条件:', {
      hasTTSConfig: !!ttsConfig,
      hasOutline: !!aiCourse.outline,
      outlineLength: aiCourse.outline?.length || 0
    });

    if (ttsConfig && aiCourse.outline && aiCourse.outline.length > 0) {
      console.log('开始批量生成TTS配音...');
      try {
        const ttsResults = await batchGenerateTTSForCourse(
          aiCourse.outline,
          user.userId,
          ttsConfig
        );

        // 将TTS结果写入课程数据
        if (courseDataWithAudio.outline) {
          for (let segmentIndex = 0; segmentIndex < courseDataWithAudio.outline.length; segmentIndex++) {
            const segment = courseDataWithAudio.outline[segmentIndex];
          if (!segment.items) continue;

          for (let itemIndex = 0; itemIndex < segment.items.length; itemIndex++) {
            const itemKey = `${segmentIndex}-${itemIndex}`;
            if (ttsResults[itemKey]) {
              const item = segment.items[itemIndex];
              item.audioUrl = ttsResults[itemKey].audioUrl;
              item.audioDuration = ttsResults[itemKey].duration;
              item.audioFileId = ttsResults[itemKey].fileId;
              
              // 记录音频文件路径
              resourcePaths.audio.push(ttsResults[itemKey].audioUrl);
            }
          }
          }
        }
        console.log(`TTS生成完成，共生成 ${resourcePaths.audio.length} 个音频文件`);
      } catch (error) {
        console.error('批量TTS生成失败:', error);
        // TTS失败不阻止发布，只是记录错误
      }
    }

    const publishData = {
      originalCourseId: new Types.ObjectId(courseId),
      title: aiCourse.title,
      description: aiCourse.theme,
      status: 'active' as const,
      publishConfig: {
        isPublic: true,
        allowDownload: false,
        showAuthor: true,
        enableComments: false,
        autoPlay: true,
        ...publishConfig
      } as IPublishConfig,
      courseData: courseDataWithAudio,
      coursewareData: courseware.toObject(),
      resourcePaths,
      stats: {
        viewCount: 0,
        shareCount: 0
      },
      publishedBy: new Types.ObjectId(user.userId),
      publishedAt: new Date(),
      lastUpdated: new Date()
    };

    let publishedCourse;

    if (existingPublish) {
      // 更新现有发布
      Object.assign(existingPublish, publishData);
      publishedCourse = await existingPublish.save();
    } else {
      // 创建新发布
      publishedCourse = await PublishedCourseModel.create(publishData);
    }

    // 构建分享链接 - 指向前端服务端口
    const host = req.get('host') || '';
    const frontendHost = host.replace(`:${config.port}`, `:${config.frontendPort}`); // 将后端端口替换为前端端口
    const shareUrl = `${req.protocol}://${frontendHost}/course/${publishedCourse.id}`;

    res.json({
      success: true,
      publishId: publishedCourse.id,
      shareUrl,
      publishedAt: publishedCourse.publishedAt,
      status: publishedCourse.status
    });

  } catch (error) {
    console.error('Publish course error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取发布状态
export async function getPublishStatus(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const user = (req as any).user;

    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Valid courseId is required' });
    }

    // 权限检查
    const aiCourse = await AICourseModel.findById(courseId);
    if (!aiCourse) {
      return res.status(404).json({ message: 'AI Course not found' });
    }

    if (user.role !== 'superadmin' && aiCourse.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const publishedCourse = await PublishedCourseModel.findOne({ originalCourseId: courseId });

    if (!publishedCourse) {
      return res.json({
        isPublished: false,
        publishId: null,
        shareUrl: null,
        status: null
      });
    }

    const host = req.get('host') || '';
    const frontendHost = host.replace(`:${config.port}`, `:${config.frontendPort}`);
    const shareUrl = `${req.protocol}://${frontendHost}/course/${publishedCourse.id}`;

    res.json({
      isPublished: true,
      publishId: publishedCourse.id,
      shareUrl,
      status: publishedCourse.status,
      publishConfig: publishedCourse.publishConfig,
      stats: publishedCourse.stats,
      publishedAt: publishedCourse.publishedAt,
      lastUpdated: publishedCourse.lastUpdated
    });

  } catch (error) {
    console.error('Get publish status error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 更新发布配置
export async function updatePublishConfig(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const { publishConfig } = req.body;
    const user = (req as any).user;

    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Valid courseId is required' });
    }

    // 权限检查
    const aiCourse = await AICourseModel.findById(courseId);
    if (!aiCourse) {
      return res.status(404).json({ message: 'AI Course not found' });
    }

    if (user.role !== 'superadmin' && aiCourse.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const publishedCourse = await PublishedCourseModel.findOne({ originalCourseId: courseId });
    if (!publishedCourse) {
      return res.status(404).json({ message: 'Published course not found' });
    }

    // 更新配置
    publishedCourse.publishConfig = { ...publishedCourse.publishConfig, ...publishConfig };
    publishedCourse.lastUpdated = new Date();

    await publishedCourse.save();

    res.json({
      success: true,
      publishConfig: publishedCourse.publishConfig,
      lastUpdated: publishedCourse.lastUpdated
    });

  } catch (error) {
    console.error('Update publish config error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 停用发布
export async function unpublishCourse(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const user = (req as any).user;

    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Valid courseId is required' });
    }

    // 权限检查
    const aiCourse = await AICourseModel.findById(courseId);
    if (!aiCourse) {
      return res.status(404).json({ message: 'AI Course not found' });
    }

    if (user.role !== 'superadmin' && aiCourse.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const publishedCourse = await PublishedCourseModel.findOne({ originalCourseId: courseId });
    if (!publishedCourse) {
      return res.status(404).json({ message: 'Published course not found' });
    }

    // 停用发布
    publishedCourse.status = 'inactive';
    publishedCourse.lastUpdated = new Date();

    await publishedCourse.save();

    res.json({
      success: true,
      status: publishedCourse.status,
      lastUpdated: publishedCourse.lastUpdated
    });

  } catch (error) {
    console.error('Unpublish course error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 公开访问课程数据（无需认证）
export async function getPublicCourse(req: Request, res: Response) {
  try {
    const { publishId } = req.params;
    console.log('=== 公开课程访问 ===');
    console.log('publishId:', publishId);

    if (!publishId || !Types.ObjectId.isValid(publishId)) {
      console.error('Invalid publishId:', publishId);
      return res.status(400).json({ message: 'Valid publishId is required' });
    }

    const publishedCourse = await PublishedCourseModel.findById(publishId).lean();
    console.log('找到课程:', !!publishedCourse, '状态:', publishedCourse?.status);
    
    if (!publishedCourse || publishedCourse.status !== 'active') {
      console.error('Course not found or inactive');
      return res.status(404).json({ message: 'Published course not found or inactive' });
    }

    // 增加访问统计（使用单独的更新操作，返回更新后的文档）
    const updatedCourse = await PublishedCourseModel.findByIdAndUpdate(
      publishId,
      {
        $inc: { 'stats.viewCount': 1 },
        $set: { 'stats.lastViewedAt': new Date() }
      },
      { new: true } // 返回更新后的文档
    ).lean();

    // 处理课件数据中的文件路径，转换为公开访问URL
    // 使用 JSON.parse(JSON.stringify()) 确保深拷贝
    const processedCoursewareData = JSON.parse(JSON.stringify(publishedCourse.coursewareData));
    const processedCourseData = JSON.parse(JSON.stringify(publishedCourse.courseData));
    
    console.log('Raw courseware data:', {
      modelUrl: processedCoursewareData.modelUrl,
      modifiedModelUrl: processedCoursewareData.modifiedModelUrl
    });

    // 辅助函数：转换文件URL为公开访问URL
    const convertToPublicUrl = (url: string): string => {
      if (!url || url.startsWith('http')) return url;
      
      // 转换 /api/files/:id/download → /api/public/files/:id
      const fileIdMatch = url.match(/\/api\/files\/([a-f0-9]{24})\/download/);
      if (fileIdMatch) {
        return `/api/public/files/${fileIdMatch[1]}`;
      }
      
      // 转换 /api/files/courseware-download?path=xxx → /api/public/courseware-file?path=xxx
      const coursewareMatch = url.match(/\/api\/files\/courseware-download\?path=(.+)/);
      if (coursewareMatch) {
        return `/api/public/courseware-file?path=${coursewareMatch[1]}`;
      }
      
      return url;
    };

    // 处理模型URL - 优先使用修改后的模型
    if (processedCoursewareData.modifiedModelUrl) {
      processedCoursewareData.modelUrl = convertToPublicUrl(processedCoursewareData.modifiedModelUrl);
      console.log('Converted modified model URL:', processedCoursewareData.modelUrl);
    } else if (processedCoursewareData.modelUrl) {
      processedCoursewareData.modelUrl = convertToPublicUrl(processedCoursewareData.modelUrl);
      console.log('Converted model URL:', processedCoursewareData.modelUrl);
    }

    // 处理课程数据中的音频和图片URL
    if (processedCourseData.outline) {
      for (const segment of processedCourseData.outline) {
        if (segment.items) {
          for (const item of segment.items) {
            // 转换音频URL
            if (item.audioUrl) {
              item.audioUrl = convertToPublicUrl(item.audioUrl);
            }
            // 转换图片URL
            if (item.imageUrl) {
              item.imageUrl = convertToPublicUrl(item.imageUrl);
            }
          }
        }
      }
    }

    const responseData = {
      id: publishedCourse._id.toString(),
      title: publishedCourse.title,
      description: publishedCourse.description,
      publishConfig: publishedCourse.publishConfig,
      courseData: processedCourseData,
      coursewareData: processedCoursewareData,
      resourceBaseUrl: `${req.protocol}://${req.get('host')}/api/public`,
      stats: {
        viewCount: updatedCourse?.stats?.viewCount || 0 // 使用更新后的访问次数
      },
      publishedAt: publishedCourse.publishedAt,
      lastUpdated: publishedCourse.lastUpdated // 添加最后更新时间，用于缓存控制
    };

    // 设置响应头，禁止缓存以确保每次都获取最新内容
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json(responseData);

  } catch (error) {
    console.error('=== Get public course error ===');
    console.error('Error details:', error);
    console.error('Error stack:', (error as any)?.stack);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取访问统计（可选）
export async function getPublicCourseStats(req: Request, res: Response) {
  try {
    const { publishId } = req.params;

    if (!publishId || !Types.ObjectId.isValid(publishId)) {
      return res.status(400).json({ message: 'Valid publishId is required' });
    }

    const publishedCourse = await PublishedCourseModel.findById(publishId);
    if (!publishedCourse || publishedCourse.status !== 'active') {
      return res.status(404).json({ message: 'Published course not found or inactive' });
    }

    res.json({
      stats: publishedCourse.stats,
      publishedAt: publishedCourse.publishedAt
    });

  } catch (error) {
    console.error('Get public course stats error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取所有发布的课程列表（需要认证）
export async function listPublishedCourses(req: Request, res: Response) {
  try {
    const q = (req.query.q as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const user = (req as any).user;

    const filter: any = { status: 'active' }; // 只返回激活的发布课程
    
    // 搜索过滤
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ];
    }

    // 权限过滤：非超级管理员只能看到自己发布的课程
    if (user.role !== 'superadmin') {
      if (!user?.userId || !Types.ObjectId.isValid(user.userId)) {
        return res.status(401).json({ message: 'Invalid user' });
      }
      filter.publishedBy = new Types.ObjectId(user.userId);
    }

    const [items, total] = await Promise.all([
      PublishedCourseModel
        .find(filter)
        .populate('publishedBy', 'name')
        .select('_id title description publishConfig publishedAt lastUpdated stats') // 只返回基本信息，不包含完整课程数据
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      PublishedCourseModel.countDocuments(filter)
    ]);

    // 格式化返回数据，为Unity客户端提供清晰的结构
    const formattedItems = items.map((item: any) => ({
      publishId: item._id,
      title: item.title,
      description: item.description,
      publishedBy: item.publishedBy?.name || 'Unknown',
      publishedAt: item.publishedAt,
      lastUpdated: item.lastUpdated,
      isPublic: item.publishConfig?.isPublic || false,
      autoPlay: item.publishConfig?.autoPlay || false,
      viewCount: item.stats?.viewCount || 0
    }));

    res.json({
      items: formattedItems,
      pagination: { 
        page, 
        limit, 
        total, 
        pages: Math.ceil(total / limit) 
      }
    });

  } catch (error) {
    console.error('List published courses error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}
