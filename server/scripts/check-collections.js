/**
 * 检查指定数据库中的所有集合
 */

const mongoose = require('mongoose');

async function checkDatabase(dbName) {
  const MONGODB_URI = `mongodb://192.168.0.239:27017/${dbName}`;
  
  try {
    console.log(`\n🔌 检查数据库: ${dbName}`);
    console.log('─'.repeat(80));
    
    await mongoose.connect(MONGODB_URI);
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    
    console.log(`📊 集合数量: ${collections.length}\n`);
    
    if (collections.length === 0) {
      console.log('   (数据库为空)');
    } else {
      for (const coll of collections) {
        const count = await mongoose.connection.db.collection(coll.name).countDocuments();
        console.log(`📦 ${coll.name}`);
        console.log(`   文档数量: ${count}`);
        
        // 显示前2条数据示例
        if (count > 0) {
          const samples = await mongoose.connection.db.collection(coll.name)
            .find({})
            .limit(2)
            .toArray();
          
          console.log(`   示例数据:`);
          samples.forEach((doc, idx) => {
            const keys = Object.keys(doc).filter(k => !k.startsWith('_') && k !== '__v');
            const preview = keys.slice(0, 3).map(k => `${k}: ${JSON.stringify(doc[k]).substring(0, 30)}`).join(', ');
            console.log(`   ${idx + 1}) ${preview}...`);
          });
        }
        console.log('');
      }
    }
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error(`❌ 检查数据库 ${dbName} 时出错:`, error.message);
    await mongoose.disconnect();
  }
}

async function main() {
  console.log('🔍 检查所有数据库的集合...\n');
  
  await checkDatabase('admin_platform');
  await checkDatabase('reservation_system');
  
  console.log('\n✅ 检查完成！');
}

main();

