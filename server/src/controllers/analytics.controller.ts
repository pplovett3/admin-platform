import { Request, Response } from 'express';
import { SchoolModel } from '../models/School';
import { CourseModel } from '../models/Course';
import { UserModel } from '../models/User';
import { TimeLogModel } from '../models/TimeLog';
import { ScoreModel } from '../models/Score';
import { SchoolCourseModel } from '../models/Enrollment';
import mongoose from 'mongoose';
import { ClassModel } from '../models/Class';

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

export async function overview(_req: Request, res: Response) {
  const [schoolCount, courses, studentCount, sessionCount, submissions] = await Promise.all([
    SchoolModel.countDocuments({ enabled: true }),
    CourseModel.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
    UserModel.countDocuments({ role: 'student' }),
    TimeLogModel.countDocuments({}),
    ScoreModel.aggregate([{ $unwind: '$moduleScores' }, { $count: 'count' }]),
  ]);
  const courseCountByType: Record<string, number> = {};
  for (const c of courses) courseCountByType[c._id as string] = c.count as number;
  res.json({
    schoolCount,
    courseCountByType,
    studentCount,
    totalSessions: sessionCount,
    totalScoreSubmissions: (submissions?.[0]?.count || 0) as number,
  });
}

export async function schoolsStats(_req: Request, res: Response) {
  const schools = await SchoolModel.find({ enabled: true }).lean();
  const schoolIds = schools.map((s) => (s as any)._id);

  const [authAgg, studentAgg, sessionAgg] = await Promise.all([
    SchoolCourseModel.aggregate([
      { $match: { schoolId: { $in: schoolIds } } },
      { $group: { _id: '$schoolId', authorizedCourseCount: { $sum: 1 } } },
    ]),
    UserModel.aggregate([
      { $match: { role: 'student', schoolId: { $in: schoolIds } } as any },
      { $group: { _id: '$schoolId', studentCount: { $sum: 1 } } },
    ] as any),
    // sessions: count timelog docs per school (join users)
    TimeLogModel.aggregate([
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $match: { 'u.schoolId': { $in: schoolIds } } },
      { $group: { _id: '$u.schoolId', sessions: { $sum: 1 } } },
    ]),
  ]);

  const by = (arr: any[]) => {
    const m = new Map<string, any>();
    arr.forEach((it) => m.set((it._id as mongoose.Types.ObjectId).toString(), it));
    return m;
  };
  const authMap = by(authAgg);
  const stuMap = by(studentAgg);
  const sesMap = by(sessionAgg);

  const rows = schools.map((s) => {
    const sid = ((s as any)._id as mongoose.Types.ObjectId).toString();
    return {
      schoolId: sid,
      name: (s as any).name,
      authorizedCourseCount: authMap.get(sid)?.authorizedCourseCount || 0,
      studentCount: stuMap.get(sid)?.studentCount || 0,
      sessions: sesMap.get(sid)?.sessions || 0,
    };
  });
  res.json(rows);
}

