# 部署检查清单 ✅

使用此清单确保正确完成 Docker 部署的每个步骤。

## 📋 阶段一：本地准备（Windows 开发机）

### 环境检查
- [ ] 已安装 Docker Desktop
- [ ] Docker Desktop 正在运行
- [ ] 已验证 Docker 版本：`docker --version`
- [ ] 已验证 Docker Compose：`docker compose version`

### 配置文件准备
- [ ] 复制 `env.template` 为 `.env`
- [ ] 修改 `.env` 中的 `JWT_SECRET`
- [ ] 修改 `.env` 中的 `STORAGE_ROOT`（改为本地路径）
- [ ] 确认 `.env` 中的 `NEXT_PUBLIC_API_URL=http://localhost:4000`

### 本地测试
- [ ] 执行 `docker compose up -d --build`
- [ ] 等待容器启动完成（约 2-3 分钟）
- [ ] 访问 http://localhost:3000 确认前端正常
- [ ] 访问 http://localhost:4000/health 确认后端正常
- [ ] 使用 `13800000000/admin123` 登录测试
- [ ] 测试核心功能（上传、浏览等）
- [ ] 执行 `docker compose down` 停止服务

**✅ 本地测试通过，继续下一阶段**

---

## 📋 阶段二：阿里云镜像仓库准备

### 阿里云控制台配置
- [ ] 登录阿里云控制台
- [ ] 打开容器镜像服务：https://cr.console.aliyun.com
- [ ] 选择个人实例或企业版
- [ ] 记录镜像仓库地址（如：`registry.cn-hangzhou.aliyuncs.com`）
- [ ] 创建命名空间（如：`mycompany`）
- [ ] 创建仓库：`admin-platform-server`
- [ ] 创建仓库：`admin-platform-web`
- [ ] 设置仓库访问权限（公开或私有）
- [ ] 获取镜像仓库登录凭证

### 修改构建脚本
- [ ] 打开 `build-and-push.ps1`（Windows）或 `build-and-push.sh`（Linux/Mac）
- [ ] 修改 `REGISTRY` 为你的镜像仓库地址
- [ ] 修改 `NAMESPACE` 为你的命名空间
- [ ] 保存文件

### 推送镜像
```powershell
# Windows PowerShell
.\build-and-push.ps1
```

```bash
# Linux/Mac
chmod +x build-and-push.sh
./build-and-push.sh
```

检查清单：
- [ ] 提示登录时，输入阿里云镜像仓库用户名和密码
- [ ] Server 镜像构建成功
- [ ] Web 镜像构建成功
- [ ] Server 镜像推送成功
- [ ] Web 镜像推送成功
- [ ] 在阿里云控制台确认镜像版本已上传

**✅ 镜像推送成功，继续下一阶段**

---

## 📋 阶段三：NAS 环境准备

### NAS 基础检查
- [ ] NAS 已安装 Docker
- [ ] NAS 已安装 Docker Compose
- [ ] 确认 Docker 服务运行中
- [ ] 确认有足够磁盘空间（至少 10GB）
- [ ] 确认有足够内存（至少 2GB）

### 创建部署目录
```bash
# SSH 登录 NAS 或使用文件管理器
mkdir -p /volume1/docker/admin-platform
cd /volume1/docker/admin-platform
```

- [ ] 创建了部署目录
- [ ] 记录部署目录路径：`_________________`

### 上传配置文件
将以下文件从开发机上传到 NAS 部署目录：
- [ ] `docker-compose.prod.yml`
- [ ] `env.template`
- [ ] `deploy-to-nas.sh`（可选）

### 配置生产环境变量
在 NAS 上：
```bash
cd /volume1/docker/admin-platform
cp env.template .env.prod
nano .env.prod  # 或使用其他编辑器
```

修改以下配置：
- [ ] `JWT_SECRET` - 生成新的强随机密钥（不要与开发环境相同！）
- [ ] `NEXT_PUBLIC_API_URL` - 改为 NAS 的 IP 地址，如：`http://192.168.1.100:4000`
- [ ] `STORAGE_ROOT` - 改为 NAS 的存储路径，如：`/volume1/metaclassroom`
- [ ] 其他必要配置

### 修改 docker-compose.prod.yml
- [ ] 打开 `docker-compose.prod.yml`
- [ ] 将所有镜像地址改为你的阿里云仓库地址：
  ```yaml
  image: registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-server:latest
  ```
- [ ] 检查数据卷挂载路径是否正确
- [ ] 保存文件

**✅ NAS 配置完成，继续部署**

---

## 📋 阶段四：NAS 部署执行

### 登录阿里云镜像仓库
```bash
docker login registry.cn-hangzhou.aliyuncs.com
```

- [ ] 输入阿里云镜像仓库用户名
- [ ] 输入密码
- [ ] 显示 "Login Succeeded"

### 拉取镜像
```bash
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-server:latest
docker pull registry.cn-hangzhou.aliyuncs.com/你的命名空间/admin-platform-web:latest
docker pull mongo:6
```

- [ ] Server 镜像拉取成功
- [ ] Web 镜像拉取成功
- [ ] MongoDB 镜像拉取成功

