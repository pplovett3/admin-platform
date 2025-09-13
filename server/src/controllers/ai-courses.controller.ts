import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { AICourseModel } from '../models/AICourse';

export async function listAICourses(req: Request, res: Response) {
  try {
    const q = (req.query.q as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (q) {
      filter.$or = [
        { title: new RegExp(q, 'i') },
        { theme: new RegExp(q, 'i') }
      ];
    }

    const user = (req as any).user;
    if (user.role !== 'superadmin') {
      if (!user?.userId || !Types.ObjectId.isValid(user.userId)) {
        return res.status(401).json({ message: 'Invalid user' });
      }
      filter.createdBy = new Types.ObjectId(user.userId);
    }

    const [items, total] = await Promise.all([
      AICourseModel
        .find(filter)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AICourseModel.countDocuments(filter)
    ]);

    res.json({
      items,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (err) {
    console.error('listAICourses error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function getAICourse(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
    const doc = await AICourseModel.findById(id).populate('createdBy', 'name').populate('updatedBy', 'name');
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const user = (req as any).user;
    const createdById = (doc as any).createdBy?._id?.toString?.() || (doc as any).createdBy?.toString?.();
    if (user.role !== 'superadmin' && createdById !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    res.json(doc);
  } catch (err) {
    console.error('getAICourse error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function createAICourse(req: Request, res: Response) {
  try {
    const { title, coursewareId } = req.body || {};
    if (!title?.trim()) return res.status(400).json({ message: 'Title is required' });
    if (!coursewareId || !Types.ObjectId.isValid(coursewareId)) return res.status(400).json({ message: 'coursewareId is required' });
    const user = (req as any).user;
    if (!user?.userId || !Types.ObjectId.isValid(user.userId)) {
      return res.status(401).json({ message: 'Invalid user' });
    }
    const userId = new Types.ObjectId(user.userId);
    const doc = await AICourseModel.create({
      title: title.trim(),
      coursewareId: new Types.ObjectId(coursewareId),
      status: 'draft',
      createdBy: userId,
      updatedBy: userId,
      version: '1.0',
      courseVersion: 1
    });
    const populated = await AICourseModel.findById(doc._id).populate('createdBy', 'name').populate('updatedBy', 'name');
    res.status(201).json(populated);
  } catch (err) {
    console.error('createAICourse error:', err);
    const message = (err as any)?.message || 'Internal server error';
    res.status(500).json({ message });
  }
}

export async function updateAICourse(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
    const doc = await AICourseModel.findById(id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const user = (req as any).user;
    if (user.role !== 'superadmin' && doc.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    const updateData = { ...req.body };
    delete (updateData as any)._id;
    delete (updateData as any).createdBy;
    delete (updateData as any).createdAt;
    delete (updateData as any).updatedAt;
    updateData.updatedBy = new Types.ObjectId(user.userId);
    updateData.courseVersion = (doc.courseVersion || 1) + 1;
    const updated = await AICourseModel
      .findByIdAndUpdate(id, updateData, { new: true })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');
    res.json(updated);
  } catch (err) {
    console.error('updateAICourse error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function deleteAICourse(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid id' });
    const doc = await AICourseModel.findById(id);
    if (!doc) return res.status(404).json({ message: 'Not found' });
    const user = (req as any).user;
    if (user.role !== 'superadmin' && doc.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }
    await AICourseModel.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (err) {
    console.error('deleteAICourse error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}



