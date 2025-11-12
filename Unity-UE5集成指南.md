# Unity/UE5 课程启动器集成指南

## 概述

本文档说明如何将Unity和UE5打包的课程应用集成到启动器系统中，实现基于激活码的授权管理。

---

## 集成原理

```
启动器 (Launcher.exe)
  ↓ 用户登录获取JWT Token
  ↓ 启动课程应用
Course.exe --token=<JWT_TOKEN>
  ↓ 接收并验证Token
  ↓ Token有效 → 运行课程
  ↓ Token无效 → 退出应用
```

**核心要点：**
1. 启动器通过命令行参数 `--token=<JWT>` 传递授权Token给课程应用
2. JWT Token中已包含用户ID、课程ID等信息，无需额外参数
3. 课程应用必须验证Token，验证失败则自动退出
4. Token格式为标准JWT（三段式：header.payload.signature）

---

## Unity集成（C#）

### 1. 创建CourseLauncher脚本

在Unity项目中创建 `CourseLauncher.cs`：

```csharp
using UnityEngine;
using System;
using System.Linq;

/// <summary>
/// 课程启动器验证组件
/// 必须在游戏启动时第一个运行
/// </summary>
public class CourseLauncher : MonoBehaviour
{
    void Awake()
    {
        // 在Awake中执行，确保最早运行
        if (!ValidateLaunch())
        {
            Debug.LogError("课程启动验证失败，应用将退出");
            Application.Quit();
            
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#endif
        }
        else
        {
            Debug.Log("课程启动验证通过");
        }
    }

    /// <summary>
    /// 验证启动参数
    /// </summary>
    bool ValidateLaunch()
    {
        string[] args = System.Environment.GetCommandLineArgs();
        
        // 读取token参数
        // 启动器会传递：Course.exe --token=<JWT>
        string token = GetArgValue(args, "--token");
        
        // 检查token是否存在
        if (string.IsNullOrEmpty(token))
        {
            Debug.LogError("缺少必需参数：--token");
            Debug.LogError("请从YF课程启动器启动本应用");
            return false;
        }
        
        // 验证Token格式（简单检查）
        if (!ValidateTokenFormat(token))
        {
            Debug.LogError("Token格式无效");
            return false;
        }
        
        // 可选：解析Token内容（需要JWT库）
        // var payload = ParseJWTPayload(token);
        // Debug.Log($"用户ID: {payload.userId}, 课程ID: {payload.courseId}");
        
        Debug.Log("课程启动验证通过");
        return true;
    }
    
    /// <summary>
    /// 从命令行参数中获取指定key的值
    /// 支持两种格式：
    /// 1. --token=<value>
    /// 2. --token <value>
    /// </summary>
    string GetArgValue(string[] args, string key)
    {
        foreach (string arg in args)
        {
            // 格式1: --token=value
            if (arg.StartsWith(key + "="))
            {
                return arg.Substring(key.Length + 1);
            }
        }
        
        // 格式2: --token value
        for (int i = 0; i < args.Length - 1; i++)
        {
            if (args[i] == key)
            {
                return args[i + 1];
            }
        }
        
        return null;
    }
    
    /// <summary>
    /// 简单的Token格式验证
    /// JWT格式：header.payload.signature
    /// </summary>
    bool ValidateTokenFormat(string token)
    {
        if (string.IsNullOrEmpty(token))
            return false;
        
        string[] parts = token.Split('.');
        return parts.Length == 3;
    }
    
    // 高级选项：完整JWT验证（需要额外的JWT库）
    // 推荐库：System.IdentityModel.Tokens.Jwt (需通过NuGet安装)
    /*
    bool ValidateJWTToken(string token, string expectedCourseId, string expectedUserId)
    {
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var jwtToken = handler.ReadJwtToken(token);
            
            // 检查过期时间
            if (jwtToken.ValidTo < DateTime.UtcNow)
            {
                Debug.LogError("Token已过期");
                return false;
            }
            
            // 验证课程ID和用户ID
            var courseIdClaim = jwtToken.Claims.FirstOrDefault(c => c.Type == "courseId");
            var userIdClaim = jwtToken.Claims.FirstOrDefault(c => c.Type == "userId");
            
            if (courseIdClaim?.Value != expectedCourseId)
            {
                Debug.LogError("课程ID不匹配");
                return false;
            }
            
            if (userIdClaim?.Value != expectedUserId)
            {
                Debug.LogError("用户ID不匹配");
                return false;
            }
            
            return true;
        }
        catch (Exception e)
        {
            Debug.LogError($"Token验证异常: {e.Message}");
            return false;
        }
    }
    */
}
```

