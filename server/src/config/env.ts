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
  // 前端公网/内网访问基址（用于生成分享链接，避免拿到 docker 内部 Host）
  // 例如 http://172.17.136.200:3001 或 https://platform.yf-xr.com
  publicBaseUrl: process.env.PUBLIC_BASE_URL || '',
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
  doubaoBaseUrl: process.env.DOUBAO_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  // 豆包大模型ID（用于AI生成大纲、考题、标注简介等文本/多模态任务）
  // 可填模型ID（如 Doubao-Seed-2.1-pro）或火山方舟接入点ID（形如 ep-xxxxxxxx）
  doubaoModelId: process.env.DOUBAO_MODEL_ID || 'doubao-seed-2-1-pro-260628',
  // 豆包 Seed 系列思考模式开关：disabled=关闭思考（响应快，适合标注简介/大纲等），enabled=开启思考（质量高但慢）
  // 默认关闭以获得最快响应；需要复杂推理时可设为 enabled
  doubaoThinking: (process.env.DOUBAO_THINKING || 'disabled') as 'disabled' | 'enabled',
  // 豆包文生图模型ID（用于AI生成课程配图，基于大纲图片描述生成提示词后调用）
  doubaoImageModelId: process.env.DOUBAO_IMAGE_MODEL_ID || 'doubao-seedream-5-0-260128',
  // 豆包语音合成（TTS）配置 - 火山引擎语音服务（与方舟API Key独立，需在"豆包语音"控制台开通）
  doubaoTtsAppId: process.env.DOUBAO_TTS_APP_ID || '',
  doubaoTtsAccessKey: process.env.DOUBAO_TTS_ACCESS_KEY || '',
  doubaoTtsBaseUrl: process.env.DOUBAO_TTS_BASE_URL || 'https://openspeech.bytedance.com',
  // 音色资源ID：官方2.0音色用 seed-tts-2.0，官方1.0音色用 seed-tts-1.0
  doubaoTtsResourceId: process.env.DOUBAO_TTS_RESOURCE_ID || 'seed-tts-2.0'
} as const; 