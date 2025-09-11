# Unity三维课件开发需求文档

## 1. 概述

本文档描述了Unity中VR三维课件系统的开发需求，包括用户认证、课件下载、数据解析和交互功能实现。

## 2. 系统架构

```
VR用户 → Unity客户端 → 后端API → GLB模型文件 + JSON数据
                      ↓
                   数据解析器
                      ↓
              VR交互系统（标注+动画）
```

## 3. API对接

### 3.1 基础配置
- **服务器地址**: `http://106.15.229.165:4000`
- **认证方式**: JWT Token，放在请求头 `Authorization: Bearer <token>`
- **内容类型**: `application/json`
- **模型下载**: 课件返回的`modelUrl`和`modifiedModelUrl`为`https://dl.yf-xr.com`公网直链，可直接下载GLB文件

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

### 3.3 获取课件列表
```http
GET /api/coursewares?q=&page=1&limit=20
Authorization: Bearer <token>
```

**响应**:
```json
{
  "items": [
    {
      "_id": "68bc53d55f017bd5c72d4013",
      "name": "小米su7轮胎",
      "description": "",
      "modelUrl": "https://dl.yf-xr.com/models/68af267e83f0e85a3dd4d13f.glb",
      "modifiedModelUrl": "https://dl.yf-xr.com/models/68bc54af5f017bd5c72d402a.glb",
      "createdAt": "2025-09-06T15:31:33.035Z",
      "updatedAt": "2025-09-06T15:35:11.071Z",
      "createdBy": { "_id": "689c46d6191b483b08e9c560", "name": "Admin" },
      "version": 3
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

### 3.4 获取课件详情
```http
GET /api/coursewares/{coursewareId}
Authorization: Bearer <token>
```

## 4. 数据结构解析

### 4.1 课件完整数据结构

根据示例JSON，课件数据包含以下主要部分：

```json
{
  "_id": "68bc53d55f017bd5c72d4013",
  "name": "小米su7轮胎",
  "description": "",
  "modelUrl": "https://dl.yf-xr.com/models/68af267e83f0e85a3dd4d13f.glb",
  "modifiedModelUrl": "https://dl.yf-xr.com/models/68bc54af5f017bd5c72d402a.glb",
  "annotations": [...],     // 标注数据
  "animations": [...],      // 动画数据  
  "settings": {...},        // 场景设置
  "modelStructure": {...},  // 模型结构
  "createdAt": "2025-09-06T15:31:33.035Z",
  "version": 3
}
```

### 4.2 标注数据解析 (annotations)

```json
{
  "id": "4bd0c92c-d87a-4f70-9985-5502c77ca583",
  "title": "标注测试",
  "description": "测试信息",
  "nodeKey": "60e99feb-cb9f-41c1-8546-ed482553ec1b/Xiaomi_SU7_LRB/左后轮/标注测试",
  "position": {
    "x": 0.06948047131299984,
    "y": 0.004731986623331241,
    "z": 0.0038865808111483435
  },
  "labelOffset": {
    "x": 0.22,
    "y": 0,
    "z": 0
  },
  "labelOffsetSpace": "local",
  "label": {
    "title": "标注测试",
    "summary": "测试信息",
    "offset": [0.22, 0, 0],
    "offsetSpace": "local"
  }
}
```

**解析要点**:
- `nodeKey`: 对象路径，用于在GLB模型中定位目标对象
- `position`: 标注锚点的3D坐标
- `labelOffset` + `labelOffsetSpace`: 标签相对于锚点的偏移位置
- `title` + `description`: 标签显示内容

### 4.3 动画数据解析 (animations)

#### 4.3.1 动画基本信息
```json
{
  "id": "71361f28-b009-4b5e-89d3-8f4e9009f368",
  "name": "小米su7轮胎",
  "description": "123",
  "steps": [
    {
      "id": "3fce1961-50d2-4536-a8e0-248ea4807fda",
      "name": "1",
      "description": "1",
      "time": 0
    },
    {
      "id": "945a6cb5-9dea-44f7-842f-5ba3c6a9f210", 
      "name": "2",
      "description": "2",
      "time": 1.225
    },
    {
      "id": "ca5a54e4-9945-4f45-96fa-ec09dd3ba8a1",
      "name": "3", 
      "description": "3",
      "time": 3.05
    }
  ],
  "timeline": {...}
}
```

#### 4.3.2 显隐轨道数据 (timeline.visTracks)
```json
{
  "timeline": {
    "duration": 7.333333253860474,
    "visTracks": [
      {
        "nodeKey": "Xiaomi_SU7_LRB/左后轮/tire_001_LRW",
        "keys": [
          {"time": 0, "visible": true, "easing": "linear"},
          {"time": 1.625, "visible": false, "easing": "linear"}
        ]
      },
      {
        "nodeKey": "Xiaomi_SU7_LRB/左后轮/rimDarkIn_001_LRW", 
        "keys": [
          {"time": 1.625, "visible": true, "easing": "linear"}
        ]
      }
    ]
  }
}
```

**解析要点**:
- `duration`: 动画总时长
- `visTracks`: 显隐轨道数组，每个轨道对应一个3D对象
- `nodeKey`: 对象路径，需要在GLB模型中找到对应的GameObject
- `keys`: 关键帧数组，包含时间点和可见性状态

### 4.4 模型结构解析 (modelStructure)

```json
{
  "objects": [
    {
      "path": ["Xiaomi_SU7_LRB"],
      "uuid": "80a48c8e-bb93-4304-8d7d-b64cb86d2694",
      "name": "Xiaomi_SU7_LRB",
      "visible": true,
      "type": "Group"
    },
    {
      "path": ["Xiaomi_SU7_LRB", "左后轮"],
      "uuid": "4d2ebe37-cb1e-4097-ae29-c277375e6afc", 
      "name": "左后轮",
      "visible": true,
      "type": "Group"
    }
  ],
  "deletedUUIDs": []
}
```

## 5. Unity实现架构

### 5.1 核心组件设计

```csharp
// 1. 课件管理器
public class CoursewareManager : MonoBehaviour
{
    // API客户端
    // 课件下载和缓存
    // 数据解析协调
}

