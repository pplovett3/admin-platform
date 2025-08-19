import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { createUser, deleteUser, getUser, listUsers, updateUser } from '../controllers/users.controller';
import { UserModel } from '../models/User';

const router = Router();
router.use(authenticate);
router.get('/', requireRole(['superadmin', 'schoolAdmin', 'teacher']), listUsers);
router.post('/', requireRole(['superadmin', 'schoolAdmin']), createUser);
router.get('/:id', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getUser);
router.put('/:id', requireRole(['superadmin', 'schoolAdmin']), updateUser);
router.delete('/:id', requireRole(['superadmin']), deleteUser);
router.put('/:id/metaverse-allow', authenticate as any, async (req, res) => {
  const current = (req as any).user as { role: string };
  if (current.role !== 'superadmin') return res.status(403).json({ message: 'Forbidden' });
  const allowed = !!(req.body?.allowed);
  const updated = await UserModel.findByIdAndUpdate(req.params.id, { $set: { metaverseAllowed: allowed } }, { new: true }).lean();
  if (!updated) return res.status(404).json({ message: 'User not found' });
  res.json({ id: (updated as any)._id, metaverseAllowed: (updated as any).metaverseAllowed });
});
export default router; 