### 2. 在场景中使用

在Unity中创建一个持久化的GameObject：

1. 在启动场景创建空GameObject，命名为 `LauncherValidator`
2. 添加 `CourseLauncher` 脚本
3. 设置为 `DontDestroyOnLoad`（可选）

```csharp
// 在CourseLauncher中添加
void Awake()
{
    DontDestroyOnLoad(gameObject); // 保持在场景切换时不销毁
    
    if (!ValidateLaunch())
    {
        Application.Quit();
    }
}
```

### 3. 测试命令行参数

在Unity Editor中测试：

```csharp
// 在Editor中模拟命令行参数
#if UNITY_EDITOR
void Awake()
{
    // 测试模式：跳过验证或使用模拟Token
    if (Application.isEditor)
    {
        Debug.Log("编辑器模式：跳过启动验证");
        return;
    }
    
    if (!ValidateLaunch())
    {
        Application.Quit();
    }
}
#endif
```

---

## UE5集成（C++/蓝图）

### 方案1：C++实现

#### 1. 创建CourseLauncher类

创建 `CourseLauncher.h`：

```cpp
// CourseLauncher.h
#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "CourseLauncher.generated.h"

UCLASS()
class MYCOURSE_API UCourseLauncher : public UBlueprintFunctionLibrary
{
    GENERATED_BODY()
    
public:
    /**
     * 验证启动参数
     * 返回：true=验证通过，false=验证失败
     */
    UFUNCTION(BlueprintCallable, Category = "CourseLauncher")
    static bool ValidateLaunch();
    
    /**
     * 获取命令行参数的值
     */
    UFUNCTION(BlueprintCallable, Category = "CourseLauncher")
    static FString GetCommandLineArg(const FString& Key);
    
private:
    static bool ValidateTokenFormat(const FString& Token);
};
```

创建 `CourseLauncher.cpp`：

```cpp
// CourseLauncher.cpp
#include "CourseLauncher.h"
#include "Misc/CommandLine.h"

bool UCourseLauncher::ValidateLaunch()
{
    // 获取启动参数
    // 启动器会传递：Course.exe --token=<JWT>
    FString Token = GetCommandLineArg(TEXT("-token"));
    
    // 检查token是否存在
    if (Token.IsEmpty())
    {
        UE_LOG(LogTemp, Error, TEXT("缺少必需参数：--token"));
        UE_LOG(LogTemp, Error, TEXT("请从YF课程启动器启动本应用"));
        return false;
    }
    
    // 验证Token格式（简单检查）
    if (!ValidateTokenFormat(Token))
    {
        UE_LOG(LogTemp, Error, TEXT("Token格式无效"));
        return false;
    }
    
    // Token中已包含用户ID和课程ID信息
    // 可选：解析Token内容来获取这些信息
    UE_LOG(LogTemp, Log, TEXT("课程启动验证通过"));
    return true;
}

FString UCourseLauncher::GetCommandLineArg(const FString& Key)
{
    FString Value;
    // UE5中使用-token而不是--token（注意单横线）
    // 例如：Course.exe -token=<JWT>
    if (FParse::Value(FCommandLine::Get(), *Key, Value))
    {
        return Value;
    }
    return TEXT("");
}

bool UCourseLauncher::ValidateTokenFormat(const FString& Token)
{
    if (Token.IsEmpty())
        return false;
    
    // JWT格式检查：header.payload.signature
    TArray<FString> Parts;
    Token.ParseIntoArray(Parts, TEXT("."));
    
    return Parts.Num() == 3;
}
```

#### 2. 在GameMode或GameInstance中使用

```cpp
// 在BeginPlay中验证
void AMyGameMode::BeginPlay()
{
    Super::BeginPlay();
    
    if (!UCourseLauncher::ValidateLaunch())
    {
        UE_LOG(LogTemp, Error, TEXT("课程启动验证失败，游戏将退出"));
        FGenericPlatformMisc::RequestExit(false);
    }
}
```

