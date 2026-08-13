# Unity客户端 API接口文档

## 基础信息

- **服务器地址**: `https://platform.yf-xr.com`
- **API前缀**: `/api`
- **认证方式**: JWT Token，放在请求头 `Authorization: Bearer <token>`
- **内容类型**: `application/json`
- **资源下载**: 使用返回的完整URL直接下载（已包含域名和路径）

## ⚠️ 重要提示

**所有需要认证的接口（包括文件下载）都必须在请求头中携带Token：**

```http
Authorization: Bearer <your_token_here>
```

**常见错误**：
- ❌ **401 Unauthorized**：未携带Token或Token已过期 → 需要重新登录
- ❌ **403 Forbidden**：Token有效但权限不足 → 检查资源访问权限
- ✅ **正确做法**：登录后保存Token，所有后续请求都带上Token

---

## 📋 接口使用指南（按角色区分）

平台支持两类用户，使用不同的接口：

| 角色 | 获取课程列表 | 获取课程详情 | 资源管理 |
|------|-------------|-------------|---------|
| **学生** | `/api/portal/courses` | `/api/portal/courseware/:id`<br>`/api/portal/ai-course/:id` | ❌ 无权限 |
| **老师** | `/api/coursewares/client/list`<br>`/api/published-courses/client/list` | `/api/coursewares/:id`<br>`/api/public/course/:publishId` | `/api/files/client/mine`<br>`/api/files/client/public` |

### 审核状态说明

课件需要经过发布和审核流程才能被学生查看：

| 审核状态 | 说明 | 学生可见 |
|---------|------|---------|
| `draft` | 草稿 | ❌ |
| `pending` | 待审核 | ❌ |
| `approved` | 审核通过 | ✅ |
| `rejected` | 审核拒绝 | ❌ |

---

## 1. 用户认证

### 1.1 登录
获取JWT Token用于后续API访问。

```http
POST /api/auth/login
Content-Type: application/json
```

**请求体**:
```json
{
  "phone": "13800000000",
  "password": "admin123"
}
```

**响应** (200):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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

**角色类型**:
- `superadmin`: 超级管理员
- `schoolAdmin`: 学校管理员
- `teacher`: 老师
- `student`: 学生

**说明**:
- Token有效期为7天
- 后续所有需要认证的接口，在请求头添加: `Authorization: Bearer <token>`
- **学生账号**使用门户接口获取审核通过的课程
- **老师账号**使用管理接口获取自己创建的课程

---

## 2. 学生门户接口（获取审核通过的课程）

> ⭐ **学生账号推荐使用以下接口**，可获取平台上所有老师发布并审核通过的课程

### 2.1 获取课程列表（学生专用）
获取所有审核通过的三维课件和AI课程列表。

```http
GET /api/portal/courses?type=all&q=&page=1&limit=20
Authorization: Bearer <token>
```

**查询参数**:
- `type`: 可选，课程类型筛选
  - `all`: 全部（默认）
  - `courseware`: 仅三维课件
  - `ai-course`: 仅AI课程
- `q`: 可选，模糊搜索课程名称或描述
- `page`: 可选，页码（默认1）
- `limit`: 可选，每页数量（默认20）

**响应** (200):
```json
{
  "items": [
    {
      "id": "68bc53d55f017bd5c72d4013",
      "title": "小米SU7轮胎",
      "description": "小米SU7车轮拆解课件",
      "thumbnail": "https://platform.yf-xr.com/api/files/xxx/download",
      "viewCount": 128,
      "publishedAt": "2025-01-20T10:30:00.000Z",
      "type": "courseware",
      "createdBy": "张老师"
    },
    {
      "id": "6904275baa0c1d733e9cc722",
      "publishedId": "6904275baa0c1d733e9cc723",
      "sharePath": "/course/6904275baa0c1d733e9cc723",
      "title": "小米SU7车轮介绍",
      "description": "汽车零部件认知",
      "thumbnail": "https://platform.yf-xr.com/api/files/xxx/download",
      "viewCount": 256,
      "publishedAt": "2025-01-21T15:45:00.000Z",
      "type": "ai-course",
      "createdBy": "李老师"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1
  }
}
```

**返回字段说明**:

| 字段 | 说明 |
|------|------|
| `id` | 课程ID |
| `publishedId` | 仅AI课程有，发布后的课程ID |
| `sharePath` | 仅AI课程有，分享路径 |
| `title` | 课程标题 |
| `description` | 课程描述 |
| `thumbnail` | 封面图URL |
| `viewCount` | 访问次数 |
| `publishedAt` | 审核通过时间 |
| `type` | 类型：`courseware`（三维课件）或 `ai-course`（AI课程） |
| `createdBy` | 创建者姓名 |

### 2.2 获取三维课件详情（学生专用）
获取审核通过的三维课件完整数据。

