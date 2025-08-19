import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { overview, schoolsStats, courseDetail, sessionsTrend, activeStudents, topCourses, topSchools, schoolOverview, schoolSessionsTrend, schoolTopCourses, teacherOverview, teacherSessionsTrend, teacherTopCourses, studentOverview, studentSessionsTrend } from '../controllers/analytics.controller';

const router = Router();
router.use(authenticate);
router.get('/overview', requireRole(['superadmin']), overview);
router.get('/schools', requireRole(['superadmin']), schoolsStats);
router.get('/courses/:id', requireRole(['superadmin']), courseDetail);
router.get('/trend/sessions', requireRole(['superadmin']), sessionsTrend);
router.get('/active-students', requireRole(['superadmin']), activeStudents);
router.get('/top/courses', requireRole(['superadmin']), topCourses);
router.get('/top/schools', requireRole(['superadmin']), topSchools);

// school admin
router.get('/school/overview', requireRole(['schoolAdmin']), schoolOverview);
router.get('/school/trend/sessions', requireRole(['schoolAdmin']), schoolSessionsTrend);
router.get('/school/top/courses', requireRole(['schoolAdmin']), schoolTopCourses);

// teacher
router.get('/teacher/overview', requireRole(['teacher']), teacherOverview);
router.get('/teacher/trend/sessions', requireRole(['teacher']), teacherSessionsTrend);
router.get('/teacher/top/courses', requireRole(['teacher']), teacherTopCourses);

// student
router.get('/student/overview', requireRole(['student']), studentOverview);
router.get('/student/trend/sessions', requireRole(['student']), studentSessionsTrend);

export default router; 