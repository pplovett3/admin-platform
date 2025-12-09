import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { UserModel, IQuizRecord, IQuizAnswer } from '../models/User';
import { AICourseModel } from '../models/AICourse';

// 提交答题结果（需登录）
export async function submitQuizResult(req: Request, res: Response) {
  try {
    const { courseId, publishId, answers } = req.body || {};
    
    if (!courseId) {
      return res.status(400).json({ message: 'courseId is required' });
    }

    if (!Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json({ message: 'answers array is required' });
    }

    // 获取当前用户
    const user = (req as any).user;
    if (!user || !user.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // 获取AI课程数据以验证答案
    const aiCourse = await AICourseModel.findById(courseId).lean();
    if (!aiCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const questions = aiCourse.questions || [];
    if (questions.length === 0) {
      return res.status(400).json({ message: 'Course has no questions' });
    }

    // 计算得分
    const questionMap = new Map(questions.map((q: any) => [q.id, q]));
    let correctCount = 0;
    const processedAnswers: IQuizAnswer[] = [];

    for (const ans of answers) {
      const question = questionMap.get(ans.questionId);
      const isCorrect = question && question.answer === ans.userAnswer;
      if (isCorrect) correctCount++;
      
      processedAnswers.push({
        questionId: ans.questionId,
        userAnswer: ans.userAnswer,
        correct: !!isCorrect
      });
    }

    const totalQuestions = questions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);

    // 创建答题记录
    const quizRecord: IQuizRecord = {
      courseId,
      publishId,
      score,
      totalQuestions,
      correctCount,
      answers: processedAnswers,
      completedAt: new Date()
    };

    // 更新用户的答题记录
    await UserModel.findByIdAndUpdate(
      user.userId,
      { $push: { quizRecords: quizRecord } }
    );

    res.json({
      success: true,
      score,
      correctCount,
      totalQuestions,
      passRate: `${score}%`,
      details: processedAnswers.map(ans => {
        const question = questionMap.get(ans.questionId);
        return {
          questionId: ans.questionId,
          userAnswer: ans.userAnswer,
          correctAnswer: question?.answer,
          correct: ans.correct,
          explanation: question?.explanation
        };
      })
    });
  } catch (error) {
    console.error('Submit quiz result error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取用户在某课程的答题记录
export async function getQuizRecords(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    
    if (!courseId) {
      return res.status(400).json({ message: 'courseId is required' });
    }

    // 获取当前用户
    const user = (req as any).user;
    if (!user || !user.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // 获取用户数据
    const userData = await UserModel.findById(user.userId).lean();
    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 过滤该课程的答题记录
    const records = (userData.quizRecords || [])
      .filter((record: any) => record.courseId === courseId)
      .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    // 计算统计信息
    const stats = {
      totalAttempts: records.length,
      bestScore: records.length > 0 ? Math.max(...records.map((r: any) => r.score)) : 0,
      averageScore: records.length > 0 
        ? Math.round(records.reduce((sum: number, r: any) => sum + r.score, 0) / records.length) 
        : 0,
      lastAttempt: records[0]?.completedAt || null
    };

    res.json({
      courseId,
      records,
      stats
    });
  } catch (error) {
    console.error('Get quiz records error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取用户所有答题记录（带分页）
export async function getAllQuizRecords(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    // 获取当前用户
    const user = (req as any).user;
    if (!user || !user.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // 获取用户数据
    const userData = await UserModel.findById(user.userId).lean();
    if (!userData) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 获取所有答题记录并排序
    const allRecords = (userData.quizRecords || [])
      .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

    // 分页
    const total = allRecords.length;
    const startIndex = (page - 1) * limit;
    const records = allRecords.slice(startIndex, startIndex + limit);

    // 获取课程名称
    const courseIds = [...new Set(records.map((r: any) => r.courseId))];
    const courses = await AICourseModel.find(
      { _id: { $in: courseIds.filter(id => Types.ObjectId.isValid(id)).map(id => new Types.ObjectId(id)) } },
      { title: 1 }
    ).lean();
    const courseMap = new Map(courses.map((c: any) => [c._id.toString(), c.title]));

    // 添加课程名称到记录
    const recordsWithTitle = records.map((record: any) => ({
      ...record,
      courseTitle: courseMap.get(record.courseId) || '未知课程'
    }));

    res.json({
      records: recordsWithTitle,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get all quiz records error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 【管理员】获取某课程所有学生的答题成绩
export async function getAdminCourseQuizRecords(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Valid courseId is required' });
    }

    // 获取课程信息
    const course = await AICourseModel.findById(courseId, { title: 1 }).lean();
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // 聚合查询：从所有用户中提取该课程的答题记录
    const aggregateResult = await UserModel.aggregate([
      // 展开 quizRecords 数组
      { $unwind: { path: '$quizRecords', preserveNullAndEmptyArrays: false } },
      // 过滤该课程的记录
      { $match: { 'quizRecords.courseId': courseId } },
      // 按完成时间降序排序
      { $sort: { 'quizRecords.completedAt': -1 } },
      // 投影需要的字段
      {
        $project: {
          _id: 0,
          recordId: '$quizRecords._id',
          userId: '$_id',
          userName: '$name',
          userPhone: '$phone',
          score: '$quizRecords.score',
          totalQuestions: '$quizRecords.totalQuestions',
          correctCount: '$quizRecords.correctCount',
          completedAt: '$quizRecords.completedAt',
          answers: '$quizRecords.answers'
        }
      },
      // 分页
      {
        $facet: {
          records: [
            { $skip: (page - 1) * limit },
            { $limit: limit }
          ],
          totalCount: [
            { $count: 'count' }
          ]
        }
      }
    ]);

    const records = aggregateResult[0]?.records || [];
    const total = aggregateResult[0]?.totalCount[0]?.count || 0;

    // 计算统计信息
    const statsResult = await UserModel.aggregate([
      { $unwind: { path: '$quizRecords', preserveNullAndEmptyArrays: false } },
      { $match: { 'quizRecords.courseId': courseId } },
      {
        $group: {
          _id: null,
          totalAttempts: { $sum: 1 },
          avgScore: { $avg: '$quizRecords.score' },
          maxScore: { $max: '$quizRecords.score' },
          minScore: { $min: '$quizRecords.score' },
          passCount: {
            $sum: { $cond: [{ $gte: ['$quizRecords.score', 60] }, 1, 0] }
          },
          uniqueUsers: { $addToSet: '$_id' }
        }
      }
    ]);

    const stats = statsResult[0] || {
      totalAttempts: 0,
      avgScore: 0,
      maxScore: 0,
      minScore: 0,
      passCount: 0,
      uniqueUsers: []
    };

    res.json({
      courseId,
      courseTitle: course.title,
      records,
      stats: {
        totalAttempts: stats.totalAttempts,
        averageScore: Math.round(stats.avgScore || 0),
        highestScore: stats.maxScore || 0,
        lowestScore: stats.minScore || 0,
        passRate: stats.totalAttempts > 0 
          ? Math.round((stats.passCount / stats.totalAttempts) * 100) 
          : 0,
        uniqueStudents: stats.uniqueUsers?.length || 0
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get admin course quiz records error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 【管理员】获取所有课程的答题统计
export async function getAdminAllQuizStats(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const q = (req.query.q as string) || '';

    // 获取所有有考题的课程
    const courseFilter: any = { 
      'questions.0': { $exists: true } // 只查询有考题的课程
    };
    if (q) {
      courseFilter.title = { $regex: q, $options: 'i' };
    }

    const courses = await AICourseModel.find(courseFilter, { 
      title: 1, 
      questions: 1,
      createdAt: 1 
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await AICourseModel.countDocuments(courseFilter);

    // 获取每个课程的答题统计
    const courseIds = courses.map((c: any) => c._id.toString());
    
    const statsResult = await UserModel.aggregate([
      { $unwind: { path: '$quizRecords', preserveNullAndEmptyArrays: false } },
      { $match: { 'quizRecords.courseId': { $in: courseIds } } },
      {
        $group: {
          _id: '$quizRecords.courseId',
          attemptCount: { $sum: 1 },
          avgScore: { $avg: '$quizRecords.score' },
          passCount: {
            $sum: { $cond: [{ $gte: ['$quizRecords.score', 60] }, 1, 0] }
          },
          uniqueUsers: { $addToSet: '$_id' }
        }
      }
    ]);

    const statsMap = new Map(statsResult.map((s: any) => [s._id, s]));

    const items = courses.map((course: any) => {
      const stats = statsMap.get(course._id.toString()) || {
        attemptCount: 0,
        avgScore: 0,
        passCount: 0,
        uniqueUsers: []
      };
      
      return {
        courseId: course._id.toString(),
        courseTitle: course.title,
        questionCount: course.questions?.length || 0,
        attemptCount: stats.attemptCount,
        studentCount: stats.uniqueUsers?.length || 0,
        averageScore: Math.round(stats.avgScore || 0),
        passRate: stats.attemptCount > 0 
          ? Math.round((stats.passCount / stats.attemptCount) * 100) 
          : 0,
        createdAt: course.createdAt
      };
    });

    res.json({
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get admin all quiz stats error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

// 获取课程考题（公开API，用于答题界面）
export async function getCourseQuestions(req: Request, res: Response) {
  try {
    const { courseId } = req.params;
    
    if (!courseId || !Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: 'Valid courseId is required' });
    }

    // 获取AI课程数据
    const aiCourse = await AICourseModel.findById(courseId).lean();
    if (!aiCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const questions = aiCourse.questions || [];
    
    // 返回题目（不包含答案和解析，防止作弊）
    const sanitizedQuestions = questions.map((q: any) => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options,
      highlightNodeKey: q.highlightNodeKey // 互动题需要高亮信息
    }));

    res.json({
      courseId,
      courseTitle: aiCourse.title,
      questionCount: sanitizedQuestions.length,
      questions: sanitizedQuestions
    });
  } catch (error) {
    console.error('Get course questions error:', error);
    const message = (error as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

