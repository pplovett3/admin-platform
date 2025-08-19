import { Request, Response } from 'express';
import { ScoreModel } from '../models/Score';
import { UserModel } from '../models/User';
import { CourseModel, CourseModuleModel } from '../models/Course';
import mongoose from 'mongoose';

export async function upsertUserCourseScores(req: Request, res: Response) {
  const { courseId, moduleScores } = req.body as any;
  const { userId } = req.params as any;
  if (!courseId || !Array.isArray(moduleScores)) {
    return res.status(400).json({ message: 'courseId and moduleScores are required' });
  }
  if (moduleScores.length !== 1) {
    return res.status(400).json({ message: 'Only single-module submission is allowed' });
  }
  const one = moduleScores[0];
  if (!one?.moduleId || typeof one.score !== 'number') {
    return res.status(400).json({ message: 'moduleId and score are required' });
  }

  // Ensure user exists
  const user = await UserModel.findById(userId).lean();
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Normalize courseId: accept ObjectId string, code, or name; store as Course _id string
  let normalizedCourseId: string;
  if (mongoose.Types.ObjectId.isValid(courseId)) {
    const course = await CourseModel.findById(courseId).lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    normalizedCourseId = (course as any)._id.toString();
  } else {
    const course = await CourseModel.findOne({ $or: [{ code: courseId }, { name: courseId }] }).lean();
    if (!course) return res.status(404).json({ message: 'Course not found by code/name' });
    normalizedCourseId = (course as any)._id.toString();
  }

  // Validate module exists under course (optional but helpful)
  const courseModule = await CourseModuleModel.findOne({ courseId: new mongoose.Types.ObjectId(normalizedCourseId), moduleId: one.moduleId }).lean();
  if (!courseModule) {
    return res.status(404).json({ message: 'Module not found under this course' });
  }

  // Create a submission history entry (single module)
  try {
    const { ScoreSubmissionModel } = await import('../models/ScoreSubmission');
    await ScoreSubmissionModel.create({
      user: userId,
      courseId: normalizedCourseId,
      moduleScores: [{ ...one, maxScore: one.maxScore ?? (courseModule as any).maxScore ?? 100 }],
      submittedAt: new Date(),
    });
  } catch (e) {
    console.warn('[scores] failed to create submission history entry', (e as any)?.message);
  }

  // Update aggregated highest-per-module with attempts
  const doc = await ScoreModel.findOne({ user: userId, courseId: normalizedCourseId });
  const modules = (doc?.moduleScores || []).map((m: any) => ({ ...m }));
  const idx = modules.findIndex((m) => m.moduleId === one.moduleId);
  const newAttempts = (idx >= 0 ? (modules[idx].attempts || 0) : 0) + 1;
  if (idx >= 0) {
    const prev = modules[idx];
    const isHigher = (one.score ?? 0) >= (prev.score ?? -Infinity);
    modules[idx] = {
      moduleId: one.moduleId,
      score: isHigher ? one.score : prev.score,
      maxScore: one.maxScore ?? prev.maxScore ?? (courseModule as any).maxScore ?? 100,
      attempts: newAttempts,
      completedAt: isHigher ? (one.completedAt ? new Date(one.completedAt) : new Date()) : prev.completedAt,
      moreDetail: isHigher ? (one.moreDetail ?? prev.moreDetail) : prev.moreDetail,
    } as any;
  } else {
    modules.push({
      moduleId: one.moduleId,
      score: one.score,
      maxScore: one.maxScore ?? (courseModule as any).maxScore ?? 100,
      attempts: 1,
      completedAt: one.completedAt ? new Date(one.completedAt) : new Date(),
      moreDetail: one.moreDetail,
    } as any);
  }

  const updated = await ScoreModel.findOneAndUpdate(
    { user: userId, courseId: normalizedCourseId },
    { $set: { moduleScores: modules } },
    { upsert: true, new: true }
  );

  try {
    console.log(`[scores] upsert user=${userId} course=${normalizedCourseId} module=${one.moduleId} score=${one.score} attempts=${newAttempts}`);
  } catch {}

  res.json(updated);
}

export async function getUserCourseScores(req: Request, res: Response) {
  const { courseId } = req.query as any;
  const { userId } = req.params as any;
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });

  // Normalize courseId for query, similar to upsert
  let normalizedCourseId: string;
  if (mongoose.Types.ObjectId.isValid(courseId)) {
    normalizedCourseId = courseId;
  } else {
    const course = await CourseModel.findOne({ $or: [{ code: courseId }, { name: courseId }] }).lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    normalizedCourseId = (course as any)._id.toString();
  }

  const doc = await ScoreModel.findOne({ user: userId, courseId: normalizedCourseId }).lean();
  const modules = await CourseModuleModel.find({ courseId: new mongoose.Types.ObjectId(normalizedCourseId) }).lean();
  const scoreMap = new Map<string, any>((doc?.moduleScores || []).map((m: any) => [m.moduleId, m]));

  // Compute attempts from submissions to ensure accurate counts
  const { ScoreSubmissionModel } = await import('../models/ScoreSubmission');
  const attemptsAgg = await ScoreSubmissionModel.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), courseId: normalizedCourseId } },
    { $unwind: '$moduleScores' },
    { $group: { _id: '$moduleScores.moduleId', count: { $sum: 1 } } },
  ]);
  const attemptsMap = new Map<string, number>(attemptsAgg.map((a: any) => [a._id, a.count]));

  // Build full list for all course modules, filling placeholders when missing
  const moduleScores = modules.map((m: any) => {
    const s = scoreMap.get(m.moduleId);
    return {
      moduleId: m.moduleId,
      moduleName: m.name,
      score: s?.score ?? null,
      maxScore: s?.maxScore ?? m.maxScore ?? 100,
      attempts: attemptsMap.get(m.moduleId) ?? s?.attempts ?? 0,
      completedAt: s?.completedAt ?? null,
    };
  });

  res.json({ user: userId, courseId: normalizedCourseId, moduleScores });
}

