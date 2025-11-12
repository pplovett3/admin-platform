/**
 * 列出MongoDB中所有数据库
 */

const mongoose = require('mongoose');

const MONGODB_HOST = '192.168.0.239:27017';

async function main() {
  try {
    console.log('🔌 连接MongoDB服务器...');
    console.log(`   地址: ${MONGODB_HOST}\n`);
    
    // 连接到admin数据库以便列出所有数据库
    await mongoose.connect(`mongodb://${MONGODB_HOST}/admin`);
    
    // 获取所有数据库列表
    const adminDb = mongoose.connection.db.admin();
    const result = await adminDb.listDatabases();
    
    console.log(`📊 MongoDB服务器中共有 ${result.databases.length} 个数据库：`);
    console.log('─'.repeat(80));
    
    result.databases.forEach((db, index) => {
      const sizeInMB = (db.sizeOnDisk / 1024 / 1024).toFixed(2);
      console.log(`${index + 1}. ${db.name}`);
      console.log(`   大小: ${sizeInMB} MB`);
      console.log(`   是否为空: ${db.empty ? '是' : '否'}`);
      console.log('');
    });
    
    console.log('─'.repeat(80));
    console.log('\n💡 提示：检查哪个数据库包含学校数据...\n');

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

main();