```http
GET /api/portal/courseware/{coursewareId}
Authorization: Bearer <token>
```

**可选参数**:
- `countView=true`: 增加访问计数（首次加载时传入）

**响应** (200):
```json
{
  "_id": "68bc53d55f017bd5c72d4013",
  "name": "小米SU7轮胎",
  "description": "小米SU7车轮拆解课件",
  "thumbnail": "https://platform.yf-xr.com/...",
  "modelUrl": "https://platform.yf-xr.com/api/files/courseware-download?path=models%2F...",
  "modifiedModelUrl": "https://platform.yf-xr.com/api/files/courseware-download?path=modifiedModels%2F...",
  "annotations": [
    {
      "id": "4bd0c92c-d87a-4f70-9985-5502c77ca583",
      "title": "轮毂",
      "description": "铝合金轮毂结构",
      "nodeKey": "Xiaomi_SU7_LRB/左后轮/rimDarkIn_001_LRW",
      "position": {"x": 0.069, "y": 0.004, "z": 0.003},
      "labelOffset": {"x": 0.22, "y": 0, "z": 0},
      "labelOffsetSpace": "local"
    }
  ],
  "hotspots": [...],
  "animations": [
    {
      "id": "71361f28-b009-4b5e-89d3-8f4e9009f368",
      "name": "轮胎拆解动画",
      "description": "展示轮胎拆卸过程",
      "steps": [
        {"id": "step-1", "name": "初始状态", "description": "完整轮胎", "time": 0},
        {"id": "step-2", "name": "拆除外胎", "description": "显示轮毂", "time": 1.5}
      ],
      "timeline": {
        "duration": 7.33,
        "visTracks": [
          {
            "nodeKey": "Xiaomi_SU7_LRB/左后轮/tire_001_LRW",
            "keys": [
              {"time": 0, "visible": true, "easing": "linear"},
              {"time": 1.5, "visible": false, "easing": "linear"}
            ]
          }
        ]
      }
    }
  ],
  "settings": {
    "defaultCamera": {"position": {"x": 2, "y": 1, "z": 2}},
    "lighting": {"type": "environment", "intensity": 1.0}
  },
  "modelStructure": {
    "objects": [
      {
        "path": ["Xiaomi_SU7_LRB"],
        "uuid": "80a48c8e-bb93-4304-8d7d-b64cb86d2694",
        "name": "Xiaomi_SU7_LRB",
        "visible": true,
        "type": "Group"
      }
    ],
    "deletedUUIDs": []
  },
  "viewCount": 128,
  "reviewedAt": "2025-01-20T10:30:00.000Z",
  "createdBy": {"name": "张老师"}
}
```

**说明**:
- 仅返回 `reviewStatus=approved` 的课件
- 如果课件未审核通过，返回 404 错误
- `hotspots` 是 `annotations` 的兼容格式

### 2.3 获取AI课程详情（学生专用）
获取审核通过的AI课程完整数据，**包含配音音频URL和三维课件模型信息**。

```http
GET /api/portal/ai-course/{id}
Authorization: Bearer <token>
```

**说明**：使用课程列表中返回的 `id` 字段，接口会自动返回发布后的课程数据（包含 audioUrl）。

**响应** (200):
```json
{
  "_id": "6904275baa0c1d733e9cc722",
  "publishedId": "6904275baa0c1d733e9cc723",
  "title": "小米SU7车轮介绍",
  "description": "详细讲解小米SU7车轮结构",
  "thumbnail": "https://platform.yf-xr.com/...",
  "publishedAt": "2025-01-20T10:30:00.000Z",
  "coursewareId": "68bc53d55f017bd5c72d4013",
  "coursewareData": {
    "_id": "68bc53d55f017bd5c72d4013",
    "name": "小米SU7轮胎",
    "description": "小米SU7车轮拆解课件",
    "modelUrl": "/api/files/courseware-download?path=models%2F...",
    "modifiedModelUrl": "/api/files/courseware-download?path=modifiedModels%2F...",
    "annotations": [
      {
        "id": "4bd0c92c-d87a-4f70-9985-5502c77ca583",
        "title": "轮毂",
        "description": "铝合金轮毂结构",
        "nodeKey": "Xiaomi_SU7_LRB/左后轮/rimDarkIn_001_LRW",
        "position": {"x": 0.069, "y": 0.004, "z": 0.003}
      }
    ],
    "animations": [...],
    "settings": {...},
    "modelStructure": {...}
  },
  "courseData": {
    "outline": [
      {
        "id": "seg-1",
        "title": "课程导入",
        "mode": "sequence",
        "items": [
          {
            "type": "talk",
            "id": "item-1",
            "say": "大家好，今天我们来学习小米SU7的车轮结构...",
            "audioUrl": "/api/public/files/68dfa2xxx",
            "audioDuration": 6200
          },
          {
            "type": "scene.action",
            "id": "item-2",
            "say": "现在让我们看看轮胎的内部结构...",
            "audioUrl": "/api/public/files/68dfa3xxx",
            "audioDuration": 8500,
            "actions": [
              {"type": "camera.focus", "target": {"nodeKey": "轮胎"}}
            ]
          }
        ]
      }
    ],
    "quizEnabled": true,
    "quiz": [...],
    "assets": {}
  },
  "stats": {
    "viewCount": 128
  }
}
```

