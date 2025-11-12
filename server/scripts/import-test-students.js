/**
 * 批量导入测试学生数据
 * 使用方法: node scripts/import-test-students.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

// MongoDB连接配置
const MONGODB_URI = 'mongodb://192.168.0.239:27017/admin_platform';

// 学生数据配置
const SCHOOL_NAME = '上海信息技术学校';
const CLASS_NAME = '机械202501班';
const DEFAULT_PASSWORD = '123456'; // 默认密码

// 学生姓名列表（中国常见姓名）
const STUDENT_NAMES = [
  '张伟', '王芳', '李娜', '刘洋', '陈静',
  '杨军', '赵敏', '黄磊', '周涛', '吴强',
  '徐丽', '孙鹏', '马超', '朱婷', '胡斌',
  '郭亮', '林华', '何敏', '高阳', '罗峰'
];

// 定义User Schema
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    school: { type: String },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    className: { type: String, required: false, default: '' },
    studentId: { type: String },
    phone: { type: String },
    role: { type: String, enum: ['superadmin', 'schoolAdmin', 'teacher', 'student'], required: true },
    passwordHash: { type: String, required: true },
    metaverseAllowed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const SchoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    address: { type: String },
    contact: { type: String },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const User = mongoose.model('User', UserSchema);
const School = mongoose.model('School', SchoolSchema);

// 生成学号（格式：202501001-202501020）
function generateStudentId(index) {
  return `202501${String(index + 1).padStart(3, '0')}`;
}

// 生成手机号（测试用）
function generatePhone(index) {
  return `138${String(index + 1).padStart(8, '0')}`;
}

async function main() {
  try {
    console.log('🔌 正在连接MongoDB数据库...');
    console.log(`   地址: ${MONGODB_URI}`);
    
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 数据库连接成功！\n');

    // 1. 查找学校
    console.log(`🔍 查找学校: ${SCHOOL_NAME}`);
    const school = await School.findOne({ name: SCHOOL_NAME });
    
    if (!school) {
      console.error(`❌ 错误：未找到学校 "${SCHOOL_NAME}"`);
      console.log('   请先创建学校！');
      process.exit(1);
    }
    
    console.log(`✅ 找到学校: ${school.name} (ID: ${school._id})\n`);

    // 2. 生成密码哈希
    console.log(`🔐 生成密码哈希 (默认密码: ${DEFAULT_PASSWORD})...`);
    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    console.log('✅ 密码哈希生成完成\n');

    // 3. 检查是否已存在学生
    console.log(`🔍 检查班级 "${CLASS_NAME}" 中是否已有学生...`);
    const existingCount = await User.countDocuments({
      schoolId: school._id,
      className: CLASS_NAME,
      role: 'student'
    });
    
    if (existingCount > 0) {
      console.log(`⚠️  警告：班级中已有 ${existingCount} 个学生`);
      console.log('   继续执行将添加新学生（不会删除现有学生）\n');
    } else {
      console.log('✅ 班级中暂无学生\n');
    }

    // 4. 生成学生数据
    console.log('📝 生成20个测试学生数据...');
    const students = STUDENT_NAMES.map((name, index) => ({
      name: name,
      school: SCHOOL_NAME,
      schoolId: school._id,
      className: CLASS_NAME,
      studentId: generateStudentId(index),
      phone: generatePhone(index),
      role: 'student',
      passwordHash: passwordHash,
      metaverseAllowed: true, // 允许访问虚拟仿真
    }));

    console.log(`✅ 学生数据生成完成（共 ${students.length} 个）\n`);

    // 5. 批量插入数据库
    console.log('💾 批量插入学生数据到数据库...');
    const result = await User.insertMany(students);
    console.log(`✅ 成功插入 ${result.length} 个学生！\n`);

    // 6. 显示插入的学生信息
    console.log('📊 插入的学生列表：');
    console.log('─'.repeat(80));
    console.log('姓名\t\t学号\t\t手机号\t\t\t班级');
    console.log('─'.repeat(80));
    
    result.forEach((student, index) => {
      console.log(
        `${student.name}\t\t${student.studentId}\t${student.phone}\t${student.className}`
      );
    });
    
    console.log('─'.repeat(80));
    console.log(`\n✅ 总计: ${result.length} 个学生`);
    console.log(`📍 学校: ${SCHOOL_NAME}`);
    console.log(`📍 班级: ${CLASS_NAME}`);
    console.log(`🔑 默认密码: ${DEFAULT_PASSWORD}\n`);

    // 7. 统计信息
    const totalStudents = await User.countDocuments({
      schoolId: school._id,
      className: CLASS_NAME,
      role: 'student'
    });
    
    console.log('📈 统计信息：');
    console.log(`   本次新增: ${result.length} 个学生`);
    console.log(`   班级总人数: ${totalStudents} 个学生\n`);

    console.log('🎉 数据导入完成！');

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.code === 11000) {
      console.error('   提示: 手机号或学号重复，请检查数据');
    }
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行脚本
main();

