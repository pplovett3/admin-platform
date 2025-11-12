# YF课程启动器

基于Electron的课程启动器，用于管理和启动Unity/UE5虚拟仿真课程应用。

## 功能特性

- 🔐 用户登录认证
- 📚 课程列表展示
- ✅ 激活码验证
- 🚀 一键启动课程应用
- 🔑 安全的JWT令牌传递

## 技术栈

- **Electron**: 桌面应用框架
- **React**: UI框架
- **TypeScript**: 类型安全
- **Ant Design**: UI组件库
- **Axios**: HTTP客户端

## 开发

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

这将启动开发服务器和Electron应用。

### 构建

```bash
npm run build
```

### 打包

```bash
# Windows安装包
npm run package:win
```

生成的安装包位于 `release/` 目录。

## 配置

### courses.json

在应用安装目录下配置 `courses.json`：

```json
{
  "courses": [
    {
      "courseId": "课程ID（与平台课程ID对应）",
      "appPath": "C:/path/to/course/app.exe",
      "icon": "https://example.com/icon.png",
      "name": "课程名称"
    }
  ]
}
```

**字段说明：**
- `courseId`: 平台课程ID，必须与后端数据库中的课程ID匹配
- `appPath`: 课程应用的完整路径（支持相对路径和绝对路径）
- `icon`: 课程图标URL（可选）
- `name`: 课程显示名称（可选，会被平台课程名称覆盖）

### API配置

默认连接到 `http://localhost:4000`，可通过环境变量修改：

```
API_BASE=http://your-api-server.com
```

## 使用流程

1. **启动器登录**
   - 用户使用平台账号（手机号+密码）登录
   - 登录成功后保存JWT令牌

2. **查看课程列表**
   - 显示用户已激活的课程
   - 展示课程有效期等信息

3. **启动课程**
   - 点击"启动课程"按钮
   - 验证课程激活状态
   - 通过命令行参数传递JWT令牌启动应用
   - 格式：`Course.exe --token=<JWT>`

4. **应用验证**
   - Unity/UE5应用接收令牌
   - 验证令牌有效性
   - 验证通过则运行，失败则退出

## 目录结构

```
launcher/
├── src/
│   ├── main/              # Electron主进程
│   │   ├── index.ts       # 主进程入口
│   │   ├── preload.ts     # 预加载脚本
│   │   └── launcher.ts    # 应用启动逻辑
│   ├── renderer/          # 渲染进程（React）
│   │   ├── pages/         # 页面组件
│   │   │   ├── Login.tsx
│   │   │   └── CourseList.tsx
│   │   ├── utils/         # 工具函数
│   │   │   └── api.ts     # API封装
│   │   └── index.tsx      # 渲染进程入口
│   └── shared/            # 共享类型
│       └── types.ts
├── public/                # 静态资源
├── dist/                  # 构建输出
├── release/               # 打包输出
├── package.json
├── tsconfig.json
└── courses.json           # 课程配置
```

## 安全说明

- JWT令牌通过命令行参数传递给课程应用
- 令牌包含用户身份信息，有效期7天
- 课程应用必须验证令牌才能运行
- 无令牌或令牌无效时应用会自动退出

## Unity/UE5集成

请参考 `Unity-UE5集成指南.md` 了解如何在课程应用中接收和验证令牌。

## 故障排查

### 启动器无法连接服务器

- 检查API_BASE配置是否正确
- 确认后端服务器正在运行
- 检查网络连接

### 课程启动失败

- 检查courses.json中的appPath是否正确
- 确认应用文件存在
- 查看Electron开发者工具的控制台日志

### 应用立即退出

- 确认应用已正确实现令牌验证逻辑
- 检查应用日志中的错误信息
- 验证令牌格式是否正确

## 许可证

MIT