export async function courseDetail(req: Request, res: Response) {
  const id = req.params.id;
  const course = await CourseModel.findById(id).lean();
  if (!course) return res.status(404).json({ message: 'Course not found' });
  if ((course as any).type === 'modular') {
    const courseId = (course as any)._id.toString();
    const [participants, moduleAvg, classAgg] = await Promise.all([
      ScoreModel.countDocuments({ courseId }),
      ScoreModel.aggregate([
        { $match: { courseId } },
        { $unwind: '$moduleScores' },
        { $group: { _id: '$moduleScores.moduleId', avgScore: { $avg: '$moduleScores.score' }, submissions: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      ScoreModel.aggregate([
        { $match: { courseId } },
        { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
        { $unwind: '$u' },
        {
          $project: {
            className: '$u.className',
            total: {
              $reduce: { input: '$moduleScores', initialValue: 0, in: { $add: ['$$value', { $ifNull: ['$$this.score', 0] }] } },
            },
          },
        },
        { $group: { _id: '$className', avgTotal: { $avg: '$total' }, count: { $sum: 1 } } },
      ]),
    ]);
    return res.json({ course, participants, moduleAvg, classAgg });
  }
  // simple
  const courseId = (course as any)._id.toString();
  const [participants, sessions, classAgg] = await Promise.all([
    TimeLogModel.aggregate([{ $match: { courseId } }, { $group: { _id: '$userId' } }]).then((a) => a.length),
    TimeLogModel.countDocuments({ courseId }),
    TimeLogModel.aggregate([
      { $match: { courseId } },
      { $group: { _id: '$userId', dur: { $sum: '$durationSec' } } },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $group: { _id: '$u.className', total: { $sum: '$dur' }, avg: { $avg: '$dur' }, count: { $sum: 1 } } },
    ]),
  ]);
  res.json({ course, participants, totalSessions: sessions, classAgg });
}

export async function sessionsTrend(req: Request, res: Response) {
  const days = Math.max(1, Math.min(90, parseInt((req.query.days as string) || '14', 10)));
  const since = daysAgo(days - 1); // include today
  const items = await TimeLogModel.aggregate([
    { $match: { startedAt: { $gte: since } } },
    { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } } } },
    { $group: { _id: '$day', sessions: { $sum: 1 }, usersSet: { $addToSet: '$userId' } } },
    { $project: { _id: 0, day: '$_id', sessions: 1, activeUsers: { $size: '$usersSet' } } },
    { $sort: { day: 1 } },
  ]);
  res.json(items);
}

export async function activeStudents(req: Request, res: Response) {
  const days = Math.max(1, Math.min(365, parseInt((req.query.days as string) || '7', 10)));
  const since = daysAgo(days);
  const count = await TimeLogModel.aggregate([
    { $match: { startedAt: { $gte: since } } },
    { $group: { _id: '$userId' } },
    { $count: 'c' },
  ]).then((a) => (a?.[0]?.c || 0));
  res.json({ days, activeStudents: count });
}

export async function topCourses(req: Request, res: Response) {
  const metric = ((req.query.metric as string) || 'sessions').toLowerCase();
  const limit = Math.max(1, Math.min(20, parseInt((req.query.limit as string) || '10', 10)));
  if (metric === 'submissions') {
    const agg = await ScoreModel.aggregate([
      { $unwind: '$moduleScores' },
      { $group: { _id: '$courseId', submissions: { $sum: 1 } } },
      { $sort: { submissions: -1 } },
      { $limit: limit },
    ]);
    // Filter to valid ObjectIds for querying Course collection to avoid cast errors
    const validIds = agg.map((x) => x._id).filter((id) => mongoose.Types.ObjectId.isValid(id as any));
    const courses = await CourseModel.find({ _id: { $in: validIds as any } }).lean();
    const map = new Map(courses.map((c: any) => [((c._id as mongoose.Types.ObjectId).toString()), c]));
    return res.json(
      agg.map((x) => ({ course: map.get(((x._id as any) as string)), submissions: x.submissions }))
    );
  }
  // sessions
  const agg = await TimeLogModel.aggregate([
    { $group: { _id: '$courseId', sessions: { $sum: 1 } } },
    { $sort: { sessions: -1 } },
    { $limit: limit },
  ]);
  const ids = agg.map((x) => x._id);
  const courses = await CourseModel.find({ _id: { $in: ids as any } }).lean();
  const map = new Map(courses.map((c: any) => [((c._id as mongoose.Types.ObjectId).toString()), c]));
  res.json(agg.map((x) => ({ course: map.get(((x._id as any) as mongoose.Types.ObjectId).toString()), sessions: x.sessions })));
}

export async function topSchools(req: Request, res: Response) {
  const limit = Math.max(1, Math.min(20, parseInt((req.query.limit as string) || '10', 10)));
  const agg = await TimeLogModel.aggregate([
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $group: { _id: '$u.schoolId', sessions: { $sum: 1 } } },
    { $sort: { sessions: -1 } },
    { $limit: limit },
  ]);
  const ids = agg.map((x) => x._id);
  const schools = await SchoolModel.find({ _id: { $in: ids as any } }).lean();
  const map = new Map(schools.map((c) => [((c as any)._id as mongoose.Types.ObjectId).toString(), c]));
  res.json(agg.map((x) => ({ school: map.get(x._id as any), sessions: x.sessions })));
}

// ========== School Admin Analytics ==========
export async function schoolOverview(req: Request, res: Response) {
  const sid = (req as any).user?.schoolId as string;
  if (!sid) return res.status(400).json({ message: 'Missing schoolId' });
  const schoolObjId = new mongoose.Types.ObjectId(sid);
  const [authorizedCourseCount, teacherCount, studentCount, sessions, submissions] = await Promise.all([
    SchoolCourseModel.countDocuments({ schoolId: schoolObjId, enabled: true }),
    UserModel.countDocuments({ role: 'teacher', schoolId: schoolObjId } as any),
    UserModel.countDocuments({ role: 'student', schoolId: schoolObjId } as any),
    TimeLogModel.aggregate([
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $match: { 'u.schoolId': schoolObjId } },
      { $count: 'c' },
    ]).then(a => a?.[0]?.c || 0),
    ScoreModel.aggregate([
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $match: { 'u.schoolId': schoolObjId } },
      { $unwind: '$moduleScores' },
      { $count: 'c' },
    ]).then(a => a?.[0]?.c || 0),
  ]);
  res.json({ authorizedCourseCount, teacherCount, studentCount, totalSessions: sessions, totalScoreSubmissions: submissions });
}

