// 自定义HTTPS服务器 - 用于本地WebXR开发
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');
const path = require('path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3001', 10);

// 证书路径（相对于项目根目录）
const certPath = path.join(__dirname, '..', 'cert.pem');
const keyPath = path.join(__dirname, '..', 'key.pem');

// 检查证书是否存在
if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('❌ 证书文件不存在！');
  console.error('请先运行以下命令生成证书：');
  console.error('  mkcert -cert-file cert.pem -key-file key.pem localhost 127.0.0.1 192.168.0.19');
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
};

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .listen(port, hostname, () => {
      console.log(`
🔒 HTTPS Server running at:
   - https://localhost:${port}
   - https://192.168.0.19:${port}

📱 在VR设备上访问 https://192.168.0.19:${port}
      `);
    });
});





