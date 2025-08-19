import { Request, Response } from 'express';
import { SchoolModel } from '../models/School';

export async function listSchools(req: Request, res: Response) {
  const q = (req.query.q as string) || '';
  const filter: any = {};
  if (q) filter.$or = [{ name: new RegExp(q, 'i') }, { code: new RegExp(q, 'i') }];
  const items = await SchoolModel.find(filter).sort({ createdAt: -1 });
  res.json(items);
}

export async function createSchool(req: Request, res: Response) {
  const { name, code, address, contact, enabled } = req.body || {};
  if (!name || !code) return res.status(400).json({ message: 'name and code are required' });
  const exists = await SchoolModel.findOne({ code });
  if (exists) return res.status(409).json({ message: 'code already exists' });
  const doc = await SchoolModel.create({ name, code, address, contact, enabled });
  res.status(201).json(doc);
}

export async function updateSchool(req: Request, res: Response) {
  const doc = await SchoolModel.findByIdAndUpdate(req.params.id, req.body || {}, { new: true });
  if (!doc) return res.status(404).json({ message: 'School not found' });
  res.json(doc);
}

export async function deleteSchool(req: Request, res: Response) {
  const doc = await SchoolModel.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: 'School not found' });
  res.json({ success: true });
} 