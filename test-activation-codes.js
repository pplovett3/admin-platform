// 激活码系统自动化测试脚本
const API_BASE = 'http://localhost:4000';
let token = '';
let courseId = '';
let generatedCodes = [];
let testUserId = '';

// API请求函数
async function apiRequest(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    }
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${path}`, options);
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || `API错误: ${response.status}`);
  }
  
  return data;
}

// 测试步骤
async function test1_Login() {
  console.log('\n========== 测试1: 超管登录 ==========');
  try {
    const result = await apiRequest('POST', '/api/auth/login', {
      phone: '13800000000',
      password: 'admin123'
    });
    token = result.token;
    console.log('✅ 登录成功');
    console.log(`   - Token: ${token.substring(0, 20)}...`);
    console.log(`   - 用户: ${result.user.name} (${result.user.role})`);
    return true;
  } catch (error) {
    console.error('❌ 登录失败:', error.message);
    return false;
  }
}

async function test2_GetCourses() {
  console.log('\n========== 测试2: 获取课程列表 ==========');
  try {
    const courses = await apiRequest('GET', '/api/courses');
    console.log(`✅ 成功获取${courses.length}个课程`);
    
    if (courses.length > 0) {
      courseId = courses[0]._id;
      console.log(`   - 使用课程: ${courses[0].name} (${courseId})`);
    } else {
      // 创建测试课程
      const newCourse = await apiRequest('POST', '/api/courses', {
        name: '激活码测试课程',
        code: 'TEST-ACTIVATION',
        type: 'modular',
        description: '用于测试激活码功能的课程'
      });
      courseId = newCourse._id;
      console.log(`   - 创建测试课程: ${newCourse.name} (${courseId})`);
    }
    return true;
  } catch (error) {
    console.error('❌ 获取课程失败:', error.message);
    return false;
  }
}

async function test3_GenerateActivationCodes() {
  console.log('\n========== 测试3: 生成激活码 ==========');
  try {
    const result = await apiRequest('POST', '/api/activation-codes', {
      courseId,
      count: 5,
      maxUses: 30,
      validFrom: new Date().toISOString(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      description: '自动化测试激活码'
    });
    
    generatedCodes = result.codes.map(c => c.code);
    console.log(`✅ 成功生成${result.count}个激活码`);
    console.log('   生成的激活码:');
    generatedCodes.forEach((code, index) => {
      console.log(`   ${index + 1}. ${code}`);
    });
    return true;
  } catch (error) {
    console.error('❌ 生成激活码失败:', error.message);
    return false;
  }
}

async function test4_ListActivationCodes() {
  console.log('\n========== 测试4: 查询激活码列表 ==========');
  try {
    const result = await apiRequest('GET', '/api/activation-codes');
    console.log(`✅ 成功获取激活码列表`);
    console.log(`   - 总数: ${result.pagination.total}`);
    console.log(`   - 当前页: ${result.pagination.page}`);
    console.log(`   - 显示数量: ${result.items.length}`);
    
    if (result.items.length > 0) {
      console.log('   前3个激活码:');
      result.items.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.code} - ${item.courseId.name} (${item.usedCount}/${item.maxUses})`);
      });
    }
    return true;
  } catch (error) {
    console.error('❌ 查询激活码列表失败:', error.message);
    return false;
  }
}

async function test5_GetActivationCodeDetail() {
  console.log('\n========== 测试5: 查看激活码详情 ==========');
  if (generatedCodes.length === 0) {
    console.log('⚠️  跳过测试（无激活码）');
    return true;
  }
  
  try {
    const code = generatedCodes[0];
    const detail = await apiRequest('GET', `/api/activation-codes/${code}`);
    console.log(`✅ 成功获取激活码详情`);
    console.log(`   - 激活码: ${detail.code}`);
    console.log(`   - 课程: ${detail.courseId.name}`);
    console.log(`   - 使用情况: ${detail.usedCount}/${detail.maxUses}`);
    console.log(`   - 状态: ${detail.status}`);
    console.log(`   - 已使用用户数: ${detail.activations.length}`);
    return true;
  } catch (error) {
    console.error('❌ 查看激活码详情失败:', error.message);
    return false;
  }
}

let testStudentPhone = '';

