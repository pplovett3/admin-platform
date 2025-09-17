## 三维课件编辑器 任务清单（admin-platform）

说明：按阶段划分，完成的任务用 ✅ 标记，进行中用 🔄 标记，待开始用 ⏳ 标记。

### 阶段一：基础架构与编辑器核心
#### 前端基础架构
- [x] Web: 新增导航与路由 `三维课件` → `/admin/three-courseware`
- [x] Web: 课件列表页面（创建/编辑/删除）
- [x] Web: 新建课件页面（基础信息）
- [x] Web: 编辑器页面骨架（三栏：结构树 | 3D 视窗 | 时间线）

#### 三维编辑器核心
- [x] Web: GLB 模型加载（DRACO/KTX2 支持）
- [x] Web: 结构树（遍历 glTF 场景，选中联动，显隐控制）
- [x] Web: 相机控制（对焦、框选、旋转优化）
- [x] Web: 对象拾取与高亮（OutlinePass）
- [x] Web: 变换操控（位置/旋转/缩放）

#### 动画系统
- [x] Web: 时间线 UI（相机、显隐、TRS 轨道）
- [x] Web: 关键帧操作（增删改、时间调整）
- [x] Web: 关键帧多选与批量操作
- [x] Web: 关键帧复制粘贴（Ctrl+C/V）
- [x] Web: 动画预览与播放
- [x] Web: 撤销重做系统
- [x] Web: 步骤管理（名称、描述、时间点）

#### 标注系统
- [x] Web: 标注创建/编辑/删除（简化版：标题+简介）
- [x] Web: 标注标记点渲染与交互
- [x] Web: 标注数据导入导出
- [x] Web: 简化标注功能（仅保留标题+简介，移除富媒体）

### 阶段二：后端系统与数据持久化
#### 后端API开发
- [x] Server: 创建 Courseware 数据模型（MongoDB）
- [x] Server: 实现课件 CRUD API（创建/读取/更新/删除/列表）
- [x] Server: 添加课件路由与权限控制
- [x] Server: 扩展资源 API（模型资源列表、本地上传）

#### 前后端集成
- [x] Web: 编辑器与后端API集成（保存/加载课件数据）
- [x] Web: 实现 courseware.json 数据格式
- [x] Web: 新建页面添加模型选择功能
- [x] Web: 平台资源浏览器（个人/公共资源）
- [x] Web: 本地模型上传功能

#### 功能完善
- [x] Web: 简化标注功能（移除富媒体，仅保留标题+简介）
- [x] Web: 移除资源管理中的旧编辑入口
- [ ] Web: 错误处理与用户体验优化

### 阶段三：AI课程系统（Web + Server）
#### 3.1 后端（Server）
- [x] Server: DeepSeek/通义等大模型接入与抽象层
- [x] Server: `/api/ai/generate-course` 初稿生成（大纲+讲稿+图片候选+三维动作建议）
- [x] Server: `/api/ai/search-images` 图片检索与版权信息回填（Metaso集成）
- [x] Server: `/api/ai/tts` 多供应商TTS实时合成（Minimax异步 + Azure同步）
- [x] Server: `/api/ai/tts/providers` TTS供应商和音色列表
- [x] Server: `/api/ai/tts/status` TTS任务状态查询（Minimax）
- [x] Server: `/api/ai-courses` CRUD（创建、读取、更新、删除、列表）
- [ ] Server: `/api/ai/tts/batch` 批量增量合成（发布用，写回清单与 `assets.audio`）
- [ ] Server: `/api/ai-courses/:id/publish` 发布流程（含合成队列）

#### 3.2 前端（Web）
- [x] Web: 导航与路由新增"AI课程编辑" → `/admin/ai-course`
- [x] Web: 列表页（搜索/创建/删除/发布状态）
- [x] Web: 新建页（基础信息+选择 `coursewareId`）
- [x] Web: 编辑页骨架（段落树 | 3D视窗/媒体预览 | 属性面板）
- [x] Web: AI生成初稿（触发接口、结果合并与版本管理）
- [x] Web: 段落编辑（`talk`/`image.explain`/`scene.action`）、并行/顺序切换
- [x] Web: 三维动作向导（拾取 `nodeKey`/`annotationId`/`animationId` 与时间片段）
- [x] Web: 图片搜索与选择（Metaso API集成，弹窗选择）
- [x] Web: TTS多供应商试听（Azure快速、Minimax高质量，动态配置界面）
- [x] Web: 暗色模式适配与UI优化（布局、按钮、卡片样式）
- [x] Web: 预览功能完善（图片叠加、相机/显隐/高亮/标注/动画片段）
- [x] Web: 段落和步骤拖拽排序功能
- [x] Web: 场景选取空对象过滤（只选取有网格的具体模型）
- [x] Web: 步骤列表UI优化（图标化、隐藏sequence标签）
- [x] Web: 修复AI生成annotation.highlight动作类型问题
- [ ] Web: 发布流程（触发批量TTS、写回清单、CDN状态显示）

#### 3.3 发布与公开查看器
- [x] Server: 发布课程数据模型（PublishedCourse）
- [x] Server: 发布相关API（创建/更新/删除/公开访问）
- [x] Server: 智能分层存储（服务器存轻量数据，NAS存重资源）
- [x] Web: 编辑器中的发布配置对话框
- [x] Web: 发布状态管理和分享链接生成
- [x] Web: 公开查看页面 `/course/[publishId]`（无需登录）
- [x] Web: 移动端自适应设计（支持主流手机浏览器）
- [x] Web: 公开播放器功能（播放控制、进度条、分享）
- [x] Web: 资源渐进式加载和缓存优化

### 阶段四：Unity集成与发布
#### 4.1 三维课件（已完成，按“Unity三维课件开发需求文档.md”）
- [x] Unity: API 客户端与认证
- [x] Unity: 课件列表与详情拉取、GLB 下载缓存
- [x] Unity: GLB 加载（glTFast），结构树映射（nodeKey→GameObject）
- [x] Unity: 标注系统（渲染/射线点击/详情面板）
- [x] Unity: 高亮系统（描边/半透明）
- [x] Unity: 动画系统（显隐轨道播放、步骤控制、正/倒向播放）
- [x] Unity: 相机系统（对焦/飞行/缓动）
- [x] Unity: 与后端课件数据一致性校验（modelHash/nodeKey）

#### 4.2 AI课程解析与数字人授课（新增）
- [ ] Unity: 解析 `course.json`（Segment/Item/SceneAction/Assets）
- [ ] Unity: TTS 播放与抽象层（对接本地或云端SDK，优先用清单音频）
- [ ] Unity: 字幕渲染与时间轴同步（优先用词级/音素级标记）
- [ ] Unity: 数字人方案V1（2D说话头像：口型/眼神/头部朝向）
- [ ] Unity: 指向系统（3D节点与图片bbox）
- [ ] Unity: 三维动作执行器（camera.focus/visibility/highlight/annotation/animation片段）
- [ ] Unity: 段落与并行/顺序调度、播放控制（上一步/下一步/暂停/倍速）
- [ ] Unity: 预加载与容错（资源缺失降级、离线占位音）
- [ ] Unity: 与 Web 一致性联测与验收




