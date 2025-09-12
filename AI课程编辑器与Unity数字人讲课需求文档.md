## AI课程编辑器（Web）与 Unity 数字人讲课 PRD

**版本**: v1.0  
**状态**: 草案（可执行）  
**最后更新**: 2025-09-11  
**适用目录**: `admin-platform/`（前端 Next.js + 后端 Node），Unity 客户端（VR/PC）

### 一、目标与价值
- **目标**: 在现有“三维课件编辑器”基础上新增“AI课程编辑器”，实现围绕选定三维课件与课程主题的自动备课，产出可编辑课程脚本（含文本讲解、图片讲解、三维动作指令），Unity 客户端可解析并驱动数字人授课，实现类似 EON‑XR 的“自动讲解 + 互动演示”。
- **价值**:
  - 教研人员可零代码一键生成课程大纲与脚本，显著降低备课成本。
  - 统一数据格式（Web/Unity 共用 `course.json`），跨端一致播放。
  - 与“三维课件”（`courseware.json`）解耦，明确数据边界与复用关系。

### 二、用户与角色
- **管理员/教研人员**: 创建/编辑 AI 课程、触发 AI 生成、审阅与修改、发布。
- **学习者**: 在 Web/Unity 中观看数字人授课；支持同步课堂或自学模式。

### 三、名词与范围
- **三维课件（Courseware）**: 既有的数据包，包含模型、标注、动画时间线等（参考 `PRD-3D-Courseware-Editor.md`）。
- **AI 课程（AICourse）**: 以课件为素材，结合“课程主题/目标/对象”等生成并可编辑的脚本与媒体清单，驱动 Web/Unity 播放与数字人讲解。
- **数字人（Digital Lecturer）**: Unity 端可选“2D 说话头像”或“3D 虚拟人”方案，具备 TTS 配音、口型、字幕、指向/手势等能力。

### 四、核心功能（Must）

#### A. AI 课程编辑器（Web）
1) 导航与列表
   - 新增模块：侧边导航显示“AI课程编辑”。
   - 列表页 `/admin/ai-course`：课程搜索、创建、进入编辑、删除、发布状态。

2) 新建与基础信息
   - 字段：课程名称、课程主题（关键词）、目标受众、时长目标（分钟）、语言/配音风格、难度、教学目标（可选多项）。
   - 选择三维课件：从平台资源中选择 `coursewareId`；显示模型与标注/动画统计。

3) AI 生成（无代码）
   - 点击“AI生成初稿”：向后端提交关键信息（主题、受众、目标、课件摘要等），调用大模型+检索服务，产出“课程大纲 + 分段脚本”。
   - 生成内容包含：
     - 文本讲解（可配 TTS 参数与字幕）
     - 图片讲解（网络检索结果：图片URL、标题、摘要、来源、版权；支持可选框选区域 `bbox`）
     - 三维讲解动作（相机对焦、显示/隐藏、节点高亮、标注显示、动画播放片段）
   - 允许多次再生成（保留历史版本，对比/合并）。

4) 可编辑大纲（所见即所得）
   - 视图结构：
     - 左侧：章节/段落树（可拖拽排序，支持“并行组/顺序组”）
     - 中间：三维视窗+媒体预览（联动所选段落）
     - 右侧：属性面板（文本/图片/三维动作/配音参数/字幕/时序）
   - 段落最小单元：`Segment`（详见数据格式）。支持：
     - 文本编辑、关键术语高亮、时长估算
     - 图片替换/裁剪/框选热点（`bbox`）与指向设置
     - 三维动作“向导式选择”：从结构树/标注/动画时间线中拾取目标（如节点、高亮、标注ID、动画ID与时间片段）
     - 段落时序：`startOffset`（段内相对时间）、并行/顺序控制、缓动
   - 一键预览：在浏览器端模拟 TTS（可占位音频）、图片叠加、三维动作与字幕。

5) 保存与版本
   - 支持草稿/已发布；JSON 存储于后端（见“后端 API”）。
   - 版本化字段：`version`、`courseVersion`、`modelHash`、`coursewareVersion`。

6) 权限与合规
   - 版权信息：图片需存储来源与许可；支持“替换为本地上传”与“CDN缓存”；敏感词/不当内容过滤。