**核心字段说明**:

| 字段 | 说明 |
|------|------|
| `publishedId` | 发布课程ID |
| `coursewareId` | 关联的三维课件ID |
| `coursewareData.modelUrl` | 原始模型下载URL |
| `coursewareData.modifiedModelUrl` | 编辑后模型下载URL（**优先使用**） |
| `coursewareData.annotations` | 标注点数据 |
| `coursewareData.animations` | 动画列表 |
| `courseData.outline[].items[].audioUrl` | ⭐ **配音音频URL** |
| `courseData.outline[].items[].audioDuration` | 音频时长（毫秒） |
| `courseData.outline[].items[].say` | 讲解文字（字幕） |
| `courseData.quiz` | 测验题目 |

**资源下载**:

```
音频下载（无需Token）:
GET https://platform.yf-xr.com{audioUrl}
例如: GET https://platform.yf-xr.com/api/public/files/68dfa2xxx

模型下载（需要Token）:
GET https://platform.yf-xr.com{coursewareData.modifiedModelUrl}
Authorization: Bearer <token>
```

**说明**:
- 仅返回 `reviewStatus=approved` 的课程
- 如果课程未审核通过，返回 404 错误
- **接口会自动从发布数据中获取 audioUrl**，无需额外调用其他接口
- **模型下载**：优先使用 `coursewareData.modifiedModelUrl`，如果为空则使用 `modelUrl`

### 2.4 获取学生学习记录

```http
GET /api/portal/my-study
Authorization: Bearer <token>
```

**响应** (200):
```json
{
  "records": [
    {
      "courseId": "6904275baa0c1d733e9cc722",
      "courseTitle": "小米SU7车轮介绍",
      "sharePath": "/course/6904275baa0c1d733e9cc723",
      "score": 85,
      "totalQuestions": 10,
      "correctCount": 8,
      "completedAt": "2025-01-21T15:45:00.000Z"
    }
  ],
  "stats": {
    "totalCourses": 5,
    "completedCourses": 3,
    "totalQuizzes": 8,
    "averageScore": 78.5
  }
}
```

---

## 3. 资源管理（老师专用）

> 📁 **以下接口供老师管理自己上传的素材资源**

### 3.1 获取个人资源列表
获取当前老师上传的所有资源。

```http
GET /api/files/client/mine
Authorization: Bearer <token>
```

**响应** (200):
```json
{
  "rows": [
    {
      "name": "模型文件.glb",
      "type": "模型",
      "download": "https://platform.yf-xr.com/api/files/68af267e83f0e85a3dd4d13f/download"
    },
    {
      "name": "图片.png",
      "type": "图片",
      "download": "https://platform.yf-xr.com/api/files/68bc54af5f017bd5c72d402a/download"
    }
  ]
}
```

### 3.2 获取平台公共素材
获取超级管理员上传的平台公共素材（供所有老师使用）。

```http
GET /api/files/client/public
Authorization: Bearer <token>
```

**响应** (200):
```json
{
  "rows": [
    {
      "name": "共享模型.glb",
      "type": "模型",
      "download": "https://platform.yf-xr.com/api/files/68bc54af5f017bd5c72d402a/download"
    }
  ]
}
```

**说明**:
- 返回由超级管理员上传并设为公开的平台素材
- 老师可以在创建课件时使用这些公共素材

### 3.3 下载资源文件
通过文件ID下载资源（需要是本人资源或公共资源）。

```http
GET /api/files/{fileId}/download
Authorization: Bearer <token>  ⚠️ 必需
```

**⚠️ 重要：此接口必须携带Token，否则返回401错误**

**说明**:
- 直接返回文件二进制流
- `fileId`从资源列表接口中获取
- 也可直接使用资源列表返回的`download`字段完整URL
- **必须在请求头中添加** `Authorization: Bearer <token>`

**Unity示例代码**:
```csharp
string downloadUrl = "https://platform.yf-xr.com/api/files/69032f6a3700340c21429867/download";
UnityWebRequest request = UnityWebRequest.Get(downloadUrl);
request.SetRequestHeader("Authorization", "Bearer " + yourToken);
yield return request.SendWebRequest();

if (request.result == UnityWebRequest.Result.Success) {
    byte[] fileData = request.downloadHandler.data;
    // 处理文件数据
} else {
    Debug.LogError("下载失败: " + request.error);
}
```

