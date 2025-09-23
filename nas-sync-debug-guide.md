# NAS文件同步问题诊断指南

## 问题现象
- 阿里云服务器显示文件已保存到Y盘NAS
- NAS网页端看到文件夹但看不到模型文件
- Cloudflare CDN无法访问文件

## 逐步诊断方法

### 步骤1: 在阿里云服务器上检查文件
```powershell
# 1. 进入文件目录
cd "Y:\metaclassroom\users\689c46d619\..."

# 2. 列出目录内容
dir

# 3. 检查文件详细信息
dir /A    # 显示所有文件，包括隐藏文件

# 4. 检查文件大小和权限
dir *.glb /Q    # 显示GLB文件和所有者信息

# 5. 尝试直接访问文件
type "AB8.glb" | more    # 查看文件是否可读
```

### 步骤2: 检查网络驱动器挂载状态
```powershell
# 1. 检查网络驱动器状态
net use

# 2. 检查Y盘具体挂载信息
net use Y:

# 3. 重新挂载网络驱动器（如果需要）
net use Y: /delete
net use Y: \\NAS服务器IP\共享路径 /persistent:yes
```

### 步骤3: 检查文件权限和所有权
```powershell
# 1. 检查文件权限
icacls "Y:\metaclassroom\users\689c46d619...\AB8.glb"

# 2. 检查文件是否被锁定
lsof "Y:\metaclassroom\users\689c46d619...\AB8.glb"
# 或在Windows上
handle "Y:\metaclassroom\users\689c46d619...\AB8.glb"
```

### 步骤4: 检查rclone配置和状态
```bash
# 1. 检查rclone配置
rclone config show

# 2. 检查rclone同步状态
rclone ls remote:路径 | grep AB8.glb

# 3. 手动触发同步
rclone sync "Y:\metaclassroom\users\689c46d619..." remote:对应路径 -v

# 4. 检查rclone日志
rclone log
```

### 步骤5: 在NAS上直接检查
```bash
# 如果能SSH到NAS设备
ssh nas用户@NAS IP

# 1. 检查物理文件是否存在
ls -la /volume1/共享路径/users/689c46d619.../

# 2. 检查文件权限
ls -la /volume1/共享路径/users/689c46d619.../AB8.glb

# 3. 检查磁盘空间
df -h

# 4. 检查文件系统错误
fsck /dev/磁盘设备
```

## 常见原因和解决方案

### 原因1: 网络驱动器缓存问题
**诊断**:
```powershell
# 清除SMB缓存
nbtstat -R
nbtstat -RR
```

**解决**:
```powershell
# 重新挂载网络驱动器
net use Y: /delete
net use Y: \\NAS IP\共享名 密码 /user:用户名 /persistent:yes
```

### 原因2: 文件传输未完成
**诊断**:
```powershell
# 检查文件大小是否正确
dir "Y:\...\AB8.glb"
# 对比应该有的文件大小
```

**解决**:
```javascript
// 在Node.js代码中添加文件完整性检查
const fs = require('fs');
const crypto = require('crypto');

function verifyFileIntegrity(filePath, expectedSize) {
  const stats = fs.statSync(filePath);
  if (stats.size !== expectedSize) {
    throw new Error(`文件大小不匹配: 期望${expectedSize}, 实际${stats.size}`);
  }
  return true;
}
```

### 原因3: rclone同步延迟
**诊断**:
```bash
# 检查rclone同步状态
rclone check Y:\metaclassroom remote:metaclassroom --one-way
```

**解决**:
```bash
# 强制立即同步
rclone sync Y:\metaclassroom remote:metaclassroom --progress --transfers 4

# 或只同步特定文件
rclone copy "Y:\metaclassroom\users\689c46d619...\AB8.glb" remote:metaclassroom/users/689c46d619.../ -v
```

### 原因4: NAS权限问题
**诊断在NAS控制面板**:
1. 登录NAS管理界面
2. 文件管理器 → 检查文件是否存在
3. 控制面板 → 用户账户 → 检查权限
4. 控制面板 → 共享文件夹 → 检查权限设置

**解决**:
1. 修正文件/文件夹权限
2. 重建索引: NAS控制面板 → 索引服务 → 重建索引

### 原因5: 文件系统问题
**诊断**:
```powershell
# Windows上检查磁盘错误
chkdsk Y: /f /r
```

**解决**:
```bash
# NAS上修复文件系统
fsck -f /dev/磁盘设备
```

## 实时监控脚本

### PowerShell监控脚本
```powershell
# monitor-nas-sync.ps1
$targetFile = "Y:\metaclassroom\users\689c46d619...\AB8.glb"
$startTime = Get-Date

while ($true) {
    if (Test-Path $targetFile) {
        $fileSize = (Get-Item $targetFile).Length
        $elapsed = (Get-Date) - $startTime
        Write-Host "✅ 文件已出现: $targetFile, 大小: $fileSize bytes, 耗时: $($elapsed.TotalSeconds)秒"
        break
    } else {
        $elapsed = (Get-Date) - $startTime
        Write-Host "⏳ 等待文件出现... 已等待: $($elapsed.TotalSeconds)秒"
        Start-Sleep -Seconds 5
    }
    
    if ($elapsed.TotalMinutes -gt 10) {
        Write-Host "❌ 超时: 10分钟内文件未出现"
        break
    }
}
```

### Node.js文件监控
```javascript
// 在上传代码中添加监控
const fs = require('fs');
const path = require('path');

async function waitForFileSync(filePath, maxWait = 300000) {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const checkFile = () => {
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`✅ 文件同步完成: ${filePath}, 大小: ${stats.size}`);
        resolve(true);
      } else if (Date.now() - startTime > maxWait) {
        reject(new Error(`文件同步超时: ${filePath}`));
      } else {
        console.log(`⏳ 等待文件同步: ${filePath}`);
        setTimeout(checkFile, 2000);
      }
    };
    
    checkFile();
  });
}
```

## 紧急解决方案

### 1. 立即重新上传
```javascript
// 如果文件丢失，重新上传
app.post('/re-upload-model', async (req, res) => {
  try {
    const { fileId } = req.body;
    const fileRecord = await FileModel.findById(fileId);
    
    if (!fileRecord) {
      return res.status(404).json({ error: '文件记录不存在' });
    }
    
    const filePath = path.join(config.storageRoot, fileRecord.storageRelPath);
    
    if (!fs.existsSync(filePath)) {
      // 文件不存在，需要重新上传
      return res.json({ 
        needReupload: true, 
        message: '文件丢失，需要重新上传' 
      });
    }
    
    // 强制rclone同步
    await forceRcloneSync(fileRecord.storageRelPath);
    
    res.json({ success: true, message: '文件已重新同步' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 2. 使用备用CDN
```javascript
// 如果主CDN不可用，使用备用方案
function getFileUrl(fileRecord) {
  const primaryUrl = `https://dl.yf-xr.com/${fileRecord.storageRelPath}`;
  const backupUrl = `/api/files/${fileRecord._id}/download`; // 直接从服务器下载
  
  return {
    primary: primaryUrl,
    backup: backupUrl,
    recommended: primaryUrl // 先尝试CDN
  };
}
```
