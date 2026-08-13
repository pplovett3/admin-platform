/**
 * 检查指定ID的三维课件数据
 */

const mongoose = require('mongoose');

const coursewareId = process.argv[2] || '69324ce20d595d7f33a54e15';

async function checkCourseware() {
  const uri = process.env.MONGODB_URI || 'mongodb://mongo:27017/admin_platform';
  
  console.log(`\n🔍 查询课件 ID: ${coursewareId}`);
  console.log('='.repeat(80));
  
  try {
    await mongoose.connect(uri);
    console.log('✅ 数据库连接成功\n');
    
    const db = mongoose.connection.db;
    
    // 获取所有集合
    const collections = await db.listCollections().toArray();
    console.log('📦 数据库集合:', collections.map(c => c.name).join(', '));
    
    // 查询coursewares集合
    const coursewares = db.collection('coursewares');
    const count = await coursewares.countDocuments();
    console.log(`\n📋 coursewares 集合共 ${count} 条记录\n`);
    
    // 查询指定ID的课件
    const ObjectId = mongoose.Types.ObjectId;
    let courseware;
    
    try {
      courseware = await coursewares.findOne({ _id: new ObjectId(coursewareId) });
    } catch (e) {
      console.log('⚠️ ID格式无效，尝试字符串匹配...');
      courseware = await coursewares.findOne({ _id: coursewareId });
    }
    
    if (!courseware) {
      console.log(`❌ 未找到 ID 为 ${coursewareId} 的课件\n`);
      
      // 显示所有课件的ID和名称
      console.log('📋 现有课件列表:');
      const allCoursewares = await coursewares.find({}).project({ _id: 1, name: 1 }).toArray();
      allCoursewares.forEach((cw, i) => {
        console.log(`  ${i + 1}. ID: ${cw._id} | 名称: ${cw.name}`);
      });
      
      await mongoose.disconnect();
      return;
    }
    
    // 显示课件详情
    console.log('✅ 找到课件!');
    console.log('─'.repeat(80));
    console.log(`📌 名称: ${courseware.name}`);
    console.log(`📝 描述: ${courseware.description || '(无)'}`);
    console.log(`🔗 模型URL: ${courseware.modelUrl || '(无)'}`);
    console.log(`📅 版本: ${courseware.version || 1}`);
    
    // 动画信息
    console.log('\n🎬 动画信息:');
    if (courseware.animations && courseware.animations.length > 0) {
      courseware.animations.forEach((anim, i) => {
        console.log(`  [动画 ${i + 1}] ID: ${anim.id} | 名称: ${anim.name}`);
        console.log(`          描述: ${anim.description || '(无)'}`);
        
        if (anim.timeline) {
          console.log(`          时长: ${anim.timeline.duration}s`);
          console.log(`          相机关键帧: ${anim.timeline.cameraKeys?.length || 0} 个`);
          console.log(`          显隐轨道: ${anim.timeline.visTracks?.length || 0} 条`);
          console.log(`          变换轨道: ${anim.timeline.trsTracks?.length || 0} 条`);
        }
        
        // 步骤信息
        if (anim.steps && anim.steps.length > 0) {
          console.log(`          步骤: ${anim.steps.length} 个`);
          anim.steps.forEach((step, j) => {
            console.log(`            步骤${j + 1}: [${step.time}s] ${step.name} - ${step.description || ''}`);
          });
        } else {
          console.log('          步骤: (无)');
        }
      });
    } else {
      console.log('  (无动画数据)');
    }
    
    // 标注信息
    console.log('\n📍 标注信息:');
    if (courseware.annotations && courseware.annotations.length > 0) {
      courseware.annotations.forEach((ann, i) => {
        console.log(`  [标注 ${i + 1}] ID: ${ann.id}`);
        console.log(`          标题: ${ann.title}`);
        console.log(`          描述: ${ann.description || '(无)'}`);
        console.log(`          节点: ${ann.nodeKey}`);
        console.log(`          位置: (${ann.position?.x?.toFixed(2)}, ${ann.position?.y?.toFixed(2)}, ${ann.position?.z?.toFixed(2)})`);
      });
    } else {
      console.log('  (无标注数据)');
    }
    
    // 设置信息
    console.log('\n⚙️ 设置信息:');
    if (courseware.settings) {
      console.log(JSON.stringify(courseware.settings, null, 2));
    } else {
      console.log('  (无设置)');
    }
    
    // 模型结构信息
    console.log('\n🏗️ 模型结构信息:');
    if (courseware.modelStructure) {
      if (Array.isArray(courseware.modelStructure)) {
        console.log(`  对象数量: ${courseware.modelStructure.length}`);
      } else if (courseware.modelStructure.objects) {
        console.log(`  对象数量: ${courseware.modelStructure.objects.length}`);
        console.log(`  已删除UUID: ${courseware.modelStructure.deletedUUIDs?.length || 0} 个`);
      }
    } else {
      console.log('  (无模型结构数据)');
    }
    
    // 输出完整JSON
    console.log('\n' + '='.repeat(80));
    console.log('📄 完整数据 (JSON):');
    console.log('─'.repeat(80));
    console.log(JSON.stringify(courseware, null, 2));
    
    await mongoose.disconnect();
    
  } catch (error) {
    console.error(`\n❌ 错误: ${error.message}`);
    try {
      await mongoose.disconnect();
    } catch (e) {}
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 查询完成！\n');
}

checkCourseware();




























