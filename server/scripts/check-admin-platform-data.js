/**
 * 检查 admin_platform 数据库中的完整数据
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

const ClassSchema = new mongoose.Schema({
  name: { type: String, required: true },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  grade: { type: String },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  school: { type: String },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  className: { type: String },
  studentId: { type: String },
  phone: { type: String },
  role: { type: String },
  passwordHash: { type: String },
  metaverseAllowed: { type: Boolean },
}, { timestamps: true });

const School = mongoose.model('School', SchoolSchema);
const Class = mongoose.model('Class', ClassSchema);
const User = mongoose.model('User', UserSchema);

async function main() {
  try {
    console.log('🔌 连接数据库: admin_platform');
    console.log(`   URI: ${MONGODB_URI}\n`);
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 连接成功\n');

    // 列出所有集合
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📦 数据库中的集合 (${collections.length}个):`);
    console.log('─'.repeat(80));
    collections.forEach((coll, index) => {
      console.log(`${index + 1}. ${coll.name}`);
    });
    console.log('─'.repeat(80));
    console.log('');

    // 检查学校
    const schools = await School.find({}).lean();
    console.log(`🏫 学校数量: ${schools.length}`);
    if (schools.length > 0) {
      console.log('─'.repeat(80));
      schools.forEach((school, index) => {
        console.log(`${index + 1}. ${school.name}`);
        console.log(`   ID: ${school._id}`);
        console.log(`   代码: ${school.code || '无'}`);
        console.log(`   启用: ${school.enabled ? '是' : '否'}`);
        console.log('');
      });
      console.log('─'.repeat(80));
    }
    console.log('');

    // 检查班级
    const classes = await Class.find({}).lean();
    console.log(`📚 班级数量: ${classes.length}`);
    if (classes.length > 0) {
      console.log('─'.repeat(80));
      for (const cls of classes) {
        const school = await School.findById(cls.schoolId);
        console.log(`班级: ${cls.name}`);
        console.log(`   ID: ${cls._id}`);
        console.log(`   学校ID: ${cls.schoolId}`);
        console.log(`   学校: ${school ? school.name : '未找到'}`);
        console.log(`   年级: ${cls.grade || '无'}`);
        console.log(`   启用: ${cls.enabled ? '是' : '否'}`);
        console.log('');
      }
      console.log('─'.repeat(80));
    }
    console.log('');

    // 检查所有用户（按角色分组）
    const allUsers = await User.find({}).lean();
    console.log(`👥 用户总数: ${allUsers.length}`);
    
    const usersByRole = {
      superadmin: [],
      schoolAdmin: [],
      teacher: [],
      student: []
    };
    
    allUsers.forEach(user => {
      if (usersByRole[user.role]) {
        usersByRole[user.role].push(user);
      }
    });
    
    console.log('─'.repeat(80));
    console.log(`超级管理员: ${usersByRole.superadmin.length}个`);
    console.log(`学校管理员: ${usersByRole.schoolAdmin.length}个`);
    console.log(`教师: ${usersByRole.teacher.length}个`);
    console.log(`学生: ${usersByRole.student.length}个`);
    console.log('─'.repeat(80));
    console.log('');

    // 详细显示学生信息
    if (usersByRole.student.length > 0) {
      console.log(`👨‍🎓 学生详细信息:`);
      console.log('─'.repeat(80));
      
      // 按班级分组
      const studentsByClass = {};
      usersByRole.student.forEach(student => {
        const className = student.className || '未分配班级';
        if (!studentsByClass[className]) {
          studentsByClass[className] = [];
        }
        studentsByClass[className].push(student);
      });
      
      Object.keys(studentsByClass).forEach(className => {
        const students = studentsByClass[className];
        console.log(`\n班级: ${className} (${students.length}人)`);
        students.slice(0, 5).forEach((student, idx) => {
          console.log(`  ${idx + 1}. ${student.name} - 学号:${student.studentId || '无'} - 手机:${student.phone || '无'}`);
        });
        if (students.length > 5) {
          console.log(`  ... 还有 ${students.length - 5} 个学生`);
        }
      });
      console.log('');
      console.log('─'.repeat(80));
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main();

