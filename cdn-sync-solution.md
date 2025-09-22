# CDN缓存同步延迟解决方案

## 问题描述
资源上传到NAS后，通过Cloudflare CDN访问有延迟，链接不能立即生效。

## 技术原理
1. **上传流程**: 文件 → NAS → Cloudflare CDN → 全球边缘节点
2. **延迟来源**: CDN缓存传播、DNS解析、Origin Pull策略

## 解决方案

### 方案1: 自动缓存清除 + 预热
```javascript
// 上传后处理流程
async function uploadAndSync(file, nasPath) {
  // 1. 上传到NAS
  const nasUrl = await uploadToNAS(file, nasPath);
  
  // 2. 生成CDN URL
  const cdnUrl = convertToCDNUrl(nasUrl);
  
  // 3. 清除可能存在的缓存
  await purgeCDNCache(cdnUrl);
  
  // 4. 预热缓存 - 立即访问CDN链接
  await warmupCache(cdnUrl);
  
  // 5. 验证可用性
  await verifyCDNAvailability(cdnUrl);
  
  return cdnUrl;
}

// Cloudflare API缓存清除
async function purgeCDNCache(url) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      files: [url]
    })
  });
  return response.json();
}

// 缓存预热
async function warmupCache(url) {
  const response = await fetch(url, { method: 'HEAD' });
  return response.status === 200;
}
```

### 方案2: 版本化URL策略
```javascript
// 使用时间戳避免缓存问题
function generateVersionedUrl(baseUrl) {
  const timestamp = Date.now();
  return `${baseUrl}?v=${timestamp}`;
}

// 或使用文件哈希
function generateHashedUrl(baseUrl, fileHash) {
  return `${baseUrl}?hash=${fileHash}`;
}
```

### 方案3: 直接NAS访问备用机制
```javascript
// 双重检查机制
async function getResourceUrl(nasUrl, cdnUrl) {
  try {
    // 首先尝试CDN
    const cdnResponse = await fetch(cdnUrl, { method: 'HEAD' });
    if (cdnResponse.status === 200) {
      return cdnUrl;
    }
  } catch (error) {
    console.warn('CDN not ready, falling back to NAS');
  }
  
  // 回退到直接NAS访问
  return nasUrl;
}
```

### 方案4: Cloudflare配置优化
```yaml
# Cloudflare Page Rules 设置
Cache Rules:
  - Pattern: "dl.yf-xr.com/*"
    Cache Level: "Standard"
    Browser TTL: "4 hours"
    Edge TTL: "1 day"
    
  - Pattern: "dl.yf-xr.com/tts/*"
    Cache Level: "Bypass"  # 音频文件不缓存，立即生效
    
  - Pattern: "dl.yf-xr.com/images/*"
    Cache Level: "Standard"
    Edge TTL: "1 hour"     # 图片短缓存
```

## 推荐实施步骤

### 短期解决方案 (立即可实施)
1. **添加预热机制**: 上传后立即访问CDN URL
2. **版本化URL**: 给资源URL添加时间戳参数
3. **错误重试**: CDN失败时回退到NAS直连

### 中期优化 (1-2周实施)
1. **集成Cloudflare API**: 自动清除缓存
2. **监控机制**: 检测CDN可用性
3. **配置优化**: 调整缓存规则

### 长期架构优化
1. **多CDN策略**: 备用CDN提供商
2. **边缘计算**: 使用Cloudflare Workers
3. **实时同步**: WebSocket通知机制

## 代码集成示例

```javascript
// 在现有上传API中集成
app.post('/api/upload', async (req, res) => {
  try {
    const file = req.file;
    
    // 原有上传逻辑
    const nasUrl = await uploadToNAS(file);
    const cdnUrl = generateCDNUrl(nasUrl);
    
    // 新增: CDN同步优化
    await optimizeCDNSync(cdnUrl);
    
    res.json({ 
      success: true, 
      nasUrl, 
      cdnUrl,
      ready: true  // 标记CDN已就绪
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function optimizeCDNSync(cdnUrl) {
  // 1. 预热缓存
  await warmupCache(cdnUrl);
  
  // 2. 验证可用性
  const isReady = await verifyCDNAvailability(cdnUrl, { 
    retries: 3, 
    delay: 1000 
  });
  
  if (!isReady) {
    throw new Error('CDN sync failed');
  }
}
```

## 监控和告警

```javascript
// CDN健康检查
async function cdnHealthCheck() {
  const testUrls = [
    'https://dl.yf-xr.com/test-file.txt'
  ];
  
  for (const url of testUrls) {
    const start = Date.now();
    try {
      const response = await fetch(url);
      const latency = Date.now() - start;
      
      console.log(`CDN Health: ${url} - ${response.status} (${latency}ms)`);
    } catch (error) {
      console.error(`CDN Error: ${url} - ${error.message}`);
      // 发送告警通知
    }
  }
}

// 定期检查
setInterval(cdnHealthCheck, 300000); // 每5分钟检查
```