---

## 4. 三维课件管理（老师专用）

> 🎨 **以下接口供老师管理自己创建的三维课件**

### 4.1 获取课件列表（老师专用）
获取当前老师创建的三维课件列表。

```http
GET /api/coursewares/client/list?q=&page=1&limit=20
Authorization: Bearer <token>
```

**查询参数**:
- `q`: 可选，模糊搜索课件名称或描述
- `page`: 可选，页码（默认1）
- `limit`: 可选，每页数量（默认20）

**响应** (200):
```json
{
  "items": [
    {
      "id": "68bc53d55f017bd5c72d4013",
      "name": "小米SU7轮胎",
      "description": "小米SU7车轮拆解课件"
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

**说明**:
- ⚠️ **此接口仅返回当前老师自己创建的课件**
- 超级管理员可以看到所有课件
- 学生获取课程请使用 `/api/portal/courses`

### 4.2 获取课件详细信息（老师专用）
获取课件完整数据，包括标注、动画、模型结构等。

```http
GET /api/coursewares/{coursewareId}
Authorization: Bearer <token>
```

**说明**: 
- 使用4.1接口获取课件ID后，调用此接口获取完整数据
- 返回包含所有标注、动画、模型结构等详细信息

**响应** (200):
```json
{
  "_id": "68bc53d55f017bd5c72d4013",
  "name": "小米SU7轮胎",
  "description": "小米SU7车轮拆解课件",
  "modelUrl": "https://platform.yf-xr.com/api/files/courseware-download?path=models%2F...",
  "modifiedModelUrl": "https://platform.yf-xr.com/api/files/courseware-download?path=modifiedModels%2F...",
  "reviewStatus": "approved",
  "annotations": [
    {
      "id": "4bd0c92c-d87a-4f70-9985-5502c77ca583",
      "title": "轮毂",
      "description": "铝合金轮毂结构",
      "nodeKey": "Xiaomi_SU7_LRB/左后轮/rimDarkIn_001_LRW",
      "position": {"x": 0.069, "y": 0.004, "z": 0.003},
      "labelOffset": {"x": 0.22, "y": 0, "z": 0},
      "labelOffsetSpace": "local"
    }
  ],
  "animations": [
    {
      "id": "71361f28-b009-4b5e-89d3-8f4e9009f368",
      "name": "轮胎拆解动画",
      "description": "展示轮胎拆卸过程",
      "steps": [
        {"id": "step-1", "name": "初始状态", "description": "完整轮胎", "time": 0},
        {"id": "step-2", "name": "拆除外胎", "description": "显示轮毂", "time": 1.5}
      ],
      "timeline": {
        "duration": 7.33,
        "visTracks": [
          {
            "nodeKey": "Xiaomi_SU7_LRB/左后轮/tire_001_LRW",
            "keys": [
              {"time": 0, "visible": true, "easing": "linear"},
              {"time": 1.5, "visible": false, "easing": "linear"}
            ]
          }
        ]
      }
    }
  ],
  "settings": {
    "defaultCamera": {"position": {"x": 2, "y": 1, "z": 2}},
    "lighting": {"type": "environment", "intensity": 1.0}
  },
  "modelStructure": {
    "objects": [
      {
        "path": ["Xiaomi_SU7_LRB"],
        "uuid": "80a48c8e-bb93-4304-8d7d-b64cb86d2694",
        "name": "Xiaomi_SU7_LRB",
        "visible": true,
        "type": "Group"
      }
    ],
    "deletedUUIDs": []
  },
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-20T14:22:00.000Z",
  "version": 3
}
```

**核心字段解析**:

| 字段 | 说明 |
|------|------|
| `reviewStatus` | 审核状态：draft/pending/approved/rejected |
| `annotations[]` | 标注点数据，包含位置、标题、描述 |
| `animations[]` | 动画列表，包含步骤和显隐轨道 |
| `animations[].timeline.visTracks[]` | 显隐动画轨道，控制对象的显示/隐藏 |
| `modelStructure.objects[]` | 模型层级结构树 |
| `settings` | 场景设置（相机、光照等） |

### 4.3 下载课件模型
直接使用课件详情中返回的URL下载GLB模型。

```http
GET {modifiedModelUrl 或 modelUrl}
Authorization: Bearer <token>  ⚠️ 必需
```

**⚠️ 重要：课件模型下载必须携带Token**

**说明**:
- 优先使用`modifiedModelUrl`（编辑器处理后的模型）
- 如果`modifiedModelUrl`为空，使用`modelUrl`（原始模型）
- 直接返回GLB文件二进制流
- **URL示例**: `https://platform.yf-xr.com/api/files/courseware-download?path=modifiedModels%2F...`

