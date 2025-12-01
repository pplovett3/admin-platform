# 🔧 NAS 上传问题解决方案

## 问题现象
```
scp.exe: stat remote: Unknown status
scp.exe: failed to upload directory ./server to /volume1/docker/admin-platform/
```

## 解决方案

### 方案一：先检查并创建目录（推荐）

#### 步骤 1：SSH 连接到 NAS 检查目录

```powershell
ssh Tyrael@192.168.0.239
```

#### 步骤 2：在 NAS 上检查并创建目录

```bash
# 检查目录是否存在
ls -la /volume1/docker/admin-platform/

# 如果目录不存在，创建它
mkdir -p /volume1/docker/admin-platform

# 检查权限
ls -ld /volume1/docker/admin-platform/
```

#### 步骤 3：使用不同的路径格式上传

在 Windows PowerShell 中尝试：

```powershell
# 方法 1：使用绝对路径（Windows 格式）
scp -r D:\Admin_Platform_Project\admin-platform\server Tyrael@192.168.0.239:/volume1/docker/admin-platform/

# 方法 2：先进入 server 目录
cd D:\Admin_Platform_Project\admin-platform\server
scp -r * Tyrael@192.168.0.239:/volume1/docker/admin-platform/server/

# 方法 3：使用相对路径（确保在项目根目录）
cd D:\Admin_Platform_Project\admin-platform
scp -r server\* Tyrael@192.168.0.239:/volume1/docker/admin-platform/server/
```

---

### 方案二：使用 tar + ssh 压缩传输（最可靠）

#### 步骤 1：在本地压缩文件

```powershell
# 进入项目目录
cd D:\Admin_Platform_Project\admin-platform

# 压缩 server 目录（Windows 10+ 自带 tar）
tar -czf server.tar.gz server

# 压缩 web 目录
tar -czf web.tar.gz web
```

#### 步骤 2：上传压缩文件

```powershell
# 上传 server.tar.gz
scp server.tar.gz Tyrael@192.168.0.239:/volume1/docker/admin-platform/

# 上传 web.tar.gz
scp web.tar.gz Tyrael@192.168.0.239:/volume1/docker/admin-platform/

# 上传更新脚本
scp update-nas.sh Tyrael@192.168.0.239:/volume1/docker/admin-platform/
```

#### 步骤 3：在 NAS 上解压

```bash
# SSH 连接到 NAS
ssh Tyrael@192.168.0.239

# 进入目录
cd /volume1/docker/admin-platform

# 解压文件
tar -xzf server.tar.gz
tar -xzf web.tar.gz

# 删除压缩文件（可选）
rm server.tar.gz web.tar.gz

# 查看结果
ls -la
```

---

### 方案三：使用 WinSCP（图形界面，最简单）

#### 步骤 1：下载 WinSCP
访问：https://winscp.net/eng/download.php

#### 步骤 2：连接设置
- **文件协议**：SFTP
- **主机名**：`192.168.0.239`
- **端口号**：`22`
- **用户名**：`Tyrael`
- **密码**：你的 NAS 密码

#### 步骤 3：上传文件
1. 连接成功后，左侧是本地文件，右侧是 NAS 文件
2. 导航到本地：`D:\Admin_Platform_Project\admin-platform`
3. 导航到 NAS：`/volume1/docker/admin-platform`
4. 拖拽上传：
   - `server` 文件夹
   - `web` 文件夹
   - `update-nas.sh` 文件

---

### 方案四：使用 rsync（如果 NAS 支持）

```powershell
# 安装 rsync（Windows 10+ 可能需要安装）
# 或者使用 Git Bash 中的 rsync

# 上传 server
rsync -avz -e ssh ./server/ Tyrael@192.168.0.239:/volume1/docker/admin-platform/server/

# 上传 web
rsync -avz -e ssh ./web/ Tyrael@192.168.0.239:/volume1/docker/admin-platform/web/
```

---

### 方案五：分步上传（如果目录太大）

如果 `server` 或 `web` 目录太大，可以只上传必要的文件：

#### 只上传源代码（排除 node_modules）

```powershell
# 在项目目录创建临时目录
mkdir temp_upload
mkdir temp_upload\server
mkdir temp_upload\web

# 复制源代码（排除 node_modules）
xcopy /E /I /EXCLUDE:exclude.txt server temp_upload\server
xcopy /E /I /EXCLUDE:exclude.txt web temp_upload\web

# exclude.txt 内容：
# node_modules
# .next
# dist
# *.log
```

或者使用 PowerShell：

```powershell
# 复制 server（排除 node_modules）
robocopy server temp_upload\server /E /XD node_modules dist .next /XF *.log

# 复制 web（排除 node_modules）
robocopy web temp_upload\web /E /XD node_modules .next dist /XF *.log

# 上传
scp -r temp_upload\server Tyrael@192.168.0.239:/volume1/docker/admin-platform/
scp -r temp_upload\web Tyrael@192.168.0.239:/volume1/docker/admin-platform/
```

---

## 🔍 诊断步骤

### 1. 检查 SSH 连接是否正常

```powershell
ssh Tyrael@192.168.0.239 "ls -la /volume1/docker/admin-platform/"
```

如果能列出文件，说明 SSH 连接正常。

### 2. 检查目录权限

在 NAS 上执行：

```bash
ssh Tyrael@192.168.0.239
ls -ld /volume1/docker/admin-platform/
```

如果权限不对，修改权限：

```bash
sudo chmod 755 /volume1/docker/admin-platform
sudo chown Tyrael:Tyrael /volume1/docker/admin-platform
```

### 3. 测试上传单个文件

```powershell
# 创建一个测试文件
echo "test" > test.txt

# 尝试上传
scp test.txt Tyrael@192.168.0.239:/volume1/docker/admin-platform/

# 如果成功，说明连接正常，可能是目录上传的问题
```

---

## ✅ 推荐流程（tar 压缩方式）

这是最可靠的方法：

### 本地操作：

```powershell
# 1. 进入项目目录
cd D:\Admin_Platform_Project\admin-platform

# 2. 压缩目录
tar -czf server.tar.gz server
tar -czf web.tar.gz web

# 3. 上传压缩文件
scp server.tar.gz Tyrael@192.168.0.239:/volume1/docker/admin-platform/
scp web.tar.gz Tyrael@192.168.0.239:/volume1/docker/admin-platform/
scp update-nas.sh Tyrael@192.168.0.239:/volume1/docker/admin-platform/
```

### NAS 上操作：

```bash
# 1. SSH 连接
ssh Tyrael@192.168.0.239

# 2. 进入目录
cd /volume1/docker/admin-platform

# 3. 解压
tar -xzf server.tar.gz
tar -xzf web.tar.gz

# 4. 删除压缩文件
rm server.tar.gz web.tar.gz

# 5. 继续更新流程
docker compose down
chmod +x update-nas.sh
./update-nas.sh
```

---

完成！建议使用 **方案二（tar 压缩方式）**，这是最可靠的方法。

