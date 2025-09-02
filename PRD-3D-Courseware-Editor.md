## 三维课件编辑器 PRD（Web + Unity 对接）

**版本**: v1.0  
**状态**: 草案（可执行）  
**最后更新**: 2025-08-27  
**适用目录**: `admin-platform/`（前端 Next.js + 后端 Node）

### 一、产品目标与价值
- **目标**: 在平台内提供“可视化三维课件编辑器”，完成模型导入、结构树、知识点标注、基础动画、内容导出与 AI 自动讲解；产物可在 Web 与 Unity 客户端一致回放（含 VR）。
- **价值**:
  - 教研侧可零代码制作三维课件，显著提升课程制作效率。
  - 课程侧提供自动讲解（AI）与互动浏览，提高学习体验与留存。
  - 与 Unity 共用资产（GLB + JSON），降低维护成本。

### 二、用户与角色
- **管理员/教研人员**: 创建/编辑课件、上传模型、标注、编辑时间线、生成 AI 讲解并发布。
- **学习者**: 浏览或播放 AI 讲解课件，交互查看标注与媒体。

### 三、名词与范围
- **模型**: 优先使用 glTF/GLB；FBX 通过服务端转换为 GLB。
- **标注（Annotation）**: 绑定到 glTF 节点（以 `nodeIndex` 为主键），包含标题、摘要、图片/视频等富媒体与锚点（局部偏移）。
- **时间线（Timeline）**: 相机、可见性/高亮、节点 TRS、标注显示等基础动画轨道。
- **AI 讲解（Course）**: 大模型基于“层级 + 标注”生成结构化讲稿与播放指令。

### 四、核心功能（Must）
1) 模型导入
   - 支持 GLB 直传、FBX 上传后端转换→GLB；显示模型统计（节点数、面数）。
2) 结构树
   - 展示 glTF 场景树；支持搜索、选中、显隐、隔离、相机对焦。
3) 知识点标注
   - 选中对象添加标签：标题、摘要、图片/视频 URL；锚点支持包围盒中心/命中点/局部偏移；视窗内显示看板/标记点。
4) 动画（基础）
   - 时间线编辑：相机关键帧、节点显隐/高亮、节点 TRS、步骤标记；常用缓动；预览。（不再需要“标注显隐轨道”）
5) 导出/保存
   - 以统一 JSON `courseware.json` 存储完整三维课件（模型地址、标注列表、时间线含步骤、可选渲染设置）；支持打包课件（含媒体清单）。
6) AI 课件生成与播放
   - DeepSeek 等大模型生成 `course.json`；可选接 TTS 语音与字幕；播放时镜头聚焦与高亮同步。
7) 平台接入
   - 在 `admin-platform/web` 左侧导航新增“**三维课件**”；列表/编辑器路由与鉴权打通。

### 五、非功能（Must/Should）
- 性能: KTX2 纹理、Draco/Meshopt；≥50万面可基本流畅浏览；异步/延迟加载。
- 兼容: Chrome/Edge；Unity 使用 glTFast；中英文 UI。
- 安全: 鉴权、上传类型与大小限制、媒体 URL 签名/访问控制。
- 可维护: 数据版本化（`version`、`modelHash`），服务端日志与任务队列（FBX→GLB）。

### 六、信息架构与页面
- 列表页 `/admin/three-courseware`
  - 列表/搜索/上传模型/新建课件/进入编辑。
- 编辑页 `/admin/three-courseware/[id]`
  - 三栏：结构树 | 三维视窗 | 属性/时间线/媒体/AI 讲解。
  - 视窗：选中高亮、对焦、标注点可见、播放控制。

