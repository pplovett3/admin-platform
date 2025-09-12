## 三维课件编辑器 PRD（Web + Unity 对接）

**版本**: v1.1  
**状态**: 更新中（可执行）  
**最后更新**: 2025-01-11  
**适用目录**: `admin-platform/`（前端 Next.js + 后端 Node）

### 一、产品目标与价值
- **目标**: 在平台内提供"可视化三维课件编辑器"与"AI讲课生成器"，完成模型导入、结构树、知识点标注、基础动画制作，并通过AI生成完整讲课内容；产物可在 Web 与 Unity 客户端一致回放（含 VR）。
- **价值**:
  - 教研侧可零代码制作三维课件，通过AI生成讲课脚本，显著提升课程制作效率。
  - 课程侧提供自动讲解（AI + 数字人）与互动浏览，提高学习体验与留存。
  - 与 Unity 共用资产（GLB + JSON），降低维护成本。

### 二、用户与角色
- **管理员/教研人员**: 创建/编辑三维课件、制作AI讲课、上传模型、标注、编辑动画时间线并发布。
- **学习者**: 浏览或播放 AI 讲解课件，交互查看标注，在VR环境中体验数字人讲解。

### 三、名词与范围
- **模型**: 优先使用 glTF/GLB；FBX 通过服务端转换为 GLB。
- **标注（Annotation）**: 绑定到 glTF 节点，仅包含标题、简介，不含富媒体内容。
- **动画（Animation）**: 包含动画名称、步骤序列，每个步骤包含名称和描述；时间线支持相机、可见性/高亮、节点 TRS 等基础动画轨道。
- **三维课件（3D Courseware）**: 包含模型、标注、动画的完整内容包，可独立在Unity中解析查看。
- **AI 讲课（AI Course）**: AI读取三维课件内容，结合知识点检索，生成可编辑的课程脚本，支持配音和数字人讲解。

### 四、核心功能（Must）

#### A. 三维课件编辑器
1) 模型导入
   - 新建课件时可选择：读取平台个人资源/公共资源中的模型、直接从本地上传模型
   - 本地上传模型自动保存到个人资源数据库并加载
   - 支持 GLB 直传、FBX 上传后端转换→GLB；显示模型统计（节点数、面数）
2) 结构树
   - 展示 glTF 场景树；支持搜索、选中、显隐、隔离、相机对焦
3) 标注功能（简化）
   - 选中对象添加标注：仅包含标题、简介；锚点支持包围盒中心/命中点/局部偏移；视窗内显示标记点
4) 动画制作
   - 动画管理：动画名称、动画描述
   - 步骤管理：步骤名称、步骤描述、步骤时间点
   - 时间线编辑：相机关键帧、节点显隐/高亮、节点 TRS；常用缓动；预览播放
5) 三维课件保存
   - 以统一 JSON `courseware.json` 存储完整三维课件（模型地址、标注列表、动画时间线、步骤信息、渲染设置）

#### B. AI 讲课制作器（待详细设计）
1) 课件导入
   - 读取已制作的三维课件内容（模型、标注、动画）
2) 知识点扩展
   - AI检索相关富媒体内容，用户可自定义添加知识点
3) 脚本生成
   - AI生成可编辑的课程脚本，结合三维课件内容
4) 配音制作
   - TTS配音、字幕生成
5) 预览与发布
   - 网页预览、Unity VR数字人讲解

#### C. 平台接入
- 在 `admin-platform/web` 左侧导航新增"**三维课件**"；支持新建、编辑、列表管理
- 移除资源管理中通过点击模型进行编辑的入口

### 五、非功能（Must/Should）
- 性能: KTX2 纹理、Draco/Meshopt；≥50万面可基本流畅浏览；异步/延迟加载。
- 兼容: Chrome/Edge；Unity 使用 glTFast；中英文 UI。
- 安全: 鉴权、上传类型与大小限制、媒体 URL 签名/访问控制。
- 可维护: 数据版本化（`version`、`modelHash`），服务端日志与任务队列（FBX→GLB）。

### 六、信息架构与页面
#### A. 三维课件模块
- 列表页 `/admin/three-courseware`
  - 课件列表/搜索/新建课件/进入编辑/删除
- 编辑页 `/admin/three-courseware/[id]`
  - 三栏：结构树 | 三维视窗 | 属性面板（标注/动画时间线）
  - 视窗：选中高亮、对焦、标注点可见、动画播放控制
