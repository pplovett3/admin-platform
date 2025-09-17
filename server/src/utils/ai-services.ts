import { config } from '../config/env';
import { FileModel } from '../models/File';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Types } from 'mongoose';

// DeepSeek API 接口
export interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DeepSeekResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// 课件数据接口
export interface CoursewareData {
  name: string;
  description: string;
  annotations: Array<{
    id: string;
    title: string;
    description: string;
    nodeKey: string;
  }>;
  animations: Array<{
    id: string;
    name: string;
    description: string;
    steps: Array<{
      name: string;
      description: string;
    }>;
  }>;
}

// 课程生成参数
export interface CourseGenerationParams {
  coursewareData: CoursewareData;
  theme: string;
  audience: string;
  durationTarget: number;
  language?: string;
}

// DeepSeek 课程生成
export async function generateCourseWithDeepSeek(params: CourseGenerationParams): Promise<any> {
  const systemPrompt = `你是一个专业的工业/机械设备教学课程设计师。基于提供的三维课件数据，设计一门结构化的教学课程。

## 输入信息：
- 课件名称：${params.coursewareData.name}
- 课件描述：${params.coursewareData.description}
- 模型标注列表：${JSON.stringify(params.coursewareData.annotations, null, 2)}
- 动画列表：${JSON.stringify(params.coursewareData.animations, null, 2)}
- 课程主题：${params.theme}
- 目标受众：${params.audience}
- 时长目标：${params.durationTarget}分钟

## 输出要求：
请生成一个JSON格式的课程大纲，包含：

1. **课程结构**：3-5个主要章节，每章节2-4个段落
2. **段落类型**：
   - \`talk\`: 纯讲解文本（开场、总结、过渡）
   - \`image.explain\`: 需要配图说明的概念（原理、结构图等）
   - \`scene.action\`: 三维演示（指向标注、播放动画、显隐切换）

3. **内容要求**：
   - 讲解文本要通俗易懂，适合${params.audience}水平
   - 充分利用现有标注点，每个标注都要在课程中体现
   - 合理安排动画播放时机
   - 为需要配图的段落提供图片搜索关键词

## 输出格式：
返回纯JSON，不要包含markdown代码块标记：
{
  "outline": [
    {
      "id": "seg-1",
      "title": "课程导入",
      "mode": "sequence",
      "items": [
        {
          "type": "talk",
          "id": "item-1",
          "say": "欢迎学习...",
          "estimatedDuration": 30
        },
        {
          "type": "image.explain",
          "id": "item-2", 
          "say": "我们先看一下整体结构图...",
          "imageKeywords": "汽车发动机 结构图 剖面图",
          "estimatedDuration": 60
        },
        {
          "type": "scene.action",
          "id": "item-3",
          "say": "现在我们来看实际的发动机模型",
          "actions": [
            {"type": "camera.focus", "target": {"nodeKey": "实际存在的nodeKey"}},
            {"type": "highlight.show", "target": {"nodeKey": "实际存在的nodeKey"}},
            {"type": "annotation.show", "ids": ["实际存在的标注ID"]}
          ],
          "estimatedDuration": 45
        }
      ]
    }
  ]
}

## 支持的动作类型：
scene.action段落中的actions数组只能使用以下动作类型：
- \`camera.focus\`: 相机对焦到指定对象 {"type": "camera.focus", "target": {"nodeKey": "对象标识"}}
- \`highlight.show\`: 高亮显示指定对象 {"type": "highlight.show", "target": {"nodeKey": "对象标识"}}
- \`highlight.hide\`: 隐藏对象高亮 {"type": "highlight.hide", "target": {"nodeKey": "对象标识"}}
- \`annotation.show\`: 显示指定标注 {"type": "annotation.show", "ids": ["标注ID列表"]}
- \`annotation.hide\`: 隐藏指定标注 {"type": "annotation.hide", "ids": ["标注ID列表"]}
- \`animation.play\`: 播放动画 {"type": "animation.play", "animationId": "动画ID"}
- \`visibility.set\`: 设置对象显隐 {"type": "visibility.set", "items": [{"nodeKey": "对象标识", "visible": true/false}]}

注意：
- 确保所有引用的nodeKey都来自提供的标注列表
- 动画播放要指定具体的animationId
- 每个段落预估时长，总时长控制在目标范围内
- 严格按照上述动作类型格式，不要创造新的动作类型`;

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请基于上述信息生成课程大纲JSON。' }
  ];

  try {
    // 如果没有配置 API Key，返回模拟数据
    if (!config.deepseekApiKey || config.deepseekApiKey === '') {
      console.warn('DeepSeek API Key not configured, returning mock data');
      return {
        outline: [
          {
            id: "seg-1",
            title: "课程导入",
            mode: "sequence",
            items: [
              {
                type: "talk",
                id: "item-1",
                say: `欢迎学习${params.coursewareData.name}课程。本课程将围绕${params.theme}展开，适合${params.audience}学习。`,
                estimatedDuration: 30
              },
              {
                type: "scene.action",
                id: "item-2",
                say: "让我们先来看看整体模型结构",
                actions: [
                  { type: "camera.focus", target: { nodeKey: params.coursewareData.annotations[0]?.nodeKey || "Root" } }
                ],
                estimatedDuration: 45
              }
            ]
          }
        ]
      };
    }

    const response = await fetch(`${config.deepseekBaseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.deepseekApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const data: DeepSeekResponse = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in DeepSeek response');
    }

    // 尝试解析JSON
    try {
      return JSON.parse(content);
    } catch (parseError) {
      // 如果直接解析失败，尝试提取JSON部分
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Failed to parse JSON from DeepSeek response');
    }
  } catch (error) {
    console.error('DeepSeek API error:', error);
    throw error;
  }
}

// 秘塔图片搜索
export interface MetasoImageResult {
  url: string;
  title: string;
  source: string;
  license?: string;
  size?: { width: number; height: number };
}

export async function searchImagesWithMetaso(keywords: string): Promise<MetasoImageResult[]> {
  try {
    // 使用秘塔官方API进行图片搜索
    const response = await fetch(`${config.metasoBaseUrl}/api/v1/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.metasoApiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: keywords,
        scope: 'image',
        size: 10,
        includeSummary: true,
        conciseSnippet: true
      })
    });

    if (!response.ok) {
      console.warn(`Metaso API error: ${response.status} ${response.statusText}`);
      // 如果API不可用，返回模拟数据
      return [
        {
          url: `https://via.placeholder.com/800x600?text=${encodeURIComponent(keywords)}`,
          title: `${keywords} - 示例图片`,
          source: 'placeholder.com',
          license: 'CC BY 4.0',
          size: { width: 800, height: 600 }
        }
      ];
    }

    const data = await response.json();
    
    // 转换秘塔API返回格式为我们的标准格式
    if (data.images && Array.isArray(data.images)) {
      return data.images.map((img: any) => ({
        url: img.imageUrl,
        title: img.title || '无标题',
        source: extractDomain(img.imageUrl),
        license: 'Unknown', // 秘塔API没有提供版权信息，标记为未知
        size: {
          width: img.imageWidth || 0,
          height: img.imageHeight || 0
        },
        position: img.position,
        score: img.score
      }));
    }

    return [];
  } catch (error) {
    console.error('Metaso search error:', error);
    // 返回占位图片
    return [
      {
        url: `https://via.placeholder.com/800x600?text=${encodeURIComponent(keywords)}`,
        title: `${keywords} - 占位图片`,
        source: 'placeholder.com',
        license: 'CC BY 4.0',
        size: { width: 800, height: 600 }
      }
    ];
  }
}

