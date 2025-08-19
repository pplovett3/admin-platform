import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { listClasses, createClass, updateClass, deleteClass } from '../controllers/classes.controller';

const router = Router();
router.use(authenticate);
router.get('/', requireRole(['superadmin', 'schoolAdmin', 'teacher']), listClasses);
router.post('/', requireRole(['superadmin', 'schoolAdmin']), createClass);
router.put('/:id', requireRole(['superadmin', 'schoolAdmin']), updateClass);
router.delete('/:id', requireRole(['superadmin']), deleteClass);
export default router; 