- 新建页面：选择模型来源（平台资源/本地上传）

#### B. AI课程编辑模块
- 列表页 `/admin/ai-course`
- 制作页 `/admin/ai-course/[id]`
- 功能要点：
  - 基础信息：课程名称、主题、受众、时长目标、语言/音色、难度与教学目标
  - 关联三维课件：选择 `coursewareId`，展示模型与标注/动画统计
  - AI生成初稿：后端基于课件摘要与主题生成“章节大纲 + 分段脚本”（文本、图片候选、三维动作建议）
  - 可编辑大纲（所见即所得）：
    - 段落树：顺序/并行结构；拖拽排序
    - 段落项类型：`talk`（文本+TTS）、`image.explain`（图片+可选bbox指向）、`scene.action`（相机/显隐/高亮/标注/动画片段/指向）
    - 三维动作向导：从结构树/标注/动画中拾取 `nodeKey`、`annotationId`、`animationId` 与时间片段
    - 预览：浏览器侧模拟TTS（占位或实时合成）、图片叠加、三维动作与字幕
  - TTS策略：
    - 预览：实时合成试听（临时URL，不写入正式清单）
    - 发布：分段批量合成并CDN缓存，写回 `course.json` 音频字段与 `assets.audio`
  - 发布与版本：草稿/已发布；内容哈希增量合成；记录 `coursewareVersion` 与 `modelHash`

### 七、数据格式（对外约定）
1) courseware.json（三维课件格式）
```json
{
  "version": "1.1",
  "name": "汽车结构课件",
  "description": "展示汽车各部件结构与装配过程",
  "model": "https://.../model.glb",
  "annotations": [
    {
      "id": "uuid-1",
      "target": { "nodeIndex": 23, "path": "Root/Engine" },
      "anchor": { "space": "local", "offset": [0, 0.08, 0] },
      "label": { "title": "发动机", "summary": "驱动整车的核心动力部件" }
    }
  ],
  "animations": [
    {
      "id": "anim-1",
      "name": "装配过程",
      "description": "展示汽车装配的完整流程",
      "timeline": {
        "duration": 10,
        "cameraKeys": [{ "time": 0, "position": [1,2,3], "target": [0,0,0], "easing": "easeInOut" }],
        "visTracks": { "node-23": [{ "time": 0, "value": true }, { "time": 2.0, "value": false }] },
        "trsTracks": { "node-45": [{ "time": 1.5, "position": [0,0.1,0] }] }
      },
      "steps": [
        { "id": "step-1", "time": 2.5, "name": "安装发动机", "description": "将发动机组装到底盘上" }
      ]
    }
  ],
  "settings": {
    "bgTransparent": false,
    "bgColor": "#919191",
    "lights": { "dir": { "intensity": 1.2 }, "amb": { "intensity": 0.6 } }
  }
}
```
说明：
- 标注仅包含标题和简介，移除富媒体内容
- 动画包含名称、描述、时间线和步骤信息
- 可包含多个动画序列

2) course.json（AI 讲课）
```json
{
  "version": "1.1",
  "title": "汽车结构AI讲解",
  "coursewareId": "courseware-uuid-1",
  "description": "基于三维课件的AI智能讲解",
  "script": [
    {
      "id": "script-1",
      "say": "首先我们看到发动机，它是整车的动力来源。",
      "focus": { "nodeIndex": 23, "duration": 3.0 },
      "highlight": [{ "nodeIndex": 23, "mode": "outline" }],
      "playAnimation": { "animationId": "anim-1", "startTime": 0, "endTime": 5.0 },
      "showAnnotation": ["uuid-1"],
      "media": [
        { "type": "image", "src": "ai-generated/engine-detail.jpg", "title": "发动机结构图" }
      ],
      "tts": { "voice": "zh-CN-XiaoyiNeural", "rate": 1.0 },
      "audio": {
        "url": "https://cdn/app/audio/ai/68.../script-1_ab12.mp3",
        "duration": 6.2,
        "hash": "ab12...",
        "markers": { "words": [{ "t": 0.12, "d": 0.30, "text": "首先" }] }
      }
    }
  ]
}
```
说明：AI讲课引用三维课件ID，可控制动画播放、标注显示，并添加AI检索的富媒体内容；发布后写入 `audio` 字段与 `assets.audio` 清单，客户端按清单预取。

