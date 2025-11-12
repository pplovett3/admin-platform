/**
 * 列出数据库中所有的学校
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://192.168.0.239:27017/admin_platform';

const SchoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  address: { type: String },
  contact: { type: String },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

const School = mongoose.model('School', SchoolSchema);

async function main() {
  try {
    console.log('🔌 连接数据库...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 连接成功\n');

    const schools = await School.find({}).lean();
    
    console.log(`📊 数据库中共有 ${schools.length} 个学校：`);
    console.log('─'.repeat(80));
    
    if (schools.length === 0) {
      console.log('   (暂无学校数据)');
    } else {
      schools.forEach((school, index) => {
        console.log(`${index + 1}. ${school.name}`);
        console.log(`   ID: ${school._id}`);
        console.log(`   代码: ${school.code}`);
        console.log(`   启用: ${school.enabled ? '是' : '否'}`);
        if (school.address) console.log(`   地址: ${school.address}`);
        console.log('');
      });
    }
    
    console.log('─'.repeat(80));

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main();

