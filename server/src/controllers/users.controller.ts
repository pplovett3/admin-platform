import { Request, Response } from 'express';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import { UserModel, DEFAULT_STORAGE_QUOTA } from '../models/User';
import { ClassModel } from '../models/Class';
import { FileModel } from '../models/File';
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
  storageQuota: z.number().int().nonnegative().optional(),
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

  const users = await UserModel.find(filter).sort({ createdAt: -1 }).lean();

  // 附加每个用户的已用存储空间（用于配额展示）
  const ids = users.map((u: any) => u._id);
  let usageMap: Record<string, number> = {};
  if (ids.length > 0) {
    const usage = await FileModel.aggregate([
      // 仅统计个人（私有）资源；公共资源不占用个人空间
      { $match: { ownerUserId: { $in: ids }, visibility: 'private' } },
      { $group: { _id: '$ownerUserId', total: { $sum: '$size' } } },
    ]);
    usageMap = usage.reduce((acc: Record<string, number>, cur: any) => {
      acc[String(cur._id)] = cur.total || 0;
      return acc;
    }, {});
  }
  const withUsage = users.map((u: any) => ({
    ...u,
    storageQuota: typeof u.storageQuota === 'number' ? u.storageQuota : DEFAULT_STORAGE_QUOTA,
    storageUsed: usageMap[String(u._id)] || 0,
  }));
  res.json(withUsage);
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

// ==================== 批量导入用户 ====================

const TEMPLATE_HEADERS = ['姓名', '手机号', '角色', '班级', '学号', '初始密码'];

// 下载批量导入模板（.xlsx）
export async function getImportTemplate(_req: Request, res: Response) {
  try {
    const ws = XLSX.utils.aoa_to_sheet([
      TEMPLATE_HEADERS,
      ['张三', '13800000001', '学生', '计算机2401班', '2024010101', '123456'],
      ['李四', '13800000002', '学生', '计算机2401班', '2024010102', ''],
      ['王老师', '13800000003', '教师', '', '', ''],
    ]);
    // 列宽
    (ws as any)['!cols'] = [
      { wch: 12 }, { wch: 16 }, { wch: 8 }, { wch: 20 }, { wch: 16 }, { wch: 12 },
    ];

    const notes = XLSX.utils.aoa_to_sheet([
      ['批量导入用户填写说明'],
      [''],
      ['1. 必填项：姓名、手机号。手机号为登录账号，不能重复。'],
      ['2. 角色：填写「教师」或「学生」，留空默认为「学生」。'],
      ['3. 班级：学生建议填写；若班级不存在系统会自动创建。教师可留空。'],
      ['4. 学号：学生可填写，教师可留空。'],
      ['5. 初始密码：留空则默认 123456。'],
      ['6. 请勿修改第一行表头，按列顺序填写数据。'],
      ['7. 填好后保存为 .xlsx 文件，回到平台「批量导入」上传即可。'],
    ]);
    (notes as any)['!cols'] = [{ wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '用户数据');
    XLSX.utils.book_append_sheet(wb, notes, '填写说明');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="user-import-template.xlsx"`);
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ message: e?.message || '生成模板失败' });
  }
}

const ROLE_MAP: Record<string, 'teacher' | 'student'> = {
  '教师': 'teacher', '老师': 'teacher', 'teacher': 'teacher',
  '学生': 'student', 'student': 'student',
};

// 批量导入用户（上传填好的 .xlsx）
export async function importUsers(req: Request & { user?: any }, res: Response) {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ message: '请上传 Excel 文件' });

    const current = (req as any).user;
    // 确定归属学校
    let schoolId: string | undefined = current?.schoolId;
    if (current?.role === 'superadmin') {
      schoolId = (req.query.schoolId as string) || (req.body?.schoolId as string) || undefined;
      if (!schoolId) return res.status(400).json({ message: '超级管理员导入时必须指定学校（schoolId）' });
    }

    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ message: '文件中没有可导入的数据' });
    }

    const results = { total: rows.length, created: 0, failed: 0, errors: [] as Array<{ row: number; name?: string; phone?: string; reason: string }> };

    // 班级缓存（name -> classId），避免重复创建
    const classCache = new Map<string, string>();
    const ensureClass = async (name: string): Promise<void> => {
      const key = name.trim();
      if (!key || classCache.has(key)) return;
      let cls = await ClassModel.findOne({ name: key, schoolId });
      if (!cls) cls = await ClassModel.create({ name: key, schoolId });
      classCache.set(key, String((cls as any)._id));
    };

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 2; // 表头占第 1 行
      const name = String(r['姓名'] ?? '').trim();
      const phone = String(r['手机号'] ?? '').trim().replace(/\.0$/, '');
      const roleRaw = String(r['角色'] ?? '').trim();
      const className = String(r['班级'] ?? '').trim();
      const studentId = String(r['学号'] ?? '').trim().replace(/\.0$/, '');
      const password = String(r['初始密码'] ?? '').trim();

      try {
        if (!name) { throw new Error('姓名为空'); }
        if (!phone) { throw new Error('手机号为空'); }
        if (!/^\d{6,}$/.test(phone)) { throw new Error('手机号格式不正确'); }

        let role: 'teacher' | 'student' = ROLE_MAP[roleRaw] || 'student';
        // 教师只能导入学生
        if (current?.role === 'teacher') role = 'student';

        const existing = await UserModel.findOne({ phone });
        if (existing) { throw new Error('手机号已存在'); }

        if (className) await ensureClass(className);

        const passwordHash = await hashPassword(password || '123456');
        await UserModel.create({
          name,
          phone,
          role,
          schoolId,
          className: role === 'student' ? className : (className || ''),
          studentId: role === 'student' ? studentId : undefined,
          passwordHash,
          storageQuota: DEFAULT_STORAGE_QUOTA,
        });
        results.created++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ row: rowNum, name, phone, reason: err?.message || '未知错误' });
      }
    }

    return res.json(results);
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || '导入失败' });
  }
}

// 更新单个用户的存储配额（字节）
export async function updateUserQuota(req: Request & { user?: any }, res: Response) {
  try {
    const { id } = req.params as any;
    const quota = Number(req.body?.storageQuota);
    if (!Number.isFinite(quota) || quota < 0) {
      return res.status(400).json({ message: '配额必须为非负数字（字节）' });
    }
    const current = (req as any).user;
    const target = await UserModel.findById(id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    // 校级管理员只能调整本校的教师/学生
    if (current?.role === 'schoolAdmin') {
      if (!['teacher', 'student'].includes(target.role)) {
        return res.status(403).json({ message: '只能调整教师或学生的配额' });
      }
      if (current.schoolId && String(target.schoolId) !== String(current.schoolId)) {
        return res.status(403).json({ message: '只能调整本校用户的配额' });
      }
    }
    target.storageQuota = quota;
    await target.save();
    return res.json({ id: target._id, storageQuota: target.storageQuota });
  } catch (e: any) {
    return res.status(500).json({ message: e?.message || '更新配额失败' });
  }
} 