**Unity示例代码**:
```csharp
string modelUrl = courseware.modifiedModelUrl; // 从课件详情中获取
UnityWebRequest request = UnityWebRequest.Get(modelUrl);
request.SetRequestHeader("Authorization", "Bearer " + yourToken);
yield return request.SendWebRequest();

if (request.result == UnityWebRequest.Result.Success) {
    byte[] glbData = request.downloadHandler.data;
    // 加载GLB模型
} else {
    Debug.LogError("模型下载失败: " + request.error);
}
```

---

## 5. AI课程管理（老师专用）

> 🎓 **以下接口供老师管理自己创建的AI课程（数字人授课）**

### 5.1 获取已发布课程列表（老师专用）
获取当前老师发布的AI课程列表。

```http
GET /api/published-courses/client/list?q=&page=1&limit=20
Authorization: Bearer <token>
```

**查询参数**:
- `q`: 可选，模糊搜索课程标题
- `page`: 可选，页码（默认1）
- `limit`: 可选，每页数量（默认20）

**响应** (200):
```json
{
  "items": [
    {
      "id": "6904275baa0c1d733e9cc722",
      "title": "小米SU7车轮介绍",
      "description": "详细讲解小米SU7车轮结构和工作原理"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

**说明**:
- ⚠️ **此接口仅返回当前老师自己发布的课程**
- 超级管理员可以看到所有发布课程
- 学生获取课程请使用 `/api/portal/courses`

### 5.2 获取公开课程详细数据（分享链接用）
获取已发布课程的完整数据，用于公开分享链接。

```http
GET /api/public/course/{publishId}
```

**说明**: 
- 此接口**无需认证**，适合公开分享的课程
- 使用5.1接口获取课程ID后，调用此接口获取完整数据
- 返回包含所有课程大纲、音频、图片、三维课件等详细信息

**响应** (200):
```json
{
  "id": "6904275baa0c1d733e9cc722",
  "title": "小米SU7车轮介绍",
  "description": "详细讲解小米SU7车轮结构和工作原理",
  "publishConfig": {
    "isPublic": true,
    "allowDownload": false,
    "showAuthor": true,
    "enableComments": false,
    "autoPlay": true
  },
  "courseData": {
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
    "outline": [
      {
        "id": "seg-1",
        "title": "课程导入",
        "mode": "sequence",
        "items": [...]
      }
    ]
  },
  "coursewareData": {
    "_id": "68bc53d55f017bd5c72d4013",
    "name": "小米SU7轮胎",
    "modelUrl": "https://platform.yf-xr.com/api/public/courseware-file?path=modifiedModels%2F...",
    "annotations": [...],
    "animations": [...]
  },
  "stats": {
    "viewCount": 128
  },
  "publishedAt": "2025-01-20T10:30:00.000Z",
  "lastUpdated": "2025-01-21T15:45:00.000Z"
}
```

### 5.3 课程大纲项类型说明

AI课程由多个段落（segment）组成，每个段落包含多个步骤项（item）。

#### 5.3.1 纯讲话 (type: "talk")
```json
{
  "type": "talk",
  "id": "item-1",
  "say": "大家好，今天我们来学习小米SU7的车轮结构...",
  "audioUrl": "https://platform.yf-xr.com/api/public/files/68dfa2...",
  "audioDuration": 6200
}
```

**资源下载**: 使用`audioUrl`直接下载音频文件（已转换为公开访问URL，无需认证）

#### 5.3.2 图片讲解 (type: "image.explain")
```json
{
  "type": "image.explain",
  "id": "item-2",
  "say": "这是车轮的横截面结构图...",
  "imageUrl": "https://platform.yf-xr.com/api/public/files/68bc72...",
  "audioUrl": "https://platform.yf-xr.com/api/public/files/68dfa3...",
  "audioDuration": 8500,
  "image": {
    "title": "车轮结构图",
    "bbox": [0.52, 0.31, 0.18, 0.12]
  }
}
```

**资源下载**: 
- 音频: `audioUrl`
- 图片: `imageUrl`
- `bbox`: 图片标注框 [x, y, width, height]，归一化坐标(0-1)

#### 5.3.3 三维场景动作 (type: "scene.action")
```json
{
  "type": "scene.action",
  "id": "item-3",
  "say": "现在让我们观看车轮的实际拆解动画...",
  "audioUrl": "https://platform.yf-xr.com/api/public/files/68dfa4...",
  "audioDuration": 12000,
  "actions": [
    {
      "type": "camera.focus",
      "target": {"nodeKey": "Xiaomi_SU7_LRB/左后轮"},
      "duration": 2.0
    },
    {
      "type": "highlight.show",
      "targets": [{"nodeKey": "Xiaomi_SU7_LRB/左后轮/tire_001_LRW"}],
      "duration": 5.0
    },
    {
      "type": "animation.play",
      "animationId": "71361f28-b009-4b5e-89d3-8f4e9009f368",
      "animationName": "轮胎拆解动画"
    }
  ]
}
```

**支持的动作类型**:

| 动作类型 | 说明 | 主要参数 |
|---------|------|---------|
| `camera.focus` | 相机对焦到对象 | `target.nodeKey`, `duration` |
| `visibility.set` | 设置对象显隐 | `items[].nodeKey`, `items[].visible` |
| `highlight.show` | 高亮显示对象 | `targets[].nodeKey`, `duration` |
| `highlight.hide` | 取消高亮 | `targets[].nodeKey` |
| `annotation.show` | 显示标注 | `ids[]` |
| `annotation.hide` | 隐藏标注 | `ids[]` |
| `animation.play` | 播放动画 | `animationId`, `animationName` |

### 5.4 下载AI课程资源

#### 5.4.1 下载课程音频
使用步骤项中的`audioUrl`字段直接下载。

```http
GET {audioUrl}
```

**说明**: 
- 公开课程的音频URL已转换为公开访问格式，无需认证
- 直接返回音频文件（WAV格式）

#### 5.4.2 下载课程图片
使用`image.explain`类型步骤中的`imageUrl`字段。

```http
GET {imageUrl}
```

**说明**: 
- 公开课程的图片URL已转换为公开访问格式，无需认证
- 直接返回图片文件

#### 5.4.3 下载课程模型
使用`coursewareData.modelUrl`字段。

```http
GET {coursewareData.modelUrl}
Authorization: Bearer <token>
```

**说明**: 
- 返回GLB格式的3D模型文件
- 包含课件中定义的标注、动画等元数据

---

## 6. 公共文件下载（无需认证）

用于下载已发布课程中的公开资源。

### 6.1 按文件ID下载
```http
GET /api/public/files/{fileId}
```

### 6.2 按路径下载
```http
GET /api/public/courseware-file?path={相对路径}
```

**说明**:
- 这两个接口**无需认证**
- 主要用于公开课程的资源访问
- 直接返回文件二进制流

---

## 7. 错误码说明

| 状态码 | 说明 | 处理建议 |
|--------|------|---------|
| 200 | 请求成功 | 正常处理响应数据 |
| 400 | 请求参数错误 | 检查参数格式和完整性 |
| **401** | **未登录或Token无效** | **重新登录获取新Token** |
| 403 | 权限不足 | 确认用户角色和资源权限 |
| 404 | 资源不存在或未审核通过 | 资源可能已删除、ID错误或未通过审核 |
| 500 | 服务器错误 | 稍后重试或联系管理员 |

### ⚠️ 401错误详细说明

**出现场景**：
1. **文件下载接口返回401** - 最常见
2. 列表查询、课件获取等接口返回401

**原因分析**：
- ❌ 请求头中**没有携带**`Authorization`字段
- ❌ Token格式错误（如缺少`Bearer `前缀）
- ❌ Token已过期（有效期7天）
- ❌ Token无效（用户已被删除或重置密码）

**解决方法**：
```csharp
// ✅ 正确做法
UnityWebRequest request = UnityWebRequest.Get(url);
request.SetRequestHeader("Authorization", "Bearer " + token);

