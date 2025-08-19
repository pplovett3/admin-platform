import { Request, Response } from 'express';
import { CourseModel, CourseModuleModel } from '../models/Course';

export async function listCourses(req: Request, res: Response) {
  const q = (req.query.q as string) || '';
  const filter: any = {};
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }];
  const items = await CourseModel.find(filter).sort({ createdAt: -1 });
  res.json(items);
}

export async function createCourse(req: Request, res: Response) {
  const { name, code, type, description, enabled } = req.body || {};
  if (!name || !code || !type) return res.status(400).json({ message: 'name, code and type are required' });
  const exists = await CourseModel.findOne({ code });
  if (exists) return res.status(409).json({ message: 'code already exists' });
  const doc = await CourseModel.create({ name, code, type, description, enabled });
  res.status(201).json(doc);
}

export async function updateCourse(req: Request, res: Response) {
  const doc = await CourseModel.findByIdAndUpdate(req.params.id, req.body || {}, { new: true });
  if (!doc) return res.status(404).json({ message: 'Course not found' });
  res.json(doc);
}

export async function deleteCourse(req: Request, res: Response) {
  const doc = await CourseModel.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Course not found' });
  res.json({ success: true });
}

// Modules
export async function listModules(req: Request, res: Response) {
  const { courseId } = req.params as any;
  const items = await CourseModuleModel.find({ courseId }).sort({ order: 1, createdAt: 1 });
  res.json(items);
}

export async function createModule(req: Request, res: Response) {
  const { courseId } = req.params as any;
  const { moduleId, name, maxScore, order } = req.body || {};
  if (!moduleId || !name) return res.status(400).json({ message: 'moduleId and name are required' });
  const doc = await CourseModuleModel.create({ courseId, moduleId, name, maxScore, order });
  res.status(201).json(doc);
}

export async function updateModule(req: Request, res: Response) {
  const { courseId, id } = req.params as any;
  const doc = await CourseModuleModel.findOneAndUpdate({ _id: id, courseId }, req.body || {}, { new: true });
  if (!doc) return res.status(404).json({ message: 'Module not found' });
  res.json(doc);
}

export async function deleteModule(req: Request, res: Response) {
  const { courseId, id } = req.params as any;
  const doc = await CourseModuleModel.findOneAndDelete({ _id: id, courseId });
  if (!doc) return res.status(404).json({ message: 'Module not found' });
  res.json({ success: true });
} 