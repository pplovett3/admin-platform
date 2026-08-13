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
    finish_reason?: string;
  }>;
}

/**
 * 健壮的 AI JSON 响应解析器
 * 处理：markdown 代码块包裹、前后多余文本、JSON 被截断（补全括号）
 */
function parseAIJsonResponse(content: string): any {
  let text = content.trim();

  // 1. 去除 markdown 代码块标记 ```json ... ``` 或 ``` ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  // 2. 尝试直接解析
  try {
    return JSON.parse(text);
  } catch { /* continue */ }

  // 3. 提取最外层 { ... } 或 [ ... ]
  const objMatch = text.match(/\{[\s\S]*\}/);
  const arrMatch = text.match(/\[[\s\S]*\]/);
  // 优先选择先出现的那个
  const candidates: string[] = [];
  if (objMatch) candidates.push(objMatch[0]);
  if (arrMatch) candidates.push(arrMatch[0]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch { /* continue */ }
  }

  // 4. JSON 可能被截断 — 尝试补全缺失的闭合括号
  const raw = candidates[0] || text;
  const repaired = repairTruncatedJson(raw);
  try {
    return JSON.parse(repaired);
  } catch { /* continue */ }

  // 5. 最后一次尝试：从 raw 中逐步截断尾部不完整部分再补全
  const lastObj = raw.lastIndexOf('{') >= 0 ? raw.slice(0, raw.lastIndexOf('{')) : raw;
  const repaired2 = repairTruncatedJson(lastObj);
  try {
    return JSON.parse(repaired2);
  } catch (e) {
    throw new Error(`JSON解析失败（内容长度${content.length}，可能被截断）: ${(e as Error).message}`);
  }
}

/** 统计字符串中未闭合的 { 和 [ 数量，在末尾补上对应的闭合符号 */
function repairTruncatedJson(jsonStr: string): string {
  let inString = false;
  let escape = false;
  let braceDepth = 0;   // { 计数
  let bracketDepth = 0; // [ 计数

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
  }

  let repaired = jsonStr;
  // 如果在字符串中被截断，先闭合字符串
  if (inString) repaired += '"';
  // 补全括号（注意顺序：先 ] 后 }，因为 JSON 中数组通常在对象内）
  for (let i = 0; i < Math.max(0, bracketDepth); i++) repaired += ']';
  for (let i = 0; i < Math.max(0, braceDepth); i++) repaired += '}';
  return repaired;
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

// 考题生成参数
export interface QuestionGenerationParams {
  coursewareData: CoursewareData;
  outline: any[];           // 课程大纲
  questionCount: number;    // 题目数量
  theoryRatio: number;      // 理论题比例 (0-1)
  language?: string;
}

