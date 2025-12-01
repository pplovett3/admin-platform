import { Request, Response } from 'express';
import { CoursewareModel } from '../models/Courseware';
import { FileModel } from '../models/File';
import { Types } from 'mongoose';
import { config } from '../config/env';

// 工具函数：将内部文件URL转换为公网URL
async function convertFileUrlToPublic(url: string): Promise<string> {
  if (!url) return url;
  
  // 如果已经是公网URL，直接返回
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  
  // 提取文件ID：从 "/api/files/文件ID/download" 格式中提取
  const match = url.match(/\/api\/files\/([^\/]+)\/download/);
  if (!match) return url;
  
  const fileId = match[1];
  
  try {
    // 查询文件信息获取存储路径
    const file = await FileModel.findById(fileId).lean();
    if (!file || !file.storageRelPath) return url;
    
    // 如果配置了公网下载地址，使用公网URL
    if (config.publicDownloadBase) {
      return `${config.publicDownloadBase.replace(/\/$/, '')}/${file.storageRelPath}`;
    }
    
    return url;
  } catch (error) {
    console.error('Convert file URL error:', error);
    return url;
  }
}

// 转换课件对象的URL字段
async function convertCoursewareUrls(courseware: any) {
  if (!courseware) return courseware;
  
  const converted = { ...courseware };
  
  if (converted.modelUrl) {
    converted.modelUrl = await convertFileUrlToPublic(converted.modelUrl);
  }
  
  if (converted.modifiedModelUrl) {
    converted.modifiedModelUrl = await convertFileUrlToPublic(converted.modifiedModelUrl);
  }
  
  return converted;
}

