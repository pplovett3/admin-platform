# Unity数字人授课开发需求文档

## 1. 概述

本文档描述了Unity中AI课程数字人授课系统的开发需求，包括课程数据解析、TTS音频播放、字幕同步、数字人渲染、三维动作执行和播放控制功能实现。

## 2. 系统架构

```
VR用户 → Unity客户端 → 后端API → 课程JSON + 音频资源 + 图片资源
                      ↓
                   数据解析器
                      ↓
              数字人授课系统（TTS+字幕+指向+三维动作）
```

## 3. API对接

### 3.1 基础配置
- **服务器地址**: `http://106.15.229.165:4000`
- **认证方式**: JWT Token，放在请求头 `Authorization: Bearer <token>`
- **内容类型**: `application/json`
- **资源下载**: 音频、图片资源通过`https://dl.yf-xr.com`公网直链访问
- **CORS代理**: 如需要可通过`/api/public/proxy?url=<encoded_url>`代理访问

### 3.2 登录认证
```http
POST /api/auth/login
Content-Type: application/json

{
  "phone": "13800000000",
  "password": "admin123"
}
```

**响应**:
```json
{
  "token": "JWT_STRING",
  "user": {
    "id": "66b9...d3",
    "name": "Admin",
    "role": "superadmin",
    "className": "Admin",
    "school": "Default",
    "schoolId": "66b9...ab",
    "phone": "13800000000"
  }
}
```

### 3.3 获取发布课程列表（需要认证）
```http
GET /api/published-courses?q=&page=1&limit=20
Headers: Authorization: Bearer <token>
```

**响应**:
```json
{
  "items": [
    {
      "publishId": "68ca601b49dd9f75ff24ca6c",
      "title": "小米SU7车轮介绍",
      "description": "小米su7车轮课程",
      "publishedBy": "Admin",
      "publishedAt": "2025-09-19T10:30:00.000Z",
      "lastUpdated": "2025-09-19T11:00:00.000Z",
      "isPublic": true,
      "autoPlay": true,
      "viewCount": 15
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "pages": 1
  }
}
```

### 3.4 获取公开课程数据（无需认证）
```http
GET /api/public/course/{publishId}
```

**响应**:
```json
{
  "id": "68ca601b49dd9f75ff24ca6c",
  "title": "小米SU7车轮介绍",
  "description": "小米su7车轮课程",
  "publishConfig": {
    "isPublic": true,
    "allowDownload": false,
    "showAuthor": true,
    "enableComments": false,
    "autoPlay": true
  },
  "courseData": { /* AI课程数据 */ },
  "coursewareData": { /* 三维课件数据 */ },
  "publishedAt": "2025-09-19T10:30:00.000Z"
}
```

## 4. 数据结构解析

### 4.1 AI课程完整数据结构 (courseData)

```json
{
  "version": "1.0",
  "title": "小米SU7车轮介绍",
  "theme": "汽车零部件认知",
  "audience": "中职一年级",
  "durationTarget": 15,
  "language": "zh-CN",
  "voice": {
    "provider": "azure",
    "voice": "zh-CN-XiaoyiNeural",
    "rate": 1.0,
    "style": "general"
  },
  "coursewareId": "68bc53d55f017bd5c72d4013",
  "coursewareVersion": 3,
  "outline": [
    {
      "id": "seg-1",
      "title": "课程导入",
      "mode": "sequence",
      "items": [...]
    }
  ],
  "assets": {
    "images": [...],
    "audio": [...]
  }
}
```

### 4.2 段落结构解析 (outline)

#### 4.2.1 段落模式
```json
{
  "id": "seg-1",
  "title": "课程导入",
  "mode": "sequence",  // sequence: 顺序播放 | parallel: 并行播放
  "items": [...]
}
```

#### 4.2.2 段落项类型 (items)

**A. 纯说话 (talk)**
```json
{
  "type": "talk",
  "id": "item-1",
  "say": "首先我们看到发动机的整体结构...",
  "tts": {
    "provider": "azure",
    "voice": "zh-CN-XiaoyiNeural",
    "rate": 1.0
  },
  "audio": {
    "url": "https://dl.yf-xr.com/audio/seg-1_item-1_ab12.mp3",
    "duration": 6.2,
    "hash": "ab12...",
    "markers": {
      "words": [
        {"t": 0.12, "d": 0.30, "text": "首先"},
        {"t": 0.42, "d": 0.25, "text": "我们"}
      ],
      "phonemes": []
    }
  },
  "subtitles": [
    {"text": "首先我们看到发动机的整体结构", "offset": 0.0}
  ],
  "ui": {"showSubtitle": true}
}
```

