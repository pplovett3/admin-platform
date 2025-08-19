import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { getClassCourseSummary, getUserCourseScores, upsertUserCourseScores } from '../controllers/scores.controller';

const router = Router();
router.use(authenticate);
router.get('/user/:userId', requireRole(['superadmin', 'schoolAdmin', 'teacher', 'student']), getUserCourseScores);

function allowWriteScores(req: Request & { user?: any }, res: Response, next: NextFunction) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  const role = user.role;
  const targetUserId = (req.params as any).userId;
  if (role === 'superadmin' || role === 'schoolAdmin' || role === 'teacher') return next();
  if (role === 'student' && user.userId && user.userId.toString() === targetUserId) return next();
  return res.status(403).json({ message: 'Forbidden' });
}

// Single-module submission enforced in controller
router.put('/user/:userId', allowWriteScores, upsertUserCourseScores);

// List score submission history (anyone can view their own; admins/teachers can view any)
router.get('/user/:userId/submissions', async (req: Request & { user?: any }, res: Response) => {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ message: 'Unauthorized' });
  const role = user.role;
  const targetUserId = (req.params as any).userId;
  const allow = role === 'superadmin' || role === 'schoolAdmin' || role === 'teacher' || (role === 'student' && user.userId?.toString() === targetUserId);
  if (!allow) return res.status(403).json({ message: 'Forbidden' });

  const { courseId } = req.query as any;
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });

  const { ScoreSubmissionModel } = await import('../models/ScoreSubmission');
  const { CourseModel, CourseModuleModel } = await import('../models/Course');
  const mongoose = await import('mongoose');
  let normalizedCourseId: string;
  if (mongoose.default.Types.ObjectId.isValid(courseId)) {
    const c = await CourseModel.findById(courseId).lean();
    if (!c) return res.status(404).json({ message: 'Course not found' });
    normalizedCourseId = (c as any)._id.toString();
  } else {
    const c = await CourseModel.findOne({ $or: [{ code: courseId }, { name: courseId }] }).lean();
    if (!c) return res.status(404).json({ message: 'Course not found' });
    normalizedCourseId = (c as any)._id.toString();
  }

  const [docs, modules] = await Promise.all([
    ScoreSubmissionModel.find({ user: targetUserId, courseId: normalizedCourseId }).sort({ submittedAt: -1 }).lean(),
    CourseModuleModel.find({ courseId: new mongoose.default.Types.ObjectId(normalizedCourseId) }).lean(),
  ]);
  const moduleNameMap = new Map<string, string>(modules.map((m: any) => [m.moduleId, m.name]));

  const rows = (docs || []).map((d: any) => {
    const ms = Array.isArray(d.moduleScores) ? d.moduleScores : [];
    const enriched = ms.map((m: any) => ({ ...m, moduleName: moduleNameMap.get(m.moduleId) || m.moduleId }));
    return { ...d, moduleScores: enriched };
  });

  res.json({ rows });
});

router.get('/class/:className', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getClassCourseSummary);
export default router; 