export async function schoolSessionsTrend(req: Request, res: Response) {
  const sid = (req as any).user?.schoolId as string;
  if (!sid) return res.status(400).json({ message: 'Missing schoolId' });
  const days = Math.max(1, Math.min(90, parseInt((req.query.days as string) || '14', 10)));
  const since = daysAgo(days - 1);
  const schoolObjId = new mongoose.Types.ObjectId(sid);
  const items = await TimeLogModel.aggregate([
    { $match: { startedAt: { $gte: since } } },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $match: { 'u.schoolId': schoolObjId } },
    { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } } } },
    { $group: { _id: '$day', sessions: { $sum: 1 }, usersSet: { $addToSet: '$userId' } } },
    { $project: { _id: 0, day: '$_id', sessions: 1, activeUsers: { $size: '$usersSet' } } },
    { $sort: { day: 1 } },
  ]);
  res.json(items);
}

export async function schoolTopCourses(req: Request, res: Response) {
  const sid = (req as any).user?.schoolId as string;
  if (!sid) return res.status(400).json({ message: 'Missing schoolId' });
  const schoolObjId = new mongoose.Types.ObjectId(sid);
  const metric = ((req.query.metric as string) || 'sessions').toLowerCase();
  const limit = Math.max(1, Math.min(20, parseInt((req.query.limit as string) || '10', 10)));
  if (metric === 'submissions') {
    const agg = await ScoreModel.aggregate([
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $match: { 'u.schoolId': schoolObjId } },
      { $unwind: '$moduleScores' },
      { $group: { _id: '$courseId', submissions: { $sum: 1 } } },
      { $sort: { submissions: -1 } },
      { $limit: limit },
    ]);
    const ids = agg.map((x) => x._id);
    const courses = await CourseModel.find({ _id: { $in: ids as any } }).lean();
    const map = new Map(courses.map((c: any) => [((c._id as mongoose.Types.ObjectId).toString()), c]));
    return res.json(agg.map((x) => ({ course: map.get(((x._id as any) as mongoose.Types.ObjectId).toString()), submissions: x.submissions })));
  }
  const agg = await TimeLogModel.aggregate([
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $match: { 'u.schoolId': schoolObjId } },
    { $group: { _id: '$courseId', sessions: { $sum: 1 } } },
    { $sort: { sessions: -1 } },
    { $limit: limit },
  ]);
  const ids = agg.map((x) => x._id);
  const courses = await CourseModel.find({ _id: { $in: ids as any } }).lean();
  const map = new Map(courses.map((c: any) => [((c._id as mongoose.Types.ObjectId).toString()), c]));
  res.json(agg.map((x) => ({ course: map.get(((x._id as any) as mongoose.Types.ObjectId).toString()), sessions: x.sessions })));
}

// ========== Teacher Analytics ==========
export async function teacherOverview(req: Request, res: Response) {
  const teacherId = (req as any).user?.userId as string;
  const sid = (req as any).user?.schoolId as string;
  if (!teacherId || !sid) return res.status(400).json({ message: 'Missing teacherId/schoolId' });
  const teacherObjId = new mongoose.Types.ObjectId(teacherId);
  const schoolObjId = new mongoose.Types.ObjectId(sid);
  const classes = await ClassModel.find({ headTeacher: teacherObjId }).lean();
  const classNames = classes.map((c: any) => c.name).filter(Boolean);
  const [students, sessions, submissions, authorizedCourseCount] = await Promise.all([
    UserModel.countDocuments({ role: 'student', schoolId: schoolObjId, className: { $in: classNames } } as any),
    TimeLogModel.aggregate([
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $match: { 'u.schoolId': schoolObjId, 'u.className': { $in: classNames } } },
      { $count: 'c' },
    ]).then(a => a?.[0]?.c || 0),
    ScoreModel.aggregate([
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $match: { 'u.schoolId': schoolObjId, 'u.className': { $in: classNames } } },
      { $unwind: '$moduleScores' },
      { $count: 'c' },
    ]).then(a => a?.[0]?.c || 0),
    SchoolCourseModel.countDocuments({ schoolId: schoolObjId, enabled: true }),
  ]);
  res.json({ classesCount: classNames.length, students, totalSessions: sessions, totalScoreSubmissions: submissions, authorizedCourseCount });
}

