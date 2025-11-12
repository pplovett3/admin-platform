/**
 * 创建上海信息技术学校
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://192.168.0.239:27017/admin_platform';

const SchoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
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

    console.log('📝 创建学校：上海信息技术学校');
    
    const school = await School.create({
      name: '上海信息技术学校',
      code: 'SHITC',
      address: '上海市',
      contact: '',
      enabled: true
    });
    
    console.log('✅ 学校创建成功！');
    console.log(`   ID: ${school._id}`);
    console.log(`   名称: ${school.name}`);
    console.log(`   代码: ${school.code}`);

  } catch (error) {
    if (error.code === 11000) {
      console.log('ℹ️  学校已存在，无需重复创建');
    } else {
      console.error('❌ 错误:', error.message);
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main();

