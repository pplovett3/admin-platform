# rclone + NAS + Cloudflare CDN 同步延迟解决方案

## 当前架构分析
```
文件流转: 上传 → 本地临时 → NAS(Y:\metaclassroom) → Cloudflare CDN → 用户
配置: storageRoot: Y:\metaclassroom
     publicDownloadBase: https://dl.yf-xr.com
```

## 问题根源
1. **rclone同步延迟**: 文件写入NAS后，rclone可能有同步延迟
2. **Cloudflare缓存延迟**: CDN从源站拉取需要时间
3. **链路串联**: 两个环节的延迟叠加

## 解决方案

### 方案1: rclone实时同步 + CDN预热
```javascript
// 修改现有上传函数，增加同步验证
async function uploadWithRcloneSync(file, targetPath) {
  // 1. 原有逻辑：保存到NAS
  const finalPath = path.join(config.storageRoot, targetPath);
  fs.writeFileSync(finalPath, fileData);
  
  // 2. 新增：等待rclone同步完成
  await waitForRcloneSync(targetPath);
  
  // 3. 新增：CDN预热
  const cdnUrl = `${config.publicDownloadBase}/${targetPath}`;
  await warmupCDN(cdnUrl);
  
  return cdnUrl;
}

// rclone同步验证
async function waitForRcloneSync(relativePath, maxWait = 30000) {
  const cdnUrl = `${config.publicDownloadBase}/${relativePath}`;
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    try {
      const response = await fetch(cdnUrl, { method: 'HEAD' });
      if (response.status === 200) {
        console.log(`✅ rclone同步完成: ${relativePath}`);
        return true;
      }
    } catch (error) {
      // 继续等待
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒
  }
  
  console.warn(`⚠️ rclone同步超时: ${relativePath}`);
  return false;
}
```

### 方案2: 强制rclone立即同步
```bash
# 在Node.js中调用rclone命令
const { exec } = require('child_process');

async function forceRcloneSync(relativePath) {
  const nasPath = path.join(config.storageRoot, relativePath);
  
  // 强制同步特定文件到云端
  const command = `rclone copy "${nasPath}" remote:bucket/path --progress`;
  
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('rclone sync failed:', error);
        reject(error);
      } else {
        console.log('rclone sync success:', stdout);
        resolve(stdout);
      }
    });
  });
}
```

### 方案3: 双写策略（推荐）
```javascript
// 同时写入NAS和直接上传到CDN源站
async function uploadWithDualWrite(file, targetPath) {
  const promises = [
    // 1. 写入NAS（原有流程）
    writeToNAS(file, targetPath),
    
    // 2. 直接上传到CDN源站（新增）
    uploadToCDNOrigin(file, targetPath)
  ];
  
  const [nasResult, cdnResult] = await Promise.all(promises);
  
  // 立即可用的CDN链接
  return `${config.publicDownloadBase}/${targetPath}`;
}

async function uploadToCDNOrigin(file, targetPath) {
  // 如果CDN支持直接上传API，使用API
  // 否则通过HTTP PUT到源站
  const cdnUrl = `${config.publicDownloadBase}/${targetPath}`;
  
  const response = await fetch(cdnUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': 'Bearer YOUR_CDN_TOKEN' // 如果需要
    }
  });
  
  return response.ok;
}
```

## 具体代码修改

