import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { CoursewareModel, ReviewStatus } from '../models/Courseware';
import { AICourseModel } from '../models/AICourse';

// 获取待审核列表（三维课件 + AI课件）
export async function getPendingReviews(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const type = req.query.type as string; // 'courseware' | 'ai-course' | 'all'
    const status = req.query.status as string || 'pending'; // 'pending' | 'approved' | 'rejected' | 'all'
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    // 只有超管和校管可以审核
    if (!['superadmin', 'schoolAdmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const filter: any = {};
    if (status !== 'all') {
      filter.reviewStatus = status;
    } else {
      filter.reviewStatus = { $in: ['pending', 'approved', 'rejected'] };
    }

    // 校管只能审核本校的课件
    if (user.role === 'schoolAdmin' && user.schoolId) {
      // 需要通过创建者的学校来过滤
      // 这里简化处理，后续可以优化
    }

    let coursewares: any[] = [];
    let aiCourses: any[] = [];
    let coursewaresTotal = 0;
    let aiCoursesTotal = 0;

    if (!type || type === 'all' || type === 'courseware') {
      [coursewares, coursewaresTotal] = await Promise.all([
        CoursewareModel
          .find(filter)
          .populate('createdBy', 'name')
          .populate('reviewedBy', 'name')
          .select('name description thumbnail reviewStatus reviewComment submittedAt reviewedAt createdBy updatedAt')
          .sort({ submittedAt: -1 })
          .skip(type === 'courseware' ? skip : 0)
          .limit(type === 'courseware' ? limit : 10)
          .lean(),
        CoursewareModel.countDocuments(filter)
      ]);
    }

    if (!type || type === 'all' || type === 'ai-course') {
      [aiCourses, aiCoursesTotal] = await Promise.all([
        AICourseModel
          .find(filter)
          .populate('createdBy', 'name')
          .populate('reviewedBy', 'name')
          .select('title theme thumbnail reviewStatus reviewComment submittedAt reviewedAt createdBy updatedAt')
          .sort({ submittedAt: -1 })
          .skip(type === 'ai-course' ? skip : 0)
          .limit(type === 'ai-course' ? limit : 10)
          .lean(),
        AICourseModel.countDocuments(filter)
      ]);
    }

    // 格式化返回数据
    const formattedCoursewares = coursewares.map((item: any) => ({
      id: item._id.toString(),
      type: 'courseware',
      name: item.name,
      description: item.description,
      thumbnail: item.thumbnail,
      reviewStatus: item.reviewStatus,
      reviewComment: item.reviewComment,
      submittedAt: item.submittedAt,
      reviewedAt: item.reviewedAt,
      createdBy: item.createdBy?.name || 'Unknown',
      updatedAt: item.updatedAt,
    }));

    const formattedAICourses = aiCourses.map((item: any) => ({
      id: item._id.toString(),
      type: 'ai-course',
      name: item.title,
      description: item.theme,
      thumbnail: item.thumbnail,
      reviewStatus: item.reviewStatus,
      reviewComment: item.reviewComment,
      submittedAt: item.submittedAt,
      reviewedAt: item.reviewedAt,
      createdBy: item.createdBy?.name || 'Unknown',
      updatedAt: item.updatedAt,
    }));

    res.json({
      coursewares: {
        items: formattedCoursewares,
        total: coursewaresTotal,
      },
      aiCourses: {
        items: formattedAICourses,
        total: aiCoursesTotal,
      },
      pagination: {
        page,
        limit,
        total: coursewaresTotal + aiCoursesTotal,
      },
    });

  } catch (error) {
    console.error('Get pending reviews error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 提交审核申请（课件创建者调用）
export async function submitForReview(req: Request, res: Response) {
  try {
    const { type, id } = req.params; // type: 'courseware' | 'ai-course'
    const user = (req as any).user;

    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Valid id is required' });
    }

    let item: any;
    if (type === 'courseware') {
      item = await CoursewareModel.findById(id);
    } else if (type === 'ai-course') {
      item = await AICourseModel.findById(id);
    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // 检查权限：只有创建者或超管可以提交审核
    if (user.role !== 'superadmin' && item.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 检查当前状态
    if (item.reviewStatus === 'pending') {
      return res.status(400).json({ message: '已提交审核，请等待审核结果' });
    }

    // 更新审核状态
    item.reviewStatus = 'pending';
    item.submittedAt = new Date();
    item.reviewComment = undefined;
    item.reviewedBy = undefined;
    item.reviewedAt = undefined;
    await item.save();

    res.json({
      success: true,
      message: '已提交审核申请',
      reviewStatus: item.reviewStatus,
      submittedAt: item.submittedAt,
    });

  } catch (error) {
    console.error('Submit for review error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 审核课件（超管/校管调用）
export async function reviewItem(req: Request, res: Response) {
  try {
    const { type, id } = req.params; // type: 'courseware' | 'ai-course'
    const { action, comment } = req.body; // action: 'approve' | 'reject'
    const user = (req as any).user;

    // 权限检查
    if (!['superadmin', 'schoolAdmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Valid id is required' });
    }

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action, must be approve or reject' });
    }

    let item: any;
    if (type === 'courseware') {
      item = await CoursewareModel.findById(id);
    } else if (type === 'ai-course') {
      item = await AICourseModel.findById(id);
    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // 检查是否处于待审核状态
    if (item.reviewStatus !== 'pending') {
      return res.status(400).json({ message: '该项目不在待审核状态' });
    }

    // 更新审核状态
    item.reviewStatus = action === 'approve' ? 'approved' : 'rejected';
    item.reviewedBy = new Types.ObjectId(user.userId);
    item.reviewedAt = new Date();
    item.reviewComment = comment || (action === 'approve' ? '审核通过' : '审核未通过');
    await item.save();

    res.json({
      success: true,
      message: action === 'approve' ? '审核通过' : '审核已拒绝',
      reviewStatus: item.reviewStatus,
      reviewedAt: item.reviewedAt,
      reviewComment: item.reviewComment,
    });

  } catch (error) {
    console.error('Review item error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 下架课程（超管/校管调用，将已审核通过的课程设为草稿状态，再上架需重新提交审核）
export async function unpublishItem(req: Request, res: Response) {
  try {
    const { type, id } = req.params; // type: 'courseware' | 'ai-course'
    const { reason } = req.body; // 下架原因（可选）
    const user = (req as any).user;

    // 权限检查
    if (!['superadmin', 'schoolAdmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Valid id is required' });
    }

    let item: any;
    if (type === 'courseware') {
      item = await CoursewareModel.findById(id);
    } else if (type === 'ai-course') {
      item = await AICourseModel.findById(id);
    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    // 检查是否处于已通过状态
    if (item.reviewStatus !== 'approved') {
      return res.status(400).json({ message: '只能下架已审核通过的课程' });
    }

    // 更新审核状态为草稿，需要重新提交审核才能再次上架
    item.reviewStatus = 'draft';
    item.reviewComment = reason || '管理员下架';
    item.reviewedBy = new Types.ObjectId(user.userId);
    item.reviewedAt = new Date();
    item.submittedAt = undefined;
    await item.save();

    res.json({
      success: true,
      message: '课程已下架，如需重新上架请重新提交审核',
      reviewStatus: item.reviewStatus,
    });

  } catch (error) {
    console.error('Unpublish item error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取单个项目的审核状态
export async function getReviewStatus(req: Request, res: Response) {
  try {
    const { type, id } = req.params;
    const user = (req as any).user;

    if (!id || !Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Valid id is required' });
    }

    let item: any;
    if (type === 'courseware') {
      item = await CoursewareModel.findById(id)
        .populate('reviewedBy', 'name')
        .select('reviewStatus reviewComment submittedAt reviewedAt reviewedBy')
        .lean();
    } else if (type === 'ai-course') {
      item = await AICourseModel.findById(id)
        .populate('reviewedBy', 'name')
        .select('reviewStatus reviewComment submittedAt reviewedAt reviewedBy')
        .lean();
    } else {
      return res.status(400).json({ message: 'Invalid type' });
    }

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    res.json({
      reviewStatus: item.reviewStatus || 'draft',
      reviewComment: item.reviewComment,
      submittedAt: item.submittedAt,
      reviewedAt: item.reviewedAt,
      reviewedBy: (item.reviewedBy as any)?.name,
    });

  } catch (error) {
    console.error('Get review status error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