#### B. Unity 数字人授课（播放端）
1) 加载与解析
   - 根据课程ID拉取 `course.json` 与资源清单；按需缓存图片、字幕、合成或下载 TTS 音频。
   - 播放器负责调度“文本/语音/图片叠加/三维动作”的并行与顺序执行。

2) 数字人与TTS
   - TTS：可配置提供商与音色（如 Azure、Volc、ElevenLabs 等抽象层）。
   - 数字人：
     - 2D 头像：口型同步（基于音素/能量）、眼神与头部朝向（看向目标/观众）。
     - 3D 虚拟人：基础手势集（说明/指向/过渡），自动节拍；可选混合表情。
   - 字幕：跟随 TTS 时间轴，支持中/英双语与样式配置。

3) 三维动作与指向
   - 动作类型（Unity 实现）：
     - `camera.focus`（包围盒对焦，时长/缓动）
     - `visibility.set`（节点显隐批量切换，瞬时）
     - `highlight.show/hide`（描边或材质高亮，持续/时长）
     - `annotation.show/hide`（按标注ID显示/隐藏）
     - `animation.play`（播放课件自定义动画的时间片段，支持混合/过渡）
     - `pointer.point`（数字人激光笔指向：到 3D 节点或 2D 图片 `bbox`）
   - 时间轴调度：段内支持并行/延迟；段间顺序播放；可“下一步/上一步/暂停/倍速”。

4) 交互与容错
   - 互动：段内可监听“点击标注/节点”等事件并触发分支（可选）。
   - 容错：找不到 `nodeKey/annotationId/animationId` 时记录警告并跳过，不中断整体播放。

5) 性能与预加载
   - 预下载下一段音频与图片；三维动作前置计算目标包围盒与路径。

#### C. 平台接入与路由
- 导航：在 `admin-platform/web` 左侧新增“AI课程编辑”。
- 路由：
  - 列表页 `/admin/ai-course`
  - 编辑页 `/admin/ai-course/[id]`

### 五、数据格式（对外约定）

#### 1) AI 课程 `course.json`
```json
{
  "version": "1.0",
  "title": "汽车结构AI讲解",
  "theme": "发动机与传动基础",
  "audience": "中职一年级",
  "durationTarget": 15,
  "language": "zh-CN",
  "voice": { "provider": "azure", "voice": "zh-CN-XiaoyiNeural", "rate": 1.0, "style": "general" },
  "coursewareId": "courseware-uuid-1",
  "coursewareVersion": 3,
  "modelHash": "sha256-...",
  "outline": [
    {
      "id": "seg-1",
      "title": "课程导入",
      "mode": "sequence", 
      "items": [
        {
          "type": "talk",
          "id": "item-1",
          "say": "首先我们看到发动机…",
          "tts": { "voice": "zh-CN-XiaoyiNeural", "rate": 1.0 },
          "subtitles": [{ "text": "首先我们看到发动机…", "offset": 0.0 }],
          "ui": { "showSubtitle": true }
        },
        {
          "type": "image.explain",
          "id": "item-2",
          "image": {
            "src": "https://cdn.example.com/engine-detail.jpg",
            "title": "发动机结构图",
            "source": { "url": "https://site", "license": "CC BY 4.0" },
            "bbox": [0.52, 0.31, 0.18, 0.12]
          },
          "pointer": { "enable": true, "target": "bbox" },
          "say": "这一区域是气缸盖…"
        },
        {
          "type": "scene.action",
          "id": "item-3",
          "actions": [
            { "type": "camera.focus", "target": { "nodeKey": "Root/Engine" }, "duration": 2.0, "easing": "easeInOut" },
            { "type": "highlight.show", "targets": [{ "nodeKey": "Root/Engine", "mode": "outline" }], "duration": 5.0 },
            { "type": "annotation.show", "ids": ["uuid-1"] },
            { "type": "animation.play", "animationId": "anim-1", "startTime": 0.0, "endTime": 5.0, "blend": 0.25 },
            { "type": "visibility.set", "items": [{ "nodeKey": "Root/Cover", "visible": false }] }
          ]
        }
      ]
    }
  ],
  "assets": {
    "images": [
      { "id": "img-1", "src": "https://cdn.example.com/engine-detail.jpg", "title": "发动机结构图", "license": "CC BY 4.0", "sourceUrl": "https://site" }
    ]
  }
}
```
说明：
- `outline` 由若干段（Segment）组成；每段内 `items` 可为**顺序或并行**（`mode`: `sequence` / `parallel`）。
- 三维动作仅以“高阶指令”描述（如 `camera.focus` / `animation.play`），不直接存储底层 TRS 关键帧；Unity 端据此驱动课件资源。
- 图片可选 `bbox`，Unity 或 Web 可展示“数字人指向”效果。