// ❌ 错误做法
UnityWebRequest request = UnityWebRequest.Get(url);
// 忘记添加Authorization头
```

**自动重试机制建议**：
```csharp
IEnumerator DownloadWithAuth(string url, string token) {
    UnityWebRequest request = UnityWebRequest.Get(url);
    request.SetRequestHeader("Authorization", "Bearer " + token);
    yield return request.SendWebRequest();
    
    if (request.responseCode == 401) {
        // Token过期，重新登录
        yield return Login();
        // 用新Token重试
        UnityWebRequest retryRequest = UnityWebRequest.Get(url);
        retryRequest.SetRequestHeader("Authorization", "Bearer " + newToken);
        yield return retryRequest.SendWebRequest();
    }
}
```

---

## 8. 开发建议

### 8.1 认证流程
1. 首次启动时调用登录接口获取Token
2. 将Token持久化存储（PlayerPrefs或本地文件）
3. 每次API请求时在Header中携带Token
4. Token失效（401错误）时重新登录

### 8.2 资源管理
1. **预加载**: 课程开始前预加载所有音频、图片资源
2. **缓存策略**: 已下载的资源缓存到本地，减少重复下载
3. **断点续传**: 大文件（GLB模型）建议实现断点续传
4. **异步下载**: 所有资源下载使用异步方式，避免阻塞主线程

### 8.3 课程播放
1. **顺序播放**: 按`outline`数组顺序播放各段落
2. **段落模式**: 
   - `mode: "sequence"`: 步骤项依次播放
   - `mode: "parallel"`: 步骤项同时播放
3. **音频同步**: 根据`audioDuration`字段计算播放时长
4. **动画匹配**: 使用`animationName`字段匹配课件中的动画（优先级高于`animationId`）

### 8.4 性能优化
1. **模型优化**: GLB模型建议启用LOD（细节层次）
2. **纹理压缩**: 图片资源使用平台压缩格式（ETC2/ASTC）
3. **音频格式**: 音频建议转换为平台原生格式（iOS: AAC, Android: Opus）
4. **内存管理**: 及时释放不再使用的资源引用

---

## 9. 快速开始示例

### 学生端流程

#### 步骤1: 登录
```
POST /api/auth/login
{ "phone": "学生手机号", "password": "密码" }
→ 获得 token（保存 user.role 确认是 student）
```

#### 步骤2: 获取课程列表
```
GET /api/portal/courses?type=all
Authorization: Bearer <token>
→ 获得审核通过的课程列表（三维课件 + AI课程）
```

#### 步骤3: 获取课程详情
```
三维课件: GET /api/portal/courseware/{id}
AI课程:   GET /api/portal/ai-course/{id}
Authorization: Bearer <token>
→ 获得完整课程数据（AI课程自动包含 audioUrl）
```

#### 步骤4: 下载资源并播放
```
三维课件:
- 下载 modifiedModelUrl 或 modelUrl (3D模型，需要Token)

