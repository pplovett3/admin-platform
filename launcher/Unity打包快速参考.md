# Unity 打包安装程序 - 快速参考

## 🚀 3分钟快速开始

### 第一步：Unity Build（5分钟）

```
Unity编辑器
→ File → Build Settings
→ Platform: Windows, x86_64
→ Build
→ 选择输出路径: D:\UnityBuilds\MyCourse\
→ 等待Build完成
```

### 第二步：获取课程ID（1分钟）

```
管理后台: http://localhost:3001
→ 登录管理员账号
→ 课程管理
→ 找到你的课程
→ 复制课程ID（例如：690af61251fc83dcf5a7d37d）
```

### 第三步：修改安装脚本（2分钟）

打开 `Unity-Install-Template.iss`，修改以下几行：

```iss
#define MyAppName "你的课程名称"
#define MyAppExeName "MyCourse.exe"              ← Unity Build的exe文件名
#define CourseId "690af61251fc83dcf5a7d37d"     ← 粘贴课程ID
#define UnityBuildPath "D:\UnityBuilds\MyCourse" ← Unity Build路径
```

### 第四步：编译安装程序（1分钟）

```
Inno Setup
→ 打开 Unity-Install-Template.iss
→ Build → Compile (Ctrl+F9)
→ 完成！
```

生成的安装程序在：`D:\Installers\你的课程名称-Setup-1.0.0.exe`

---

## ✅ 验证清单

### 安装后检查

1. **注册表**
   ```
   Win+R → regedit
   → HKLM\SOFTWARE\YFCourses\{你的CourseId}
   → 应该看到 InstallPath、CourseName 等值
   ```

2. **启动器检测**
   ```
   打开启动器
   → Ctrl+Shift+I 打开开发者工具
   → Console应该显示：
     "✓ 注册表发现 X 门课程"
   ```

3. **功能测试**
   ```
   启动器
   → 登录学生账号
   → 激活课程
   → 点击"启动课程"
   → Unity应用启动并收到Token ✓
   ```

---

## 📋 必须修改的配置

| 配置项 | 说明 | 示例 |
|--------|------|------|
| `MyAppName` | 课程名称 | `"Unity启动测试课程"` |
| `MyAppExeName` | Unity exe文件名 | `"MyCourse.exe"` |
| `CourseId` | 数据库中的课程ID | `"690af61251fc83dcf5a7d37d"` |
| `UnityBuildPath` | Unity Build路径 | `"D:\UnityBuilds\MyCourse"` |
| `AppId` | 唯一GUID | 从 guidgenerator.com 生成 |

---

## 🎯 关键点

### ⚠️ 三个"必须一致"

1. **CourseId** 必须与管理后台课程ID一致
2. **MyAppExeName** 必须与Unity Build的exe文件名一致
3. **UnityBuildPath** 必须指向Unity Build输出目录

### 🔑 注册表结构

```
HKLM\SOFTWARE\YFCourses\
  └── {CourseId}\
      ├── InstallPath = "C:\...\MyCourse.exe"
      ├── CourseName = "Unity启动测试课程"
      └── Version = "1.0.0"
```

启动器会自动扫描这个路径。

---

## 🛠️ 工具下载

| 工具 | 用途 | 下载 |
|------|------|------|
| Inno Setup | 创建Windows安装程序 | https://jrsoftware.org/isdl.php |
| GUID Generator | 生成唯一AppId | https://www.guidgenerator.com/ |

---

## 💡 Unity接收Token代码

```csharp
using UnityEngine;
using System;

public class TokenReceiver : MonoBehaviour
{
    void Start()
    {
        string[] args = Environment.GetCommandLineArgs();
        
        foreach (string arg in args)
        {
            if (arg.StartsWith("--token="))
            {
                string token = arg.Substring(8);
                Debug.Log("✅ Token: " + token);
                
                // TODO: 解析JWT获取用户信息
                ParseJWT(token);
                break;
            }
        }
    }
}
```

---

## 🚨 常见错误

### 错误1：启动器检测不到课程

**原因：** CourseId不匹配或注册表未写入

**解决：**
```
1. 检查注册表是否有对应项
2. 确认CourseId是否与数据库一致
3. 确认安装时使用了管理员权限
```

### 错误2：点击启动无反应

**原因：** InstallPath路径错误或文件不存在

**解决：**
```
1. 检查注册表中的InstallPath是否正确
2. 确认exe文件确实存在
3. 尝试直接双击exe测试
```

### 错误3：Inno Setup编译错误

**原因：** 路径不存在或语法错误

**解决：**
```
1. 检查UnityBuildPath是否存在
2. 确认路径中没有中文（建议用英文）
3. 检查.iss文件是否UTF-8编码
```

---

## 📦 完整文件清单

部署时需要的文件：

```
你的项目/
├── Unity-Install-Template.iss    ← Inno Setup脚本
└── D:\UnityBuilds\MyCourse\      ← Unity Build输出
    ├── MyCourse.exe
    ├── MyCourse_Data\
    ├── UnityPlayer.dll
    └── ...

编译后生成：
└── D:\Installers\
    └── MyCourse-Setup-1.0.0.exe  ← 最终安装程序
```

---

## 🎓 学习资源

- **详细教程：** `Unity打包安装程序指南.md`
- **脚本模板：** `Unity-Install-Template.iss`
- **部署指南：** `课程应用部署指南.md`
- **Inno Setup文档：** https://jrsoftware.org/ishelp/

---

## ⏱️ 时间预估

| 步骤 | 首次 | 熟悉后 |
|------|------|--------|
| Unity Build | 10分钟 | 5分钟 |
| 配置脚本 | 10分钟 | 2分钟 |
| 编译安装程序 | 2分钟 | 1分钟 |
| 测试验证 | 5分钟 | 2分钟 |
| **总计** | **~30分钟** | **~10分钟** |

---

## 下一步

✅ 完成Unity Build  
✅ 修改安装脚本  
✅ 编译安装程序  
✅ 测试安装  
✅ 部署到学校！  

有问题随时查看详细教程或提问！🎉