**B. 图片讲解 (image.explain)**
```json
{
  "type": "image.explain",
  "id": "item-2",
  "say": "这一区域是气缸盖部分...",
  "image": {
    "src": "https://dl.yf-xr.com/images/engine-detail.jpg",
    "title": "发动机结构图",
    "source": {"url": "https://site", "license": "CC BY 4.0"},
    "bbox": [0.52, 0.31, 0.18, 0.12]  // [x, y, width, height] 归一化坐标
  },
  "pointer": {"enable": true, "target": "bbox"},
  "audio": {/* 同talk类型 */},
  "originalImageUrl": "https://dl.yf-xr.com/images/engine-detail.jpg"
}
```

**C. 三维动作 (scene.action)**
```json
{
  "type": "scene.action",
  "id": "item-3",
  "say": "现在我们来看实际的发动机模型",
  "actions": [
    {
      "type": "camera.focus",
      "target": {"nodeKey": "Root/Engine"},
      "duration": 2.0,
      "easing": "easeInOut"
    },
    {
      "type": "highlight.show",
      "targets": [{"nodeKey": "Root/Engine", "mode": "outline"}],
      "duration": 5.0
    },
    {
      "type": "annotation.show",
      "ids": ["uuid-1", "uuid-2"]
    },
    {
      "type": "animation.play",
      "animationId": "anim-1",
      "startTime": 0.0,
      "endTime": 5.0,
      "blend": 0.25
    },
    {
      "type": "visibility.set",
      "items": [{"nodeKey": "Root/Cover", "visible": false}]
    }
  ],
  "audio": {/* 同talk类型 */}
}
```

### 4.3 支持的三维动作类型

| 动作类型 | 描述 | 参数 |
|---------|------|------|
| `camera.focus` | 相机对焦到指定对象（VR环境下触发数字人移动和指向） | `target.nodeKey`, `duration`, `easing` |
| `visibility.set` | 设置对象显隐 | `items[].nodeKey`, `items[].visible` |
| `highlight.show` | 显示对象高亮 | `targets[].nodeKey`, `targets[].mode`, `duration` |
| `highlight.hide` | 隐藏对象高亮 | `targets[].nodeKey` |
| `annotation.show` | 显示指定标注 | `ids[]` |
| `annotation.hide` | 隐藏指定标注 | `ids[]` |
| `animation.play` | 播放动画片段 | `animationId`, `startTime`, `endTime`, `blend` |

### 4.4 音频资源清单 (assets.audio)

```json
{
  "assets": {
    "audio": [
      {
        "id": "aud-1",
        "url": "https://dl.yf-xr.com/audio/seg-1_item-1_ab12.mp3",
        "hash": "ab12...",
        "sr": 24000,
        "codec": "mp3",
        "duration": 6.2
      }
    ],
    "images": [
      {
        "id": "img-1",
        "src": "https://dl.yf-xr.com/images/engine-detail.jpg",
        "title": "发动机结构图",
        "license": "CC BY 4.0",
        "sourceUrl": "https://site"
      }
    ]
  }
}
```

### 4.5 三维课件数据 (coursewareData)

继承现有的三维课件数据结构，包含：
- `modelUrl` / `modifiedModelUrl`: GLB模型文件URL
- `annotations[]`: 标注数据
- `animations[]`: 动画数据
- `modelStructure`: 模型结构信息

## 5. 功能需求

### 5.1 核心系统需求

#### 5.1.1 AI课程管理器
- **功能**: API客户端、课程数据下载和解析、播放控制协调
- **要求**: 支持课程数据缓存、网络异常处理、数据格式验证

#### 5.1.2 数字人系统
- **功能**: 3D数字人渲染、口型同步、眼神和头部朝向、移动和指向控制
- **要求**: 
  - 支持音素级口型同步
  - 自然的眨眼和闲置动画
  - 3D数字人移动到指定位置
  - 手指指向目标对象（带射线效果）
  - 头部朝向跟随重要内容

#### 5.1.3 TTS音频系统
- **功能**: 音频播放抽象层、移动端兼容处理、音频预加载和缓存
- **要求**:
  - 优先使用预录音频（课程发布时生成）
  - 支持实时TTS降级（在线环境）
  - iOS/Android移动端音频解锁
  - 离线占位模式（纯字幕）

#### 5.1.4 字幕系统
- **功能**: 字幕渲染、时间轴同步、词级/音素级标记支持
- **要求**:
  - 支持精确字幕时间轴
  - 词级标记逐字显示
  - 字幕渐入渐出效果
  - VR环境适配布局

#### 5.1.5 三维动作执行器
- **功能**: 解析标准动作并触发数字人交互、对象显隐/高亮、标注显示、动画片段播放
- **要求**:
  - 解析`camera.focus`动作时自动触发数字人移动到目标对象附近
  - 解析`highlight.show`动作时自动触发数字人手指指向目标对象（带射线效果）
  - 对象高亮/描边效果
  - 标注显示/隐藏控制
  - 动画片段精确播放
  - 复用现有三维课件系统

#### 5.1.6 段落调度器
- **功能**: 顺序/并行播放控制、播放进度管理、上一步/下一步导航
- **要求**:
  - 支持segment内items的顺序/并行播放
  - 播放进度跟踪和恢复
  - 倍速播放控制
  - 播放状态管理

