import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { createCourse, deleteCourse, listCourses, updateCourse, createModule, deleteModule, listModules, updateModule } from '../controllers/courses.controller';

const router = Router();
router.use(authenticate);
// allow everyone to read courses (will be filtered by authorization inside controller)
router.get('/', requireRole(['superadmin', 'schoolAdmin', 'teacher', 'student']), listCourses);
router.post('/', requireRole(['superadmin']), createCourse);
router.put('/:id', requireRole(['superadmin']), updateCourse);
router.delete('/:id', requireRole(['superadmin']), deleteCourse);

router.get('/:courseId/modules', requireRole(['superadmin']), listModules);
router.post('/:courseId/modules', requireRole(['superadmin']), createModule);
router.put('/:courseId/modules/:id', requireRole(['superadmin']), updateModule);
router.delete('/:courseId/modules/:id', requireRole(['superadmin']), deleteModule);

export default router; 