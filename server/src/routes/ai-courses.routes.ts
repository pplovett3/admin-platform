import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { listAICourses, getAICourse, createAICourse, updateAICourse, deleteAICourse } from '../controllers/ai-courses.controller';

const router = Router();

router.use(authenticate);

router.get('/', requireRole(['superadmin', 'schoolAdmin', 'teacher']), listAICourses);
router.get('/:id', requireRole(['superadmin', 'schoolAdmin', 'teacher']), getAICourse);
router.post('/', requireRole(['superadmin', 'schoolAdmin', 'teacher']), createAICourse);
router.put('/:id', requireRole(['superadmin', 'schoolAdmin', 'teacher']), updateAICourse);
router.delete('/:id', requireRole(['superadmin', 'schoolAdmin', 'teacher']), deleteAICourse);

export default router;


