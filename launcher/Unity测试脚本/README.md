# Unity测试项目脚本说明

## 📦 包含的脚本

### 1. TokenReceiver.cs（核心脚本）
**功能：**
- 接收启动器传递的JWT Token
- 解析Token获取用户信息
- 验证Token有效期
- Editor模式下支持模拟测试

**使用方法：**
1. 在场景中创建空GameObject，命名为 `GameManager`
2. 将 `TokenReceiver.cs` 挂载上去
3. 运行场景

### 2. UserInfoUI.cs（UI显示脚本）
**功能：**
- 显示用户信息UI
- 实时更新状态

**使用方法：**
1. 创建Canvas和Text组件
2. 将脚本挂载到Canvas上
3. 在Inspector中关联Text组件

### 3. TestSceneSetup.cs（自动设置脚本）
**功能：**
- 自动创建测试UI
- 一键完成场景设置

**使用方法：**
1. 在空场景中创建空GameObject
2. 挂载此脚本
3. 运行场景，UI自动创建

---

## 🚀 快速开始（2种方法）

### 方法1：自动设置（推荐，最简单）

1. **创建新场景**
   ```
   File → New Scene
   ```

2. **创建两个空对象**
   ```
   GameObject → Create Empty
   命名: GameManager
   
   GameObject → Create Empty  
   命名: SceneSetup
   ```

3. **挂载脚本**
   - `GameManager` 挂载 `TokenReceiver.cs`
   - `SceneSetup` 挂载 `TestSceneSetup.cs`

4. **运行场景**
   - 按Play
   - UI会自动创建
   - 在Editor模式下会显示模拟数据

### 方法2：手动创建UI

1. **创建GameManager**
   ```
   GameObject → Create Empty
   命名: GameManager
   挂载: TokenReceiver.cs
   ```

2. **创建Canvas**
   ```
   GameObject → UI → Canvas
   ```

3. **创建Panel**
   ```
   右键Canvas → UI → Panel
   调整大小和位置
   ```

4. **创建Text组件**（7个）
   ```
   - Title (标题)
   - Status (状态)
   - UserId (用户ID)
   - UserName (姓名)
   - UserRole (角色)
   - UserPhone (手机)
   - UserSchool (学校)
   - UserClass (班级)
   ```

5. **关联UI**
   - 选择Canvas
   - 添加 `UserInfoUI.cs` 组件
   - 在Inspector中拖拽关联所有Text组件

---

## 🎮 测试流程

### Editor中测试

1. **启用测试模式**
   - 选择 `GameManager`
   - 在 `TokenReceiver` 组件中
   - 勾选 `Use Test Token In Editor`

2. **运行场景**
   - 按Play
   - 应该看到模拟的用户信息

### 通过启动器测试

1. **Build Unity项目**
   ```
   File → Build Settings
   → Windows x64
   → Build
   ```

2. **配置courses.json或创建安装程序**
   - 参考《Unity打包安装程序指南.md》

3. **通过启动器启动**
   - 打开YF课程启动器
   - 登录学生账号
   - 激活课程
   - 点击"启动课程"
   - Unity应用会显示真实的用户信息

---

## 🎯 预期效果

### Editor模式（测试）
```
=== 模拟用户信息（测试模式）===
✓ 用户ID: test-user-id-12345
✓ 姓名: 测试学生001
✓ 角色: student
✓ 手机: 13800005304
✓ 学校: 测试学校
✓ 班级: 测试班级
=================================
```

### 启动器模式（真实）
```
=== YF课程启动器 Token接收器 ===
📋 命令行参数数量: 2
  参数[0]: C:\...\MyCourse.exe
  参数[1]: --token=eyJhbGci...
✅ 成功接收到Token!
📦 JWT Payload (JSON): {...}
=== 用户信息 ===
✓ 用户ID: 673...
✓ 姓名: 测试学生001
✓ 角色: student
✓ 手机: 13800005304
✓ 学校: 上海信息学校
✓ 班级: 测试班级
✓ Token有效，剩余时间: 23小时 59分钟
================
```

---

## 📝 代码说明

### TokenReceiver.cs 关键方法

```csharp
// 单例访问
TokenReceiver.Instance

// 获取用户信息
UserInfo userInfo = TokenReceiver.Instance.GetUserInfo();

// 检查是否已接收Token
if (TokenReceiver.Instance.tokenReceived)
{
    // Token已接收并解析
    string userId = TokenReceiver.Instance.userId;
    string userName = TokenReceiver.Instance.userName;
}
```

### 在其他脚本中使用

```csharp
using UnityEngine;

public class MyGameScript : MonoBehaviour
{
    void Start()
    {
        // 等待Token接收
        if (TokenReceiver.Instance != null && 
            TokenReceiver.Instance.tokenReceived)
        {
            // 获取用户信息
            string userName = TokenReceiver.Instance.userName;
            Debug.Log($"欢迎, {userName}!");
            
            // 根据角色显示不同内容
            if (TokenReceiver.Instance.userRole == "student")
            {
                // 学生模式
            }
            else if (TokenReceiver.Instance.userRole == "teacher")
            {
                // 教师模式
            }
        }
    }
}
```

---

## ⚙️ 配置选项

### TokenReceiver 设置

- `useTestTokenInEditor`: Editor中使用模拟Token（测试用）

### UserInfoUI 设置

- `updateInterval`: UI刷新间隔（默认0.5秒）

---

## 🐛 调试技巧

### 1. 查看Console日志

所有关键步骤都会输出日志：
- Token接收状态
- JWT解析过程
- 用户信息详情
- 错误信息

### 2. Inspector面板

运行时可以在Inspector中查看：
- `TokenReceiver` 组件的所有字段
- 实时的用户信息
- Token接收状态

### 3. 命令行参数测试

在Unity Editor中测试命令行参数：
```
Edit → Project Settings → Player
→ Other Settings
→ Resolution and Presentation
→ Standalone Player Options
→ Additional Command Line Arguments
添加: --token=your_test_token_here
```

---

## 常见问题

### Q1: Editor中不显示用户信息？
**A:** 确保勾选了 `Use Test Token In Editor`

### Q2: Build后启动报错？
**A:** 检查Console日志，确认Token格式正确

### Q3: 如何自定义UI样式？
**A:** 修改 `TestSceneSetup.cs` 中的UI创建代码，或手动创建UI

### Q4: 需要其他字段？
**A:** 在 `UserInfo` 类中添加字段，确保与JWT Payload匹配

---

## 下一步

1. ✅ 将脚本复制到Unity项目
2. ✅ 按照快速开始创建场景
3. ✅ Editor中测试
4. ✅ Build项目
5. ✅ 配置启动器
6. ✅ 完整测试流程

详细的打包和部署流程请参考：
- `Unity打包安装程序指南.md`
- `Unity打包快速参考.md`

