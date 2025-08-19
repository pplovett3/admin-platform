import { Request, Response } from 'express';
import { TimeLogModel } from '../models/TimeLog';
import { UserModel } from '../models/User';
import { CourseModel } from '../models/Course';
import mongoose from 'mongoose';

async function resolveCourseObjectId(input: string): Promise<mongoose.Types.ObjectId | null> {
  if (!input) return null;
  if (mongoose.Types.ObjectId.isValid(input)) return new mongoose.Types.ObjectId(input);
  const c = await CourseModel.findOne({ $or: [{ code: input }, { name: input }] }).lean();
  return c ? ((c as any)._id as mongoose.Types.ObjectId) : null;
}

export async function start(req: Request, res: Response) {
  const { courseId, startedAt } = req.body || {};
  const userId = (req as any).user?.userId;
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });
  const courseObjId = await resolveCourseObjectId(courseId);
  if (!courseObjId) return res.status(400).json({ message: 'invalid courseId' });
  const begin = startedAt ? new Date(startedAt) : new Date();
  res.json({ startedAt: begin.toISOString() });
}

export async function stop(req: Request, res: Response) {
  const { courseId, startedAt, endedAt } = req.body || {};
  const userId = (req as any).user?.userId;
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });
  const courseObjId = await resolveCourseObjectId(courseId);
  if (!courseObjId) return res.status(400).json({ message: 'invalid courseId' });
  const start = startedAt ? new Date(startedAt) : new Date(Date.now() - 1000);
  const end = endedAt ? new Date(endedAt) : new Date();
  const durationSec = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000));
  const doc = await TimeLogModel.create({ userId, courseId: courseObjId, startedAt: start, endedAt: end, durationSec });
  res.json(doc);
}

export async function heartbeat(req: Request, res: Response) {
  const { courseId } = req.body || {};
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });
  const courseObjId = await resolveCourseObjectId(courseId);
  if (!courseObjId) return res.status(400).json({ message: 'invalid courseId' });
  res.json({ ok: true, ts: new Date().toISOString() });
}

export async function getUserTime(req: Request, res: Response) {
  const userId = (req.params as any).userId;
  const { courseId } = req.query as any;
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });
  const courseObjId = await resolveCourseObjectId(courseId);
  if (!courseObjId) return res.status(400).json({ message: 'invalid courseId' });
  const items = await TimeLogModel.find({ userId, courseId: courseObjId }).sort({ startedAt: 1 });
  const totalDurationSec = items.reduce((acc, it) => acc + (it.durationSec || 0), 0);
  res.json({ userId, courseId, totalDurationSec, logs: items });
}

export async function getClassTimeSummary(req: Request, res: Response) {
  const { className } = req.params as any;
  const { courseId } = req.query as any;
  if (!courseId) return res.status(400).json({ message: 'courseId is required' });
  const courseObjId = await resolveCourseObjectId(courseId);
  if (!courseObjId) return res.status(400).json({ message: 'invalid courseId' });
  // find students in class
  const students = await UserModel.find({ className, role: 'student' }).select('_id name studentId');
  const studentIds = students.map((s) => (s as any)._id);
  if (studentIds.length === 0) return res.json([]);

  const agg = await TimeLogModel.aggregate([
    { $match: { userId: { $in: studentIds as any }, courseId: courseObjId } },
    { $group: { _id: '$userId', totalDurationSec: { $sum: '$durationSec' }, sessions: { $sum: 1 } } },
  ]);
  const map = new Map<string, any>(agg.map((a) => [a._id.toString(), a]));
  const rows = students.map((s: any) => {
    const r = map.get(s._id.toString());
    return {
      userId: s._id,
      name: s.name,
      studentId: s.studentId,
      totalDurationSec: r?.totalDurationSec || 0,
      sessions: r?.sessions || 0,
    };
  });
  const avg = rows.length > 0 ? Math.round(rows.reduce((acc, r) => acc + r.totalDurationSec, 0) / rows.length) : 0;
  res.json({ rows, classAverageDurationSec: avg });
}

export async function getMyLogs(req: Request, res: Response) {
  const uid = (req as any).user?.userId as string;
  const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) || '30', 10)));
  const limit = Math.max(1, Math.min(500, parseInt((req.query.limit as string) || '100', 10)));
  const since = new Date();
  since.setDate(since.getDate() - days);
  const rows = await TimeLogModel.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(uid), startedAt: { $gte: since } } },
    { $sort: { startedAt: -1 } },
    { $limit: limit },
    { $lookup: { from: 'courses', localField: 'courseId', foreignField: '_id', as: 'c' } },
    { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
    { $project: { _id: 1, courseId: 1, startedAt: 1, endedAt: 1, durationSec: 1, courseName: '$c.name', courseCode: '$c.code', courseType: '$c.type' } },
  ]);
  res.json(rows);
} 