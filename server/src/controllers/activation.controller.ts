import { Request, Response } from 'express';
import { ActivationCodeModel } from '../models/ActivationCode';
import { UserCourseActivationModel } from '../models/UserCourseActivation';
import { isValidActivationCodeFormat } from '../utils/activation-code';
import mongoose from 'mongoose';

// 激活课程
export async function activateCourse(req: Request, res: Response) {
  try {
    const { code, courseId } = req.body;
    const userId = (req as any).user?.userId;

    // 参数验证
    if (!code || !courseId) {
      return res.status(400).json({ message: '参数不完整：需要code和courseId' });
    }

    if (!isValidActivationCodeFormat(code)) {
      return res.status(400).json({ message: '激活码格式不正确' });
    }

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: '无效的课程ID' });
    }

    // 1. 查找激活码
    const activationCode = await ActivationCodeModel.findOne({ code }).populate('courseId', 'name');
    
    if (!activationCode) {
      return res.status(404).json({ message: '激活码不存在' });
    }

    // 2. 验证激活码状态
    if (activationCode.status !== 'active') {
      return res.status(400).json({ message: '激活码已被禁用' });
    }

    // 3. 验证激活码是否过期
    const now = new Date();
    if (now < activationCode.validFrom) {
      return res.status(400).json({ message: '激活码尚未生效' });
    }
    if (now > activationCode.validUntil) {
      return res.status(400).json({ message: '激活码已过期' });
    }

    // 4. 验证激活码是否用尽
    if (activationCode.usedCount >= activationCode.maxUses) {
      return res.status(400).json({ message: '激活码使用次数已达上限' });
    }

    // 5. 验证激活码对应的课程是否匹配
    if (activationCode.courseId._id.toString() !== courseId) {
      return res.status(400).json({ message: '该激活码不适用于此课程' });
    }

    // 6. 检查用户是否已激活过该课程
    const existingActivation = await UserCourseActivationModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId)
    });

    if (existingActivation) {
      if (existingActivation.status === 'active') {
        return res.status(400).json({ message: '您已激活过该课程' });
      } else if (existingActivation.status === 'revoked') {
        return res.status(400).json({ message: '您的课程访问权限已被撤销' });
      }
    }

    // 7. 创建激活记录
    const activation = await UserCourseActivationModel.create({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId),
      activationCode: code,
      activatedAt: new Date(),
      expiresAt: activationCode.validUntil,
      status: 'active'
    });

    // 8. 增加激活码使用次数
    activationCode.usedCount += 1;
    await activationCode.save();

    res.status(201).json({
      success: true,
      message: '激活成功',
      activation: {
        courseId: activation.courseId,
        courseName: (activationCode.courseId as any).name,
        activatedAt: activation.activatedAt,
        expiresAt: activation.expiresAt,
        status: activation.status
      }
    });
  } catch (error: any) {
    console.error('Activate course error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ message: '您已激活过该课程' });
    }
    res.status(500).json({ message: '激活失败' });
  }
}

// 我的激活列表
export async function getMyActivations(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.userId;

    const activations = await UserCourseActivationModel.find({
      userId: new mongoose.Types.ObjectId(userId)
    })
      .populate('courseId', 'name code description')
      .sort({ activatedAt: -1 })
      .lean();

    // 检查并更新过期状态
    const now = new Date();
    const updates: Promise<any>[] = [];
    
    const result = activations.map(activation => {
      if (activation.expiresAt && now > activation.expiresAt && activation.status === 'active') {
        activation.status = 'expired';
        updates.push(
          UserCourseActivationModel.updateOne(
            { _id: activation._id },
            { status: 'expired' }
          )
        );
      }
      
      return {
        courseId: (activation.courseId as any)._id,
        courseName: (activation.courseId as any).name,
        courseCode: (activation.courseId as any).code,
        courseDescription: (activation.courseId as any).description,
        activationCode: activation.activationCode,
        activatedAt: activation.activatedAt,
        expiresAt: activation.expiresAt,
        status: activation.status
      };
    });

    // 执行状态更新
    if (updates.length > 0) {
      await Promise.all(updates);
    }

    res.json({ activations: result });
  } catch (error) {
    console.error('Get my activations error:', error);
    res.status(500).json({ message: '获取激活记录失败' });
  }
}

