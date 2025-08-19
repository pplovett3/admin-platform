import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { assignCourses, listEnrollments, assignSchoolCourse, listSchoolCourses, deleteSchoolCourse, checkSchoolCourseAccess } from '../controllers/enrollments.controller';

const router = Router();
router.use(authenticate);

// user-course assignment (legacy): superadmin and schoolAdmin
router.get('/', requireRole(['superadmin', 'schoolAdmin']), listEnrollments);
router.post('/', requireRole(['superadmin', 'schoolAdmin']), assignCourses);

// school-course assignment: superadmin only
router.get('/schools', requireRole(['superadmin']), listSchoolCourses);
router.post('/schools', requireRole(['superadmin']), assignSchoolCourse);
router.delete('/schools/:id', requireRole(['superadmin']), deleteSchoolCourse);

// check access for any role
router.get('/schools/check', requireRole(['superadmin', 'schoolAdmin', 'teacher', 'student']), checkSchoolCourseAccess);

export default router; 