### 5.2 交互需求

#### 5.2.1 VR控制界面
- **功能**: VR环境下的播放控制面板
- **要求**:
  - 播放/暂停/上一步/下一步按钮
  - 播放进度显示
  - 倍速控制滑块
  - 手柄射线交互


### 5.3 容错机制
- **功能**: 资源缺失时的降级处理
- **要求**:
  - 音频缺失时显示字幕并估算时长
  - 图片缺失时显示占位图
  - 3D对象缺失时跳过动作
  - 网络异常时的离线模式

### 5.4 平台适配需求

#### 5.4.1 PICO4设备适配
- **功能**: 针对PICO4 VR一体机的专门适配
- **要求**:
  - PICO4手柄交互适配
  - PICO4分辨率和性能优化
  - PICO4音频系统集成
  - PICO4 SDK特性支持

## 6. 开发流程建议

### 6.1 阶段一：基础播放系统 (2-3周)
1. **API对接**: 实现用户认证和课程列表获取
2. **课程选择**: 实现发布课程列表UI和选择逻辑
3. **基础播放**: 创建播放控制器和状态管理
4. **音频系统**: 实现TTS音频播放（优先预录音频）
5. **字幕系统**: 基础字幕渲染和同步

### 6.2 阶段二：数字人系统 (2-3周)
1. **3D数字人**: 实现3D数字人模型渲染
2. **口型同步**: 实现音频驱动的口型动画
3. **动作解析**: 实现对标准三维动作的智能解析
4. **交互响应**: 基于解析结果触发数字人移动和指向行为

### 6.3 阶段三：三维动作集成 (2周)
1. **系统集成**: 集成现有的三维课件系统
2. **动作执行**: 实现场景动作执行器
3. **智能解析**: 实现对标准动作的数字人行为映射
4. **显隐高亮**: 实现对象显隐、高亮、标注控制

### 6.4 阶段四：优化与完善 (1-2周)
1. **PICO4适配**: 针对PICO4设备的专门优化
2. **容错机制**: 实现资源缺失的降级处理
3. **VR交互**: 完善VR控制界面
4. **一致性验证**: 与Web版播放效果对比验证

## 7. 测试验证

### 7.1 示例课程信息
**当前服务器上的测试课程**:
- **发布ID**: `68ca601b49dd9f75ff24ca6c`
- **课程标题**: `小米SU7车轮介绍`
- **访问URL**: `http://106.15.229.165:3000/course/68ca601b49dd9f75ff24ca6c`
- **包含内容**: talk、image.explain、scene.action三种类型示例
- **资源**: 集成了TTS音频、图片资源和三维动作

### 7.2 验收标准
1. **播放功能**: 能够完整播放AI课程，包含音频、字幕、3D数字人动画
2. **智能解析**: 能够正确解析`camera.focus`并触发数字人移动，解析`highlight.show`并触发数字人指向
3. **数字人交互**: 数字人能够自然移动到目标对象附近，手指准确指向目标（带射线效果）
4. **VR交互**: PICO4设备上的控制界面正常工作
5. **容错处理**: 资源缺失时能够优雅降级而不崩溃
6. **性能表现**: 在PICO4设备上保持稳定帧率

## 8. API接口快速参考

| 接口 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/auth/login` | POST | 用户登录 | 否 |
| `/api/published-courses` | GET | 获取发布课程列表 | 是 |
| `/api/public/course/{publishId}` | GET | 获取公开课程 | 否 |
| `/api/public/proxy?url={encoded_url}` | GET | CORS代理访问 | 否 |
| `/api/coursewares` | GET | 获取课件列表 | 是 |
| `/api/coursewares/{id}` | GET | 获取课件详情 | 是 |

## 9. 错误码参考

| 状态码 | 说明 | 处理建议 |
|--------|------|---------|
| 200 | 成功 | 正常处理 |
| 400 | 请求参数错误 | 检查publishId格式 |
| 401 | 认证失败 | 重新登录获取token |
| 403 | 权限不足 | 检查用户权限 |
| 404 | 课程不存在 | 课程可能已下线 |
| 500 | 服务器错误 | 稍后重试或降级处理 |

## 10. 注意事项

### 10.1 3D数字人要求
- 3D数字人模型需要支持口型同步
- 数字人移动需要平滑过渡和寻路
- 手指指向需要精确的射线效果
- 支持自然的眨眼和闲置动画

### 10.2 VR环境适配
- PICO4设备性能优化
- VR环境下的UI布局和交互
- 手柄射线交互的精确性
- 3D空间中的字幕显示

### 10.3 音频系统
- 音频格式兼容性(MP3/WAV/OGG)
- 网络音频加载失败时的降级策略
- VR环境下的3D音频效果

### 10.4 性能考虑
- 3D数字人模型的面数和材质优化
- 图片纹理压缩和分辨率优化
- 3D模型LOD处理
- PICO4设备的内存和CPU限制
