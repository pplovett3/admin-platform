import mongoose from 'mongoose';
import { FileModel } from '../models/File';
import { UserModel, DEFAULT_STORAGE_QUOTA } from '../models/User';

// 表示“不限容量”的配额哨兵值（用于超管）。
export const UNLIMITED_QUOTA = -1;

// 统计某用户已使用的“个人存储空间”（字节）。
// 仅统计归属该用户、且为私有（个人）的资源；
// 公共资源（超管上传，全员可见）不占用任何人的个人空间，故不计入；
// 课件编辑器的临时 GLB（modifiedModels，不入 File 模型）与 TTS 配音也不计入。
export async function getUsedStorage(userId: string): Promise<number> {
  const result = await FileModel.aggregate([
    { $match: { ownerUserId: new mongoose.Types.ObjectId(userId), visibility: 'private' } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return result.length > 0 ? (result[0].total || 0) : 0;
}

// 获取用户配额（字节）。
// 超管（superadmin）不限容量，返回 UNLIMITED_QUOTA；
// 其他角色缺省回退到默认 5GB。
export async function getUserQuota(userId: string): Promise<number> {
  const user = await UserModel.findById(userId).select('storageQuota role').lean();
  if ((user as any)?.role === 'superadmin') return UNLIMITED_QUOTA;
  const q = (user as any)?.storageQuota;
  return typeof q === 'number' && q >= 0 ? q : DEFAULT_STORAGE_QUOTA;
}

export interface QuotaCheck {
  ok: boolean;
  used: number;
  quota: number;
  remaining: number;
  unlimited: boolean;
}

// 校验在新增 addBytes 字节后是否会超出配额。
// 不限容量时（超管）直接放行。
export async function checkQuota(userId: string, addBytes: number): Promise<QuotaCheck> {
  const [used, quota] = await Promise.all([getUsedStorage(userId), getUserQuota(userId)]);
  if (quota === UNLIMITED_QUOTA) {
    return { ok: true, used, quota: UNLIMITED_QUOTA, remaining: Number.MAX_SAFE_INTEGER, unlimited: true };
  }
  const remaining = quota - used;
  return { ok: addBytes <= remaining, used, quota, remaining, unlimited: false };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