// 获取课件列表（Unity客户端专用 - 只返回基本信息）
export async function listCoursewaresForClient(req: Request, res: Response) {
  try {
    const q = (req.query.q as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    
    // 文本搜索
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') }
      ];
    }

    // 权限过滤：超管可以看所有，其他用户只能看自己创建的
    const user = (req as any).user;
    if (user.role !== 'superadmin') {
      filter.createdBy = new Types.ObjectId(user.userId);
    }

    const [items, total] = await Promise.all([
      CoursewareModel
        .find(filter)
        .select('_id name description') // 只选择需要的字段
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CoursewareModel.countDocuments(filter)
    ]);

    // 格式化返回数据，只返回 id, name, description
    const formattedItems = items.map((item: any) => ({
      id: item._id.toString(),
      name: item.name,
      description: item.description || ''
    }));

    res.json({
      items: formattedItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List coursewares for client error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// 获取课件列表
export async function listCoursewares(req: Request, res: Response) {
  try {
    const q = (req.query.q as string) || '';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const filter: any = {};
    
    // 文本搜索
    if (q) {
      filter.$or = [
        { name: new RegExp(q, 'i') },
        { description: new RegExp(q, 'i') }
      ];
    }

    // 权限过滤：超管可以看所有，其他用户只能看自己创建的
    const user = (req as any).user;
    if (user.role !== 'superadmin') {
      filter.createdBy = new Types.ObjectId(user.userId);
    }

    const [items, total] = await Promise.all([
      CoursewareModel
        .find(filter)
        .populate('createdBy', 'name')
        .populate('updatedBy', 'name')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      CoursewareModel.countDocuments(filter)
    ]);

    // 转换课件URL为公网地址
    const convertedItems = await Promise.all(
      items.map(item => convertCoursewareUrls(item.toObject()))
    );

    res.json({
      items: convertedItems,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('List coursewares error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// 获取单个课件
export async function getCourseware(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid courseware ID' });
    }

    const courseware = await CoursewareModel
      .findById(id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!courseware) {
      return res.status(404).json({ message: 'Courseware not found' });
    }

    // 权限检查：超管可以看所有，其他用户只能看自己创建的
    const user = (req as any).user;
    if (user.role !== 'superadmin' && courseware.createdBy._id.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 转换URL为公网地址
    const convertedCourseware = await convertCoursewareUrls(courseware.toObject());

    res.json(convertedCourseware);
  } catch (error) {
    console.error('Get courseware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// 创建课件
export async function createCourseware(req: Request, res: Response) {
  try {
    const { name, description, modelUrl } = req.body || {};
    
    if (!name?.trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    
    if (!modelUrl?.trim()) {
      return res.status(400).json({ message: 'Model URL is required' });
    }

    const user = (req as any).user;
    const userId = new Types.ObjectId(user.userId);

    const courseware = await CoursewareModel.create({
      name: name.trim(),
      description: description?.trim() || '',
      modelUrl: modelUrl.trim(),
      annotations: [],
      animations: [],
      settings: {
        cameraPosition: { x: 0, y: 0, z: 5 },
        cameraTarget: { x: 0, y: 0, z: 0 },
        background: '#f0f0f0'
      },
      createdBy: userId,
      updatedBy: userId,
      version: 1
    });

    const populated = await CoursewareModel
      .findById(courseware._id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    // 转换URL为公网地址
    const convertedCourseware = await convertCoursewareUrls(populated!.toObject());

    res.status(201).json(convertedCourseware);
  } catch (error) {
    console.error('Create courseware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// 更新课件
export async function updateCourseware(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid courseware ID' });
    }

    const courseware = await CoursewareModel.findById(id);
    if (!courseware) {
      return res.status(404).json({ message: 'Courseware not found' });
    }

    // 权限检查：超管可以编辑所有，其他用户只能编辑自己创建的
    const user = (req as any).user;
    if (user.role !== 'superadmin' && courseware.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 记录接收到的原始请求数据
    console.log('[Backend/Update] 接收到的原始req.body.settings:', JSON.stringify(req.body.settings, null, 2));
    
    const updateData = { ...req.body };
    updateData.updatedBy = new Types.ObjectId(user.userId);
    updateData.version = courseware.version + 1;
    
    // 移除不允许更新的字段
    delete updateData._id;
    delete updateData.createdBy;
    delete updateData.createdAt;
    delete updateData.updatedAt;

    // 记录处理后的设置数据
    console.log('[Backend/Update] 处理后的updateData.settings:', JSON.stringify(updateData.settings, null, 2));
    console.log('[Backend/Update] updateData.settings的所有键:', updateData.settings ? Object.keys(updateData.settings) : 'null');

    // 使用 $set 操作符确保嵌套对象正确更新
    // 特别注意：对于嵌套对象，Mongoose需要明确使用点号路径或直接替换整个对象
    // 这里我们直接替换整个settings对象，确保所有字段都被保存
    const updateQuery: any = {
      $set: {
        updatedBy: updateData.updatedBy,
        version: updateData.version
      }
    };
    
    // 复制所有字段到$set中，但settings单独处理
    Object.keys(updateData).forEach(key => {
      if (key !== 'settings' && key !== 'updatedBy' && key !== 'version') {
        updateQuery.$set[key] = updateData[key];
      }
    });
    
    // 如果 settings 存在，确保整个 settings 对象被替换（而不是合并）
    if (updateData.settings) {
      // 直接替换整个settings对象
      updateQuery.$set.settings = updateData.settings;
    }

    console.log('[Backend/Update] 准备执行的更新查询:', JSON.stringify(updateQuery, null, 2));

    const updated = await CoursewareModel
      .findByIdAndUpdate(id, updateQuery, { new: true, runValidators: false })
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    // 记录更新后的设置数据
    if (updated && updated.settings) {
      console.log('[Backend/Update] 更新后的设置数据:', JSON.stringify(updated.settings, null, 2));
    }

    // 转换URL为公网地址
    const convertedCourseware = await convertCoursewareUrls(updated!.toObject());

    res.json(convertedCourseware);
  } catch (error) {
    console.error('Update courseware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// 删除课件
export async function deleteCourseware(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid courseware ID' });
    }

    const courseware = await CoursewareModel.findById(id);
    if (!courseware) {
      return res.status(404).json({ message: 'Courseware not found' });
    }

    // 权限检查：超管可以删除所有，其他用户只能删除自己创建的
    const user = (req as any).user;
    if (user.role !== 'superadmin' && courseware.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await CoursewareModel.findByIdAndDelete(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete courseware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// 导出课件数据（courseware.json格式）
export async function exportCourseware(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid courseware ID' });
    }

    const courseware = await CoursewareModel.findById(id);
    if (!courseware) {
      return res.status(404).json({ message: 'Courseware not found' });
    }

    // 权限检查
    const user = (req as any).user;
    if (user.role !== 'superadmin' && courseware.createdBy.toString() !== user.userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 构造 courseware.json 格式
    const exportData = {
      version: "1.1",
      name: courseware.name,
      description: courseware.description,
      modelUrl: courseware.modelUrl,
      annotations: courseware.annotations,
      animations: courseware.animations,
      settings: courseware.settings,
      exportedAt: new Date().toISOString(),
      exportedBy: user.name
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${courseware.name}.courseware.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Export courseware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// 导入课件数据
export async function importCourseware(req: Request, res: Response) {
  try {
    const { coursewareData, name } = req.body || {};
    
    if (!coursewareData || !name?.trim()) {
      return res.status(400).json({ message: 'Courseware data and name are required' });
    }

    const user = (req as any).user;
    const userId = new Types.ObjectId(user.userId);

    const courseware = await CoursewareModel.create({
      name: name.trim(),
      description: coursewareData.description || '',
      modelUrl: coursewareData.modelUrl || '',
      annotations: coursewareData.annotations || [],
      animations: coursewareData.animations || [],
      settings: coursewareData.settings || {
        cameraPosition: { x: 0, y: 0, z: 5 },
        cameraTarget: { x: 0, y: 0, z: 0 },
        background: '#f0f0f0'
      },
      createdBy: userId,
      updatedBy: userId,
      version: 1
    });

    const populated = await CoursewareModel
      .findById(courseware._id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    res.status(201).json(populated);
  } catch (error) {
    console.error('Import courseware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

// 获取可用的模型资源列表
export async function getAvailableModels(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;
    const q = (req.query.q as string) || '';

    // 构建查询条件：只查找模型文件
    const baseFilter: any = {
      type: 'model', // 只查找模型类型的文件
    };

    // 添加搜索条件
    if (q) {
      baseFilter.originalName = { $regex: q, $options: 'i' };
    }

    // 查询用户的私人资源和公共资源
    const [personalModels, publicModels] = await Promise.all([
      // 个人资源
      FileModel
        .find({
          ...baseFilter,
          ownerUserId: new Types.ObjectId(user.userId),
          visibility: 'private'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      
      // 公共资源
      FileModel
        .find({
          ...baseFilter,
          visibility: 'public'
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    // 合并并格式化结果（过滤掉编辑器自动保存的临时 GLB：courseware-*-modified.glb）
    const shouldHideEditorSaved = (name: string) => /^(courseware-).*(-modified\.glb)$/i.test(name || '');
    const allModels = [...personalModels, ...publicModels].filter((m: any) => !shouldHideEditorSaved(m.originalName || ''));
    const formattedModels = allModels.map((model: any) => ({
      id: model._id,
      name: model.originalName,
      size: model.size,
      type: model.visibility === 'public' ? 'public' : 'personal',
      createdAt: model.createdAt,
      downloadUrl: config.publicDownloadBase && model.storageRelPath 
        ? `${config.publicDownloadBase.replace(/\/$/, '')}/${model.storageRelPath}`
        : `/api/files/${model._id}/download`,
      // 构建预览URL（如果有公共访问地址）
      viewUrl: config.publicDownloadBase && model.storageRelPath 
        ? `${config.publicDownloadBase.replace(/\/$/, '')}/${model.storageRelPath}`
        : `/api/files/${model._id}/download`
    }));

    // 获取总数
    const [personalTotal, publicTotal] = await Promise.all([
      FileModel.countDocuments({
        ...baseFilter,
        ownerUserId: new Types.ObjectId(user.userId),
        visibility: 'private'
      }),
      FileModel.countDocuments({
        ...baseFilter,
        visibility: 'public'
      })
    ]);

    const total = personalTotal + publicTotal;

    res.json({
      models: formattedModels,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get available models error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}