export async function getClassCourseSummary(req: Request, res: Response) {
  const { className } = req.params as any;
  const { courseId, schoolId } = req.query as any;
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });

  // Normalize courseId for consistent querying
  let normalizedCourseId: string;
  if (mongoose.Types.ObjectId.isValid(courseId)) {
    normalizedCourseId = courseId;
  } else {
    const course = await CourseModel.findOne({ $or: [{ code: courseId }, { name: courseId }] }).lean();
    if (!course) return res.status(404).json({ message: 'Course not found' });
    normalizedCourseId = (course as any)._id.toString();
  }

  const studentQuery: any = { className, role: 'student' };
  if (schoolId && mongoose.Types.ObjectId.isValid(schoolId)) {
    studentQuery.schoolId = new mongoose.Types.ObjectId(schoolId);
  }
  const students = await UserModel.find(studentQuery).select('_id name studentId className school');
  const studentIds = students.map((s) => (s as any)._id);
  const scores = await ScoreModel.find({ user: { $in: studentIds }, courseId: normalizedCourseId }).lean();
  const scoresMap = new Map(scores.map((s: any) => [((s as any).user as any).toString(), s]));

  // Load course modules for names, max score, and ordering
  const modules = await CourseModuleModel.find({ courseId: new mongoose.Types.ObjectId(normalizedCourseId) }).lean();
  const moduleNameMap = new Map<string, string>(modules.map((m: any) => [m.moduleId, m.name]));
  const moduleMaxMap = new Map<string, number>(modules.map((m: any) => [m.moduleId, m.maxScore ?? 100]));
  const courseMaxTotal = modules.reduce((acc: number, m: any) => acc + (m.maxScore ?? 100), 0);

  // Attempts aggregated from submission history for accuracy
  const { ScoreSubmissionModel } = await import('../models/ScoreSubmission');
  const attemptsAgg = await ScoreSubmissionModel.aggregate([
    { $match: { user: { $in: studentIds }, courseId: normalizedCourseId } },
    { $unwind: '$moduleScores' },
    { $group: { _id: { user: '$user', moduleId: '$moduleScores.moduleId' }, count: { $sum: 1 } } },
  ]);
  const attemptsByUserModule = new Map<string, number>(
    attemptsAgg.map((a: any) => [`${(a._id.user as any).toString()}|${a._id.moduleId}`, a.count])
  );

  const result = students.map((s) => {
    const sid = ((s as any)._id as any).toString();
    const score: any = scoresMap.get(sid);
    const moduleScoresRaw = Array.isArray(score?.moduleScores) ? (score?.moduleScores as any[]) : [];

    // Aggregate by moduleId → highest score and latest completion time
    const byModule = new Map<string, { moduleId: string; score: number | null; maxScore: number; completedAt?: Date | null }>();
    for (const m of moduleScoresRaw) {
      const prev = byModule.get(m.moduleId);
      const candidateScore = typeof m.score === 'number' ? m.score : 0;
      const prevScore = typeof prev?.score === 'number' ? (prev.score as number) : -Infinity;
      const maxScore = moduleMaxMap.get(m.moduleId) ?? m.maxScore ?? 100;
      const takeNewer = !prev?.completedAt || (m.completedAt && new Date(m.completedAt).getTime() > new Date(prev.completedAt).getTime());
      if (!prev || candidateScore >= prevScore) {
        byModule.set(m.moduleId, {
          moduleId: m.moduleId,
          score: candidateScore,
          maxScore,
          completedAt: takeNewer ? (m.completedAt || prev?.completedAt || null) : prev.completedAt || null,
        });
      }
    }

    // Build list aligned to course modules order; include attempts from history
    const aggList = modules.map((m: any) => {
      const v = byModule.get(m.moduleId);
      const key = `${sid}|${m.moduleId}`;
      const attempts = attemptsByUserModule.get(key) ?? 0;
      return {
        moduleId: m.moduleId,
        moduleName: m.name,
        score: v?.score ?? null,
        maxScore: m.maxScore ?? 100,
        attempts,
        completedAt: v?.completedAt ?? null,
      };
    });

    const total = aggList.reduce((acc: number, m: any) => acc + (m.score || 0), 0);
    const maxTotal = courseMaxTotal;

    // derive last submitted time: prefer doc.updatedAt, fallback to max completedAt in modules
    let lastSubmittedAt: Date | undefined = (score as any)?.updatedAt as any;
    if (!lastSubmittedAt && aggList.length > 0) {
      const times = aggList
        .map((m: any) => (m.completedAt ? new Date(m.completedAt).getTime() : 0))
        .filter((t: number) => t > 0);
      if (times.length > 0) lastSubmittedAt = new Date(Math.max(...times));
    }

    return {
      userId: (s as any)._id,
      name: (s as any).name,
      studentId: (s as any).studentId,
      className: (s as any).className,
      school: (s as any).school,
      total,
      maxTotal,
      moduleScores: aggList,
      lastSubmittedAt,
    };
  });

  res.json(result);
} 