// 验证课程访问权限（启动器使用）
export async function verifyCourseAccess(req: Request, res: Response) {
  try {
    const { courseId } = req.query;
    const userId = (req as any).user?.userId;

    if (!courseId) {
      return res.status(400).json({ allowed: false, message: '缺少courseId参数' });
    }

    if (!mongoose.Types.ObjectId.isValid(courseId as string)) {
      return res.status(400).json({ allowed: false, message: '无效的课程ID' });
    }

    const activation = await UserCourseActivationModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      courseId: new mongoose.Types.ObjectId(courseId as string)
    });

    if (!activation) {
      return res.json({
        allowed: false,
        reason: 'not_activated',
        message: '课程未激活'
      });
    }

    // 检查是否过期
    if (activation.expiresAt && new Date() > activation.expiresAt) {
      if (activation.status === 'active') {
        activation.status = 'expired';
        await activation.save();
      }
      return res.json({
        allowed: false,
        reason: 'expired',
        message: '激活已过期'
      });
    }

    // 检查状态
    if (activation.status !== 'active') {
      return res.json({
        allowed: false,
        reason: activation.status,
        message: activation.status === 'revoked' ? '访问权限已被撤销' : '激活已过期'
      });
    }

    // 更新最后验证时间（静默验证）
    activation.lastVerifiedAt = new Date();
    await activation.save();

    res.json({
      allowed: true,
      courseId: activation.courseId,
      expiresAt: activation.expiresAt,
      lastVerifiedAt: activation.lastVerifiedAt
    });
  } catch (error) {
    console.error('Verify course access error:', error);
    // 验证失败时返回allowed: false，但不返回500错误，让启动器可以容错处理
    res.json({
      allowed: false,
      reason: 'error',
      message: '验证失败，请稍后重试'
    });
  }
}

// 撤销用户激活（超管）
export async function revokeActivation(req: Request, res: Response) {
  try {
    const { userId, courseId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: '无效的用户ID或课程ID' });
    }

    const activation = await UserCourseActivationModel.findOneAndUpdate(
      {
        userId: new mongoose.Types.ObjectId(userId),
        courseId: new mongoose.Types.ObjectId(courseId)
      },
      { status: 'revoked' },
      { new: true }
    ).populate('userId', 'name').populate('courseId', 'name');

    if (!activation) {
      return res.status(404).json({ message: '激活记录不存在' });
    }

    res.json({
      success: true,
      message: '已撤销激活',
      activation: {
        userName: (activation.userId as any).name,
        courseName: (activation.courseId as any).name,
        status: activation.status
      }
    });
  } catch (error) {
    console.error('Revoke activation error:', error);
    res.status(500).json({ message: '撤销激活失败' });
  }
}

// 激活记录列表（超管/校管/教师查看）
export async function listActivations(req: Request, res: Response) {
  try {
    const { courseId, userId, status, q, page = '1', limit = '20' } = req.query;
    const userRole = (req as any).user?.role;
    const currentUserId = (req as any).user?.userId;

    const filter: any = {};
    
    // 权限过滤
    if (userRole === 'student') {
      // 学生只能看自己的
      filter.userId = new mongoose.Types.ObjectId(currentUserId);
    }

    if (courseId) filter.courseId = courseId;
    if (userId) filter.userId = userId;
    if (status) filter.status = status;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    let query = UserCourseActivationModel.find(filter)
      .populate('userId', 'name phone studentId school className')
      .populate('courseId', 'name code')
      .sort({ activatedAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // 如果有搜索条件，需要先populate再筛选
    const [items, total] = await Promise.all([
      query.lean(),
      UserCourseActivationModel.countDocuments(filter)
    ]);

    // 如果有搜索关键词，过滤结果
    let filteredItems = items;
    if (q) {
      const searchTerm = (q as string).toLowerCase();
      filteredItems = items.filter(item => {
        const user = item.userId as any;
        const course = item.courseId as any;
        return (
          user?.name?.toLowerCase().includes(searchTerm) ||
          user?.phone?.includes(searchTerm) ||
          user?.studentId?.includes(searchTerm) ||
          course?.name?.toLowerCase().includes(searchTerm) ||
          item.activationCode?.toLowerCase().includes(searchTerm)
        );
      });
    }

    res.json({
      items: filteredItems.map(item => ({
        _id: item._id,
        userId: (item.userId as any)._id,
        userName: (item.userId as any).name,
        userPhone: (item.userId as any).phone,
        studentId: (item.userId as any).studentId,
        school: (item.userId as any).school,
        className: (item.userId as any).className,
        courseId: (item.courseId as any)._id,
        courseName: (item.courseId as any).name,
        courseCode: (item.courseId as any).code,
        activationCode: item.activationCode,
        activatedAt: item.activatedAt,
        expiresAt: item.expiresAt,
        lastVerifiedAt: item.lastVerifiedAt,
        status: item.status
      })),
      pagination: {
        total: q ? filteredItems.length : total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil((q ? filteredItems.length : total) / limitNum)
      }
    });
  } catch (error) {
    console.error('List activations error:', error);
    res.status(500).json({ message: '获取激活记录失败' });
  }
}

