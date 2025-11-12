# Docker 部署文档索引

本项目已完整支持 Docker 容器化部署，可从本地开发、构建镜像、推送到阿里云容器镜像服务，最后在 NAS 或任何 Docker 环境中运行。

## 📚 文档导航

### 🚀 快速开始
- **[QUICK_START.md](./QUICK_START.md)** - 3 分钟快速上手指南
  - 本地 Docker 测试
  - 推送到阿里云
  - NAS 部署

### 📖 完整指南
- **[DOCKER_DEPLOY_GUIDE.md](./DOCKER_DEPLOY_GUIDE.md)** - 详细部署指南
  - 本地 Docker 运行测试
  - 构建并推送镜像到阿里云
  - NAS Docker 部署
  - 环境变量配置
  - 常见问题
  - 安全建议
  - 监控和维护

### 📝 其他文档
- **[README_DEPLOY.md](./README_DEPLOY.md)** - 原阿里云 ECS 部署指南（保留）

## 🛠️ 配置文件

### Docker 配置
- `docker-compose.yml` - 本地开发环境配置
- `docker-compose.prod.yml` - 生产环境配置（NAS/服务器）
- `server/Dockerfile` - 后端镜像构建文件
- `web/Dockerfile` - 前端镜像构建文件

### 环境变量
- `env.template` - 环境变量模板（复制后使用）
- `.env` - 本地开发环境变量（不提交到 Git）
- `.env.prod` - 生产环境变量（不提交到 Git）

### 自动化脚本
- `build-and-push.sh` - Linux/Mac 构建推送脚本
- `build-and-push.ps1` - Windows PowerShell 构建推送脚本
- `deploy-to-nas.sh` - NAS 部署脚本

## 🎯 部署流程

```
┌─────────────────┐
│  1. 本地开发    │
│  docker compose │
│     up -d       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  2. 构建镜像    │
│  ./build-and-   │
│     push.ps1    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  3. 推送阿里云  │
│  docker push    │
│  registry.cn... │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  4. NAS 拉取    │
│  docker pull    │
│  registry.cn... │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  5. NAS 运行    │
│  docker compose │
│  -f prod.yml up │
└─────────────────┘
```

## 📦 镜像结构

本项目包含 3 个容器：

1. **admin-platform-mongo**
   - 基础镜像：`mongo:6`
   - 用途：MongoDB 数据库
   - 数据持久化：mongo-data 卷

2. **admin-platform-server**
   - 基础镜像：`node:20-alpine`
   - 用途：Node.js + Express 后端 API
   - 端口：4000
   - 依赖：MongoDB

3. **admin-platform-web**
   - 基础镜像：`node:20-alpine`
   - 用途：Next.js 前端应用
   - 端口：3000
   - 依赖：Server

## 🔧 环境要求

### 本地开发
- Windows 10/11 + Docker Desktop
- 或 Linux/Mac + Docker + Docker Compose

### 生产环境（NAS/服务器）
- Docker 20.10+
- Docker Compose 2.0+
- 2GB+ 可用内存
- 10GB+ 可用磁盘空间

### 阿里云容器镜像服务
- 已注册阿里云账号
- 已开通容器镜像服务
- 已创建命名空间和仓库

## 🎨 架构图

```
┌─────────────────────────────────────────┐
│              浏览器/客户端               │
└──────────────┬──────────────────────────┘
               │ HTTP/HTTPS
               │
    ┌──────────▼──────────┐
    │    Nginx (可选)     │
    │   反向代理 + SSL    │
    └──────────┬──────────┘
               │
    ┌──────────▼──────────────────────────┐
    │                                      │
    │         Docker Network               │
    │                                      │
    │  ┌─────────────┐  ┌──────────────┐  │
    │  │   Web :3000 │  │ Server :4000 │  │
    │  │   Next.js   │◄─┤   Express    │  │
    │  └─────────────┘  └──────┬───────┘  │
    │                          │           │
    │                   ┌──────▼───────┐   │
    │                   │  MongoDB     │   │
    │                   │   :27017     │   │
    │                   └──────────────┘   │
    │                          │           │
    └──────────────────────────┼───────────┘
                               │
                        ┌──────▼────────┐
                        │  mongo-data   │
                        │  (持久化卷)   │
                        └───────────────┘
```

## ⚙️ 关键配置说明

### 1. 镜像仓库配置
在脚本中修改：
```bash
REGISTRY="registry.cn-hangzhou.aliyuncs.com"  # 改为你的区域
NAMESPACE="mycompany"  # 改为你的命名空间
```

### 2. 环境变量配置
从 `env.template` 复制并修改：
```env
JWT_SECRET=your-random-secret          # 必改
NEXT_PUBLIC_API_URL=http://your-ip:4000  # 必改
STORAGE_ROOT=/your/storage/path        # 必改
```

### 3. 数据卷挂载
在 `docker-compose.prod.yml` 中：
```yaml
volumes:
  - /volume1/metaclassroom:/storage  # 改为实际路径
  - ./mongo-data:/data/db
```

## 🔒 安全检查清单

部署到生产环境前，请确保：

- [ ] 修改了 JWT_SECRET 为强随机字符串
- [ ] 修改了默认管理员密码
- [ ] MongoDB 未暴露到公网（移除端口映射）
- [ ] 配置了 Nginx 反向代理
- [ ] 启用了 HTTPS（SSL 证书）
- [ ] 配置了防火墙规则
- [ ] 设置了数据备份计划
- [ ] 限制了敏感端口的访问

## 📞 支持与反馈

遇到问题时：
1. 查看日志：`docker compose logs -f`
2. 检查容器状态：`docker compose ps`
3. 参考常见问题：[DOCKER_DEPLOY_GUIDE.md](./DOCKER_DEPLOY_GUIDE.md)

## 📝 更新日志

### 2024-10 Docker 化完成
- ✅ 添加完整 Docker 支持
- ✅ 创建自动化构建推送脚本
- ✅ 编写详细部署文档
- ✅ 支持阿里云镜像仓库
- ✅ 支持 NAS Docker 部署

---

**开始使用：**
```bash
# 1. 本地测试
docker compose up -d --build

# 2. 构建推送
.\build-and-push.ps1

# 3. NAS 部署
./deploy-to-nas.sh
```

详细步骤请参考 [QUICK_START.md](./QUICK_START.md)