AI课程:
- 下载 coursewareData.modifiedModelUrl (3D模型，需要Token)
- 下载 courseData.outline[].items[].audioUrl (音频，无需Token)
- 下载 imageUrl (图片，无需Token)
播放课程
```

---

### 老师端流程

#### 步骤1: 登录
```
POST /api/auth/login
{ "phone": "老师手机号", "password": "密码" }
→ 获得 token（保存 user.role 确认是 teacher）
```

#### 步骤2: 获取自己的课程列表
```
三维课件: GET /api/coursewares/client/list
AI课程: GET /api/published-courses/client/list
Authorization: Bearer <token>
→ 获得自己创建/发布的课程列表
```

#### 步骤3: 获取课程详情
```
三维课件: GET /api/coursewares/{id}
AI课程: GET /api/public/course/{publishId}
Authorization: Bearer <token>
→ 获得完整课程数据
```

#### 步骤4: 获取素材资源
```
个人素材: GET /api/files/client/mine
平台素材: GET /api/files/client/public
Authorization: Bearer <token>
→ 获得可用的素材资源列表
```

---

## 10. 常见问题（FAQ）

### Q1: 为什么文件下载接口返回401错误？

**A**: 这是最常见的问题。文件下载接口**必须携带Token**。

**错误示例**：
```csharp
// ❌ 错误：没有添加Authorization头
UnityWebRequest request = UnityWebRequest.Get(
    "https://platform.yf-xr.com/api/files/69032f6a3700340c21429867/download"
);
yield return request.SendWebRequest();
// 结果：401 Unauthorized
```

**正确做法**：
```csharp
// ✅ 正确：添加Authorization头
UnityWebRequest request = UnityWebRequest.Get(downloadUrl);
request.SetRequestHeader("Authorization", "Bearer " + yourToken);
yield return request.SendWebRequest();
```

---

### Q2: 学生和老师获取课程的接口有什么区别？

**A**: 
- **学生**使用 `/api/portal/courses` 获取**所有审核通过**的课程
- **老师**使用 `/api/coursewares/client/list` 或 `/api/published-courses/client/list` 获取**自己创建**的课程

---

### Q3: 为什么学生获取课程列表是空的？

**A**: 可能原因：
1. 平台上还没有审核通过的课程
2. 老师创建的课程还在 `draft`（草稿）或 `pending`（待审核）状态
3. 课程被管理员拒绝（`rejected`）

只有 `reviewStatus=approved` 的课程才会出现在学生门户中。

---

### Q4: 哪些接口需要Token，哪些不需要？

**需要Token的接口**（大部分）：
- ✅ `/api/portal/courses` - 学生获取课程列表
- ✅ `/api/portal/courseware/:id` - 学生获取课件详情
- ✅ `/api/portal/ai-course/:id` - 学生获取AI课程详情
- ✅ `/api/files/{fileId}/download` - **文件下载**
- ✅ `/api/files/courseware-download` - **课件模型下载**
- ✅ `/api/coursewares` - 课件列表（老师）
- ✅ `/api/published-courses` - AI课程列表（老师）
- ✅ `/api/files/client/mine` - 个人资源
- ✅ `/api/files/client/public` - 平台公共素材

**不需要Token的接口**（仅公开分享相关）：
- ⭕ `/api/public/course/{publishId}` - 公开课程详情
- ⭕ `/api/public/files/{fileId}` - 公开文件下载
- ⭕ `/api/public/courseware-file` - 公开课件文件

---

### Q5: Token有效期是多久？过期后怎么办？

**A**:
- Token有效期：**7天**
- 过期后：自动重新登录获取新Token
- 建议：实现自动刷新机制（见上方401错误处理示例）

---

### Q6: 如何调试Token是否正确携带？

**方法1：检查请求头**
```csharp
UnityWebRequest request = UnityWebRequest.Get(url);
request.SetRequestHeader("Authorization", "Bearer " + token);
Debug.Log("Request URL: " + request.url);
Debug.Log("Authorization: Bearer " + token);
```

**方法2：使用Postman测试**
1. 在Postman中创建GET请求
2. URL: `https://platform.yf-xr.com/api/files/{fileId}/download`
3. Headers添加: `Authorization: Bearer <your_token>`
4. 如果Postman能下载成功，说明Token有效，问题在Unity代码

