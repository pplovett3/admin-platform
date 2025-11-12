/**
 * 查找小米SU7课程数据
 */

const mongoose = require('mongoose');

const databases = [
  'admin_platform',
  'reservation_system'
];

async function searchInDatabase(dbName) {
  const uri = `mongodb://192.168.0.239:27017/${dbName}`;
  
  console.log(`\n🔍 搜索数据库: ${dbName}`);
  console.log('─'.repeat(80));
  
  try {
    await mongoose.connect(uri);
    
    // 获取所有集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    let foundAny = false;
    
    // 在每个集合中搜索包含"SU7"或"小米"的文档
    for (const collName of collectionNames) {
      try {
        const collection = mongoose.connection.db.collection(collName);
        
        // 搜索包含SU7或小米的文档
        const docs = await collection.find({
          $or: [
            { title: /SU7|小米/i },
            { name: /SU7|小米/i },
            { description: /SU7|小米/i }
          ]
        }).limit(10).toArray();
        
        if (docs.length > 0) {
          foundAny = true;
          console.log(`\n✅ 集合: ${collName} (找到 ${docs.length} 条记录)`);
          docs.forEach((doc, idx) => {
            console.log(`\n  ${idx + 1}. ID: ${doc._id}`);
            if (doc.title) console.log(`     标题: ${doc.title}`);
            if (doc.name) console.log(`     名称: ${doc.name}`);
            if (doc.description) console.log(`     描述: ${doc.description?.substring(0, 50)}...`);
            if (doc.publishId) console.log(`     发布ID: ${doc.publishId}`);
            if (doc.courseId) console.log(`     课程ID: ${doc.courseId}`);
            if (doc.coursewareId) console.log(`     课件ID: ${doc.coursewareId}`);
          });
        }
      } catch (e) {
        // 跳过搜索错误
      }
    }
    
    // 尝试通过publishId直接查找
    console.log('\n🔍 尝试查找 publishId: 6904275baa0c1d733e9cc722');
    for (const collName of collectionNames) {
      try {
        const collection = mongoose.connection.db.collection(collName);
        const doc = await collection.findOne({ 
          _id: new mongoose.Types.ObjectId('6904275baa0c1d733e9cc722') 
        });
        
        if (doc) {
          foundAny = true;
          console.log(`\n✅ 在集合 ${collName} 中找到！`);
          console.log(JSON.stringify(doc, null, 2).substring(0, 500));
        }
      } catch (e) {
        // 跳过
      }
    }
    
    if (!foundAny) {
      console.log('\n❌ 未找到相关课程数据');
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error(`❌ 错误: ${error.message}`);
    await mongoose.disconnect();
  }
}

async function main() {
  console.log('🔍 开始搜索小米SU7课程...\n');
  
  for (const dbName of databases) {
    await searchInDatabase(dbName);
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 搜索完成');
}

main();

