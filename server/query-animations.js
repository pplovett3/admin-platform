const mongoose = require('mongoose');

async function query() {
  await mongoose.connect('mongodb://127.0.0.1:27017/admin_platform');
  const db = mongoose.connection.db;
  const coursewares = db.collection('coursewares');
  
  const ObjectId = mongoose.Types.ObjectId;
  const cw = await coursewares.findOne({ _id: new ObjectId('69324ce20d595d7f33a54e15') });
  
  if (!cw) {
    console.log('课件未找到');
  } else {
    console.log('课件名称:', cw.name);
    console.log('动画数量:', cw.animations?.length || 0);
    if (cw.animations && cw.animations.length > 0) {
      cw.animations.forEach((anim, i) => {
        console.log(`\n--- 动画 ${i + 1} ---`);
        console.log('ID:', anim.id);
        console.log('名称:', anim.name);
        console.log('描述:', anim.description);
        if (anim.timeline) {
          console.log('时长:', anim.timeline.duration, 's');
          console.log('相机关键帧:', anim.timeline.cameraKeys?.length || 0);
          console.log('显隐轨道:', anim.timeline.visTracks?.length || 0);
          console.log('变换轨道:', anim.timeline.trsTracks?.length || 0);
        }
        console.log('步骤数:', anim.steps?.length || 0);
      });
    }
  }
  
  await mongoose.disconnect();
}

query().catch(console.error);


















