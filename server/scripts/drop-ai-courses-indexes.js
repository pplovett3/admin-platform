const { MongoClient } = require('mongodb');

async function dropAICoursesIndexes() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection('aicourses');
    
    // 获取所有索引
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));
    
    // 删除文本索引（如果存在）
    for (const index of indexes) {
      if (index.name && index.name.includes('text')) {
        try {
          await collection.dropIndex(index.name);
          console.log(`Dropped index: ${index.name}`);
        } catch (e) {
          console.log(`Failed to drop ${index.name}:`, e.message);
        }
      }
    }
    
    console.log('AI courses indexes cleanup completed');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

dropAICoursesIndexes();






