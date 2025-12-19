import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { PublishedCourseModel } from '../models/PublishedCourse';
import { UserModel } from '../models/User';
import { CoursewareModel } from '../models/Courseware';
import { AICourseModel } from '../models/AICourse';

// 获取所有已发布且通过审核的公开课程（学生可见）
export async function getPortalCourses(req: Request, res: Response) {
  try {
    const q = (req.query.q as string) || '';
    const type = (req.query.type as string) || 'all'; // 'all' | 'courseware' | 'ai-course'
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const allItems: any[] = [];

    // 查询审核通过的三维课件
    if (type === 'all' || type === 'courseware') {
      const coursewareFilter: any = { reviewStatus: 'approved' };
      if (q) {
        coursewareFilter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ];
      }
      
      const coursewares = await CoursewareModel
        .find(coursewareFilter)
        .populate('createdBy', 'name')
        .select('_id name description thumbnail viewCount reviewedAt createdBy')
        .sort({ reviewedAt: -1 })
        .lean();
      
      coursewares.forEach((item: any) => {
        allItems.push({
          id: item._id.toString(),
          title: item.name,
          description: item.description || '',
          thumbnail: item.thumbnail,
          viewCount: item.viewCount || 0, // 从 Courseware 获取实际访问次数
          publishedAt: item.reviewedAt,
          type: 'courseware',
          createdBy: item.createdBy?.name || 'Unknown',
        });
      });
    }

    // 查询审核通过的AI课件（仅返回“已发布为公开链接”的，确保学生点击即跳转到发布链接）
    if (type === 'all' || type === 'ai-course') {
      const aiCourseFilter: any = { reviewStatus: 'approved' };
      if (q) {
        aiCourseFilter.$or = [
          { title: { $regex: q, $options: 'i' } },
          { theme: { $regex: q, $options: 'i' } }
        ];
      }
      
      const aiCourses = await AICourseModel
        .find(aiCourseFilter)
        .populate('createdBy', 'name')
        .select('_id title theme thumbnail reviewedAt createdBy coursewareId')
        .sort({ reviewedAt: -1 })
        .lean();

      // 一次性查询这些 AI 课件对应的 PublishedCourse（active），包含 stats.viewCount
      const aiIds = aiCourses.map((c: any) => c._id).filter(Boolean);
      const published = await PublishedCourseModel
        .find({ originalCourseId: { $in: aiIds }, status: 'active' })
        .select('_id originalCourseId publishedAt lastUpdated thumbnail resourcePaths.thumbnail stats.viewCount')
        .lean();

      const publishedMap = new Map<string, any>();
      published.forEach((p: any) => {
        if (p?.originalCourseId) publishedMap.set(String(p.originalCourseId), p);
      });

      // AI 课件封面兜底：如果 AICourse.thumbnail 为空，回退到关联 Courseware.thumbnail
      const missingThumbCoursewareIds = aiCourses
        .filter((c: any) => !c?.thumbnail && c?.coursewareId)
        .map((c: any) => c.coursewareId);
      const coursewareThumbs = missingThumbCoursewareIds.length
        ? await CoursewareModel
            .find({ _id: { $in: missingThumbCoursewareIds } })
            .select('_id thumbnail')
            .lean()
        : [];
      const cwThumbMap = new Map<string, string | undefined>(
        coursewareThumbs.map((c: any) => [String(c._id), c.thumbnail])
      );

      aiCourses.forEach((item: any) => {
        const pub = publishedMap.get(String(item._id));
        if (!pub) return; // 未发布的不展示给学生

        allItems.push({
          id: item._id.toString(),
          publishedId: pub._id.toString(),
          sharePath: `/course/${pub._id.toString()}`,
          title: item.title,
          description: item.theme || '',
          thumbnail: item.thumbnail || pub.thumbnail || pub?.resourcePaths?.thumbnail || cwThumbMap.get(String(item.coursewareId)),
          viewCount: pub?.stats?.viewCount || 0, // 从 PublishedCourse 获取实际访问次数
          publishedAt: pub.publishedAt || item.reviewedAt,
          type: 'ai-course',
          createdBy: item.createdBy?.name || 'Unknown',
        });
      });
    }

    // 注意：PublishedCourseModel 已废弃，现在统一使用审核流程
    // 只有审核通过的课件才会显示给学生

    // 按发布时间排序
    allItems.sort((a, b) => {
      const dateA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const dateB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return dateB - dateA;
    });

    // 分页
    const total = allItems.length;
    const paginatedItems = allItems.slice(skip, skip + limit);

    res.json({
      items: paginatedItems,
      pagination: { 
        page, 
        limit, 
        total, 
        pages: Math.ceil(total / limit) 
      }
    });

  } catch (error) {
    console.error('Get portal courses error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取学生的学习记录
export async function getMyStudy(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    
    if (!user?.userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // 获取用户的答题记录
    const userData = await UserModel.findById(user.userId).select('quizRecords').lean();
    const quizRecords = (userData as any)?.quizRecords || [];

    // 获取课程标题
    const courseIdSet = new Set<string>();
    quizRecords.forEach((r: any) => {
      if (r.courseId) courseIdSet.add(String(r.courseId));
    });
    const courseIds = Array.from(courseIdSet);
    const validCourseIds = courseIds.filter(id => Types.ObjectId.isValid(id));
    const objectIds = validCourseIds.map(id => new Types.ObjectId(id));
    // quizRecords.courseId 可能是 originalCourseId（旧逻辑）也可能是 publishId（新逻辑）
    const courses = await PublishedCourseModel
      .find({
        $or: [
          { originalCourseId: { $in: objectIds } },
          { _id: { $in: objectIds } }
        ]
      })
      .select('_id originalCourseId title')
      .lean();

    // 既支持用 originalCourseId 查，也支持用 publishId 查
    const courseMap = new Map<string, { title: string; publishId: string }>();
    courses.forEach((c: any) => {
      const publishId = c?._id?.toString?.() || '';
      const title = c?.title || '未知课程';
      if (c?.originalCourseId) courseMap.set(String(c.originalCourseId), { title, publishId });
      if (publishId) courseMap.set(String(publishId), { title, publishId });
    });

    // 格式化记录
    const records = quizRecords.map((record: any) => ({
      courseId: record.courseId,
      courseTitle: courseMap.get(String(record.courseId))?.title || '未知课程',
      sharePath: courseMap.get(String(record.courseId))?.publishId
        ? `/course/${courseMap.get(String(record.courseId))!.publishId}`
        : undefined,
      score: record.score,
      totalQuestions: record.totalQuestions,
      correctCount: record.correctCount,
      completedAt: record.completedAt,
    })).sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    // 计算统计数据
    const uniqueCourses = new Set(quizRecords.map((r: any) => r.courseId));
    const passedCourses = new Set(quizRecords.filter((r: any) => r.score >= 60).map((r: any) => r.courseId));
    const totalScore = quizRecords.reduce((sum: number, r: any) => sum + r.score, 0);

    const stats = {
      totalCourses: uniqueCourses.size,
      completedCourses: passedCourses.size,
      totalQuizzes: quizRecords.length,
      averageScore: quizRecords.length > 0 ? totalScore / quizRecords.length : 0,
    };

    res.json({ records, stats });

  } catch (error) {
    console.error('Get my study error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取三维课件详情（学生可访问，只返回审核通过的）
export async function getCoursewareDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    // 只有当 ?countView=true 时才增加访问计数（避免重复计数）
    const shouldCountView = req.query.countView === 'true';
    
    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid courseware id' });
    }

    let courseware;
    if (shouldCountView) {
      // 增加访问计数并获取课件数据
      courseware = await CoursewareModel
        .findOneAndUpdate(
          { _id: id, reviewStatus: 'approved' },
          { $inc: { viewCount: 1 } },
          { new: true }
        )
        .populate('createdBy', 'name')
        .select('_id name description thumbnail modelUrl modifiedModelUrl annotations hotspots animations settings modelStructure viewCount reviewedAt createdBy')
        .lean();
    } else {
      // 仅查询，不增加计数
      courseware = await CoursewareModel
        .findOne({ _id: id, reviewStatus: 'approved' })
        .populate('createdBy', 'name')
        .select('_id name description thumbnail modelUrl modifiedModelUrl annotations hotspots animations settings modelStructure viewCount reviewedAt createdBy')
        .lean();
    }

    if (!courseware) {
      return res.status(404).json({ message: 'Courseware not found or not approved' });
    }

    // 兼容字段：门户 viewer 使用 hotspots，Courseware 主 schema 是 annotations
    const annotations = (courseware as any).annotations || [];
    const hotspots = (courseware as any).hotspots || annotations.map((a: any) => ({
      id: a.id,
      name: a.title,
      description: a.description,
      position: a.position,
      nodeKey: a.nodeKey,
      labelOffset: a.labelOffset,
      labelOffsetSpace: a.labelOffsetSpace,
      label: a.label,
    }));

    res.json({
      ...(courseware as any),
      annotations,
      hotspots,
      modelStructure: (courseware as any).modelStructure,
      settings: (courseware as any).settings,
    });

  } catch (error) {
    console.error('Get courseware detail error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取AI课件详情（学生可访问，只返回审核通过的）
export async function getAICourseDetail(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid AI course id' });
    }

    const aiCourse = await AICourseModel
      .findOne({ _id: id, reviewStatus: 'approved' })
      .populate('createdBy', 'name')
      // 注意：AICourse 模型中实际存储的是 outline/questions/assets 等字段，而不是 courseData
      .select('_id title theme thumbnail outline questions assets reviewedAt createdBy')
      .lean();

    if (!aiCourse) {
      return res.status(404).json({ message: 'AI course not found or not approved' });
    }

    // 兼容前端：返回 courseData 结构（Portal Learn 页面依赖 courseData.outline）
    const normalized = {
      ...aiCourse,
      courseData: {
        outline: (aiCourse as any).outline || [],
        quizEnabled: Array.isArray((aiCourse as any).questions) && (aiCourse as any).questions.length > 0,
        quiz: (aiCourse as any).questions || [],
        assets: (aiCourse as any).assets || {},
      },
    };

    res.json(normalized);

  } catch (error) {
    console.error('Get AI course detail error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

