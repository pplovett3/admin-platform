/**
 * 检查数据库中的课程数据
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://192.168.0.239:27017/admin_platform';

async function main() {
  try {
    console.log('🔌 连接数据库...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 连接成功\n');

    // 列出所有集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    console.log('📦 检查课程相关的集合：');
    console.log('─'.repeat(80));
    
    // 检查可能的课程相关集合
    const courseCollections = collectionNames.filter(name => 
      name.toLowerCase().includes('course') || 
      name.toLowerCase().includes('score') ||
      name.toLowerCase().includes('enrollment')
    );
    
    if (courseCollections.length === 0) {
      console.log('   ❌ 未找到课程相关的集合');
    } else {
      courseCollections.forEach(name => {
        console.log(`   ✅ ${name}`);
      });
    }
    console.log('─'.repeat(80));
    console.log('');
    
    // 尝试查询各种课程集合
    const collectionChecks = [
      'courses',
      'aicourses', 
      'publishedcourses',
      'coursewares',
      'scores',
      'scoresubmissions',
      'enrollments'
    ];
    
    for (const collName of collectionChecks) {
      try {
        const count = await mongoose.connection.db.collection(collName).countDocuments();
        if (count > 0) {
          console.log(`📊 ${collName}: ${count} 条记录`);
          
          // 显示前3条记录
          const docs = await mongoose.connection.db.collection(collName).find({}).limit(3).toArray();
          docs.forEach((doc, idx) => {
            console.log(`   ${idx + 1}. ${doc.name || doc.title || doc._id}`);
            if (doc.courseId) console.log(`      课程ID: ${doc.courseId}`);
          });
          console.log('');
        }
      } catch (e) {
        // 集合不存在，跳过
      }
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 数据库连接已关闭');
  }
}

main();

