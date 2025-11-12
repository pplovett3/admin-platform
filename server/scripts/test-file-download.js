/**
 * 测试文件下载接口
 */

const http = require('http');

const BASE_URL = 'http://192.168.0.239:4000';

// 简单的HTTP请求函数
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          statusText: res.statusMessage,
          headers: res.headers,
          data: data
        });
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function main() {
  console.log('🔐 测试文件下载接口\n');
  console.log('='.repeat(80));
  console.log(`Base URL: ${BASE_URL}`);
  console.log('='.repeat(80));
  
  try {
    // 1. 登录获取token
    console.log('\n1️⃣ 登录获取token...');
    const loginRes = await httpRequest(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        phone: '13800000000',
        password: 'admin123'
      }
    });
    
    const loginData = JSON.parse(loginRes.data);
    const token = loginData.token;
    console.log(`✅ 登录成功！`);
    console.log(`Token: ${token.substring(0, 20)}...`);
    
    // 2. 获取文件列表
    console.log('\n2️⃣ 获取文件列表...');
    const filesRes = await httpRequest(`${BASE_URL}/api/files/mine`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log(`   状态码: ${filesRes.status}`);
    if (filesRes.status !== 200) {
      console.log(`   响应: ${filesRes.data.substring(0, 500)}`);
      throw new Error(`获取文件列表失败: ${filesRes.status}`);
    }
    
    const filesData = JSON.parse(filesRes.data);
    const files = filesData.rows || filesData;
    console.log(`✅ 找到 ${files.length} 个文件\n`);
    
    if (files.length === 0) {
      console.log('❌ 没有文件可供测试');
      return;
    }
    
    // 显示前5个文件
    console.log('文件列表（前5个）:');
    files.slice(0, 5).forEach((file, idx) => {
      console.log(`  ${idx + 1}. ${file.originalName} (ID: ${file.id})`);
      console.log(`     类型: ${file.type}`);
      console.log(`     大小: ${file.size} bytes`);
    });
    
    // 3. 测试下载第一个文件
    const testFile = files[0];
    console.log('\n' + '='.repeat(80));
    console.log('3️⃣ 测试下载文件...');
    console.log('='.repeat(80));
    console.log(`\n文件: ${testFile.originalName}`);
    console.log(`ID: ${testFile.id}`);
    console.log(`下载URL: ${BASE_URL}/api/files/${testFile.id}/download`);
    
    // 测试不带token的请求
    console.log('\n📝 测试1: 不带Authorization header (应该失败)');
    const noTokenRes = await httpRequest(`${BASE_URL}/api/files/${testFile.id}/download`);
    if (noTokenRes.status === 401 || noTokenRes.status === 403) {
      console.log(`✅ 预期失败: ${noTokenRes.status} ${noTokenRes.statusText}`);
      console.log(`   响应: ${noTokenRes.data.substring(0, 200)}`);
    } else {
      console.log(`❌ 意外：请求返回 ${noTokenRes.status} (应该是401)`);
    }
    
    // 测试带token的请求
    console.log('\n📝 测试2: 带Authorization header (应该成功)');
    const downloadRes = await httpRequest(`${BASE_URL}/api/files/${testFile.id}/download`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (downloadRes.status >= 200 && downloadRes.status < 400) {
      console.log(`✅ 下载成功！`);
      console.log(`   状态码: ${downloadRes.status}`);
      console.log(`   Content-Type: ${downloadRes.headers['content-type']}`);
      console.log(`   Content-Length: ${downloadRes.headers['content-length'] || '未知'}`);
      
      if (downloadRes.status === 302 || downloadRes.status === 301) {
        console.log(`   重定向到: ${downloadRes.headers.location}`);
      } else {
        console.log(`   数据大小: ${downloadRes.data.length} bytes`);
      }
    } else {
      console.log(`❌ 下载失败: ${downloadRes.status} ${downloadRes.statusText}`);
      console.log(`   响应: ${downloadRes.data.substring(0, 200)}`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ 测试完成');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();