#### 2) 三维动作类型约定（Unity 播放器）
```json
[
  { "type": "camera.focus", "target": { "nodeKey": "Path/To/Node" }, "duration": 2.0, "easing": "easeInOut" },
  { "type": "visibility.set", "items": [{ "nodeKey": "Path/To/Node", "visible": true }] },
  { "type": "highlight.show", "targets": [{ "nodeKey": "Path/To/Node", "mode": "outline" }], "duration": 3.0 },
  { "type": "annotation.show", "ids": ["uuid-1", "uuid-2"] },
  { "type": "animation.play", "animationId": "anim-1", "startTime": 0.0, "endTime": 5.0, "blend": 0.2 },
  { "type": "pointer.point", "target": { "kind": "node", "nodeKey": "Path/To/Node" } },
  { "type": "pointer.point", "target": { "kind": "image.bbox", "imageId": "img-1", "bboxIndex": 0 } }
]
```

> 规范提醒：后台存储/上传的时间线数据不包含底层 TRS 轨道，仅保留相机与显隐关键帧；三维位姿变化由 GLB/课件动画承担（与平台既定规范一致）。

### 六、后端 API（概要）

#### A. AI 课程
- GET/POST `/api/ai-courses`：列表/创建（创建时仅基础元信息）。
- GET/PUT/DELETE `/api/ai-courses/:id`：详情/更新（写入 `course.json`）/删除。
- POST `/api/ai-courses/:id/publish`：发布/下线（触发分段TTS批量合成与清单写回）。

#### B. 生成与检索
- POST `/api/ai/generate-course`：输入 `coursewareId`、主题、受众、时长目标、教学目标等 → 返回 `course.json` 初稿（含段落、图片候选、三维动作建议）。
- POST `/api/ai/search-images`：关键词与上下文 → 返回图片候选（URL、标题、摘要、来源、license、可选 `bbox`）。
- POST `/api/ai/tts`：用于草稿预览的实时合成接口（小流量、短文本），输入文本与语音参数 → 返回临时音频URL；不写入发布清单。
- POST `/api/ai/tts/batch`：发布流程内调用，按 `outline.items` 增量合成（基于内容哈希去重），保存到持久存储与CDN，写回 `course.json` 的 `audio` 字段与 `assets.audio`。

说明：
- 安全：鉴权（JWT）、上传类型限制、外链缓存与签名 URL；图片版权字段必填。

### 七、AI 生成策略（实现建议）
- 输入：课程主题、受众/难度、教学目标、选定课件的模型结构摘要（节点/标注/动画列表）。
- 步骤：
  1) 纲要生成：产出章节与关键知识点（JSON）。
  2) 讲稿生成：逐段输出“说/展示/操作”三类元素，限定操作只引用现有 `nodeKey/annotationId/animationId`。
  3) 图片检索：对每段生成 1–3 张候选，带来源与版权；可选 `bbox` 建议。
  4) 一致性校验：剔除找不到目标对象的动作；对齐课件版本与 `modelHash`。
  5) 时长估算：基于字数与语速、动作时长为每段给出估时。
  6) TTS 策略：
     - 草稿预览：调用 `/api/ai/tts` 实时合成，返回临时URL；编辑器试听与删除。
     - 发布：由 `/api/ai-courses/:id/publish` 触发 `/api/ai/tts/batch`，对变更项增量合成，写回清单并上CDN。

### 八、编辑器交互关键点
- 段落树：拖拽排序、并行/顺序切换、批量启用/禁用。
- 段落编辑：文本富格式（粗体/术语高亮）、TTS 预听、图片裁剪/框选与指向点设置。
- 三维动作向导：从结构树拾取 `nodeKey`、从“动画管理”选择 `animationId` 与片段区间，标注选择 `annotationId`；即时预览。
- 预览：浏览器内半真实模拟（无模型 TRS 回放，仅相机/显隐/高亮/标注/动画片段）。

