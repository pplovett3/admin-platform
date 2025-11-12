/**
 * 检查 courseware 数据库
 */

const mongoose = require('mongoose');

async function checkDatabase() {
  const uri = 'mongodb://192.168.0.239:27017/courseware';
  
  console.log('🔍 连接到 courseware 数据库...\n');
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(uri);
    
    // 获取所有集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log(`\n📦 数据库: courseware`);
    console.log(`集合数量: ${collections.length}\n`);
    
    if (collections.length === 0) {
      console.log('❌ 数据库为空！没有任何集合。');
      await mongoose.disconnect();
      return;
    }
    
    console.log('集合列表:');
    collections.forEach(c => console.log(`  - ${c.name}`));
    
    // 检查每个集合
    for (const collInfo of collections) {
      const collName = collInfo.name;
      const collection = mongoose.connection.db.collection(collName);
      const count = await collection.countDocuments();
      
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📋 集合: ${collName} (${count} 条记录)`);
      console.log('─'.repeat(80));
      
      if (count === 0) {
        console.log('  (空集合)');
        continue;
      }
      
      // 显示前3条记录
      const docs = await collection.find({}).limit(3).toArray();
      
      docs.forEach((doc, idx) => {
        console.log(`\n  [${idx + 1}] ID: ${doc._id}`);
        
        // 显示所有字段
        const importantFields = ['title', 'name', 'courseTitle', 'description', 
                                 'status', 'type', 'originalCourseId', 'courseId',
                                 'coursewareId', 'publishId', 'createdAt', 'updatedAt'];
        
        importantFields.forEach(field => {
          if (doc[field] !== undefined) {
            let value = doc[field];
            if (typeof value === 'string' && value.length > 80) {
              value = value.substring(0, 80) + '...';
            } else if (typeof value === 'object' && !(value instanceof Date)) {
              value = JSON.stringify(value).substring(0, 80) + '...';
            }
            console.log(`      ${field}: ${value}`);
          }
        });
      });
      
      if (count > 3) {
        console.log(`\n  ... 还有 ${count - 3} 条记录`);
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error(`\n❌ 错误: ${error.message}`);
    try {
      await mongoose.disconnect();
    } catch (e) {}
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 检查完成！\n');
}

checkDatabase();