### 七、数据格式（对外约定）
1) courseware.json（统一导出/导入）
```json
{
  "version": "1.0",
  "model": "https://.../model.glb",
  "annotations": [
    {
      "id": "uuid-1",
      "target": { "nodeIndex": 23, "path": "Root/Engine" },
      "anchor": { "space": "local", "offset": [0, 0.08, 0] },
      "label": { "title": "发动机", "summary": "驱动整车核心部件" },
      "media": [
        { "type": "image", "src": "media/engine.jpg" },
        { "type": "video", "src": "media/engine.mp4" }
      ]
    }
  ],
  "timeline": {
    "duration": 10,
    "cameraKeys": [{ "time": 0, "position": [1,2,3], "target": [0,0,0], "easing": "easeInOut" }],
    "visTracks": { "node-23": [{ "time": 0, "value": true }, { "time": 2.0, "value": false }] },
    "trsTracks": { "node-45": [{ "time": 1.5, "position": [0,0.1,0] }] },
    "steps": [ { "id": "step-1", "time": 2.5, "name": "步骤1" } ]
  },
  "settings": {
    "bgTransparent": false,
    "bgColor": "#919191",
    "lights": { "dir": { "intensity": 1.2 }, "amb": { "intensity": 0.6 } }
  }
}
```
说明：时间线不再包含“标注显隐轨道（annotationTracks）”。旧版 `annotations.json`/`timeline.json` 可在导入时合并为 `courseware.json`。

2) course.json（AI 讲解）
```json
{
  "version": "1.0",
  "title": "汽车结构讲解",
  "script": [
    {
      "id": "step-1",
      "say": "首先我们看到发动机，它是整车的动力来源。",
      "focus": { "nodeIndex": 23, "duration": 3.0 },
      "highlight": [{ "nodeIndex": 23, "mode": "outline" }],
      "showMedia": [{ "annotationId": "uuid-1", "type": "image" }],
      "tts": { "voice": "zh-CN-XiaoyiNeural", "rate": 1.0 }
    }
  ]
}
```

### 八、后端 API（概要）
- POST `/api/assets/upload`  上传 GLB/FBX → `{assetId, glbUrl?, status}`
- POST `/api/assets/convert`  触发 FBX→GLB → `{jobId}`；GET `/api/jobs/:id`
- GET/POST `/api/coursewares`  列表/创建
- GET/PUT `/api/coursewares/:id`  读写 `annotationsUrl`、`timelineUrl`、`courseUrl`
- POST `/api/ai/generate-course`  传入“层级+标注摘要” → 返回 `course.json`

### 九、交互关键点
- 选中高亮：OutlinePass 或材质描边，高亮与可见性互不干扰。
- 对焦：相机飞行至目标包围盒；可设置时长与缓动。
- 标注点：朝向相机；可点击打开富媒体面板；支持显隐。
- 时间线：轨道开关、关键帧吸附、复制/粘贴、区间拉伸。

### 十、验收标准（关键）
- 导入 GLB/FBX 并显示正确层级与材质；≥50 万面模型流畅浏览。
- 标注添加/保存/重新打开一致；媒体可正常预览。
- 时间线可编辑与预览：镜头/显隐/标注显示；导出/导入无损。
- AI 生成 `course.json` 可回放；（可选）TTS 同步字幕。
- Unity 端加载同一资产与 JSON，回放逻辑一致。

### 十一、里程碑（6–8 周参考）
- M1 基础（2 周）：上传/转换、GLB 加载、结构树、选中高亮、标注保存。
- M2 动画（2 周）：时间线相机/显隐/标注出现，关键帧与预览，导出 `timeline.json`。
- M3 AI 与打包（1–2 周）：AI 生成 `course.json`，TTS 可选，课件打包导出。
- M4 对接与发布（1–2 周）：Unity 加载与回放、导航与权限打通、发布流程完善。

### 十二、风险与对策
- FBX 转换失败/坐标轴差异 → 保留日志与回退；统一单位与坐标；允许手工修正。
- 大模型性能 → KTX2、Draco、层级剔除、延迟加载、相机对焦范围限制。
- AI 输出不稳定 → 严格 JSON schema + 校验/重试；few-shot 示例；保留人工编辑优先级。
- 跨端一致性 → 以 `nodeIndex` 为主键；校验 `modelHash`；路径作为回退。

### 十三、依赖与边界
- three.js / React Three Fiber、glTFast、KTX2/Draco 工具链；DeepSeek API；对象存储/CDN。
- 不在范围：蒙皮权重编辑、IK/约束搭建（交由 DCC 工具完成）。


