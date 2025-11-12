/**
 * 测试后端实际使用的数据库连接
 */

const mongoose = require('mongoose');

// 从环境变量读取 MongoDB URI（和后端一样）
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://192.168.0.239:27017/courseware';

console.log('📡 测试后端数据库连接...\n');
console.log('='.repeat(80));
console.log(`MongoDB URI: ${MONGODB_URI}`);
console.log('='.repeat(80));

async function testConnection() {
  try {
    await mongoose.connect(MONGODB_URI);
    
    const dbName = mongoose.connection.db.databaseName;
    console.log(`\n✅ 连接成功！`);
    console.log(`📦 数据库名称: ${dbName}\n`);
    
    // 列出所有集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`集合数量: ${collections.length}`);
    
    if (collections.length === 0) {
      console.log('\n❌ 数据库为空！');
    } else {
      console.log('\n集合列表:');
      for (const coll of collections) {
        const collection = mongoose.connection.db.collection(coll.name);
        const count = await collection.countDocuments();
        console.log(`  - ${coll.name} (${count} 条记录)`);
        
        // 如果是课程相关的集合，显示第一条记录
        if (['aicourses', 'publishedcourses', 'coursewares'].includes(coll.name)) {
          const doc = await collection.findOne({});
          if (doc) {
            console.log(`    示例: ${doc.title || doc.name || doc._id}`);
          }
        }
      }
    }
    
    // 尝试查询 AI 课程
    console.log('\n' + '-'.repeat(80));
    console.log('🔍 查询 AI 课程集合...');
    console.log('-'.repeat(80));
    
    const aiCourseCollection = mongoose.connection.db.collection('aicourses');
    const aiCourses = await aiCourseCollection.find({}).limit(5).toArray();
    
    console.log(`\n找到 ${aiCourses.length} 门 AI 课程:`);
    aiCourses.forEach((course, idx) => {
      console.log(`\n  ${idx + 1}. ${course.title || '(无标题)'}`);
      console.log(`     ID: ${course._id}`);
      console.log(`     状态: ${course.status || 'N/A'}`);
      if (course.createdAt) {
        console.log(`     创建时间: ${course.createdAt}`);
      }
    });
    
    if (aiCourses.length === 0) {
      console.log('  (空集合)');
    }
    
    await mongoose.disconnect();
    console.log('\n' + '='.repeat(80));
    console.log('✅ 测试完成');
    
  } catch (error) {
    console.error('\n❌ 连接失败:', error.message);
    console.error('\n详细错误:', error);
    process.exit(1);
  }
}

testConnection();

