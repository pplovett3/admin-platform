import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { PublishedCourseModel, IPublishConfig } from '../models/PublishedCourse';
import { AICourseModel } from '../models/AICourse';
import { CoursewareModel } from '../models/Courseware';
import { config } from '../config/env';
import * as crypto from 'crypto';
import * as path from 'path';

// 发布AI课程
export async function publishCourse(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const { publishConfig = {} } = req.body;
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
      courseData: aiCourse.toObject(),
      coursewareData: courseware.toObject(),
      resourcePaths: {
        audio: [],
        images: [],
        thumbnail: undefined
      },
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

    // 构建资源URL
    const resourceBaseUrl = `${req.protocol}://${req.get('host')}/api/files`;

    const responseData = {
      id: publishedCourse.id,
      title: publishedCourse.title,
      description: publishedCourse.description,
      publishConfig: publishedCourse.publishConfig,
      courseData: publishedCourse.courseData,
      coursewareData: publishedCourse.coursewareData,
      resourceBaseUrl,
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