### 启动服务
```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

- [ ] 容器创建成功
- [ ] 容器启动成功
- [ ] 查看状态：`docker compose -f docker-compose.prod.yml ps`
- [ ] 所有容器状态为 "Up"

### 等待服务就绪
等待约 30-60 秒，让服务完全启动

- [ ] 查看日志：`docker compose -f docker-compose.prod.yml logs -f`
- [ ] MongoDB 启动完成
- [ ] Server 启动完成，显示 "Server running on port 4000"
- [ ] Web 启动完成

**✅ 服务启动成功，继续验证**

---

## 📋 阶段五：服务验证

### 网络访问测试

从 NAS 本地测试：
```bash
curl http://localhost:4000/health
curl http://localhost:3000
```

- [ ] 后端健康检查返回 `{"ok":true}`
- [ ] 前端返回 HTML 内容

从外部网络测试：
- [ ] 记录 NAS IP 地址：`_________________`
- [ ] 浏览器访问：`http://你的NAS_IP:3000`
- [ ] 前端页面加载成功
- [ ] 后端 API 访问：`http://你的NAS_IP:4000/health`
- [ ] 返回健康状态

### 功能测试
- [ ] 使用默认账号登录：`13800000000/admin123`
- [ ] 登录成功，跳转到管理后台
- [ ] 测试文件上传功能
- [ ] 测试数据浏览功能
- [ ] 测试其他核心功能

### 容器健康检查
```bash
docker compose -f docker-compose.prod.yml ps
```

- [ ] mongo 容器健康状态：healthy
- [ ] server 容器健康状态：healthy
- [ ] web 容器健康状态：healthy

### 数据持久化验证
```bash
# 重启容器
docker compose -f docker-compose.prod.yml restart

# 等待 30 秒
sleep 30

# 再次访问，数据应该还在
```

- [ ] 重启后数据未丢失
- [ ] 数据卷挂载正确

**✅ 服务验证通过，部署成功！**

---

## 📋 阶段六：安全加固（生产环境必做）

### 密码安全
- [ ] 修改默认管理员密码（从 `admin123` 改为强密码）
- [ ] 确认 `.env.prod` 文件权限设置为 600（`chmod 600 .env.prod`）
- [ ] 确认 JWT_SECRET 是强随机字符串（32 位以上）

### 网络安全
- [ ] MongoDB 未暴露到公网（docker-compose.prod.yml 中无 27017 端口映射）
- [ ] 配置 NAS 防火墙规则
- [ ] 仅开放必要端口（3000, 4000）
- [ ] 考虑使用 VPN 或内网访问

### 反向代理（强烈推荐）
- [ ] 配置 Nginx 反向代理
- [ ] 申请 SSL 证书（Let's Encrypt 或阿里云）
- [ ] 配置 HTTPS
- [ ] 配置域名解析
- [ ] 测试 HTTPS 访问

### 数据备份
```bash
# 创建备份目录
mkdir -p /volume1/docker/admin-platform/backups

# 设置定时备份脚本
```

- [ ] 设置 MongoDB 自动备份
- [ ] 设置文件存储备份
- [ ] 测试备份恢复流程
- [ ] 记录备份位置：`_________________`

### 监控告警
- [ ] 配置容器重启策略（已在 docker-compose.prod.yml 中设置）
- [ ] 配置日志轮转
- [ ] 设置磁盘空间监控
- [ ] 设置服务健康监控

**✅ 安全加固完成**

---

## 📋 阶段七：运维准备

### 文档记录
记录以下关键信息：

```
部署信息记录表
===================
NAS IP 地址：____________________
访问地址（前端）：http://______:3000
访问地址（后端）：http://______:4000
部署目录：____________________
镜像仓库地址：____________________
命名空间：____________________
管理员账号：____________________
部署日期：____________________
最新版本号：____________________
```

### 常用命令备忘
将以下命令保存到 NAS 的 `commands.txt`：

```bash
# 查看状态
docker compose -f docker-compose.prod.yml ps

# 查看日志
docker compose -f docker-compose.prod.yml logs -f

# 重启服务
docker compose -f docker-compose.prod.yml restart

# 停止服务
docker compose -f docker-compose.prod.yml down

# 更新服务
docker pull registry.cn-hangzhou.aliyuncs.com/命名空间/admin-platform-server:latest
docker pull registry.cn-hangzhou.aliyuncs.com/命名空间/admin-platform-web:latest
docker compose -f docker-compose.prod.yml up -d

# 备份数据库
docker exec admin-platform-mongo mongodump --out /backup

# 查看资源使用
docker stats
```

- [ ] 保存了常用命令
- [ ] 团队成员已了解基本操作

### 更新流程文档
- [ ] 记录了完整的更新流程
- [ ] 测试了更新流程
- [ ] 确认更新不会导致数据丢失

**✅ 运维准备完成**

---

## 🎉 部署完成！

恭喜！您已成功完成 Admin Platform 的 Docker 化部署。

### 下一步建议：
1. 监控服务运行状况
2. 定期检查日志
3. 执行定期备份
4. 关注系统更新
5. 优化性能配置

### 需要帮助？
- 查看详细文档：[DOCKER_DEPLOY_GUIDE.md](./DOCKER_DEPLOY_GUIDE.md)
- 快速参考：[QUICK_START.md](./QUICK_START.md)
- 常见问题：查看部署指南的"常见问题"章节

---

**部署人签名：__________ 日期：__________**