### 方案2：蓝图实现（简化版）

在Level Blueprint或GameMode蓝图中：

1. **BeginPlay事件**
2. **Get Command Line** 节点
3. **查找子字符串** 检查是否包含 `--token`
4. **Branch** 分支判断
   - True：继续游戏
   - False：调用 **Quit Game** 退出

蓝图伪代码：
```
BeginPlay
  ↓
Get Command Line → 获取命令行字符串
  ↓
Contains "--token" → 检查是否包含token
  ↓
Branch
  ├─ True → 继续游戏
  └─ False → Quit Game (退出)
```

---

## 启动参数说明

### 参数列表

| 参数 | 类型 | 必需 | 说明 | 示例 |
|------|------|------|------|------|
| `--token` | String | 是 | JWT授权令牌 | `eyJhbGciOiJ...` |

**注意：** 
- Unity应用使用：`--token=<value>`
- UE5应用使用：`-token=<value>`（单横线）

### 启动示例

```bash
# Unity应用启动
UnityCourse.exe --token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# UE5应用启动  
UE5Course.exe -token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token结构（JWT格式）

Token是标准JWT令牌，包含以下信息：
- **userId**: 用户ID
- **role**: 用户角色
- **name**: 用户姓名
- **phone**: 用户手机号
- **schoolId**: 学校ID（如果有）
- **exp**: 过期时间（登录后7天有效）

课程应用接收到Token后，可以解析它来获取用户信息，无需额外传递courseId和userId参数。

---

## 安全建议

### 1. 基础验证（必须）
- ✅ 检查Token参数存在性
- ✅ 检查Token格式（三段式）
- ✅ 无Token则立即退出

### 2. 中级验证（推荐）
- ✅ 验证Token过期时间
- ✅ 验证courseId和userId匹配
- ✅ 记录启动日志

### 3. 高级验证（可选）
- 验证Token签名（需要密钥）
- 与服务器实时验证
- 防调试保护

**注意：** 客户端验证只能防止普通用户绕过，无法完全防止高级破解。核心数据（如成绩、进度）应由服务器验证。

---

## 常见问题

### Q1: Unity Editor中如何测试？

A: 添加条件编译指令：

```csharp
#if UNITY_EDITOR
void Awake()
{
    if (Application.isEditor)
    {
        Debug.Log("编辑器模式：跳过验证");
        return;
    }
    ValidateLaunch();
}
#endif
```

### Q2: 如何在打包后测试启动参数？

A: 手动通过命令行启动：

```bash
cd "C:\Program Files\YourGame"
.\YourGame.exe --token=test123 --courseId=abc --userId=xyz
```

### Q3: 用户能否直接双击exe绕过？

A: 不能。没有Token参数时，应用会立即退出。但要确保验证逻辑在Awake/BeginPlay中执行。

### Q4: Token验证失败后怎么办？

A: 建议：
1. 记录错误日志
2. 显示简单提示："请从启动器启动课程"
3. 自动退出应用

### Q5: 是否需要额外的JWT库？

A: 
- **基础验证**：不需要，检查格式即可
- **完整验证**：推荐使用 `System.IdentityModel.Tokens.Jwt`（Unity）或第三方JWT库（UE5）

---

## 完整集成检查清单

### Unity项目
- [ ] 创建CourseLauncher脚本
- [ ] 在启动场景添加验证组件
- [ ] 测试命令行参数接收
- [ ] 添加Editor模式跳过逻辑
- [ ] 打包测试完整流程

### UE5项目
- [ ] 创建CourseLauncher类
- [ ] 在GameMode/GameInstance中调用验证
- [ ] 测试命令行参数接收
- [ ] 添加编辑器模式跳过逻辑
- [ ] 打包测试完整流程

### 启动器集成
- [ ] 确认courses/manifest.json配置正确
- [ ] 测试启动器启动课程
- [ ] 验证Token传递成功
- [ ] 测试无Token时课程自动退出

---

## 技术支持

如有集成问题，请联系开发团队。

提供以下信息：
1. 引擎版本（Unity/UE5版本号）
2. 错误日志
3. 命令行参数示例
4. 复现步骤

