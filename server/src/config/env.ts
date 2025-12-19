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
  azureSpeechEndpoint: process.env.AZURE_SPEECH_ENDPOINT || '',
  // 通义千问VL配置（用于AI智能标注整理）
  qwenVLApiKey: process.env.QWEN_VL_API_KEY || '',
  qwenVLBaseUrl: process.env.QWEN_VL_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  // 豆包API配置（字节跳动）
  doubaoApiKey: process.env.DOUBAO_API_KEY || '',
  doubaoBaseUrl: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3'
} as const; 