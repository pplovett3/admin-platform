/**
 * 向 courseware 数据库批量导入学生和成绩
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = 'mongodb://192.168.0.239:27018/courseware';

// 学生姓名列表
const studentNames = [
  '张伟', '王芳', '李娜', '刘洋', '陈静',
  '杨帆', '赵敏', '孙涛', '周磊', '吴霞',
  '郑强', '王丽', '李明', '刘芳', '陈涛',
  '张敏', '王强', '李霞', '刘静', '陈伟'
];

// 学校和班级 ID（从前面查询结果）
const schoolId = '6908609f0c50b1a41581be5e'; // 上海信息技术学校
const classId = '690861130c50b1a41581be74';   // 机械202501班

// 课程模块 IDs
const moduleIds = [
  '69085f2c0c50b1a41581be46', // 产线认知
  '690860580c50b1a41581be4a', // 机器人本体与导轨安装
  '690860630c50b1a41581be4e', // 机器人电气安装模块
  '690860740c50b1a41581be52', // 各单元电气安装模块
  '6908607f0c50b1a41581be56'  // 故障模拟与诊断模块
];

// 课程 ID
const courseId = '69085f180c50b1a41581be41';

async function main() {
  console.log('🚀 开始导入学生和成绩数据...\n');
  console.log('='.repeat(80));
  console.log(`目标数据库: ${MONGODB_URI}`);
  console.log(`学校ID: ${schoolId}`);
  console.log(`班级ID: ${classId}`);
  console.log(`学生数量: ${studentNames.length}`);
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('\n✅ 数据库连接成功\n');
    
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const scoresCollection = db.collection('scores');
    
    // 清理之前导入的数据
    console.log('🧹 清理之前导入的测试数据...\n');
    const deleteUsersResult = await usersCollection.deleteMany({
      username: { $regex: /^student_\d{3}$/ }
    });
    console.log(`  删除了 ${deleteUsersResult.deletedCount} 个之前的学生账号`);
    
    const deleteScoresResult = await scoresCollection.deleteMany({});
    console.log(`  删除了 ${deleteScoresResult.deletedCount} 条之前的成绩记录\n`);
    
    // 生成密码哈希（默认密码：123456）
    const passwordHash = await bcrypt.hash('123456', 10);
    console.log('🔐 密码哈希生成成功 (默认密码: 123456)\n');
    
    // 批量创建学生
    console.log('📝 开始创建学生账号...\n');
    const students = [];
    
    for (let i = 0; i < studentNames.length; i++) {
      const name = studentNames[i];
      const username = `student_${String(i + 1).padStart(3, '0')}`; // student_001, student_002...
      const studentNo = `2025${String(i + 1).padStart(4, '0')}`; // 20250001, 20250002...
      
      const student = {
        username,
        password: passwordHash,
        name,
        studentNo,
        role: 'student',
        schoolId: new mongoose.Types.ObjectId(schoolId),
        classId: new mongoose.Types.ObjectId(classId),
        className: '机械202501班', // 前端显示用
        status: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      students.push(student);
      console.log(`  ${i + 1}. ${name} (${username}, 学号: ${studentNo})`);
    }
    
    // 插入学生数据
    const insertResult = await usersCollection.insertMany(students);
    console.log(`\n✅ 成功创建 ${insertResult.insertedCount} 个学生账号\n`);
    
    // 获取插入的学生 IDs
    const studentIds = Object.values(insertResult.insertedIds);
    
    // 为每个学生生成成绩（使用正确的Score模型结构）
    console.log('='.repeat(80));
    console.log('📊 开始生成成绩数据...\n');
    
    const moduleIdStrings = ['001', '002', '003', '004', '005'];
    const scores = [];
    
    for (const studentId of studentIds) {
      // 为每个学生生成5个模块的成绩，存储在一条记录的moduleScores数组中
      const moduleScores = moduleIds.map((moduleObjId, idx) => {
        const score = Math.floor(Math.random() * 41) + 60; // 60-100分
        return {
          moduleId: moduleIdStrings[idx],  // 使用字符串 '001', '002'等
          score: score,
          maxScore: 100,
          attempts: 1,
          completedAt: new Date()
        };
      });
      
      const scoreRecord = {
        user: studentId,            // 字段名是 user
        courseId: courseId,         // 字符串格式的courseId
        moduleScores: moduleScores, // 所有模块成绩在一个数组中
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      scores.push(scoreRecord);
    }
    
    // 批量插入成绩
    const scoresResult = await scoresCollection.insertMany(scores);
    console.log(`✅ 成功创建 ${scoresResult.insertedCount} 条成绩记录`);
    console.log(`   (${studentIds.length} 个学生，每人5个模块成绩)\n`);
    
    // 显示统计信息
    console.log('='.repeat(80));
    console.log('📈 数据统计');
    console.log('='.repeat(80));
    
    const totalUsers = await usersCollection.countDocuments();
    const totalStudents = await usersCollection.countDocuments({ role: 'student' });
    const totalScores = await scoresCollection.countDocuments();
    
    console.log(`\n总用户数: ${totalUsers}`);
    console.log(`学生数: ${totalStudents}`);
    console.log(`成绩记录数: ${totalScores}`);
    
    // 显示示例数据
    console.log('\n' + '='.repeat(80));
    console.log('📋 示例数据');
    console.log('='.repeat(80));
    
    const sampleStudent = students[0];
    console.log(`\n学生示例: ${sampleStudent.name}`);
    console.log(`  用户名: ${sampleStudent.username}`);
    console.log(`  学号: ${sampleStudent.studentNo}`);
    console.log(`  密码: 123456`);
    
    const sampleScoreDoc = await scoresCollection.findOne({
      user: studentIds[0]
    });
    
    console.log(`\n${sampleStudent.name} 的成绩:`);
    if (sampleScoreDoc && sampleScoreDoc.moduleScores) {
      for (const moduleScore of sampleScoreDoc.moduleScores) {
        console.log(`  模块 ${moduleScore.moduleId}: ${moduleScore.score}/${moduleScore.maxScore} 分`);
      }
    }
    
    await mongoose.disconnect();
    
    console.log('\n' + '='.repeat(80));
    console.log('🎉 导入完成！');
    console.log('='.repeat(80));
    console.log('\n默认登录信息:');
    console.log('  用户名: student_001 ~ student_020');
    console.log('  密码: 123456');
    console.log('  学号: 20250001 ~ 20250020\n');
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error(error);
    process.exit(1);
  }
}

main();


