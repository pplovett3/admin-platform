import { Request, Response } from 'express';
import { ActivationCodeModel } from '../models/ActivationCode';
import { UserCourseActivationModel } from '../models/UserCourseActivation';
import { generateUniqueCodes, isValidActivationCodeFormat } from '../utils/activation-code';
import mongoose from 'mongoose';

// 生成激活码
export async function generateActivationCodes(req: Request, res: Response) {
  try {
    const { courseId, count, maxUses, validFrom, validUntil, description } = req.body;
    const userId = (req as any).user?.userId;

    // 参数验证
    if (!courseId || !count || !maxUses || !validUntil) {
      return res.status(400).json({ message: '参数不完整：需要courseId、count、maxUses、validUntil' });
    }

    if (count < 1 || count > 100) {
      return res.status(400).json({ message: '生成数量必须在1-100之间' });
    }

    if (maxUses < 1) {
      return res.status(400).json({ message: '最大使用次数必须大于0' });
    }

    // 验证courseId是否有效
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: '无效的课程ID' });
    }

    // 生成唯一的激活码
    const codes = generateUniqueCodes(count);
    
    // 检查是否与数据库中的激活码重复
    const existingCodes = await ActivationCodeModel.find({ code: { $in: codes } }).lean();
    if (existingCodes.length > 0) {
      // 如果有重复，重新生成
      const existingCodeStrings = existingCodes.map(c => c.code);
      const uniqueCodes = codes.filter(c => !existingCodeStrings.includes(c));
      const additionalCount = count - uniqueCodes.length;
      if (additionalCount > 0) {
        const moreCodes = generateUniqueCodes(additionalCount * 2); // 生成更多以防重复
        uniqueCodes.push(...moreCodes.filter(c => !existingCodeStrings.includes(c)).slice(0, additionalCount));
      }
    }

    // 批量创建激活码
    const activationCodes = codes.map(code => ({
      code,
      courseId: new mongoose.Types.ObjectId(courseId),
      maxUses,
      usedCount: 0,
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: new Date(validUntil),
      status: 'active' as const,
      description: description || '',
      createdBy: new mongoose.Types.ObjectId(userId)
    }));

    const result = await ActivationCodeModel.insertMany(activationCodes);

    res.status(201).json({
      success: true,
      count: result.length,
      codes: result
    });
  } catch (error) {
    console.error('Generate activation codes error:', error);
    res.status(500).json({ message: '生成激活码失败' });
  }
}

// 激活码列表
export async function listActivationCodes(req: Request, res: Response) {
  try {
    const { courseId, status, page = '1', limit = '20', q } = req.query;
    
    const filter: any = {};
    if (courseId) filter.courseId = courseId;
    if (status) filter.status = status;
    if (q) filter.code = new RegExp(q as string, 'i');

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      ActivationCodeModel.find(filter)
        .populate('courseId', 'name code')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ActivationCodeModel.countDocuments(filter)
    ]);

    res.json({
      items,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('List activation codes error:', error);
    res.status(500).json({ message: '获取激活码列表失败' });
  }
}

// 激活码详情
export async function getActivationCodeDetail(req: Request, res: Response) {
  try {
    const { code } = req.params;

    if (!isValidActivationCodeFormat(code)) {
      return res.status(400).json({ message: '无效的激活码格式' });
    }

    const activationCode = await ActivationCodeModel.findOne({ code })
      .populate('courseId', 'name code')
      .populate('createdBy', 'name')
      .lean();

    if (!activationCode) {
      return res.status(404).json({ message: '激活码不存在' });
    }

    // 获取使用该激活码的用户列表
    const activations = await UserCourseActivationModel.find({ activationCode: code })
      .populate('userId', 'name phone studentId')
      .sort({ activatedAt: -1 })
      .lean();

    res.json({
      ...activationCode,
      activations: activations.map(a => ({
        userId: (a.userId as any)._id,
        userName: (a.userId as any).name,
        userPhone: (a.userId as any).phone,
        studentId: (a.userId as any).studentId,
        activatedAt: a.activatedAt,
        status: a.status
      }))
    });
  } catch (error) {
    console.error('Get activation code detail error:', error);
    res.status(500).json({ message: '获取激活码详情失败' });
  }
}

// 更新激活码状态
export async function updateActivationCodeStatus(req: Request, res: Response) {
  try {
    const { code } = req.params;
    const { status } = req.body;

    if (!['active', 'disabled'].includes(status)) {
      return res.status(400).json({ message: '无效的状态值' });
    }

    const activationCode = await ActivationCodeModel.findOneAndUpdate(
      { code },
      { status },
      { new: true }
    ).populate('courseId', 'name code');

    if (!activationCode) {
      return res.status(404).json({ message: '激活码不存在' });
    }

    res.json({
      success: true,
      activationCode
    });
  } catch (error) {
    console.error('Update activation code status error:', error);
    res.status(500).json({ message: '更新激活码状态失败' });
  }
}

// 删除激活码
export async function deleteActivationCode(req: Request, res: Response) {
  try {
    const { code } = req.params;

    // 检查是否有用户使用了该激活码
    const usageCount = await UserCourseActivationModel.countDocuments({ activationCode: code });
    if (usageCount > 0) {
      return res.status(400).json({ message: '该激活码已被使用，无法删除。请使用禁用功能。' });
    }

    const result = await ActivationCodeModel.findOneAndDelete({ code });
    if (!result) {
      return res.status(404).json({ message: '激活码不存在' });
    }

    res.json({ success: true, message: '激活码已删除' });
  } catch (error) {
    console.error('Delete activation code error:', error);
    res.status(500).json({ message: '删除激活码失败' });
  }
}