// 辅助函数：从URL提取域名
function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

// Minimax TTS 接口
export interface MinimaxTTSParams {
  text: string;
  voice_setting: {
    voice_id: string;
    speed?: number;
    vol?: number;
    pitch?: number;
  };
  audio_setting?: {
    sample_rate?: number;
    bitrate?: number;
    format?: string;
    channel?: number;
  };
  model?: string;
}

export interface MinimaxTTSResult {
  task_id?: string;
  file_id?: number;
  task_token?: string;
  usage_characters?: number;
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export interface MinimaxTTSQueryResult {
  task_id?: string;
  status?: string;
  file_id?: number;
  base_resp?: {
    status_code?: number;
    status_msg?: string;
  };
}

export async function generateTTSWithMinimax(params: MinimaxTTSParams): Promise<MinimaxTTSResult> {
  try {
    if (!config.minimaxApiKey || config.minimaxApiKey === '') {
      console.warn('Minimax API Key not configured, returning mock data');
      return {
        task_id: 'mock_task_' + Date.now(),
        file_id: Date.now(),
        task_token: 'mock_token',
        usage_characters: params.text.length,
        base_resp: {
          status_code: 0,
          status_msg: 'success'
        }
      };
    }

    const response = await fetch(`${config.minimaxBaseUrl}/v1/t2a_async_v2`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.minimaxApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: params.model || 'speech-01-turbo',
        text: params.text,
        voice_setting: {
          voice_id: params.voice_setting.voice_id,
          speed: params.voice_setting.speed || 1.0,
          vol: params.voice_setting.vol || 1.0,
          pitch: params.voice_setting.pitch || 0
        },
        audio_setting: {
          sample_rate: params.audio_setting?.sample_rate || 32000,
          bitrate: params.audio_setting?.bitrate || 128000,
          format: params.audio_setting?.format || 'mp3',
          channel: params.audio_setting?.channel || 2
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Minimax TTS API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (e) {
        // 如果不是JSON格式，使用原始错误信息
      }
      
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Minimax TTS error:', error);
    throw error;
  }
}

// 查询TTS任务状态
export async function queryTTSStatus(taskId: string): Promise<MinimaxTTSQueryResult> {
  try {
    if (!config.minimaxApiKey || config.minimaxApiKey === '') {
      console.warn('Minimax API Key not configured, returning mock data');
      return {
        task_id: taskId,
        status: 'Success',
        file_id: Date.now(),
        base_resp: {
          status_code: 0,
          status_msg: 'success'
        }
      };
    }

    const response = await fetch(
      `${config.minimaxBaseUrl}/v1/query/t2a_async_query_v2?task_id=${taskId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.minimaxApiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Minimax TTS Query API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (e) {
        // 如果不是JSON格式，使用原始错误信息
      }
      
      throw new Error(errorMsg);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Minimax TTS query error:', error);
    throw error;
  }
}

// 获取文件下载URL
export async function getFileDownloadUrl(fileId: number): Promise<string | null> {
  try {
    if (!config.minimaxApiKey || config.minimaxApiKey === '') {
      console.warn('Minimax API Key not configured, returning mock URL');
      return `https://www.soundjay.com/misc/sounds/bell-ringing-05.wav`;
    }

    const response = await fetch(
      `${config.minimaxBaseUrl}/v1/files/retrieve?file_id=${fileId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.minimaxApiKey}`
        }
      }
    );

    if (!response.ok) {
      console.error(`Failed to get file download URL: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data.file?.download_url || null;
  } catch (error) {
    console.error('Get file download URL error:', error);
    return null;
  }
}

// Azure TTS 接口
export interface AzureTTSParams {
  text: string;
  voiceName: string; // 如 'zh-CN-XiaoxiaoNeural'
  language?: string; // 如 'zh-CN'
  rate?: string; // 如 '+0%', '-20%', '+50%'
  pitch?: string; // 如 '+0Hz', '-50Hz', '+200Hz'
  style?: string; // 如 'gentle', 'cheerful'
  outputFormat?: string; // 如 'riff-16khz-16bit-mono-pcm'
}

export interface AzureTTSResult {
  success: boolean;
  audioData?: Buffer;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

export interface AzureVoice {
  Name: string;
  DisplayName: string;
  LocalName: string;
  ShortName: string;
  Gender: string;
  Locale: string;
  StyleList?: string[];
}

// Azure TTS 访问令牌缓存
let azureTokenCache: { token: string; expiry: number } | null = null;

// 获取Azure TTS访问令牌
async function getAzureAccessToken(): Promise<string> {
  // 检查缓存的令牌是否还有效（提前1分钟刷新）
  if (azureTokenCache && azureTokenCache.expiry > Date.now() + 60000) {
    return azureTokenCache.token;
  }

  if (!config.azureSpeechKey || !config.azureSpeechRegion) {
    throw new Error('Azure Speech Key and Region are required');
  }

  try {
    const response = await fetch(
      `https://${config.azureSpeechRegion}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': config.azureSpeechKey,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Azure access token: ${response.status} ${response.statusText}`);
    }

    const token = await response.text();
    
    // 缓存令牌（有效期10分钟）
    azureTokenCache = {
      token,
      expiry: Date.now() + (10 * 60 * 1000) // 10分钟
    };

    return token;
  } catch (error) {
    console.error('Azure access token error:', error);
    throw error;
  }
}

// 获取Azure TTS可用音色列表
export async function getAzureVoices(): Promise<AzureVoice[]> {
  try {
    if (!config.azureSpeechKey || !config.azureSpeechRegion) {
      console.warn('Azure Speech Key/Region not configured, returning mock voices');
      return [
        {
          Name: 'zh-CN-XiaoxiaoNeural',
          DisplayName: 'Xiaoxiao',
          LocalName: '晓晓',
          ShortName: 'zh-CN-XiaoxiaoNeural',
          Gender: 'Female',
          Locale: 'zh-CN',
          StyleList: ['general', 'assistant', 'chat', 'cheerful', 'gentle']
        },
        {
          Name: 'zh-CN-YunxiNeural',
          DisplayName: 'Yunxi',
          LocalName: '云希',
          ShortName: 'zh-CN-YunxiNeural',
          Gender: 'Male',
          Locale: 'zh-CN',
          StyleList: ['general', 'assistant', 'chat', 'cheerful']
        }
      ];
    }

    const response = await fetch(
      `https://${config.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/voices/list`,
      {
        headers: {
          'Ocp-Apim-Subscription-Key': config.azureSpeechKey
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get Azure voices: ${response.status} ${response.statusText}`);
    }

    const voices: AzureVoice[] = await response.json();
    // 只返回中文音色
    return voices.filter(voice => voice.Locale.startsWith('zh-'));
  } catch (error) {
    console.error('Azure voices error:', error);
    throw error;
  }
}

// Azure TTS 文本转语音（同步API）
export async function generateTTSWithAzure(params: AzureTTSParams): Promise<AzureTTSResult> {
  try {
    if (!config.azureSpeechKey || !config.azureSpeechRegion) {
      console.warn('Azure Speech Key/Region not configured, returning mock result');
      return {
        success: true,
        audioUrl: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav',
        duration: 5000
      };
    }

    const token = await getAzureAccessToken();
    
    // 构建SSML
    const ssml = `
    <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='${params.language || 'zh-CN'}'>
      <voice name='${params.voiceName}'>
        ${params.style && params.style !== 'general' ? `<mstts:express-as style='${params.style}'>` : ''}
        <prosody rate='${params.rate || '+0%'}' pitch='${params.pitch || '+0Hz'}'>
          ${params.text}
        </prosody>
        ${params.style && params.style !== 'general' ? '</mstts:express-as>' : ''}
      </voice>
    </speak>
    `.trim();

    const response = await fetch(
      `https://${config.azureSpeechRegion}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': params.outputFormat || 'audio-16khz-32kbitrate-mono-mp3',
          'User-Agent': 'CoursewareEditor'
        },
        body: ssml
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg = `Azure TTS API error: ${response.status} ${response.statusText}`;
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.message) {
          errorMsg = errorData.message;
        }
      } catch (e) {
        // 如果不是JSON格式，使用原始错误信息
      }
      
      throw new Error(errorMsg);
    }

    const audioData = Buffer.from(await response.arrayBuffer());
    
    // 这里可以选择直接返回音频数据，或者保存到临时文件并返回URL
    // 为了简化，我们返回base64编码的data URL
    const base64Audio = audioData.toString('base64');
    const mimeType = params.outputFormat?.includes('mp3') ? 'audio/mpeg' : 'audio/wav';
    const audioUrl = `data:${mimeType};base64,${base64Audio}`;

    return {
      success: true,
      audioData,
      audioUrl,
      duration: estimateAudioDuration(params.text) // 简单估算时长
    };
  } catch (error) {
    console.error('Azure TTS error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// 简单估算音频时长（基于文字长度，中文平均每分钟300字）
function estimateAudioDuration(text: string): number {
  const charactersPerMinute = 300;
  const characters = text.length;
  const minutes = characters / charactersPerMinute;
  return Math.ceil(minutes * 60 * 1000); // 返回毫秒
}

// 保存音频到NAS并返回公开URL
export async function saveAudioToNAS(
  audioData: Buffer, 
  filename: string, 
  userId: string,
  mimeType: string = 'audio/wav'
): Promise<{ fileId: string; publicUrl: string; storageRelPath: string }> {
  try {
    // 生成文件哈希
    const sha256 = crypto.createHash('sha256').update(audioData).digest('hex');
    
    // 构建存储路径: tts/用户ID/年月/哈希值.wav
    const now = new Date();
    const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    const ext = path.extname(filename) || '.wav';
    const relDir = `tts/${userId}/${yearMonth}`;
    const storageFilename = `${sha256}${ext}`;
    const storageRelPath = `${relDir}/${storageFilename}`;

    // 确保目录存在
    const targetDir = path.join(config.storageRoot, relDir);
    fs.mkdirSync(targetDir, { recursive: true });
    
    // 保存文件
    const finalPath = path.join(config.storageRoot, storageRelPath);
    fs.writeFileSync(finalPath, audioData);

    // 保存到File模型
    const fileRecord = await FileModel.create({
      ownerUserId: new Types.ObjectId(userId),
      ownerRole: 'teacher', // 假设TTS文件都是教师创建的
      visibility: 'public', // TTS文件设为公开，便于课程播放
      type: 'other', // 或者我们可以添加新的类型'audio'
      originalName: filename,
      originalNameSaved: storageFilename,
      ext: ext,
      size: audioData.length,
      sha256: sha256,
      storageRelPath: storageRelPath.replace(/\\/g, '/'),
      storageDir: relDir.replace(/\\/g, '/'),
    } as any);

    // 构建公开URL
    const publicUrl = config.publicDownloadBase 
      ? `${config.publicDownloadBase.replace(/\/$/, '')}/${storageRelPath.replace(/\\/g, '/')}`
      : `/api/files/${fileRecord._id}/download`;

    return {
      fileId: (fileRecord._id as any).toString(),
      publicUrl,
      storageRelPath: storageRelPath.replace(/\\/g, '/')
    };
  } catch (error) {
    console.error('Save audio to NAS error:', error);
    throw error;
  }
}

// 批量生成TTS并保存到NAS
export async function batchGenerateTTSForCourse(
  courseOutline: any[],
  userId: string,
  ttsConfig: {
    provider: 'azure' | 'minimax';
    voiceName?: string;
    voice_id?: string;
    speed?: number;
    rate?: string;
    language?: string;
  }
): Promise<{ [itemKey: string]: { audioUrl: string; duration: number; fileId: string } }> {
  const results: { [itemKey: string]: { audioUrl: string; duration: number; fileId: string } } = {};
  
  try {
    for (let segmentIndex = 0; segmentIndex < courseOutline.length; segmentIndex++) {
      const segment = courseOutline[segmentIndex];
      if (!segment.items) continue;

      for (let itemIndex = 0; itemIndex < segment.items.length; itemIndex++) {
        const item = segment.items[itemIndex];
        console.log(`检查步骤 ${segmentIndex}-${itemIndex}:`, {
          type: item.type,
          say: item.say?.substring(0, 50) + '...',
          hasAudio: !!item.say?.trim()
        });
        
        if (!item.say?.trim()) {
          console.log(`跳过步骤 ${segmentIndex}-${itemIndex}: 没有配音文本`);
          continue;
        }

        const itemKey = `${segmentIndex}-${itemIndex}`;
        const text = item.say.trim();
        
        try {
          console.log(`生成TTS: ${itemKey} - ${text.substring(0, 50)}...`);
          
          let audioData: Buffer | null = null;
          let duration = 0;

          if (ttsConfig.provider === 'azure') {
            const result = await generateTTSWithAzure({
              text,
              voiceName: ttsConfig.voiceName || 'zh-CN-XiaoxiaoNeural',
              language: ttsConfig.language || 'zh-CN',
              rate: ttsConfig.rate || '+0%'
            });

            if (result.success && result.audioData) {
              audioData = result.audioData;
              duration = result.duration || estimateAudioDuration(text);
            }
          } else if (ttsConfig.provider === 'minimax') {
            // Minimax是异步的，需要等待完成
            const generateResult = await generateTTSWithMinimax({
              text,
              voice_setting: {
                voice_id: ttsConfig.voice_id || 'female-shaonv',
                speed: ttsConfig.speed || 1.0
              }
            });

            if (generateResult.base_resp?.status_code === 0 && generateResult.task_id) {
              // 轮询等待完成
              let attempts = 0;
              const maxAttempts = 30; // 最多等待5分钟
              
              while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒
                
                const statusResult = await queryTTSStatus(generateResult.task_id);
                if (statusResult.status === 'Success' && statusResult.file_id) {
                  const downloadUrl = await getFileDownloadUrl(statusResult.file_id);
                  if (downloadUrl) {
                    // 下载音频数据
                    const response = await fetch(downloadUrl);
                    if (response.ok) {
                      audioData = Buffer.from(await response.arrayBuffer());
                      duration = estimateAudioDuration(text);
                    }
                  }
                  break;
                } else if (statusResult.status === 'Failed') {
                  throw new Error('Minimax TTS generation failed');
                }
                attempts++;
              }
            }
          }

          if (audioData) {
            // 保存到NAS
            const filename = `course_${itemKey}_${Date.now()}.wav`;
            const saveResult = await saveAudioToNAS(audioData, filename, userId, 'audio/wav');
            
            results[itemKey] = {
              audioUrl: saveResult.publicUrl,
              duration: duration,
              fileId: saveResult.fileId
            };
            
            console.log(`TTS保存成功: ${itemKey} -> ${saveResult.publicUrl}`);
          } else {
            console.warn(`TTS生成失败: ${itemKey}`);
          }
        } catch (error) {
          console.error(`TTS生成错误 ${itemKey}:`, error);
          // 继续处理下一个
        }
      }
    }
  } catch (error) {
    console.error('Batch TTS generation error:', error);
  }

  return results;
}
