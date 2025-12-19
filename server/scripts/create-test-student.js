// 创建测试学生账户
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_platform';

async function createTestStudent() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const UserSchema = new mongoose.Schema({
      name: String,
      phone: String,
      school: String,
      schoolId: mongoose.Schema.Types.ObjectId,
      className: String,
      studentId: String,
      role: String,
      passwordHash: String,
      metaverseAllowed: Boolean,
      quizRecords: Array,
    }, { timestamps: true });

    const User = mongoose.models.User || mongoose.model('User', UserSchema);

    // 检查是否已存在
    const existing = await User.findOne({ phone: '13800000001' });
    if (existing) {
      console.log('测试学生账户已存在:');
      console.log('  手机号: 13800000001');
      console.log('  密码: student123');
      await mongoose.disconnect();
      return;
    }

    // 创建密码哈希
    const passwordHash = await bcrypt.hash('student123', 10);

    // 创建学生账户
    const student = await User.create({
      name: '测试学生',
      phone: '13800000001',
      school: 'Default',
      className: '测试班级',
      studentId: 'STU001',
      role: 'student',
      passwordHash,
      metaverseAllowed: false,
      quizRecords: [],
    });

    console.log('测试学生账户创建成功:');
    console.log('  姓名:', student.name);
    console.log('  手机号: 13800000001');
    console.log('  密码: student123');
    console.log('  角色:', student.role);

    await mongoose.disconnect();
  } catch (error) {
    console.error('创建失败:', error);
    process.exit(1);
  }
}

createTestStudent();