async function test6_CreateTestStudent() {
  console.log('\n========== 测试6: 创建测试学生 ==========');
  try {
    testStudentPhone = `1380000${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const result = await apiRequest('POST', '/api/users', {
      name: '测试学生001',
      phone: testStudentPhone,
      studentId: `TEST-${Date.now()}`,
      className: '测试班级',
      role: 'student',
      password: '123456'
    });
    testUserId = result._id;
    console.log(`✅ 成功创建测试学生`);
    console.log(`   - 姓名: ${result.name}`);
    console.log(`   - 手机: ${result.phone}`);
    console.log(`   - 学号: ${result.studentId}`);
    console.log(`   - 用户ID: ${testUserId}`);
    return true;
  } catch (error) {
    console.error('❌ 创建测试学生失败:', error.message);
    return false;
  }
}

async function test7_ActivateCourse() {
  console.log('\n========== 测试7: 学生激活课程 ==========');
  if (generatedCodes.length === 0 || !testUserId) {
    console.log('⚠️  跳过测试（无激活码或测试用户）');
    return true;
  }
  
  try {
    // 先用测试学生登录
    const loginResult = await apiRequest('POST', '/api/auth/login', {
      phone: testStudentPhone,
      password: '123456'
    });
    
    const studentToken = token;
    token = loginResult.token;
    
    // 激活课程
    const code = generatedCodes[0];
    const result = await apiRequest('POST', '/api/activation/activate', {
      code,
      courseId
    });
    
    console.log(`✅ 学生激活课程成功`);
    console.log(`   - 课程: ${result.activation.courseName}`);
    console.log(`   - 激活码: ${code}`);
    console.log(`   - 过期时间: ${new Date(result.activation.expiresAt).toLocaleDateString()}`);
    
    // 恢复超管token
    token = studentToken;
    return true;
  } catch (error) {
    console.error('❌ 学生激活课程失败:', error.message);
    return false;
  }
}

async function test8_VerifyCourseAccess() {
  console.log('\n========== 测试8: 验证课程访问权限 ==========');
  if (!testUserId) {
    console.log('⚠️  跳过测试（无测试用户）');
    return true;
  }
  
  try {
    const result = await apiRequest('GET', `/api/activation/verify?courseId=${courseId}`);
    console.log(`✅ 验证课程访问权限成功`);
    console.log(`   - 允许访问: ${result.allowed ? '是' : '否'}`);
    if (result.allowed) {
      console.log(`   - 课程ID: ${result.courseId}`);
      console.log(`   - 过期时间: ${new Date(result.expiresAt).toLocaleDateString()}`);
    } else {
      console.log(`   - 拒绝原因: ${result.reason}`);
    }
    return true;
  } catch (error) {
    console.error('❌ 验证课程访问权限失败:', error.message);
    return false;
  }
}

async function test9_ListActivations() {
  console.log('\n========== 测试9: 查看激活记录 ==========');
  try {
    const result = await apiRequest('GET', '/api/activation/list');
    console.log(`✅ 成功获取激活记录`);
    console.log(`   - 总记录数: ${result.pagination.total}`);
    console.log(`   - 当前显示: ${result.items.length}`);
    
    if (result.items.length > 0) {
      console.log('   最新激活记录:');
      result.items.slice(0, 3).forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.userName} - ${item.courseName} - ${item.status}`);
      });
    }
    return true;
  } catch (error) {
    console.error('❌ 查看激活记录失败:', error.message);
    return false;
  }
}

async function test10_UpdateActivationCodeStatus() {
  console.log('\n========== 测试10: 禁用/启用激活码 ==========');
  if (generatedCodes.length === 0) {
    console.log('⚠️  跳过测试（无激活码）');
    return true;
  }
  
  try {
    const code = generatedCodes[1] || generatedCodes[0];
    
    // 禁用
    await apiRequest('PATCH', `/api/activation-codes/${code}`, { status: 'disabled' });
    console.log(`✅ 成功禁用激活码: ${code}`);
    
    // 启用
    await apiRequest('PATCH', `/api/activation-codes/${code}`, { status: 'active' });
    console.log(`✅ 成功启用激活码: ${code}`);
    
    return true;
  } catch (error) {
    console.error('❌ 更新激活码状态失败:', error.message);
    return false;
  }
}

// 运行所有测试
async function runAllTests() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   激活码系统自动化测试                     ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`开始时间: ${new Date().toLocaleString()}`);
  
  const tests = [
    test1_Login,
    test2_GetCourses,
    test3_GenerateActivationCodes,
    test4_ListActivationCodes,
    test5_GetActivationCodeDetail,
    test6_CreateTestStudent,
    test7_ActivateCourse,
    test8_VerifyCourseAccess,
    test9_ListActivations,
    test10_UpdateActivationCodeStatus
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    const result = await test();
    if (result) {
      passed++;
    } else {
      failed++;
    }
    // 等待500ms
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║   测试完成                                 ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`通过: ${passed} / ${tests.length}`);
  console.log(`失败: ${failed} / ${tests.length}`);
  console.log(`成功率: ${((passed / tests.length) * 100).toFixed(1)}%`);
  console.log(`结束时间: ${new Date().toLocaleString()}`);
  
  if (failed === 0) {
    console.log('\n🎉 所有测试通过！激活码系统运行正常！');
  } else {
    console.log('\n⚠️  部分测试失败，请查看上方错误信息');
  }
}

// 执行测试
runAllTests().catch(error => {
  console.error('\n❌ 测试过程发生错误:', error);
  process.exit(1);
});