// 2. 标注系统
public class AnnotationSystem : MonoBehaviour  
{
    // 标注点渲染
    // 射线检测
    // 详情面板显示
}

// 3. 动画系统
public class AnimationSystem : MonoBehaviour
{
    // 动画列表UI
    // 步骤控制
    // 显隐轨道播放
}

// 4. 高亮系统
public class HighlightSystem : MonoBehaviour
{
    // 对象高亮
    // 半透明处理
}
```

### 5.2 数据模型定义

```csharp
[System.Serializable]
public class CoursewareData
{
    public string _id;
    public string name;
    public string description;
    public string modelUrl;
    public string modifiedModelUrl;
    public AnnotationData[] annotations;
    public AnimationData[] animations;
    public SettingsData settings;
    public ModelStructureData modelStructure;
}

[System.Serializable]
public class AnnotationData
{
    public string id;
    public string title;
    public string description;
    public string nodeKey;
    public Vector3 position;
    public Vector3 labelOffset;
    public string labelOffsetSpace;
}

[System.Serializable]
public class AnimationData
{
    public string id;
    public string name;
    public string description;
    public StepData[] steps;
    public TimelineData timeline;
}

[System.Serializable]
public class StepData
{
    public string id;
    public string name;
    public string description;
    public float time;
}

[System.Serializable]
public class VisibilityTrack
{
    public string nodeKey;
    public VisibilityKey[] keys;
}

[System.Serializable]
public class VisibilityKey
{
    public float time;
    public bool visible;
    public string easing;
}
```

## 6. VR交互需求

### 6.1 标注交互

#### 6.1.1 射线点击检测
- **输入**: VR手柄射线
- **目标**: 3D场景中的标注点
- **反馈**: 
  - 标注点高亮
  - 显示详情面板
  - 播放点击音效

#### 6.1.2 对象高亮系统
- **选中效果**: 
  - 目标对象：高亮显示（发光边缘或颜色变化）
  - 其他对象：半透明显示（Alpha = 0.3-0.5）
- **还原机制**:
  - 点击空白区域
  - 选中其他标注
  - 手动关闭按钮

#### 6.1.3 详情面板
- **位置**: 跟随用户视线或固定在手柄附近
- **内容**:
  - 标题 (title)
  - 描述信息 (description)
  - 关闭按钮
- **交互**: 
  - 支持手柄指向点击
  - 支持手势滑动（如果内容过长）

### 6.2 动画控制

#### 6.2.1 动画列表UI
- **展示形式**: 下拉菜单或侧边面板
- **内容**: 
  - 动画名称 (name)
  - 动画描述 (description) 
  - 选中状态指示
- **交互**: 手柄射线点击选择

#### 6.2.2 步骤控制系统
选中动画后显示步骤控制面板：

- **步骤列表**:
  - 显示所有步骤名称
  - 当前步骤高亮
  - 支持直接点击跳转到指定步骤

- **控制按钮**:
  - **上一步**: 从当前时间倒放到上一步的时间点
  - **下一步**: 从当前时间播放到下一步的时间点  
  - **复位**: 重置到动画开始状态 (time = 0)
  - **播放/暂停**: 正常播放控制

#### 6.2.3 播放逻辑

```csharp
// 伪代码示例
public class AnimationController
{
    public void PlayToStep(int stepIndex)
    {
        float targetTime = steps[stepIndex].time;
        float currentTime = GetCurrentTime();
        
        if (targetTime > currentTime)
        {
            // 正向播放
            PlayFromTo(currentTime, targetTime);
        }
        else if (targetTime < currentTime)
        {
            // 倒向播放
            PlayReversed(currentTime, targetTime);
        }
    }
    
