/**
 * 生成测试数据脚本
 * - 5个学校
 * - 每个学校5个班级
 * - 每个班级5个学生
 * - 5门课程
 */

const mongoose = require('mongoose');

// MongoDB 连接
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/admin_platform';

// 学校模型
const SchoolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  address: { type: String },
  contact: { type: String },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

const School = mongoose.model('School', SchoolSchema);

// 班级模型
const ClassSchema = new mongoose.Schema({
  name: { type: String, required: true },
  headTeacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
}, { timestamps: true });

const Class = mongoose.model('Class', ClassSchema);

// 用户模型
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  school: { type: String },
  schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
  className: { type: String, default: '' },
  studentId: { type: String },
  phone: { type: String },
  role: { type: String, enum: ['superadmin', 'schoolAdmin', 'teacher', 'student'], required: true },
  passwordHash: { type: String, required: true },
  metaverseAllowed: { type: Boolean, default: false },
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

// 课程模型
const CourseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  type: { type: String, enum: ['simple', 'modular'], required: true },
  description: { type: String },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

const Course = mongoose.model('Course', CourseSchema);

// 生成密码哈希 (bcrypt, 默认密码: 123456)
// 预先生成的密码哈希 (密码: 123456)
const defaultPasswordHash = '$2a$10$Rq0hYZj5P9qN.ZxJGQJ.6OeVpK8DZkKQGmQqVp7ZqKzFHK8fQ7Z0u';

// 学校名称
const schoolNames = [
  '实验小学',
  '第一中学',
  '育才学校',
  '希望中学',
  '明德小学'
];

// 课程数据
const courses = [
  { name: '数学基础', code: 'MATH101', type: 'simple', description: '基础数学课程' },
  { name: '语文阅读', code: 'CHIN101', type: 'simple', description: '语文阅读理解' },
  { name: '英语口语', code: 'ENG101', type: 'modular', description: '英语口语交流' },
  { name: '科学探索', code: 'SCI101', type: 'modular', description: '科学实验课程' },
  { name: '编程入门', code: 'CODE101', type: 'modular', description: 'Python编程基础' }
];

// 姓氏和名字库
const surnames = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '罗', '高'];
const givenNames = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋', '勇', '艳', '杰', '涛', '明', '超', '秀英', '华', '鹏', '玲', '浩', '婷', '宇', '飞', '鑫'];

function randomName() {
  const surname = surnames[Math.floor(Math.random() * surnames.length)];
  const givenName = givenNames[Math.floor(Math.random() * givenNames.length)];
  return surname + givenName;
}

function generatePhone() {
  const prefix = '138';
  const suffix = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return prefix + suffix;
}

async function generateTestData() {
  try {
    console.log('📦 连接到 MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB 连接成功\n');

    // 清空相关集合（可选）
    console.log('🧹 清理现有测试数据...');
    await Course.deleteMany({});
    await User.deleteMany({ role: 'student' });
    await Class.deleteMany({});
    await School.deleteMany({});
    console.log('✅ 清理完成\n');

    // 1. 创建5个学校
    console.log('🏫 创建学校...');
    const schools = [];
    for (let i = 0; i < 5; i++) {
      const school = await School.create({
        name: schoolNames[i],
        code: `SCHOOL${String(i + 1).padStart(3, '0')}`,
        address: `测试市第${i + 1}区学府路${100 + i * 10}号`,
        contact: generatePhone(),
        enabled: true
      });
      schools.push(school);
      console.log(`  ✓ ${school.name} (${school.code})`);
    }
    console.log(`✅ 创建了 ${schools.length} 个学校\n`);

    // 2. 为每个学校创建5个班级，每个班级5个学生
    console.log('📚 创建班级和学生...');
    let totalClasses = 0;
    let totalStudents = 0;

    for (const school of schools) {
      console.log(`\n  学校: ${school.name}`);
      
      for (let classIndex = 0; classIndex < 5; classIndex++) {
        const grade = Math.floor(classIndex / 2) + 1; // 年级1-3
        const classNum = (classIndex % 2) + 1; // 班级号1-2
        const className = `${grade}年级${classNum}班`;
        
        // 创建班级
        const classObj = await Class.create({
          name: className,
          schoolId: school._id
        });
        totalClasses++;
        console.log(`    ✓ ${className}`);

        // 为班级创建5个学生
        for (let studentIndex = 0; studentIndex < 5; studentIndex++) {
          const studentNumber = String(classIndex * 5 + studentIndex + 1).padStart(2, '0');
          const studentId = `${school.code.slice(-3)}${String(grade)}${String(classNum)}${studentNumber}`;
          
          const student = await User.create({
            name: randomName(),
            school: school.name,
            schoolId: school._id,
            className: className,
            studentId: studentId,
            phone: generatePhone(),
            role: 'student',
            passwordHash: defaultPasswordHash,
            metaverseAllowed: Math.random() > 0.5 // 随机允许元宇宙访问
          });
          totalStudents++;
        }
        console.log(`      → 添加了5名学生`);
      }
    }
    console.log(`\n✅ 创建了 ${totalClasses} 个班级和 ${totalStudents} 名学生\n`);

    // 3. 创建5门课程
    console.log('📖 创建课程...');
    const createdCourses = [];
    for (const courseData of courses) {
      const course = await Course.create(courseData);
      createdCourses.push(course);
      console.log(`  ✓ ${course.name} (${course.code}) - ${course.type}`);
    }
    console.log(`✅ 创建了 ${createdCourses.length} 门课程\n`);

    // 统计信息
    console.log('📊 数据统计:');
    console.log(`  学校: ${schools.length}`);
    console.log(`  班级: ${totalClasses}`);
    console.log(`  学生: ${totalStudents}`);
    console.log(`  课程: ${createdCourses.length}`);
    console.log('\n🎉 测试数据生成完成！');
    console.log('\n💡 学生默认密码: 123456');

  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 断开 MongoDB 连接');
  }
}

// 运行脚本
generateTestData();

