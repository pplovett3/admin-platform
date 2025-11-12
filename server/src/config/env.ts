import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  frontendPort: parseInt(process.env.FRONTEND_PORT || '3001', 10),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/admin_platform',
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  storageRoot: process.env.STORAGE_ROOT || 'Y:\\metaclassroom',
  publicViewBase: process.env.PUBLIC_VIEW_BASE || '',
  publicDownloadBase: process.env.PUBLIC_DOWNLOAD_BASE || '',
  // AI 服务配置
  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  metasoApiKey: process.env.METASO_API_KEY || '',
  metasoBaseUrl: process.env.METASO_BASE_URL || 'https://metaso.cn',
  minimaxApiKey: process.env.MINIMAX_API_KEY || '',
  minimaxBaseUrl: process.env.MINIMAX_BASE_URL || 'https://api.minimaxi.com',
  // Azure TTS 配置
  azureSpeechKey: process.env.AZURE_SPEECH_KEY || '',
  azureSpeechRegion: process.env.AZURE_SPEECH_REGION || '',
  azureSpeechEndpoint: process.env.AZURE_SPEECH_ENDPOINT || ''
} as const; 