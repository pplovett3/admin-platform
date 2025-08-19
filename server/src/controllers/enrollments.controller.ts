import { Request, Response } from 'express';
import { EnrollmentModel, SchoolCourseModel } from '../models/Enrollment';
import mongoose from 'mongoose';
import { CourseModel } from '../models/Course';

const isValid = (v?: any) => v !== undefined && v !== null && v !== '' && v !== 'undefined' && v !== 'null';

export async function listEnrollments(req: Request, res: Response) {
  const { userId, courseId, schoolId, type } = req.query as any;
  if (type === 'school') {
    const sf: any = {};
    if (isValid(schoolId)) sf.schoolId = schoolId;
    if (isValid(courseId)) sf.courseId = courseId;
    const items = await SchoolCourseModel.find(sf).sort({ createdAt: -1 }).populate('schoolId', 'name').populate('courseId', 'name code');
    return res.json(items);
  }
  const filter: any = {};
  if (isValid(userId)) filter.userId = userId;
  if (isValid(courseId)) filter.courseId = courseId;
  const items = await EnrollmentModel.find(filter).sort({ createdAt: -1 });
  res.json(items);
}

export async function assignCourses(req: Request & { user?: any }, res: Response) {
  const { userIds, courseId } = req.body as any;
  const assignedBy = (req as any).user?.userId;
  if (!Array.isArray(userIds) || !courseId) return res.status(400).json({ message: 'userIds[] and courseId are required' });
  const ops = userIds.map((uid: string) => ({
    updateOne: {
      filter: { userId: uid, courseId },
      update: { $set: { userId: uid, courseId, assignedBy, assignedAt: new Date(), status: 'active' } },
      upsert: true,
    },
  }));
  await EnrollmentModel.bulkWrite(ops);
  res.json({ success: true });
}

export async function assignSchoolCourse(req: Request & { user?: any }, res: Response) {
  const role = (req as any).user?.role;
  if (role !== 'superadmin') return res.status(403).json({ message: '仅超管可分配学校课程' });
  const { schoolId, courseId, enabled } = req.body as any;
  if (!schoolId || !courseId) return res.status(400).json({ message: 'schoolId and courseId are required' });
  const doc = await SchoolCourseModel.findOneAndUpdate(
    { schoolId, courseId },
    { $set: { schoolId, courseId, enabled: enabled !== false, assignedBy: (req as any).user?.userId, assignedAt: new Date() } },
    { upsert: true, new: true }
  );
  res.json(doc);
}

export async function listSchoolCourses(req: Request & { user?: any }, res: Response) {
  const role = (req as any).user?.role;
  const { schoolId, courseId } = req.query as any;
  const filter: any = {};
  if (isValid(schoolId)) filter.schoolId = schoolId;
  if (isValid(courseId)) filter.courseId = courseId;
  const items = await SchoolCourseModel.find(filter).populate('schoolId', 'name').populate('courseId', 'name code');
  if (role !== 'superadmin') return res.status(403).json([]);
  res.json(items);
}

export async function deleteSchoolCourse(req: Request & { user?: any }, res: Response) {
  const role = (req as any).user?.role;
  if (role !== 'superadmin') return res.status(403).json({ message: '仅超管可操作' });
  const id = (req.params as any).id;
  const doc = await SchoolCourseModel.findByIdAndDelete(id);
  if (!doc) return res.status(404).json({ message: 'Not found' });
  res.json({ success: true });
}

export async function checkSchoolCourseAccess(req: Request & { user?: any }, res: Response) {
  const { schoolId, courseId } = req.query as any;
  if (!isValid(schoolId) || !isValid(courseId)) return res.status(400).json({ allowed: false, message: 'schoolId and courseId are required' });

  let courseObjectId: mongoose.Types.ObjectId | undefined;
  try {
    if (mongoose.Types.ObjectId.isValid(courseId as string)) {
      courseObjectId = new mongoose.Types.ObjectId(courseId as string);
    } else {
      const c = await CourseModel.findOne({ $or: [{ code: courseId }, { name: courseId }] }).lean();
      if (c) courseObjectId = (c as any)._id as mongoose.Types.ObjectId;
    }
  } catch {}

  if (!courseObjectId) return res.json({ allowed: false, message: 'course not found' });

  const doc = await SchoolCourseModel.findOne({ schoolId, courseId: courseObjectId, enabled: true }).lean();
  res.json({ allowed: !!doc });
} 