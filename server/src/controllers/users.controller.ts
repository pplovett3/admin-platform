import { Request, Response } from 'express';
import { z } from 'zod';
import { UserModel } from '../models/User';
import { hashPassword } from '../utils/password';

const userSchema = z.object({
  name: z.string().min(1),
  school: z.string().optional(),
  schoolId: z.string().optional(),
  className: z.string().optional().default(''),
  studentId: z.string().optional(),
  phone: z.string().min(6).optional(),
  role: z.enum(['superadmin', 'schoolAdmin', 'teacher', 'student']).default('student'),
  password: z.string().min(6).optional(),
});

export async function createUser(req: Request & { user?: any }, res: Response) {
  try {
    const parse = userSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ message: parse.error.message });
    const { password, ...rest } = parse.data as any;

    const current = (req as any).user;
    // permission enforcement
    if (current?.role === 'schoolAdmin' && !['teacher', 'student'].includes((rest as any).role)) {
      return res.status(403).json({ message: '学校管理员仅能创建教师或学生' });
    }
    if (current?.role === 'teacher') {
      (rest as any).role = 'student';
      // teacher default to own school
      if (current.schoolId) (rest as any).schoolId = current.schoolId;
    }
    if (current?.role === 'schoolAdmin') {
      // default schoolId to self's school
      if (current.schoolId && !(rest as any).schoolId) (rest as any).schoolId = current.schoolId;
    }

    if ((rest as any).phone) {
      const existingPhone = await UserModel.findOne({ phone: (rest as any).phone });
      if (existingPhone) return res.status(409).json({ message: '手机号已存在' });
    }

    const passwordHash = await hashPassword(password || '123456');
    const user = await UserModel.create({ ...(rest as any), passwordHash });
    return res.status(201).json(user);
  } catch (e: any) {
    // duplicate key handling
    if (e && (e.code === 11000 || e.name === 'MongoServerError')) {
      const fields = Object.keys(e.keyPattern || e.keyValue || {});
      const field = fields[0];
      if (field === 'phone') return res.status(409).json({ message: '手机号已存在' });
      return res.status(409).json({ message: '唯一约束冲突' });
    }
    return res.status(500).json({ message: e?.message || '服务器错误' });
  }
}

const updateSchema = userSchema.partial();

export async function updateUser(req: Request & { user?: any }, res: Response) {
  try {
    const parse = updateSchema.safeParse(req.body);
    if (!parse.success) return res.status(400).json({ message: parse.error.message });
    const { password, ...rest } = parse.data as any;

    const currentRole = (req as any).user?.role as 'superadmin' | 'schoolAdmin' | 'teacher' | 'student' | undefined;
    if (currentRole === 'schoolAdmin' && rest.role && !['teacher', 'student'].includes(rest.role)) {
      return res.status(403).json({ message: '学校管理员仅能设置教师或学生' });
    }
    if (currentRole === 'teacher' && rest.role && rest.role !== 'student') {
      return res.status(403).json({ message: '教师仅能设置学生' });
    }

    const id = (req.params as any).id;
    // uniqueness checks on update
    if (rest.phone) {
      const existingPhone = await UserModel.findOne({ phone: rest.phone, _id: { $ne: id } });
      if (existingPhone) return res.status(409).json({ message: '手机号已存在' });
    }

    const update: any = { ...(rest as any) };
    if (password) update.passwordHash = await hashPassword(password);
    const user = await UserModel.findByIdAndUpdate(id, update, { new: true });
    if (!user) return res.status(404).json({ message: 'User not found' });
    return res.json(user);
  } catch (e: any) {
    if (e && (e.code === 11000 || e.name === 'MongoServerError')) {
      const fields = Object.keys(e.keyPattern || e.keyValue || {});
      const field = fields[0];
      if (field === 'phone') return res.status(409).json({ message: '手机号已存在' });
      return res.status(409).json({ message: '唯一约束冲突' });
    }
    return res.status(500).json({ message: e?.message || '服务器错误' });
  }
}

export async function listUsers(req: Request & { user?: any }, res: Response) {
  const { school, schoolId, className, role, q } = req.query as any;
  const filter: any = {};
  if (school) filter.school = school;
  if (schoolId) filter.schoolId = schoolId;
  if (className) filter.className = className;
  if (role) filter.role = role;
  if (q) filter.$or = [
    { name: new RegExp(q as string, 'i') },
    { phone: new RegExp(q as string, 'i') },
    { studentId: new RegExp(q as string, 'i') },
  ];

  const current = (req as any).user;
  if (current?.role === 'teacher') {
    filter.role = 'student';
  }
  if (current?.role === 'schoolAdmin') {
    if (filter.role && !['teacher', 'student'].includes(filter.role)) {
      return res.json([]);
    }
    // restrict to teacher + student
    if (!filter.role) filter.role = { $in: ['teacher', 'student'] } as any;
  }
  // scope by school for teacher/schoolAdmin
  if (current?.schoolId && current.role !== 'superadmin') {
    filter.schoolId = current.schoolId;
  }

  const users = await UserModel.find(filter).sort({ createdAt: -1 });
  res.json(users);
}

export async function getUser(req: Request & { user?: any }, res: Response) {
  const user = await UserModel.findById((req.params as any).id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json(user);
}

export async function deleteUser(req: Request, res: Response) {
  const user = await UserModel.findByIdAndDelete((req.params as any).id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ success: true });
} 