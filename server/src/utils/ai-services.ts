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
    // 注意：这里需要根据秘塔的实际API文档调整
    // 如果没有官方API，可能需要使用爬虫或其他方式
    const response = await fetch(`${config.metasoBaseUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.metasoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: keywords,
        type: 'image',
        limit: 10
      })
    });

    if (!response.ok) {
      // 如果API不可用，返回模拟数据
      console.warn('Metaso API not available, returning mock data');
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
    return data.images || [];
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
