# 📝 NAS 手动更新步骤（一步步操作）

## 第一部分：在本地 Windows 上上传文件到 NAS

### 步骤 1：打开 PowerShell 或 CMD

按 `Win + R`，输入 `powershell` 或 `cmd`，回车

### 步骤 2：进入项目目录

```powershell
cd D:\Admin_Platform_Project\admin-platform
```

### 步骤 3：上传 server 目录

在 PowerShell 或 CMD 中执行（**需要输入 NAS 密码**）：

```powershell
scp -r .\server Tyrael@192.168.0.239:/volume1/docker/admin-platform/
```

**说明**：
- 会提示输入密码（Tyrael 用户的密码）
- 上传过程可能需要几分钟，请耐心等待
- 如果提示 "找不到 scp 命令"，可以使用 WinSCP 或其他 FTP 工具

### 步骤 4：上传 web 目录

```powershell
scp -r .\web Tyrael@192.168.0.239:/volume1/docker/admin-platform/
```

**同样需要输入密码**

### 步骤 5：上传更新脚本

```powershell
scp .\update-nas.sh Tyrael@192.168.0.239:/volume1/docker/admin-platform/
```

### 步骤 6：上传构建脚本（可选）

```powershell
scp .\nas-build-deploy.sh Tyrael@192.168.0.239:/volume1/docker/admin-platform/
```

---

## 第二部分：在 NAS 上执行更新

### 步骤 1：SSH 连接到 NAS

在 PowerShell 或 CMD 中执行：

```powershell
ssh Tyrael@192.168.0.239
```

**需要输入密码**

### 步骤 2：进入项目目录

```bash
cd /volume1/docker/admin-platform
```

### 步骤 3：查看当前状态（可选）

```bash
# 查看当前运行的容器
docker compose ps

# 查看目录内容，确认文件已上传
ls -la
```

### 步骤 4：停止旧容器

```bash
docker compose down
```

**说明**：这会停止并删除旧容器，但**不会删除数据**（MongoDB 数据和文件都保存在卷中）

### 步骤 5：给更新脚本添加执行权限

```bash
chmod +x update-nas.sh
```

### 步骤 6：执行更新脚本

```bash
./update-nas.sh
```

**说明**：
- 脚本会自动备份旧镜像
- 构建 server 镜像（约 10-15 分钟）
- 构建 web 镜像（约 15-20 分钟）
- 自动启动新容器

**总耗时约 30-40 分钟，请耐心等待**

---

## 第三部分：验证更新

### 步骤 1：查看容器状态

```bash
docker compose ps
```

应该看到三个容器都在运行：
- `admin-platform-mongo`
- `admin-platform-server`
- `admin-platform-web`

### 步骤 2：查看日志

```bash
# 查看所有日志
docker compose logs -f

# 或者查看特定服务日志
docker compose logs -f server
docker compose logs -f web
```

按 `Ctrl + C` 退出日志查看

### 步骤 3：访问系统

在浏览器中打开：
```
http://192.168.0.239:3001
```

使用默认账号登录：
- 用户名：`admin`
- 密码：`admin123`

---

## 🔄 如果不想用脚本，手动执行更新命令

如果 `update-nas.sh` 脚本有问题，可以手动执行以下命令：

### 1. 停止旧容器

```bash
cd /volume1/docker/admin-platform
docker compose down
```

### 2. 备份旧镜像（可选）

```bash
# 查看现有镜像
docker images | grep admin-platform

# 备份镜像（替换时间戳）
docker tag admin-platform-server:latest admin-platform-server:backup-20250101-120000
docker tag admin-platform-web:latest admin-platform-web:backup-20250101-120000
```

### 3. 构建 server 镜像

```bash
cd /volume1/docker/admin-platform/server
docker build -t admin-platform-server:latest .
```

**等待约 10-15 分钟**

### 4. 构建 web 镜像

```bash
cd /volume1/docker/admin-platform/web
docker build --build-arg NEXT_PUBLIC_API_URL=http://192.168.0.239:4000 -t admin-platform-web:latest .
```

**等待约 15-20 分钟**

### 5. 启动新容器

```bash
cd /volume1/docker/admin-platform
docker compose up -d
```

### 6. 查看状态

```bash
docker compose ps
docker compose logs -f
```

---

## ⚠️ 常见问题

### 问题 1：scp 命令找不到

**解决方案**：
- 使用 WinSCP（图形界面工具）
- 或使用 FileZilla
- 或使用 Windows 的 `scp.exe`（通常在 `C:\Windows\System32\OpenSSH\`）

### 问题 2：上传失败

**检查**：
```powershell
# 检查网络连接
ping 192.168.0.239

# 检查 SSH 连接
ssh Tyrael@192.168.0.239
```

### 问题 3：构建失败

**查看详细错误**：
```bash
# 查看构建日志
docker build -t admin-platform-server:latest . --progress=plain

# 检查磁盘空间
df -h
```

### 问题 4：容器无法启动

**查看日志**：
```bash
docker compose logs server
docker compose logs web
```

---

## 📋 完整命令清单（复制粘贴用）

### 本地 Windows（PowerShell/CMD）

```powershell
# 进入项目目录
cd D:\Admin_Platform_Project\admin-platform

# 上传 server
scp -r .\server Tyrael@192.168.0.239:/volume1/docker/admin-platform/

# 上传 web
scp -r .\web Tyrael@192.168.0.239:/volume1/docker/admin-platform/

# 上传更新脚本
scp .\update-nas.sh Tyrael@192.168.0.239:/volume1/docker/admin-platform/

# SSH 连接
ssh Tyrael@192.168.0.239
```

### NAS 上（SSH 连接后）

```bash
# 进入目录
cd /volume1/docker/admin-platform

# 停止旧容器
docker compose down

# 添加执行权限
chmod +x update-nas.sh

# 执行更新
./update-nas.sh

# 查看状态
docker compose ps

# 查看日志
docker compose logs -f
```

---

完成！🎉