### 八、后端 API（概要）
#### A. 资源管理
- POST `/api/assets/upload`  上传 GLB/FBX → `{assetId, glbUrl?, status}`
- POST `/api/assets/convert`  触发 FBX→GLB → `{jobId}`；GET `/api/jobs/:id`
- GET `/api/assets/models`  获取用户可用的模型资源（个人+公共）

#### B. 三维课件
- GET/POST `/api/coursewares`  课件列表/创建
- GET/PUT/DELETE `/api/coursewares/:id`  课件详情/更新/删除
- POST `/api/coursewares/:id/export`  导出课件为 `courseware.json`

#### C. AI讲课
- GET/POST `/api/ai-courses`  AI讲课列表/创建
- GET/PUT/DELETE `/api/ai-courses/:id`  AI讲课详情/更新/删除（写入 `course.json`）
- POST `/api/ai-courses/:id/publish`  发布/下线（触发分段TTS批量合成与清单写回）
- POST `/api/ai/generate-course`  基于三维课件生成 AI 脚本（初稿）
- POST `/api/ai/search-images`  图片检索（返回URL/标题/摘要/来源/版权/可选bbox）
- POST `/api/ai/tts`  草稿预览实时合成（返回临时URL，不写入清单）
- POST `/api/ai/tts/batch`  发布流程内增量合成并写回清单与 `assets.audio`

### 九、交互关键点
- 选中高亮：OutlinePass 或材质描边，高亮与可见性互不干扰
- 对焦：相机飞行至目标包围盒；可设置时长与缓动
- 标注点：朝向相机；点击显示标注信息（标题+简介）；支持显隐
- 动画时间线：轨道开关、关键帧吸附、复制/粘贴、区间拉伸
- 步骤管理：可在时间线上添加步骤标记，编辑步骤名称和描述

### 十、验收标准（关键）
#### A. 三维课件编辑器
- 导入GLB/FBX并显示正确层级与材质；≥50万面模型流畅浏览
- 标注添加/保存/重新打开一致；标注仅包含标题和简介
- 动画制作：可创建多个动画，每个动画包含完整的时间线和步骤
- 时间线编辑与预览：镜头/显隐/TRS动画；导出/导入courseware.json无损
- Unity端可加载同一课件JSON，展示逻辑一致

#### B. AI讲课制作器（后期）
- 可读取三维课件内容，生成AI脚本
- 支持配音和数字人讲解
- Unity VR环境中可驱动数字人

### 十一、里程碑（调整版）
#### 第一阶段：三维课件编辑器（4-5周）
- M1 基础框架（1-2周）：课件列表、新建页面、模型选择与加载
- M2 标注功能（1周）：简化标注（标题+简介），标注点显示与编辑
- M3 动画完善（1-2周）：动画管理、步骤编辑、时间线优化
- M4 课件保存（1周）：courseware.json格式、导出导入、Unity对接测试

#### 第二阶段：AI课程编辑与发布（4-6周）
- M1（1周）：AI课程模块骨架（列表/创建/编辑），`course.json` Schema 定稿
- M2（1–2周）：AI生成后端（纲要+讲稿+图片候选），编辑器段落/图片/三维动作向导与预览
- M3（1–2周）：TTS策略落地（预览实时合成、发布批量合成与清单写回）、版权校验与CDN
- M4（1周）：发布流程、版本化、跨端联测（Unity/Web），验收

### 十二、风险与对策
- FBX转换失败/坐标轴差异 → 保留日志与回退；统一单位与坐标；允许手工修正
- 大模型性能 → KTX2、Draco、层级剔除、延迟加载、相机对焦范围限制
- 跨端一致性 → 以nodeIndex为主键；校验modelHash；路径作为回退
- 模块分离复杂度 → 明确三维课件与AI讲课的数据边界和接口

### 十三、依赖与边界
- 技术栈：three.js、React、glTFast、KTX2/Draco工具链；对象存储/CDN
- AI相关：DeepSeek API、TTS服务、数字人系统（第二阶段）
- 不在范围：蒙皮权重编辑、IK/约束搭建（交由DCC工具完成）

### 十四、入口调整说明
#### 移除内容
- 资源管理中的"点击模型进行编辑"入口

#### 新增内容
- 主导航栏"三维课件"模块
- 支持新建课件时选择模型来源（平台资源/本地上传）
- 独立的课件管理体系


