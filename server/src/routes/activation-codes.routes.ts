import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import {
  generateActivationCodes,
  listActivationCodes,
  getActivationCodeDetail,
  updateActivationCodeStatus,
  deleteActivationCode
} from '../controllers/activation-codes.controller';

const router = Router();

// 所有路由都需要认证和超管权限
router.use(authenticate);
router.use(requireRole(['superadmin']));

// 生成激活码
router.post('/', generateActivationCodes);

// 激活码列表
router.get('/', listActivationCodes);

// 激活码详情
router.get('/:code', getActivationCodeDetail);

// 更新激活码状态
router.patch('/:code', updateActivationCodeStatus);

// 删除激活码
router.delete('/:code', deleteActivationCode);

export default router;

