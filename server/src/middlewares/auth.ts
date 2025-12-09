import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

export interface AuthPayload {
  userId: string;
  role: 'superadmin' | 'schoolAdmin' | 'teacher' | 'student';
  className?: string;
  school?: string;
  schoolId?: string;
}

export function authenticate(req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    (req as any).user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

export function requireRole(roles: AuthPayload['role'][]) {
  return (req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) => {
    if (!(req as any).user || !roles.includes(((req as any).user as AuthPayload).role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

// 可选认证：如果有token则解析，没有则继续（用于支持游客访问）
export function optionalAuthenticate(req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    // 没有token，继续执行（游客模式）
    return next();
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    (req as any).user = payload;
  } catch (e) {
    // token无效，忽略错误，继续执行（当作游客）
  }
  next();
} 