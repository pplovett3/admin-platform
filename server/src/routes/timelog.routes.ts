import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { getUserTime, heartbeat, start, stop, getClassTimeSummary, getMyLogs } from '../controllers/timelog.controller';

const router = Router();
router.use(authenticate);
router.post('/start', requireRole(['student', 'teacher', 'schoolAdmin', 'superadmin']), start);
router.post('/heartbeat', requireRole(['student', 'teacher', 'schoolAdmin', 'superadmin']), heartbeat);
router.post('/stop', requireRole(['student', 'teacher', 'schoolAdmin', 'superadmin']), stop);
router.get('/user/:userId', requireRole(['teacher', 'schoolAdmin', 'superadmin', 'student']), (req, res, next) => {
  const u: any = (req as any).user;
  if (u?.role === 'student' && u.userId !== (req.params as any).userId) return res.status(403).json({ message: 'Forbidden' });
  next();
}, getUserTime);
router.get('/class/:className', requireRole(['teacher', 'schoolAdmin', 'superadmin']), getClassTimeSummary);
router.get('/my/logs', requireRole(['student']), getMyLogs);
export default router; 