    public void PlayNext()
    {
        int currentStep = GetCurrentStepIndex();
        if (currentStep < steps.Length - 1)
        {
            PlayToStep(currentStep + 1);
        }
    }
    
    public void PlayPrevious()
    {
        int currentStep = GetCurrentStepIndex();
        if (currentStep > 0)
        {
            PlayToStep(currentStep - 1);
        }
    }
}
```

## 7. 显隐动画实现

### 7.1 对象路径解析
```csharp
public GameObject FindObjectByPath(string nodeKey, GameObject root)
{
    // 解析路径: "Xiaomi_SU7_LRB/左后轮/tire_001_LRW"
    string[] pathParts = nodeKey.Split('/');
    
    GameObject current = root;
    foreach (string part in pathParts)
    {
        Transform child = current.transform.Find(part);
        if (child == null) return null;
        current = child.gameObject;
    }
    
    return current;
}
```

### 7.2 显隐轨道播放
```csharp
public class VisibilityTrackPlayer
{
    public void UpdateVisibility(VisibilityTrack track, float currentTime)
    {
        GameObject target = FindObjectByPath(track.nodeKey, rootObject);
        if (target == null) return;
        
        // 找到当前时间对应的可见性状态
        bool visible = GetVisibilityAtTime(track.keys, currentTime);
        target.SetActive(visible);
    }
    
    private bool GetVisibilityAtTime(VisibilityKey[] keys, float time)
    {
        // 如果时间在第一个关键帧之前，使用第一个关键帧的值
        if (time <= keys[0].time) return keys[0].visible;
        
        // 如果时间在最后一个关键帧之后，使用最后一个关键帧的值
        if (time >= keys[keys.Length - 1].time) 
            return keys[keys.Length - 1].visible;
        
        // 在中间，找到前后两个关键帧并使用前一个的值
        for (int i = 0; i < keys.Length - 1; i++)
        {
            if (time >= keys[i].time && time < keys[i + 1].time)
            {
                return keys[i].visible;
            }
        }
        
        return true; // 默认可见
    }
}
```

## 8. 开发流程建议

### 8.1 阶段一：基础框架
1. 创建API客户端 (HTTP请求封装)
2. 实现用户登录和Token管理
3. 实现课件列表获取和显示
4. 实现GLB模型加载和显示

### 8.2 阶段二：标注系统
1. 解析标注数据
2. 在3D场景中创建标注点
3. 实现射线检测和点击交互
4. 实现详情面板显示
5. 实现高亮和半透明效果

### 8.3 阶段三：动画系统
1. 解析动画数据和步骤信息
2. 创建动画列表UI
3. 实现步骤控制UI
4. 实现显隐轨道播放
5. 实现正向/倒向播放逻辑

### 8.4 阶段四：优化完善
1. 性能优化 (LOD、批处理等)
2. 用户体验优化 (动画缓动、音效等)
3. 错误处理和异常情况处理
4. 多课件管理和缓存策略

## 9. 注意事项

### 9.1 网络处理
- 实现断网重连机制
- 大文件下载进度显示
- GLB文件本地缓存策略

### 9.2 性能考虑
- GLB模型LOD处理
- 显隐切换时的性能优化
- UI渲染性能优化

### 9.3 用户体验
- 加载状态提示
- 操作反馈和引导
- 错误提示友好化

### 9.4 兼容性
- 不同VR设备的适配
- 不同GLB文件格式的兼容
- JSON数据格式的向后兼容

## 10. 示例课件信息

**当前服务器上的测试课件**:
- 课件ID: `68bc53d55f017bd5c72d4013`  
- 课件名称: `小米su7轮胎`
- 模型URL: `https://dl.yf-xr.com/models/68bc54af5f017bd5c72d402a.glb` (修改后的GLB)
- 包含2个标注点，1个自定义动画（3个步骤），1个内置动画
- 自定义动画包含轮胎显隐切换效果

可用此课件进行开发测试和功能验证。