// 生成的考题结果
export interface GeneratedQuestion {
  id: string;
  type: 'theory' | 'interactive';
  question: string;
  options: { key: string; text: string }[];
  answer: string;
  explanation?: string;
  highlightNodeKey?: string;
  relatedOutlineItemId?: string;
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
    // 如果没有配置豆包 API Key，返回模拟数据
    if (!config.doubaoApiKey || config.doubaoApiKey === '') {
      console.warn('Doubao API Key not configured, returning mock course data');
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

    // 使用豆包（OpenAI 兼容）替代 DeepSeek，统一计费
    const response = await fetch(`${config.doubaoBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.doubaoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.doubaoModelId, thinking: { type: config.doubaoThinking },
        messages,
        temperature: 0.7,
        max_tokens: 16000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('豆包API错误(generateCourse):', response.status, errorText);
      throw new Error(`豆包API错误: ${response.status} ${response.statusText}`);
    }

    const data: DeepSeekResponse = await response.json();
    const content = data.choices[0]?.message?.content;
    const finishReason = data.choices[0]?.finish_reason;
    
    if (!content) {
      throw new Error('豆包返回内容为空');
    }

    console.log(`[生成大纲] 返回长度: ${content.length}, finish_reason: ${finishReason}`);

    // 使用健壮的 JSON 解析器（处理 markdown 包裹、截断等）
    try {
      return parseAIJsonResponse(content);
    } catch (parseError) {
      console.error('大纲JSON解析失败，原始内容前500字:', content.substring(0, 500));
      console.error('大纲JSON解析失败，原始内容后500字:', content.substring(content.length - 500));
      throw new Error(`AI大纲JSON解析失败: ${(parseError as Error).message}`);
    }
  } catch (error) {
    console.error('豆包API错误(generateCourse):', error);
    throw error;
  }
}

// DeepSeek 考题生成
export async function generateQuestionsWithDeepSeek(params: QuestionGenerationParams): Promise<GeneratedQuestion[]> {
  const theoryCount = Math.round(params.questionCount * params.theoryRatio);
  const interactiveCount = params.questionCount - theoryCount;

  const systemPrompt = `你是一个专业的工业/机械设备教学考试出题专家。基于提供的三维课件和课程大纲，设计选择题。

## 输入信息：
- 课件名称：${params.coursewareData.name}
- 课件描述：${params.coursewareData.description}
- 模型标注列表：${JSON.stringify(params.coursewareData.annotations, null, 2)}
- 课程大纲：${JSON.stringify(params.outline, null, 2)}

## 出题要求：
请生成 ${params.questionCount} 道选择题，包含：
1. **理论知识题** ${theoryCount} 道：考察学员对课程内容的理解，包括概念、原理、功能、作用等
2. **互动识别题** ${interactiveCount} 道：通过高亮模型中的某个部件，让学员识别该部件的名称或作用

## 题目设计原则：
- 每道题4个选项（A/B/C/D），只有一个正确答案
- 选项设计要有迷惑性但不能太离谱
- 理论题要紧扣课程大纲内容
- 互动题的 highlightNodeKey 必须来自标注列表中的 nodeKey
- 每道题提供简短解析

## 输出格式：
返回纯JSON数组，不要包含markdown代码块标记：
[
  {
    "id": "q-1",
    "type": "theory",
    "question": "关于XXX的描述，以下哪项是正确的？",
    "options": [
      {"key": "A", "text": "选项A内容"},
      {"key": "B", "text": "选项B内容"},
      {"key": "C", "text": "选项C内容"},
      {"key": "D", "text": "选项D内容"}
    ],
    "answer": "A",
    "explanation": "解析：...",
    "relatedOutlineItemId": "item-1"
  },
  {
    "id": "q-2",
    "type": "interactive",
    "question": "请观察模型中高亮显示的部件，这是什么？",
    "options": [
      {"key": "A", "text": "XXX"},
      {"key": "B", "text": "YYY"},
      {"key": "C", "text": "ZZZ"},
      {"key": "D", "text": "WWW"}
    ],
    "answer": "B",
    "explanation": "解析：该部件是YYY，主要功能是...",
    "highlightNodeKey": "标注列表中存在的nodeKey"
  }
]

注意：
- 互动题的 highlightNodeKey 必须是标注列表中真实存在的 nodeKey
- 题目难度适中，符合课程目标受众水平
- 题目内容要准确，不能有知识性错误`;

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: '请基于上述信息生成考题JSON数组。' }
  ];

  try {
    // 如果没有配置豆包 API Key，返回模拟数据
    if (!config.doubaoApiKey || config.doubaoApiKey === '') {
      console.warn('Doubao API Key not configured, returning mock questions');
      const mockQuestions: GeneratedQuestion[] = [];
      
      // 生成模拟理论题
      for (let i = 0; i < theoryCount; i++) {
        mockQuestions.push({
          id: `q-theory-${i + 1}`,
          type: 'theory',
          question: `关于${params.coursewareData.name}的以下描述，哪项是正确的？`,
          options: [
            { key: 'A', text: '这是一个正确的描述' },
            { key: 'B', text: '这是一个错误的描述' },
            { key: 'C', text: '这也是一个错误的描述' },
            { key: 'D', text: '这还是一个错误的描述' }
          ],
          answer: 'A',
          explanation: '正确答案是A，因为...',
          relatedOutlineItemId: params.outline[0]?.items?.[0]?.id
        });
      }
      
      // 生成模拟互动题
      for (let i = 0; i < interactiveCount; i++) {
        const annotation = params.coursewareData.annotations[i % params.coursewareData.annotations.length];
        mockQuestions.push({
          id: `q-interactive-${i + 1}`,
          type: 'interactive',
          question: '请观察模型中高亮显示的部件，这是什么？',
          options: [
            { key: 'A', text: annotation?.title || '部件A' },
            { key: 'B', text: '其他部件B' },
            { key: 'C', text: '其他部件C' },
            { key: 'D', text: '其他部件D' }
          ],
          answer: 'A',
          explanation: `这是${annotation?.title || '该部件'}，${annotation?.description || '具有重要功能'}`,
          highlightNodeKey: annotation?.nodeKey || ''
        });
      }
      
      return mockQuestions;
    }

    // 使用豆包（OpenAI 兼容）替代 DeepSeek，统一计费
    const response = await fetch(`${config.doubaoBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.doubaoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.doubaoModelId, thinking: { type: config.doubaoThinking },
        messages,
        temperature: 0.7,
        max_tokens: 8000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('豆包API错误(generateQuestions):', response.status, errorText);
      throw new Error(`豆包API错误: ${response.status} ${response.statusText}`);
    }

    const data: DeepSeekResponse = await response.json();
    const content = data.choices[0]?.message?.content;
    const finishReason = data.choices[0]?.finish_reason;
    
    if (!content) {
      throw new Error('豆包返回内容为空');
    }

    console.log(`[生成题目] 返回长度: ${content.length}, finish_reason: ${finishReason}`);

    // 使用健壮的 JSON 解析器
    try {
      const parsed = parseAIJsonResponse(content);
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed.questions;
      }
      throw new Error('Invalid response format: 期望数组或 {questions: [...]}');
    } catch (parseError) {
      console.error('题目JSON解析失败，原始内容前500字:', content.substring(0, 500));
      console.error('题目JSON解析失败，原始内容后500字:', content.substring(content.length - 500));
      throw new Error(`AI题目JSON解析失败: ${(parseError as Error).message}`);
    }
  } catch (error) {
    console.error('豆包API错误(generateQuestions):', error);
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

/** AI 文生图结果 */
export interface DoubaoImageResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * 使用豆包 Seedream 模型生成图片
 * @param prompt 文生图提示词
 * @param size 图片尺寸，默认 2048x2048（Seedream 5.0 要求最小约 3686400 像素）
 */
export async function generateImageWithDoubao(prompt: string, size: string = '2048x2048'): Promise<DoubaoImageResult> {
  if (!config.doubaoApiKey) {
    return { success: false, error: '豆包 API Key 未配置' };
  }

  try {
    const response = await fetch(`${config.doubaoBaseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.doubaoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.doubaoImageModelId,
        prompt,
        size
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('豆包图片生成错误:', response.status, errorText);
      let errorMsg = `豆包图片生成失败: ${response.status}`;
      try {
        const err = JSON.parse(errorText);
        if (err.error?.message) errorMsg = err.error.message;
      } catch { /* ignore */ }
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    const imageUrl = data.data?.[0]?.url;
    if (!imageUrl) {
      return { success: false, error: '豆包返回图片URL为空' };
    }

    return { success: true, url: imageUrl };
  } catch (error: any) {
    console.error('豆包图片生成异常:', error);
    return { success: false, error: error.message || '图片生成异常' };
  }
}

/**
 * 使用豆包大模型将课程大纲中的图片描述转化为文生图提示词
 * @param context 课程上下文信息（课件名、段落标题、讲解词、图片关键词等）
 */
export async function generateImagePromptWithDoubao(context: {
  coursewareName?: string;
  segmentTitle?: string;
  say?: string;
  imageKeywords?: string;
}): Promise<{ success: boolean; prompt?: string; error?: string }> {
  if (!config.doubaoApiKey) {
    return { success: false, error: '豆包 API Key 未配置' };
  }

  const userContent = `请根据以下课程信息，生成一段用于AI文生图的英文提示词（prompt）。

课程名称：${context.coursewareName || '未知'}
段落标题：${context.segmentTitle || '未知'}
讲解词：${context.say || '无'}
图片关键词：${context.imageKeywords || '无'}

要求：
1. 提示词用英文编写，适合 Seedream 文生图模型
2. 描述要具体、画面感强，包含主体、场景、光线、风格等要素
3. 风格偏向教学/科普插图，专业清晰
4. 只返回提示词文本，不要其他内容，不要引号`;

  try {
    const response = await fetch(`${config.doubaoBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.doubaoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.doubaoModelId, thinking: { type: config.doubaoThinking },
        messages: [{ role: 'user', content: userContent }],
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('豆包提示词生成错误:', response.status, errorText);
      return { success: false, error: `提示词生成失败: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    if (!content) {
      return { success: false, error: '提示词生成返回为空' };
    }

    // 清理可能的引号和换行
    let prompt = content.trim();
    if ((prompt.startsWith('"') && prompt.endsWith('"')) ||
        (prompt.startsWith("'") && prompt.endsWith("'"))) {
      prompt = prompt.slice(1, -1);
    }
    prompt = prompt.replace(/\n/g, ' ').trim();

    return { success: true, prompt };
  } catch (error: any) {
    console.error('豆包提示词生成异常:', error);
    return { success: false, error: error.message || '提示词生成异常' };
  }
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

// 豆包语音合成（Doubao-语音合成-2.0）接口
export interface DoubaoTTSParams {
  text: string;
  speaker: string;          // 音色ID，如 'zh_female_xiaohe_uranus_bigtts'
  speedRatio?: number;      // 语速 0.2-3.0，默认 1.0
  format?: 'mp3' | 'wav' | 'pcm' | 'ogg_opus';
  sampleRate?: number;      // 采样率，默认 24000
}

export interface DoubaoTTSResult {
  success: boolean;
  audioData?: Buffer;
  audioUrl?: string;
  duration?: number;
  error?: string;
}

// 豆包语音合成 2.0 官方音色列表（resource_id: seed-tts-2.0，uranus 系列）
export const DOUBAO_TTS_VOICES = [
  { id: 'zh_female_xiaohe_uranus_bigtts', name: '小何 2.0', gender: 'female', locale: 'zh-CN', desc: '通用女声，自然亲切' },
  { id: 'zh_female_vv_uranus_bigtts', name: 'Vivi 2.0', gender: 'female', locale: 'zh-CN', desc: '多语种女声，情感丰富' },
  { id: 'zh_female_qingxinnvsheng_uranus_bigtts', name: '清新女声 2.0', gender: 'female', locale: 'zh-CN', desc: '清新淡雅女声' },
  { id: 'zh_female_tianmei_uranus_bigtts', name: '甜美女声 2.0', gender: 'female', locale: 'zh-CN', desc: '甜美女声' },
  { id: 'zh_male_m191_uranus_bigtts', name: '云舟 2.0', gender: 'male', locale: 'zh-CN', desc: '通用男声' },
  { id: 'zh_male_taocheng_uranus_bigtts', name: '小天 2.0', gender: 'male', locale: 'zh-CN', desc: '通用男声，年轻' },
  { id: 'zh_male_liufei_uranus_bigtts', name: '刘飞 2.0', gender: 'male', locale: 'zh-CN', desc: '通用男声' },
  { id: 'zh_male_sophie_uranus_bigtts', name: '魅力苏菲 2.0', gender: 'male', locale: 'zh-CN', desc: '通用男声' }
];

/**
 * 豆包语音合成-2.0（火山引擎语音服务 V3 单向流式接口）
 * 端点：https://openspeech.bytedance.com/api/v3/tts/unidirectional
 * 鉴权需在火山引擎"豆包语音"控制台开通并获取 AppID + Access Key
 */
export async function generateTTSWithDoubao(params: DoubaoTTSParams): Promise<DoubaoTTSResult> {
  try {
    if (!config.doubaoTtsAppId || !config.doubaoTtsAccessKey) {
      console.warn('豆包TTS未配置（DOUBAO_TTS_APP_ID / DOUBAO_TTS_ACCESS_KEY），跳过配音生成');
      return {
        success: false,
        error: '豆包TTS未配置：缺少 DOUBAO_TTS_APP_ID 或 DOUBAO_TTS_ACCESS_KEY。请在火山引擎“豆包语音”控制台开通，并写入服务器 .env；或发布时改用已配置的 Azure TTS。'
      };
    }

    const requestId = crypto.randomUUID();
    const format = params.format || 'mp3';
    const sampleRate = params.sampleRate || 24000;

    // V3 unidirectional 接口：req_params 格式 + 顶层 user 字段
    // 鉴权用 X-Api-App-Id + X-Api-Access-Key + X-Api-Resource-Id
    const response = await fetch(`${config.doubaoTtsBaseUrl}/api/v3/tts/unidirectional`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-App-Id': config.doubaoTtsAppId,
        'X-Api-Access-Key': config.doubaoTtsAccessKey,
        'X-Api-Resource-Id': config.doubaoTtsResourceId,
        'X-Api-Request-Id': requestId
      },
      body: JSON.stringify({
        user: { uid: 'admin-platform' },
        req_params: {
          text: params.text,
          speaker: params.speaker,
          audio_params: {
            format,
            sample_rate: sampleRate
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('豆包TTS API错误:', response.status, errorText);
      throw new Error(`豆包TTS API错误: ${response.status} ${response.statusText}`);
    }

    // V3 单向流式接口返回连续 JSON 对象拼接（无换行分隔）
    // 需要增量解析：跟踪括号深度在深度为 0 时分割出完整 JSON 对象
    const responseText = await response.text();
    const base64Chunks: string[] = [];

    const parseJsonObjects = (text: string): any[] => {
      const objects: any[] = [];
      let depth = 0;
      let inString = false;
      let escape = false;
      let start = -1;

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (char === '{') {
          if (depth === 0) start = i;
          depth++;
        } else if (char === '}') {
          depth--;
          if (depth === 0 && start >= 0) {
            const jsonStr = text.slice(start, i + 1);
            try {
              objects.push(JSON.parse(jsonStr));
            } catch {
              // 跳过无法解析的片段
            }
            start = -1;
          }
        }
      }
      return objects;
    };

    const chunks = parseJsonObjects(responseText);
    for (const chunk of chunks) {
      // V3 接口：数据帧 code=0，终止帧 code=20000000；其他为错误
      if (chunk.code !== undefined && chunk.code !== 0 && chunk.code !== 20000000) {
        console.error('豆包TTS返回错误码:', chunk.code, chunk.message);
        throw new Error(`豆包TTS合成失败: ${chunk.message || chunk.code}`);
      }
      if (chunk.data) {
        base64Chunks.push(chunk.data);
      }
    }

    if (base64Chunks.length === 0) {
      throw new Error('豆包TTS返回音频数据为空');
    }

    const audioData = Buffer.from(base64Chunks.join(''), 'base64');
    const mimeType = format === 'wav' ? 'audio/wav' : format === 'ogg_opus' ? 'audio/ogg' : 'audio/mpeg';

    return {
      success: true,
      audioData,
      audioUrl: `data:${mimeType};base64,${audioData.toString('base64')}`,
      duration: estimateAudioDuration(params.text)
    };
  } catch (error) {
    console.error('豆包TTS错误:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
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

// Azure TTS 推荐的Unity兼容格式
export const AZURE_TTS_FORMATS = {
  // MP3格式 - 文件小，广泛兼容
  'mp3-standard': 'audio-24khz-48kbitrate-mono-mp3',
  'mp3-high': 'audio-24khz-96kbitrate-mono-mp3',
  'mp3-stereo': 'audio-24khz-48kbitrate-stereo-mp3',
  
  // WAV格式 - 无损，Unity最佳兼容
  'wav-mono': 'riff-24khz-16bit-mono-pcm',
  'wav-stereo': 'riff-24khz-16bit-stereo-pcm',
  
  // 高质量格式
  'wav-high': 'riff-48khz-16bit-mono-pcm',
  
  // 旧格式（不推荐）
  'mp3-low': 'audio-16khz-32kbitrate-mono-mp3'
} as const;

// Azure TTS 文本转语音（同步API）
export async function generateTTSWithAzure(params: AzureTTSParams): Promise<AzureTTSResult> {
  try {
    if (!config.azureSpeechKey || !config.azureSpeechRegion) {
      console.warn('Azure Speech Key/Region not configured, skip TTS');
      return {
        success: false,
        error: 'Azure TTS未配置：缺少 AZURE_SPEECH_KEY 或 AZURE_SPEECH_REGION。请在服务器 .env 配置后重试。'
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
          'X-Microsoft-OutputFormat': params.outputFormat || AZURE_TTS_FORMATS['mp3-standard'],
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
    provider: 'azure' | 'minimax' | 'doubao';
    voiceName?: string;
    voice_id?: string;
    speaker?: string;       // 豆包TTS音色ID
    speed?: number;
    speedRatio?: number;    // 豆包TTS语速
    rate?: string;
    language?: string;
  }
): Promise<{ results: { [itemKey: string]: { audioUrl: string; duration: number; fileId: string } }; error: string }> {
  const results: { [itemKey: string]: { audioUrl: string; duration: number; fileId: string } } = {};
  let firstTtsError = '';
  
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
        
        // 检查所有有配音文本的步骤，不限制类型
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
              rate: ttsConfig.rate || '+0%',
              outputFormat: AZURE_TTS_FORMATS['wav-mono'] // 使用WAV格式确保Unity兼容性
            });

            if (result.success && result.audioData) {
              audioData = result.audioData;
              duration = result.duration || estimateAudioDuration(text);
            } else if (!result.success) {
              if (!firstTtsError) firstTtsError = result.error || 'Azure TTS生成失败';
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
          } else if (ttsConfig.provider === 'doubao') {
            // 豆包语音合成-2.0（同步流式，返回音频Buffer）
            const doubaoResult = await generateTTSWithDoubao({
              text,
              speaker: ttsConfig.speaker || ttsConfig.voice_id || 'zh_female_xiaohe_uranus_bigtts',
              speedRatio: ttsConfig.speedRatio ?? ttsConfig.speed ?? 1.0,
              format: 'mp3'
            });

            if (doubaoResult.success && doubaoResult.audioData) {
              audioData = doubaoResult.audioData;
              duration = doubaoResult.duration || estimateAudioDuration(text);
            } else if (!doubaoResult.success) {
              if (!firstTtsError) firstTtsError = doubaoResult.error || '豆包TTS生成失败';
            }
          }

          if (audioData) {
            // 保存到NAS
            const filename = `course_${itemKey}_${Date.now()}.mp3`;
            const saveResult = await saveAudioToNAS(audioData, filename, userId, 'audio/wav');
            
            results[itemKey] = {
              audioUrl: saveResult.publicUrl,
              duration: duration,
              fileId: saveResult.fileId
            };
            
            console.log(`TTS保存成功: ${itemKey} -> ${saveResult.publicUrl}`);
          } else {
            console.warn(`TTS生成失败: ${itemKey}`);
            if (!firstTtsError) firstTtsError = 'TTS生成失败：未返回音频数据';
          }
        } catch (error) {
          console.error(`TTS生成错误 ${itemKey}:`, error);
          if (!firstTtsError) firstTtsError = error instanceof Error ? error.message : String(error);
          // 继续处理下一个
        }
      }
    }
  } catch (error) {
    console.error('Batch TTS generation error:', error);
    if (!firstTtsError) firstTtsError = error instanceof Error ? error.message : String(error);
  }

  return { results, error: firstTtsError };
}

// ==========================================
// 通义千问VL多模态服务（用于AI智能标注整理）
// ==========================================

// 模型结构节点接口
export interface ModelStructureNode {
  path: string;
  original_name: string;
  children?: ModelStructureNode[];
}

// AI整理后的节点接口
export interface OrganizedNode {
  original_path?: string;
  new_name: string;
  children?: OrganizedNode[];
}

// 部件图片数据接口
export interface PartImageData {
  path: string;
  imageBase64: string; // 位置图（含整体上下文、蓝色高亮）
  focusImageBase64?: string; // 聚焦隔离图（只显示该对象/更易识别）
}

// 整理请求参数
export interface OrganizeStructureParams {
  structureData: {
    tree: ModelStructureNode[];
  };
  globalImageBase64: string;
  partImages: PartImageData[];
}

// 整理结果接口
export interface OrganizeStructureResult {
  nodes: OrganizedNode[];
}

// 单对象识别请求参数
export interface IdentifySinglePartParams {
  path: string;
  imageBase64: string; // 位置图
  focusImageBase64?: string; // 聚焦图
  coursewareName?: string; // 课件名称（帮助AI理解上下文）
}

// 单对象识别结果
export interface IdentifySinglePartResult {
  path: string;
  new_name: string;
  confidence?: string; // 识别置信度描述
}

/**
 * 使用豆包Seed 1.6识别单个部件
 * 每次只识别一个对象，减少上下文干扰，提高识别准确率
 */
export async function identifySinglePartWithQwenVL(
  params: IdentifySinglePartParams
): Promise<IdentifySinglePartResult> {
  const { path, imageBase64, focusImageBase64, coursewareName } = params;

  // 构建提示词，如果有课件名称则加入上下文
  const contextHint = coursewareName 
    ? `这是一个【${coursewareName}】的3D模型。` 
    : '';
  const promptText = `${contextHint}图1是整体位置（蓝色边框标识目标），图2是该部件的隔离图。请识别这是什么部件，只返回JSON：{"new_name": "部件名称"}`;

  // 构建豆包API请求内容（OpenAI兼容格式）
  const userContent: any[] = [];

  // 图1：整体位置图（蓝色边框标识目标部件）
  userContent.push({
    type: 'image_url',
    image_url: {
      url: imageBase64.startsWith('data:') 
        ? imageBase64 
        : `data:image/png;base64,${imageBase64}`
    }
  });

  // 图2：部件隔离图（只显示目标部件）
  if (focusImageBase64) {
    userContent.push({
      type: 'image_url',
      image_url: {
        url: focusImageBase64.startsWith('data:') 
          ? focusImageBase64 
          : `data:image/png;base64,${focusImageBase64}`
      }
    });
  }

  userContent.push({
    type: 'text',
    text: promptText
  });

  try {
    // 优先使用豆包API（OpenAI兼容模式）
    if (config.doubaoApiKey && config.doubaoApiKey !== '') {
      console.log(`[豆包识别] 开始识别: ${path}`);
      
      const response = await fetch(`${config.doubaoBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.doubaoApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.doubaoModelId, thinking: { type: config.doubaoThinking },
          messages: [
            {
              role: 'user',
              content: userContent
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('豆包API错误:', response.status, errorText);
        throw new Error(`豆包API错误: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[豆包识别] 原始返回:`, JSON.stringify(data, null, 2));
      
      // 豆包 chat/completions API 返回格式解析（OpenAI兼容格式）
      let content = '';
      if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
      }

      console.log(`[豆包识别] 解析内容: ${content}`);

      if (!content) {
        throw new Error('豆包API返回内容为空');
      }

      // 解析JSON
      let cleaned = content.trim();
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
      cleaned = cleaned.replace(/\n?```\s*$/i, '');

      try {
        const result = JSON.parse(cleaned);
        return {
          path,
          new_name: result.new_name || path.split('/').pop() || path,
          confidence: '高'
        };
      } catch (parseError) {
        // 尝试从文本中提取名称
        const nameMatch = content.match(/"new_name"\s*:\s*"([^"]+)"/);
        if (nameMatch) {
          return {
            path,
            new_name: nameMatch[1],
            confidence: '中'
          };
        }
        // 如果返回的是纯文本名称，直接使用
        if (cleaned && !cleaned.includes('{') && cleaned.length < 50) {
          return {
            path,
            new_name: cleaned,
            confidence: '中'
          };
        }
        console.error('解析豆包返回失败:', content);
        // 解析失败，返回原始路径
        return {
          path,
          new_name: path.split('/').pop() || path,
          confidence: '低'
        };
      }
    }
    
    // 回退到通义千问
    if (config.qwenVLApiKey && config.qwenVLApiKey !== '') {
      console.log(`[千问识别] 回退使用千问: ${path}`);
      
      const qwenContent: any[] = [];
      qwenContent.push({
        type: 'image_url',
        image_url: {
          url: imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
        }
      });
      if (focusImageBase64) {
        qwenContent.push({
          type: 'image_url',
          image_url: {
            url: focusImageBase64.startsWith('data:') ? focusImageBase64 : `data:image/png;base64,${focusImageBase64}`
          }
        });
      }
      qwenContent.push({
        type: 'text',
        text: promptText
      });

      const response = await fetch(`${config.qwenVLBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.qwenVLApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'qwen-vl-plus',
          messages: [
            { role: 'user', content: qwenContent }
          ],
          temperature: 0.2,
          max_tokens: 500
        })
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        console.log(`[千问识别] 返回内容: ${content}`);
        if (content) {
          let cleaned = content.trim().replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
          try {
            const result = JSON.parse(cleaned);
            return { path, new_name: result.new_name || path.split('/').pop() || path, confidence: '中' };
          } catch {
            const nameMatch = content.match(/"new_name"\s*:\s*"([^"]+)"/);
            if (nameMatch) return { path, new_name: nameMatch[1], confidence: '低' };
          }
        }
      }
    }

    console.warn('没有可用的AI API配置');
    return {
      path,
      new_name: path.split('/').pop() || path,
      confidence: '低'
    };
  } catch (error) {
    console.error('识别部件错误:', error);
    return {
      path,
      new_name: path.split('/').pop() || path,
      confidence: '低'
    };
  }
}

/**
 * 使用通义千问VL-Plus多模态模型整理模型结构树
 * @param params 包含结构树JSON、全局截图和部件截图的参数
 * @returns 整理后的结构树
 */
export async function organizeModelStructureWithQwenVL(
  params: OrganizeStructureParams
): Promise<OrganizeStructureResult> {
  const { structureData, globalImageBase64, partImages } = params;

  // 统计输入节点数量
  const countNodes = (nodes: ModelStructureNode[]): number => {
    let count = 0;
    for (const node of nodes) {
      count++;
      if (node.children) {
        count += countNodes(node.children);
      }
    }
    return count;
  };
  const totalInputNodes = countNodes(structureData.tree);
  console.log(`[AI整理] 输入节点总数: ${totalInputNodes}`);

  // 转换结构树，只保留path，移除original_name避免干扰AI识别
  const stripNames = (nodes: ModelStructureNode[]): Array<{path: string; children?: any[]}> => {
    return nodes.map(node => ({
      path: node.path,
      children: node.children ? stripNames(node.children) : undefined
    }));
  };
  const strippedTree = stripNames(structureData.tree);

  // 构建Prompt - 强调必须返回所有节点
  const systemPrompt = `你是一个专业的3D模型结构分析专家。你的任务是分析用户提供的3D模型结构树和相关截图，对模型的层级结构和命名进行优化整理。

## 重要要求（必须严格遵守）：
1. **必须处理所有节点**：输入中有 ${totalInputNodes} 个节点，你必须在输出中包含所有这 ${totalInputNodes} 个节点，一个都不能遗漏！
2. **保持original_path不变**：每个原始节点的 original_path 必须与输入的 path 完全一致
3. **完整输出**：即使JSON很长，也必须输出完整，不能截断

## 你的任务：
1. **看图识别**：仔细观察每张部件截图中**蓝色高亮边框**标识的对象，根据其**实际形状和外观**识别是什么部件
2. **中文命名**：为每个部件取一个准确的中文名称
3. **整理层级**：根据部件功能创建逻辑分组
4. **保留路径**：必须保留 original_path 字段，这是前端定位对象的唯一标识

## 输入数据说明：
- 结构树：只包含 path（唯一路径），需要你根据截图来识别并命名
- 全局截图：展示模型整体外观
- 部件截图：每个部件会给你**两张图作为一组**：
  - 图A（位置图）：显示该对象在整体中的位置（其他对象半透明），蓝色高亮边框标识当前对象
  - 图B（聚焦图）：只显示该对象（或对该对象强制对焦），用于看清细节与形状
  你必须综合A+B来识别该对象是什么部件

## ⚠️ 核心规则
1. **只看图片**：完全根据图A/图B中蓝色高亮对象的形状来识别
2. **准确对应**：每组图片后面标注的path就是该对象的唯一标识，确保命名正确对应


## 输出格式：
返回纯JSON对象（不要包含markdown代码块标记）：
{
  "nodes": [
    {
      "original_path": "原始路径（必须与输入的path完全一致）",
      "new_name": "优化后的中文名称",
      "children": [...]
    }
  ]
}

## 关键注意事项：
- ⚠️ 输入有 ${totalInputNodes} 个节点，输出也必须有 ${totalInputNodes} 个带有 original_path 的节点
- 新创建的逻辑分组节点不需要 original_path 字段
- 如果无法从截图识别某个部件，根据其名称特征推测合理的中文名称
- 命名要专业、准确、简洁`;

  // 构建用户消息内容（多模态）
  const userContent: any[] = [];

  // 添加文本说明 - 只发送path结构，不发送原始名称
  userContent.push({
    type: 'text',
    text: `请分析以下3D模型并为每个部件命名。

## 模型结构（只有path，需要你根据截图识别并命名）：
${JSON.stringify(strippedTree, null, 2)}

## 以下是模型截图，请根据截图识别每个部件：`
  });

  // 添加全局截图
  userContent.push({
    type: 'image_url',
    image_url: {
      url: globalImageBase64.startsWith('data:') 
        ? globalImageBase64 
        : `data:image/png;base64,${globalImageBase64}`
    }
  });
  userContent.push({
    type: 'text',
    text: '（以上是模型全局截图）'
  });

  // 添加部件截图（限制数量，避免请求过大）
  // 注意：通义千问VL对图片数量有限制；由于每个部件要发送2张图，这里按“部件组”限制，默认最多25组（约50张图）
  const maxPartPairs = Math.min(partImages.length, 25);
  if (partImages.length > maxPartPairs) {
    userContent.push({
      type: 'text',
      text: `\n注意：由于图片数量限制，以下只展示 ${maxPartPairs} 组代表性部件截图（每组2张：位置图+聚焦图）。结构树仍包含所有 ${totalInputNodes} 个节点。\n`
    });
  }
  
  for (let i = 0; i < maxPartPairs; i++) {
    const part = partImages[i];
    // 图A：位置图
    userContent.push({
      type: 'image_url',
      image_url: {
        url: part.imageBase64.startsWith('data:') 
          ? part.imageBase64 
          : `data:image/png;base64,${part.imageBase64}`
      }
    });
    // 图B：聚焦图（可选，但前端会尽量提供）
    if (part.focusImageBase64) {
      userContent.push({
        type: 'image_url',
        image_url: {
          url: part.focusImageBase64.startsWith('data:')
            ? part.focusImageBase64
            : `data:image/png;base64,${part.focusImageBase64}`
        }
      });
    }
    userContent.push({
      type: 'text',
      text: `【路径: ${part.path}】上面两张图为同一对象：图A=位置图（整体上下文），图B=聚焦图（细节）。请综合两图识别蓝色高亮对象是什么部件，并为该path指定准确中文名称。`
    });
  }

  // 添加最终指令 - 强调完整返回
  userContent.push({
    type: 'text',
    text: `

## 最终指令
请根据以上截图（每个对象两张图：位置图+聚焦图），识别每个蓝色高亮部件是什么，并返回整理后的结构JSON。

⚠️ 关键要求：
1. **只根据图A/图B中蓝色高亮对象的形状来命名**
2. 每组图片后面标注的path就是该对象的标识符
3. 必须返回纯JSON，不要包含\`\`\`json标记
4. 必须包含所有 ${totalInputNodes} 个节点（通过original_path标识）
5. original_path的值必须与输入的path完全一致
6. 可以创建新的分组节点来组织层级，新分组节点不需要original_path

请开始输出完整的JSON：`
  });

  try {
    // 检查API Key配置
    if (!config.doubaoApiKey || config.doubaoApiKey === '') {
      console.warn('豆包API Key未配置，返回模拟数据');
      // 返回模拟数据：直接将原始结构返回，名称不变
      const mockResult: OrganizeStructureResult = {
        nodes: structureData.tree.map(node => convertToOrganizedNode(node))
      };
      return mockResult;
    }

    // 调用豆包API（OpenAI兼容模式）
    const response = await fetch(`${config.doubaoBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.doubaoApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.doubaoModelId, thinking: { type: config.doubaoThinking },
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        max_tokens: 16000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('豆包API错误:', response.status, errorText);
      throw new Error(`豆包API错误: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    // 豆包API返回格式（OpenAI兼容）
    const content = data.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('豆包API返回内容为空');
    }

    console.log('豆包API返回长度:', content.length);
    console.log('豆包API返回预览:', content.substring(0, 1000) + '...');

    // 统计返回的节点数量
    const countReturnedNodes = (nodes: OrganizedNode[]): number => {
      let count = 0;
      for (const node of nodes) {
        if (node.original_path) count++; // 只统计有original_path的节点
        if (node.children) {
          count += countReturnedNodes(node.children);
        }
      }
      return count;
    };

    /**
     * 尝试修复被截断的JSON
     * 主要处理数组或对象未正确闭合的情况
     */
    const tryFixTruncatedJSON = (jsonStr: string): string => {
      let fixed = jsonStr.trim();
      
      // 统计括号
      let braceCount = 0;  // {}
      let bracketCount = 0; // []
      let inString = false;
      let escape = false;
      
      for (const char of fixed) {
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (inString) continue;
        
        if (char === '{') braceCount++;
        else if (char === '}') braceCount--;
        else if (char === '[') bracketCount++;
        else if (char === ']') bracketCount--;
      }
      
      // 如果在字符串中被截断，先闭合字符串
      if (inString) {
        fixed += '"';
      }
      
      // 移除末尾的不完整部分（如逗号后没有内容）
      fixed = fixed.replace(/,\s*$/, '');
      
      // 补充缺失的括号
      while (bracketCount > 0) {
        fixed += ']';
        bracketCount--;
      }
      while (braceCount > 0) {
        fixed += '}';
        braceCount--;
      }
      
      return fixed;
    };

    /**
     * 去除markdown代码块标记
     */
    const removeMarkdownCodeBlock = (str: string): string => {
      let cleaned = str.trim();
      // 去除开头的 ```json 或 ```
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
      // 去除结尾的 ```
      cleaned = cleaned.replace(/\n?```\s*$/i, '');
      return cleaned.trim();
    };

    // 解析JSON（带修复功能）
    const parseWithFix = (jsonStr: string): any => {
      // 首先去除markdown代码块标记
      let cleaned = removeMarkdownCodeBlock(jsonStr);
      
      try {
        return JSON.parse(cleaned);
      } catch (e) {
        // 尝试修复被截断的JSON
        console.log('[AI整理] JSON解析失败，尝试修复...');
        const fixed = tryFixTruncatedJSON(cleaned);
        console.log('[AI整理] 修复后JSON长度:', fixed.length);
        return JSON.parse(fixed);
      }
    };

    try {
      const result = parseWithFix(content);
      if (result.nodes && Array.isArray(result.nodes)) {
        const returnedCount = countReturnedNodes(result.nodes);
        console.log(`[AI整理] 返回节点数: ${returnedCount}, 输入节点数: ${totalInputNodes}`);
        
        if (returnedCount < totalInputNodes) {
          console.warn(`[AI整理] 警告：AI只返回了 ${returnedCount}/${totalInputNodes} 个节点，可能有遗漏`);
        }
        
        return result as OrganizeStructureResult;
      }
      throw new Error('返回格式不正确：缺少nodes数组');
    } catch (parseError) {
      // 尝试提取JSON部分
      console.log('[AI整理] 尝试从响应中提取JSON部分...');
      const jsonMatch = content.match(/\{[\s\S]*"nodes"[\s\S]*/);
      if (jsonMatch) {
        try {
          const result = parseWithFix(jsonMatch[0]);
          if (result.nodes && Array.isArray(result.nodes)) {
            const returnedCount = countReturnedNodes(result.nodes);
            console.log(`[AI整理] 返回节点数: ${returnedCount}, 输入节点数: ${totalInputNodes}`);
            
            if (returnedCount < totalInputNodes) {
              console.warn(`[AI整理] 警告：AI只返回了 ${returnedCount}/${totalInputNodes} 个节点，可能有遗漏`);
            }
            
            return result as OrganizeStructureResult;
          }
        } catch (e) {
          console.error('[AI整理] 修复后仍无法解析:', e);
        }
      }
      console.error('解析豆包返回失败:', parseError);
      console.error('原始内容(末尾500字符):', content.slice(-500));
      throw new Error(`解析豆包返回的JSON失败: ${(parseError as Error).message}`);
    }
  } catch (error) {
    console.error('豆包API错误:', error);
    throw error;
  }
}

/**
 * 辅助函数：将输入节点转换为整理后的节点格式（用于mock数据）
 */
function convertToOrganizedNode(node: ModelStructureNode): OrganizedNode {
  return {
    original_path: node.path,
    new_name: node.original_name,
    children: node.children?.map(child => convertToOrganizedNode(child)) || []
  };
}

// 生成标注简介请求参数
export interface GenerateAnnotationSummaryParams {
  coursewareName: string;  // 课件名称
  annotationTitle: string; // 标注标题
  imageBase64?: string;    // 可选：标注位置截图
}

// 生成标注简介结果
export interface GenerateAnnotationSummaryResult {
  summary: string;
}

/**
 * 使用AI生成标注简介
 * 根据课件名称和标注标题，生成专业的简介描述
 */
export async function generateAnnotationSummaryWithAI(
  params: GenerateAnnotationSummaryParams
): Promise<GenerateAnnotationSummaryResult> {
  const { coursewareName, annotationTitle, imageBase64 } = params;

  // 构建提示词
  const promptText = `你是一个专业的工业/机械设备教学专家。请根据以下信息生成一段简洁专业的标注简介（50-150字）：

课件名称：${coursewareName}
标注标题：${annotationTitle}

要求：
1. 简介应描述该部件/组件的功能、作用或重要性
2. 使用专业但易懂的语言
3. 适合教学场景使用
4. 不要使用"这是"、"它是"等开头
5. 只返回简介文本，不要其他内容`;

  try {
    // 优先使用豆包API（OpenAI兼容模式）
    if (config.doubaoApiKey && config.doubaoApiKey !== '') {
      console.log(`[AI简介生成] 课件: ${coursewareName}, 标注: ${annotationTitle}`);
      
      const userContent: any[] = [];
      
      // 如果有图片，添加图片
      if (imageBase64) {
        userContent.push({
          type: 'image_url',
          image_url: {
            url: imageBase64.startsWith('data:') 
              ? imageBase64 
              : `data:image/png;base64,${imageBase64}`
          }
        });
      }
      
      userContent.push({
        type: 'text',
        text: promptText
      });

      const response = await fetch(`${config.doubaoBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.doubaoApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.doubaoModelId, thinking: { type: config.doubaoThinking },
          messages: [
            {
              role: 'user',
              content: userContent
            }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('豆包API错误:', response.status, errorText);
        throw new Error(`豆包API错误: ${response.status}`);
      }

      const data = await response.json();
      
      // 解析返回内容（OpenAI兼容格式）
      const content = data.choices?.[0]?.message?.content || '';

      if (!content) {
        throw new Error('AI返回内容为空');
      }

      // 清理返回的文本
      let summary = content.trim();
      // 移除可能的引号
      if ((summary.startsWith('"') && summary.endsWith('"')) || 
          (summary.startsWith("'") && summary.endsWith("'"))) {
        summary = summary.slice(1, -1);
      }

      console.log(`[AI简介生成] 完成: ${summary.substring(0, 50)}...`);

      return { summary };
    }

    // 回退到DeepSeek API
    if (config.deepseekApiKey && config.deepseekApiKey !== '') {
      console.log(`[AI简介生成] 使用DeepSeek: ${annotationTitle}`);
      
      const response = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.deepseekApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'user',
              content: promptText
            }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('DeepSeek API错误:', response.status, errorText);
        throw new Error(`DeepSeek API错误: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      
      if (!content) {
        throw new Error('DeepSeek返回内容为空');
      }

      let summary = content.trim();
      if ((summary.startsWith('"') && summary.endsWith('"')) || 
          (summary.startsWith("'") && summary.endsWith("'"))) {
        summary = summary.slice(1, -1);
      }

      return { summary };
    }

    throw new Error('未配置可用的AI服务（需要豆包或DeepSeek API密钥）');
  } catch (error) {
    console.error('AI简介生成失败:', error);
    throw error;
  }
}