### 1. 修改 saveAudioToNAS 函数
```typescript
// 在 admin-platform/server/src/utils/ai-services.ts 中修改
export async function saveAudioToNAS(
  audioData: Buffer, 
  filename: string, 
  userId: string,
  mimeType: string = 'audio/wav'
): Promise<{ fileId: string; publicUrl: string; storageRelPath: string }> {
  try {
    // ... 原有代码保持不变 ...
    
    // 保存文件到NAS
    const finalPath = path.join(config.storageRoot, storageRelPath);
    fs.writeFileSync(finalPath, audioData);

    // 🆕 新增：等待文件可通过CDN访问
    await ensureCDNAvailability(publicUrl);

    // ... 其余代码保持不变 ...
    
    return {
      fileId: (fileRecord._id as any).toString(),
      publicUrl,
      storageRelPath: storageRelPath.replace(/\\/g, '/')
    };
  } catch (error) {
    console.error('Save audio to NAS error:', error);
    throw error;
  }
}

// 🆕 新增：确保CDN可访问性
async function ensureCDNAvailability(url: string, maxWait = 30000): Promise<boolean> {
  if (!config.publicDownloadBase) {
    return true; // 如果没有配置CDN，直接返回
  }
  
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.status === 200) {
        console.log(`✅ CDN文件就绪: ${url}`);
        return true;
      }
    } catch (error) {
      // 继续等待
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
  }
  
  console.warn(`⚠️ CDN文件未就绪，可能需要更长时间: ${url}`);
  return false;
}
```

### 2. 修改普通文件上传
```typescript
// 在 admin-platform/server/src/routes/files.routes.ts 中修改
router.post('/upload', authenticate as any, upload.single('file'), async (req, res) => {
  try {
    // ... 原有代码直到文件保存 ...
    
    // 原有保存逻辑
    await new Promise<void>((resolve, reject) => {
      const rs = fs.createReadStream(file.path);
      const ws = fs.createWriteStream(finalPath, { flags: 'w' });
      rs.on('error', reject);
      ws.on('error', reject);
      ws.on('finish', () => resolve());
      rs.pipe(ws);
    });
    fs.unlinkSync(file.path);

    // 🆕 新增：CDN可用性检查
    const publicUrl = config.publicDownloadBase 
      ? `${config.publicDownloadBase}/${rel.replace(/\\/g, '/')}`
      : downloadUrl;
    
    if (config.publicDownloadBase) {
      // 后台异步检查，不阻塞响应
      ensureCDNAvailability(publicUrl).catch(err => {
        console.warn('CDN sync check failed:', err);
      });
    }

    // ... 保存到数据库等其余逻辑 ...
    
    return res.json({ 
      ok: true, 
      file: saved, 
      downloadUrl,
      publicUrl, // 🆕 返回公开URL
      cdnReady: false // 🆕 标记CDN状态
    });
  } catch (e: any) {
    // ... 错误处理 ...
  }
});
```

## 环境变量配置优化
```bash
# .env 文件中添加
STORAGE_ROOT=Y:\metaclassroom
PUBLIC_DOWNLOAD_BASE=https://dl.yf-xr.com
RCLONE_CONFIG_PATH=/path/to/rclone.conf
CDN_SYNC_TIMEOUT=30000
CDN_WARMUP_ENABLED=true

# Cloudflare API (如果需要主动清缓存)
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ZONE_ID=your_zone_id
```

## 监控和日志
```typescript
// 添加CDN同步监控
export async function monitorCDNSync() {
  const testFile = 'test-sync-' + Date.now() + '.txt';
  const testPath = path.join(config.storageRoot, 'test', testFile);
  const testUrl = `${config.publicDownloadBase}/test/${testFile}`;
  
  // 写入测试文件
  fs.writeFileSync(testPath, 'CDN sync test');
  
  // 检查同步时间
  const startTime = Date.now();
  const syncSuccess = await ensureCDNAvailability(testUrl);
  const syncTime = Date.now() - startTime;
  
  console.log(`📊 CDN同步监控: ${syncSuccess ? '成功' : '失败'}, 耗时: ${syncTime}ms`);
  
  // 清理测试文件
  try { fs.unlinkSync(testPath); } catch {}
  
  return { success: syncSuccess, duration: syncTime };
}

// 定期监控
setInterval(monitorCDNSync, 300000); // 每5分钟检查一次
```

## 部署建议

### 立即可实施（今天）
1. **添加CDN可用性检查函数**
2. **修改saveAudioToNAS增加等待机制**
3. **配置环境变量**

### 本周内完成
1. **所有上传接口增加CDN预热**
2. **添加监控和告警**
3. **优化rclone配置**

### 长期优化
1. **考虑直接CDN上传**
2. **实现智能重试机制**
3. **CDN多节点策略**