### 九、Unity 实现要点
1) 数据类（示例）
```csharp
[System.Serializable]
public class AICourseData {
    public string version;
    public string title;
    public string theme;
    public string audience;
    public float durationTarget;
    public string language;
    public VoiceConfig voice;
    public string coursewareId;
    public int coursewareVersion;
    public string modelHash;
    public Segment[] outline;
    public AssetsData assets;
}

[System.Serializable]
public class Segment {
    public string id;
    public string title;
    public string mode; // sequence | parallel
    public SegmentItem[] items;
}

[System.Serializable]
public class SegmentItem {
    public string id;
    public string type; // talk | image.explain | scene.action
    public string say;
    public TTSConfig tts;
    public SubtitleEntry[] subtitles;
    public SceneAction[] actions;
}

[System.Serializable]
public class SceneAction {
    public string type; // camera.focus, visibility.set, highlight.show, annotation.show, animation.play, pointer.point
    public string nodeKey;
    public string[] ids; // annotation ids
    public string animationId;
    public float startTime;
    public float endTime;
    public float duration;
}
```

2) 播放器
- 调度器：按段落依次播放；段内按 `mode` 处理并行/顺序，支持 `startOffset` 与缓动。
- 数字人：TTS 播放→口型同步→手势/指向事件；字幕同步渲染。
- 三维：对象定位（`nodeKey`→GameObject）、相机对焦、显隐/高亮、标注显示、动画片段播放（与“课件动画系统”复用）。
- 容错：缺失对象/资源跳过并记录。
 - 音频：优先使用清单中的 `audio.url`；如缺失且在线可降级调用临时TTS，离线则使用占位音+字幕。

#### 9.1 `course.json` 音频清单（示例补充）
```json
{
  "outline": [
    {
      "id": "seg-1",
      "mode": "sequence",
      "items": [
        {
          "id": "item-1",
          "type": "talk",
          "say": "首先我们看到发动机…",
          "audio": {
            "url": "https://cdn/app/audio/ai/68bc5/seg-1_item-1_ab12.mp3",
            "duration": 6.2,
            "hash": "ab12...",
            "markers": {
              "words": [{ "t": 0.12, "d": 0.30, "text": "首先" }],
              "phonemes": []
            }
          }
        }
      ]
    }
  ],
  "assets": {
    "audio": [
      { "id": "aud-1", "url": "https://cdn/app/audio/ai/.../seg-1_item-1_ab12.mp3", "hash": "ab12...", "sr": 24000, "codec": "mp3" }
    ]
  }
}
```


### 十、验收标准
- Web：
  - 完成 AI 生成初稿，包含文本+图片+三维动作建议；可编辑、预览、保存与版本管理。
  - 列表/详情/编辑路由完整；权限与版权校验通过。
- Unity：
  - 能加载并完整播放 `course.json`；数字人发声、字幕、图片叠加、指向与三维动作按序执行。
  - 与“三维课件”对象映射正确；动画片段播放一致；无致命错误。

### 十一、里程碑（建议）
- M1（1周）：AI 课程模块骨架（列表/创建/编辑页框架），`course.json` Schema 定稿。
- M2（1–2周）：AI 生成后端（纲要+讲稿+图片候选），编辑器段落/图片/三维动作向导与预览。
- M3（1–2周）：Unity 播放器（TTS 抽象、字幕、指向、三维动作）、缓存与容错。
- M4（1周）：发布流程、版本化、版权与安全、跨端联测与验收。

### 十二、风险与对策
- 图片版权与稳定性 → 存储来源与许可证，提供本地化缓存与替换。
- 大模型幻觉 → 只允许引用现有 `nodeKey/annotationId/animationId`；生成后做一致性校验与人工审核。
- 端间不一致 → 以 `nodeKey` 为唯一主键，校验 `modelHash` 与 `coursewareVersion`；必要时提供路径回退。
- 性能 → 图片/音频预加载，分段播控；三维动作尽量复用课件动画，减少临时计算。

### 十三、依赖与边界
- 前端：Next.js、three.js、TTS 预听（可占位或 WebAudio）
- 后端：LLM（DeepSeek/通义/其他）、图片检索/审查、TTS 提供商抽象层、对象存储/CDN
- Unity：glTFast、TTS SDK、字幕与口型同步、描边/高亮与相机系统复用
- 不在范围：复杂角色动画制作、全身动捕、图像分割/检测训练（可使用三方服务输出 `bbox`）


