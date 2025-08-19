import { Request, Response } from 'express';
import { z } from 'zod';
import { ClassModel } from '../models/Class';

const schema = z.object({
  name: z.string().min(1),
  headTeacher: z.string().optional(),
  schoolId: z.string().optional(),
});

export async function listClasses(req: Request & { user?: any }, res: Response) {
  const { schoolId, q, headTeacher } = req.query as any;
  const filter: any = {};
  if (schoolId) filter.schoolId = schoolId;
  if (headTeacher) filter.headTeacher = headTeacher;
  if ((req as any).user?.schoolId && (req as any).user?.role !== 'superadmin') {
    filter.schoolId = (req as any).user.schoolId;
  }
  if (q) filter.name = new RegExp(q as string, 'i');
  const list = await ClassModel.find(filter)
    .sort({ createdAt: -1 })
    .populate('headTeacher', 'name phone')
    .populate('schoolId', 'name');
  res.json(list);
}

export async function createClass(req: Request & { user?: any }, res: Response) {
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ message: parse.error.message });
  const body: any = parse.data;
  const current = (req as any).user;
  if (current?.schoolId && current?.role !== 'superadmin') {
    body.schoolId = current.schoolId;
  }
  if (current?.role === 'superadmin' && !body.schoolId) {
    return res.status(400).json({ message: 'schoolId is required for superadmin' });
  }
  const created = await ClassModel.create(body);
  res.status(201).json(created);
}

export async function updateClass(req: Request & { user?: any }, res: Response) {
  const parse = schema.partial().safeParse(req.body);
  if (!parse.success) return res.status(400).json({ message: parse.error.message });
  const body: any = parse.data;
  const current = (req as any).user;
  if (current?.schoolId && current?.role !== 'superadmin') {
    body.schoolId = current.schoolId;
  }
  const updated = await ClassModel.findByIdAndUpdate((req.params as any).id, body, { new: true });
  if (!updated) return res.status(404).json({ message: 'Class not found' });
  res.json(updated);
}

export async function deleteClass(req: Request, res: Response) {
  const doc = await ClassModel.findByIdAndDelete((req.params as any).id);
  if (!doc) return res.status(404).json({ message: 'Class not found' });
  res.json({ success: true });
} 