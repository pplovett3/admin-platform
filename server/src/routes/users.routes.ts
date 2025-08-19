import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { createUser, deleteUser, getUser, listUsers, updateUser } from '../controllers/users.controller';

const router = Router();
router.use(authenticate);
router.get('/', requireRole(['superadmin', 'schoolAdmin', 'teacher']), listUsers);
router.post('/', requireRole(['superadmin', 'schoolAdmin']), createUser);
router.get('/:id', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getUser);
router.put('/:id', requireRole(['superadmin', 'schoolAdmin']), updateUser);
router.delete('/:id', requireRole(['superadmin']), deleteUser);
export default router; 