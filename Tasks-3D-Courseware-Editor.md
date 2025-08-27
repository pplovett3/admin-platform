## 三维课件编辑器 任务清单（admin-platform）

说明：按里程碑拆分，含前端 Web、后端 Server、AI、Unity 对接与发布。勾选顺序建议按里程碑推进。

### M1 基础
- [x] Web: 新增导航与路由 `三维课件` → `/admin/three-courseware`
- [x] Web: 列表页（搜索/上传 GLB/FBX/进入编辑）；课程元数据卡片（基础骨架）
- [x] Web: 编辑页骨架（三栏：结构树 | 3D 视窗 | 属性/媒体）（占位页）
- [x] Web: GLB 加载（DRACO/KTX2 支持）、相机对焦、拾取选中、高亮（OutlinePass）
- [x] Web: GLB 加载（DRACO/KTX2 支持）、相机对焦、拾取选中（基础版）
- [x] Web: 结构树（遍历 glTF 场景树，选中联动）
- [x] Web: 标注创建/编辑/删除（标题、摘要，锚点默认包围盒中心）
- [x] Web: 标注标记点渲染与点击交互（球体占位）
- [x] Web: 保存/加载 `annotations.json`（路径匹配目标）
- [x] Server: 上传沿用现有资源管理（模型上传复用，无需新建 API）
- [ ] Server: FBX→GLB 转换任务（FBX2glTF/Blender 子进程）、任务查询
- [ ] Server: 课件 CRUD（记录 annotations/timeline/course URL 与版本）

### M2 动画与时间线
- [ ] Web: 时间线 UI（轨道：相机/显隐/高亮/节点 TRS/标注显示）
- [ ] Web: 关键帧操作（添加/删除/拖拽、缓动、区间拉伸、复制粘贴）
- [ ] Web: 预览插值器（AnimationMixer 或自定义），与视窗状态同步
- [ ] Web: 导出/导入 `timeline.json`
- [ ] Web: 高亮稳定方案（OutlinePass 与材质描边二选一）
- [ ] Server: 课件版本化与回滚；打包导出（GLB + JSON + 媒体清单）

### M3 AI 与媒体
- [ ] Web: “生成 AI 讲解”面板，整理层级+标注摘要并调用后端
- [ ] Server: DeepSeek 集成，提示词模板与 JSON Schema 校验，产出 `course.json`
- [ ] Web: 播放 `course.json`（镜头聚焦/高亮/媒体展示/字幕）
- [ ] 可选: 接入 TTS（Edge/讯飞），生成音频与 SRT；播放器与时间线同步

### M4 对接与发布
- [ ] Unity: 使用 glTFast 加载 GLB；解析 annotations/timeline/course JSON
- [ ] Unity: 生成标注点 Prefab、点击打开 UI、回放时间线（Timeline/Playable 或 DOTween）
- [ ] Platform: 权限与角色（仅管理员/教研可编辑；其余只读）
- [ ] Platform: 发布与版本管理，CDN/签名 URL 接入
- [ ] QA: 性能与稳定性测试（≥50 万面）、FBX 转换失败回退流程

### 工程与基础设施
- [ ] 前端依赖：three.js/R3F、postprocessing、draco/ktx2 loaders、UI 组件库
- [ ] 后端依赖：FBX2glTF/Blender、任务队列、对象存储/静态资源服务
- [ ] 监控与日志：上传/转换/AI 调用日志、异常与告警
- [ ] 文档：README、数据结构说明、API 文档与示例

### 预估工作量（T-Shirt）
- M1: L  | M2: L  | M3: M  | M4: M  | 基建: M

### 里程碑验收清单
- [ ] M1：导入/树/标注可用，annotations 保存与重载正常
- [ ] M2：时间线可编辑与预览，timeline 保存与重载正常
- [ ] M3：AI 生成 `course.json` 并可回放；（可选）TTS 播放与字幕
- [ ] M4：Unity 端使用同一资产与 JSON 成功回放；平台权限与发布打通


