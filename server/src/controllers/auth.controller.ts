import { Request, Response } from 'express';
import { UserModel } from '../models/User';
import { verifyPassword } from '../utils/password';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { SchoolCourseModel } from '../models/Enrollment';
import mongoose from 'mongoose';
import { CourseModel } from '../models/Course';
import { FileModel } from '../models/File';

export async function login(req: Request, res: Response) {
  const { phone, password, courseId } = req.body as any;
  if (!phone || !password) {
    return res.status(400).json({ message: 'phone and password are required' });
  }
  const user = await UserModel.findOne({ phone });
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await verifyPassword(password, (user as any).passwordHash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });

  // Optional: course authorization at login time (for Unity)
  if (courseId && ((user as any).role === 'student' || (user as any).role === 'teacher')) {
    const sid = (user as any).schoolId?.toString();
    if (!sid) return res.status(403).json({ message: 'No school assigned for user' });

    let courseObjectId: mongoose.Types.ObjectId | null = null;
    if (mongoose.Types.ObjectId.isValid(courseId)) {
      courseObjectId = new mongoose.Types.ObjectId(courseId);
    } else {
      const course = await CourseModel.findOne({ $or: [{ code: courseId }, { name: courseId }] }).lean();
      if (course) courseObjectId = (course as any)._id as mongoose.Types.ObjectId;
    }
    if (!courseObjectId) return res.status(403).json({ message: 'Course not found by id/code/name' });

    const grant = await SchoolCourseModel.findOne({ schoolId: sid, courseId: courseObjectId, enabled: true }).lean();
    if (!grant) return res.status(403).json({ message: 'Course not authorized for your school' });
  }

  const token = (jwt as any).sign(
    {
      userId: (user as any)._id.toString(),
      role: (user as any).role,
      className: (user as any).className,
      school: (user as any).school,
      schoolId: (user as any).schoolId?.toString?.(),
      name: (user as any).name,
      phone: (user as any).phone,
      metaverseAllowed: !!(user as any).metaverseAllowed,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  const myFiles = await FileModel.find({ ownerUserId: (user as any)._id })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return res.json({
    token,
    user: {
      id: (user as any)._id.toString(),
      name: (user as any).name,
      role: (user as any).role,
      className: (user as any).className,
      school: (user as any).school,
      schoolId: (user as any).schoolId?.toString?.(),
      phone: (user as any).phone,
      metaverseAllowed: !!(user as any).metaverseAllowed,
    },
    myFiles: (myFiles as any[]).map((r) => ({
      id: r._id,
      type: (r as any).type,
      originalName: (r as any).originalName,
      size: (r as any).size,
      createdAt: (r as any).createdAt,
      downloadUrl: `/api/files/${r._id}/download`,
    })),
  });
}

export async function hasSchoolCourseAccess(schoolId?: string, courseId?: string): Promise<boolean> {
  if (!schoolId || !courseId) return false;
  const doc = await SchoolCourseModel.findOne({ schoolId, courseId, enabled: true }).lean();
  return !!doc;
} 