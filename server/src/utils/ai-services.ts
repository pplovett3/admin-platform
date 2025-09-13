import { config } from '../config/env';

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
            {"type": "annotation.show", "ids": ["实际存在的标注ID"]}
          ],
          "estimatedDuration": 45
        }
      ]
    }
  ]
}

注意：
- 确保所有引用的nodeKey都来自提供的标注列表
- 动画播放要指定具体的animationId
- 每个段落预估时长，总时长控制在目标范围内`;

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
