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
    const frontendHost = host.replace(':4000', ':3000'); // 将后端端口替换为前端端口
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
    const frontendHost = host.replace(':4000', ':3000');
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

    if (!publishId || !Types.ObjectId.isValid(publishId)) {
      return res.status(400).json({ message: 'Valid publishId is required' });
    }

    const publishedCourse = await PublishedCourseModel.findById(publishId);
    if (!publishedCourse || publishedCourse.status !== 'active') {
      return res.status(404).json({ message: 'Published course not found or inactive' });
    }

    // 增加访问统计
    publishedCourse.stats.viewCount += 1;
    publishedCourse.stats.lastViewedAt = new Date();
    await publishedCourse.save();

    // 处理课件数据中的文件路径，转换为公开访问URL
    const processedCoursewareData = { ...publishedCourse.coursewareData };
    const processedCourseData = { ...publishedCourse.courseData };

    // 如果配置了公开下载基地址，直接使用NAS的公开URL
    if (config.publicDownloadBase) {
      const publicBaseUrl = config.publicDownloadBase.replace(/\/$/, '');
      console.log('Using public download base:', publicBaseUrl);
      
      // 处理模型URL
      if (processedCoursewareData.modelUrl && !processedCoursewareData.modelUrl.startsWith('http')) {
        console.log('Original model URL:', processedCoursewareData.modelUrl);
        // 如果是文件ID，需要查找对应的文件路径
        const fileIdMatch = processedCoursewareData.modelUrl.match(/([a-f0-9]{24})/);
        if (fileIdMatch) {
          const fileId = fileIdMatch[1];
          try {
            const { FileModel } = await import('../models/File');
            const file = await FileModel.findById(fileId);
            if (file) {
              processedCoursewareData.modelUrl = `${publicBaseUrl}/${file.storageRelPath}`;
              console.log('Converted model URL:', processedCoursewareData.modelUrl);
            }
          } catch (error) {
            console.error('Error finding file for model URL:', error);
          }
        } else {
          processedCoursewareData.modelUrl = `${publicBaseUrl}/${processedCoursewareData.modelUrl}`;
        }
      }

      // 处理课程数据中的图片URL
      if (processedCourseData.outline) {
        for (const segment of processedCourseData.outline) {
          if (segment.items) {
            for (const item of segment.items) {
              if (item.imageUrl && !item.imageUrl.startsWith('http')) {
                const fileIdMatch = item.imageUrl.match(/([a-f0-9]{24})/);
                if (fileIdMatch) {
                  const fileId = fileIdMatch[1];
                  try {
                    const { FileModel } = await import('../models/File');
                    const file = await FileModel.findById(fileId);
                    if (file) {
                      item.imageUrl = `${publicBaseUrl}/${file.storageRelPath}`;
                    }
                  } catch (error) {
                    console.error('Error finding file for image URL:', error);
                  }
                }
              }
            }
          }
        }
      }
    }

    const responseData = {
      id: publishedCourse.id,
      title: publishedCourse.title,
      description: publishedCourse.description,
      publishConfig: publishedCourse.publishConfig,
      courseData: processedCourseData,
      coursewareData: processedCoursewareData,
      resourceBaseUrl: config.publicDownloadBase || `${req.protocol}://${req.get('host')}/api/public/files`,
      stats: {
        viewCount: publishedCourse.stats.viewCount
      },
      publishedAt: publishedCourse.publishedAt
    };

    res.json(responseData);

  } catch (error) {
    console.error('Get public course error:', error);
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
