import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { createSchool, deleteSchool, listSchools, updateSchool } from '../controllers/schools.controller';

const router = Router();
router.use(authenticate);
router.get('/', requireRole(['superadmin']), listSchools);
router.post('/', requireRole(['superadmin']), createSchool);
router.put('/:id', requireRole(['superadmin']), updateSchool);
router.delete('/:id', requireRole(['superadmin']), deleteSchool);
export default router; 