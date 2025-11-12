/**
 * 彻底搜索所有数据库中的课程数据
 */

const mongoose = require('mongoose');

async function searchAllDatabases() {
  // 先连接到admin数据库列出所有数据库
  const adminUri = 'mongodb://192.168.0.239:27017/admin';
  
  try {
    await mongoose.connect(adminUri);
    
    // 获取所有数据库
    const adminDb = mongoose.connection.db.admin();
    const { databases } = await adminDb.listDatabases();
    
    console.log('🔍 找到的数据库:');
    databases.forEach(db => {
      console.log(`  - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    
    await mongoose.disconnect();
    
    // 遍历每个数据库（排除系统数据库）
    for (const database of databases) {
      if (['admin', 'config', 'local'].includes(database.name)) {
        continue;
      }
      
      await searchInDatabase(database.name);
    }
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
  }
}

async function searchInDatabase(dbName) {
  const uri = `mongodb://192.168.0.239:27017/${dbName}`;
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📦 数据库: ${dbName}`);
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(uri);
    
    // 获取所有集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log(`\n集合列表 (${collections.length}个):`);
    collections.forEach(c => console.log(`  - ${c.name}`));
    
    // 搜索每个集合
    for (const collInfo of collections) {
      const collName = collInfo.name;
      const collection = mongoose.connection.db.collection(collName);
      
      // 获取集合文档数
      const count = await collection.countDocuments();
      
      if (count === 0) continue;
      
      console.log(`\n📋 集合: ${collName} (${count} 条记录)`);
      console.log('-'.repeat(80));
      
      // 获取前5条文档
      const docs = await collection.find({}).limit(5).toArray();
      
      docs.forEach((doc, idx) => {
        console.log(`\n  [${idx + 1}] ID: ${doc._id}`);
        
        // 显示关键字段
        const keyFields = ['title', 'name', 'courseTitle', 'courseName', 
                          'description', 'type', 'status', 'publishId', 
                          'courseId', 'coursewareId', 'createdAt'];
        
        keyFields.forEach(field => {
          if (doc[field] !== undefined) {
            let value = doc[field];
            if (typeof value === 'string' && value.length > 100) {
              value = value.substring(0, 100) + '...';
            } else if (typeof value === 'object') {
              value = JSON.stringify(value).substring(0, 100) + '...';
            }
            console.log(`      ${field}: ${value}`);
          }
        });
      });
      
      if (count > 5) {
        console.log(`\n  ... 还有 ${count - 5} 条记录`);
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error(`❌ 搜索 ${dbName} 时出错:`, error.message);
    try {
      await mongoose.disconnect();
    } catch (e) {}
  }
}

console.log('🚀 开始彻底搜索所有数据库...\n');
searchAllDatabases().then(() => {
  console.log('\n' + '='.repeat(80));
  console.log('✅ 搜索完成！');
  process.exit(0);
});

