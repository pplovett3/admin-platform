/**
 * 检查 reservation_system 数据库中的学校和班级数据
 */

const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://192.168.0.239:27017/reservation_system';

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
    console.log('🔌 连接数据库: reservation_system');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ 连接成功\n');

    // 检查学校
    const schools = await School.find({}).lean();
    console.log(`📊 学校数量: ${schools.length}`);
    if (schools.length > 0) {
      console.log('─'.repeat(80));
      schools.forEach((school, index) => {
        console.log(`${index + 1}. ${school.name}`);
        console.log(`   ID: ${school._id}`);
        console.log(`   代码: ${school.code || '无'}`);
        console.log('');
      });
      console.log('─'.repeat(80));
    }
    console.log('');

    // 检查班级
    const classes = await Class.find({}).lean();
    console.log(`📊 班级数量: ${classes.length}`);
    if (classes.length > 0) {
      console.log('─'.repeat(80));
      for (const cls of classes) {
        const school = await School.findById(cls.schoolId);
        console.log(`班级: ${cls.name}`);
        console.log(`   ID: ${cls._id}`);
        console.log(`   学校: ${school ? school.name : '未关联'}`);
        console.log('');
      }
      console.log('─'.repeat(80));
    }
    console.log('');

    // 检查学生
    const students = await User.find({ role: 'student' }).lean();
    console.log(`📊 学生数量: ${students.length}`);
    if (students.length > 0) {
      console.log('─'.repeat(80));
      console.log(`前5个学生示例：`);
      students.slice(0, 5).forEach((student) => {
        console.log(`- ${student.name} (${student.studentId || '无学号'}) - ${student.className || '无班级'}`);
      });
      console.log('─'.repeat(80));
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 数据库连接已关闭');
  }
}

main();

