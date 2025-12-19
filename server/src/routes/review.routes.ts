import { Router } from 'express';
import { 
  getPendingReviews, 
  submitForReview, 
  reviewItem,
  getReviewStatus,
  unpublishItem
} from '../controllers/review.controller';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 获取待审核列表（超管/校管）
router.get('/pending', authenticate, getPendingReviews);

// 获取单个项目的审核状态
router.get('/:type/:id/status', authenticate, getReviewStatus);

// 提交审核申请
router.post('/:type/:id/submit', authenticate, submitForReview);

// 审核项目（通过/拒绝）
router.post('/:type/:id/review', authenticate, reviewItem);

// 下架课程（超管/校管）
router.post('/:type/:id/unpublish', authenticate, unpublishItem);

export default router;

