import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/admin_platform',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  storageRoot: process.env.STORAGE_ROOT || '/mnt/nas',
  publicViewBase: process.env.PUBLIC_VIEW_BASE || '',
  publicDownloadBase: process.env.PUBLIC_DOWNLOAD_BASE || ''
} as const; 