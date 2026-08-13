import { Router } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middlewares/auth';
import { createUser, deleteUser, getUser, listUsers, updateUser, getImportTemplate, importUsers, updateUserQuota } from '../controllers/users.controller';
import { UserModel } from '../models/User';

const router = Router();
// 批量导入文件保存在内存（xlsx 体积小）
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(authenticate);
router.get('/', requireRole(['superadmin', 'schoolAdmin', 'teacher']), listUsers);
router.post('/', requireRole(['superadmin', 'schoolAdmin']), createUser);
// 批量导入：模板下载 + 上传解析（放在 /:id 之前，避免被参数路由捕获）
router.get('/import-template', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getImportTemplate);
router.post('/import', requireRole(['superadmin', 'schoolAdmin', 'teacher']), importUpload.single('file'), importUsers);
router.put('/:id/quota', requireRole(['superadmin', 'schoolAdmin']), updateUserQuota);
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