**方法3：查看响应状态码**
```csharp
Debug.Log("Response Code: " + request.responseCode);
if (request.responseCode == 401) {
    Debug.LogError("未携带Token或Token无效");
}
```

---

### Q7: 能否提供一个完整的Unity学生端示例？

**A**: 完整代码示例：

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class StudentAPIClient : MonoBehaviour
{
    private string token;
    
    // 1. 登录获取Token
    IEnumerator Login() {
        string url = "https://platform.yf-xr.com/api/auth/login";
        string json = "{\"phone\":\"学生手机号\",\"password\":\"密码\"}";
        
        UnityWebRequest request = new UnityWebRequest(url, "POST");
        byte[] bodyRaw = System.Text.Encoding.UTF8.GetBytes(json);
        request.uploadHandler = new UploadHandlerRaw(bodyRaw);
        request.downloadHandler = new DownloadHandlerBuffer();
        request.SetRequestHeader("Content-Type", "application/json");
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success) {
            LoginResponse response = JsonUtility.FromJson<LoginResponse>(request.downloadHandler.text);
            token = response.token;
            Debug.Log("登录成功，角色: " + response.user.role);
        }
    }
    
    // 2. 获取审核通过的课程列表
    IEnumerator GetPortalCourses() {
        string url = "https://platform.yf-xr.com/api/portal/courses?type=all";
        
        UnityWebRequest request = UnityWebRequest.Get(url);
        request.SetRequestHeader("Authorization", "Bearer " + token);
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success) {
            Debug.Log("课程列表: " + request.downloadHandler.text);
            // 解析课程列表...
        }
    }
    
    // 3. 获取课件详情
    IEnumerator GetCoursewareDetail(string coursewareId) {
        string url = $"https://platform.yf-xr.com/api/portal/courseware/{coursewareId}?countView=true";
        
        UnityWebRequest request = UnityWebRequest.Get(url);
        request.SetRequestHeader("Authorization", "Bearer " + token);
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success) {
            Debug.Log("课件详情: " + request.downloadHandler.text);
            // 解析课件数据...
        } else if (request.responseCode == 404) {
            Debug.LogError("课件不存在或未通过审核");
        }
    }
    
    // 4. 下载文件（必须携带Token）
    IEnumerator DownloadFile(string downloadUrl) {
        UnityWebRequest request = UnityWebRequest.Get(downloadUrl);
        // ⚠️ 关键：添加Authorization头
        request.SetRequestHeader("Authorization", "Bearer " + token);
        
        yield return request.SendWebRequest();
        
        if (request.result == UnityWebRequest.Result.Success) {
            byte[] fileData = request.downloadHandler.data;
            Debug.Log("文件下载成功，大小: " + fileData.Length + " bytes");
            // 处理文件数据
        } else if (request.responseCode == 401) {
            Debug.LogError("401错误：Token无效或未携带");
            // 重新登录
            yield return Login();
            // 重试下载
            yield return DownloadFile(downloadUrl);
        } else {
            Debug.LogError("下载失败: " + request.error);
        }
    }
    
    [System.Serializable]
    class LoginResponse {
        public string token;
        public UserInfo user;
    }
    
    [System.Serializable]
    class UserInfo {
        public string id;
        public string name;
        public string role;
    }
}
```

---

## 11. 联系方式

如有技术问题或需要协助，请联系后端开发团队。

**紧急问题快速检查**：
1. ✅ 确认已登录并获取Token
2. ✅ 确认使用正确的接口（学生用portal接口，老师用管理接口）
3. ✅ 确认所有请求都添加了`Authorization: Bearer <token>`
4. ✅ 确认Token格式正确（Bearer后有空格）
5. ✅ 检查响应状态码，根据错误码对照本文档第7节
