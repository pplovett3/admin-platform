import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IPublishConfig {
  isPublic: boolean;
  allowDownload: boolean;
  showAuthor: boolean;
  enableComments: boolean;
  autoPlay: boolean;
  watermark?: string;
}

export interface IPublishedCourseStats {
  viewCount: number;
  shareCount: number;
  lastViewedAt?: Date;
}

export interface IPublishedCourse extends Document {
  id: string; // 唯一发布ID
  originalCourseId: Types.ObjectId; // 原始AI课程ID
  title: string;
  description?: string;
  thumbnail?: string;
  
  // 发布状态
  status: 'active' | 'inactive';
  
  // 发布配置
  publishConfig: IPublishConfig;
  
  // 数据快照（发布时冻结）
  courseData: any; // 完整课程数据
  coursewareData: any; // 课件数据
  
  // 资源路径映射（NAS存储）
  resourcePaths: {
    audio: string[]; // TTS音频文件路径
    images: string[]; // 配图文件路径
    thumbnail?: string; // 缩略图路径
  };
  
  // 统计数据
  stats: IPublishedCourseStats;
  
  // 发布信息
  publishedBy: Types.ObjectId;
  publishedAt: Date;
  lastUpdated: Date;
  expiresAt?: Date;
}

const PublishConfigSchema = new Schema({
  isPublic: { type: Boolean, default: true },
  allowDownload: { type: Boolean, default: false },
  showAuthor: { type: Boolean, default: true },
  enableComments: { type: Boolean, default: false },
  autoPlay: { type: Boolean, default: true },
  watermark: { type: String }
}, { _id: false });

const PublishedCourseStatsSchema = new Schema({
  viewCount: { type: Number, default: 0 },
  shareCount: { type: Number, default: 0 },
  lastViewedAt: { type: Date }
}, { _id: false });

const PublishedCourseSchema = new Schema<IPublishedCourse>({
  originalCourseId: { type: Schema.Types.ObjectId, ref: 'AICourse', required: true },
  title: { type: String, required: true },
  description: { type: String },
  thumbnail: { type: String },
  
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  
  publishConfig: { type: PublishConfigSchema, default: {} },
  
  // 数据快照
  courseData: { type: Schema.Types.Mixed, required: true },
  coursewareData: { type: Schema.Types.Mixed, required: true },
  
  // 资源路径
  resourcePaths: {
    audio: [{ type: String }],
    images: [{ type: String }],
    thumbnail: { type: String }
  },
  
  stats: { type: PublishedCourseStatsSchema, default: {} },
  
  publishedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  publishedAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  expiresAt: { type: Date }
}, { 
  timestamps: true,
  // 自定义ID字段
  toJSON: { 
    transform: function(doc: any, ret: any) {
      ret.id = ret._id.toString();
      return ret;
    }
  }
});

// 索引
PublishedCourseSchema.index({ originalCourseId: 1 });
PublishedCourseSchema.index({ status: 1 });
PublishedCourseSchema.index({ publishedBy: 1 });
PublishedCourseSchema.index({ publishedAt: -1 });

export const PublishedCourseModel = mongoose.model<IPublishedCourse>('PublishedCourse', PublishedCourseSchema);