export async function teacherSessionsTrend(req: Request, res: Response) {
  const teacherId = (req as any).user?.userId as string;
  const sid = (req as any).user?.schoolId as string;
  if (!teacherId || !sid) return res.status(400).json({ message: 'Missing teacherId/schoolId' });
  const classes = await ClassModel.find({ headTeacher: new mongoose.Types.ObjectId(teacherId) }).lean();
  const classNames = classes.map((c: any) => c.name).filter(Boolean);
  const days = Math.max(1, Math.min(90, parseInt((req.query.days as string) || '14', 10)));
  const since = daysAgo(days - 1);
  const schoolObjId = new mongoose.Types.ObjectId(sid);
  const items = await TimeLogModel.aggregate([
    { $match: { startedAt: { $gte: since } } },
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $match: { 'u.schoolId': schoolObjId, 'u.className': { $in: classNames } } },
    { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } } } },
    { $group: { _id: '$day', sessions: { $sum: 1 }, usersSet: { $addToSet: '$userId' } } },
    { $project: { _id: 0, day: '$_id', sessions: 1, activeUsers: { $size: '$usersSet' } } },
    { $sort: { day: 1 } },
  ]);
  res.json(items);
}

export async function teacherTopCourses(req: Request, res: Response) {
  const teacherId = (req as any).user?.userId as string;
  const sid = (req as any).user?.schoolId as string;
  if (!teacherId || !sid) return res.status(400).json({ message: 'Missing teacherId/schoolId' });
  const classes = await ClassModel.find({ headTeacher: new mongoose.Types.ObjectId(teacherId) }).lean();
  const classNames = classes.map((c: any) => c.name).filter(Boolean);
  const schoolObjId = new mongoose.Types.ObjectId(sid);
  const metric = ((req.query.metric as string) || 'sessions').toLowerCase();
  const limit = Math.max(1, Math.min(20, parseInt((req.query.limit as string) || '10', 10)));
  if (metric === 'submissions') {
    const agg = await ScoreModel.aggregate([
      { $lookup: { from: 'users', localField: 'user', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $match: { 'u.schoolId': schoolObjId, 'u.className': { $in: classNames } } },
      { $unwind: '$moduleScores' },
      { $group: { _id: '$courseId', submissions: { $sum: 1 } } },
      { $sort: { submissions: -1 } },
      { $limit: limit },
    ]);
    const ids = agg.map((x) => x._id);
    const courses = await CourseModel.find({ _id: { $in: ids as any } }).lean();
    const map = new Map(courses.map((c: any) => [((c._id as mongoose.Types.ObjectId).toString()), c]));
    return res.json(agg.map((x) => ({ course: map.get(((x._id as any) as mongoose.Types.ObjectId).toString()), submissions: x.submissions })));
  }
  const agg = await TimeLogModel.aggregate([
    { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'u' } },
    { $unwind: '$u' },
    { $match: { 'u.schoolId': schoolObjId, 'u.className': { $in: classNames } } },
    { $group: { _id: '$courseId', sessions: { $sum: 1 } } },
    { $sort: { sessions: -1 } },
    { $limit: limit },
  ]);
  const ids = agg.map((x) => x._id);
  const courses = await CourseModel.find({ _id: { $in: ids as any } }).lean();
  const map = new Map(courses.map((c: any) => [((c._id as mongoose.Types.ObjectId).toString()), c]));
  res.json(agg.map((x) => ({ course: map.get(((x._id as any) as mongoose.Types.ObjectId).toString()), sessions: x.sessions })));
}

// ========== Student Analytics ==========
export async function studentOverview(req: Request, res: Response) {
  const userId = (req as any).user?.userId as string;
  const sid = (req as any).user?.schoolId as string;
  if (!userId || !sid) return res.status(400).json({ message: 'Missing userId/schoolId' });
  const [authorizedCourseCount, mySessions, mySubmissions, participatedCourses] = await Promise.all([
    SchoolCourseModel.countDocuments({ schoolId: new mongoose.Types.ObjectId(sid), enabled: true }),
    TimeLogModel.countDocuments({ userId: new mongoose.Types.ObjectId(userId) } as any),
    ScoreModel.countDocuments({ user: new mongoose.Types.ObjectId(userId) } as any),
    TimeLogModel.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$courseId' } },
      { $count: 'c' },
    ]).then(a => a?.[0]?.c || 0),
  ]);
  res.json({ authorizedCourseCount, mySessions, mySubmissions, participatedCourses });
}

export async function studentSessionsTrend(req: Request, res: Response) {
  const userId = (req as any).user?.userId as string;
  if (!userId) return res.status(400).json({ message: 'Missing userId' });
  const days = Math.max(1, Math.min(90, parseInt((req.query.days as string) || '14', 10)));
  const since = daysAgo(days - 1);
  const items = await TimeLogModel.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), startedAt: { $gte: since } } as any },
    { $addFields: { day: { $dateToString: { format: '%Y-%m-%d', date: '$startedAt' } } } },
    { $group: { _id: '$day', sessions: { $sum: 1 } } },
    { $project: { _id: 0, day: '$_id', sessions: 1 } },
    { $sort: { day: 1 } },
  ]);
  res.json(items);
} 