import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVoiceConfig {
  provider?: string;
  voice?: string;
  rate?: number;
  style?: string;
}

// 考题选项
export interface IQuestionOption {
  key: string;    // A/B/C/D
  text: string;   // 选项内容
}

// 考题数据结构
export interface IQuestion {
  id: string;
  type: 'theory' | 'interactive';  // 理论题/互动题
  question: string;                 // 题目内容
  options: IQuestionOption[];       // 选项A/B/C/D
  answer: string;                   // 正确答案key
  explanation?: string;             // 解析
  // 互动题专用
  highlightNodeKey?: string;        // 高亮的模型节点
  relatedOutlineItemId?: string;    // 关联的大纲项ID
}

// 审核状态类型
export type ReviewStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface IAICourse extends Document {
  version: string; // schema版本
  title: string;
  theme?: string;
  audience?: string;
  durationTarget?: number;
  language?: string;
  voice?: IVoiceConfig;
  coursewareId: Types.ObjectId;
  coursewareVersion?: number;
  modelHash?: string;
  outline?: any[]; // 段落结构，保持灵活
  questions?: IQuestion[]; // 考题列表
  assets?: {
    images?: any[];
    audio?: any[];
  };
  thumbnail?: string; // 缩略图URL
  status: 'draft' | 'published';
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  courseVersion: number;
  // 审核相关字段
  reviewStatus: ReviewStatus; // 审核状态
  reviewedBy?: Types.ObjectId; // 审核人
  reviewedAt?: Date; // 审核时间
  reviewComment?: string; // 审核意见
  submittedAt?: Date; // 提交审核时间
}

const VoiceConfigSchema = new Schema({
  provider: { type: String },
  voice: { type: String },
  rate: { type: Number },
  style: { type: String }
}, { _id: false });

// 考题选项Schema
const QuestionOptionSchema = new Schema({
  key: { type: String, required: true },   // A/B/C/D
  text: { type: String, required: true }   // 选项内容
}, { _id: false });

// 考题Schema
const QuestionSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['theory', 'interactive'], required: true },
  question: { type: String, required: true },
  options: { type: [QuestionOptionSchema], required: true },
  answer: { type: String, required: true },
  explanation: { type: String },
  highlightNodeKey: { type: String },        // 互动题：高亮的模型节点
  relatedOutlineItemId: { type: String }     // 关联的大纲项ID
}, { _id: false });

const AICourseSchema = new Schema<IAICourse>({
  version: { type: String, default: '1.0' },
  title: { type: String, required: true },
  theme: { type: String },
  audience: { type: String },
  durationTarget: { type: Number },
  language: { type: String, default: 'zh-CN' },
  voice: { type: VoiceConfigSchema },
  coursewareId: { type: Schema.Types.ObjectId, ref: 'Courseware', required: true },
  coursewareVersion: { type: Number },
  modelHash: { type: String },
  outline: { type: Schema.Types.Mixed, default: [] },
  questions: { type: [QuestionSchema], default: [] },  // 考题列表
  assets: { type: Schema.Types.Mixed, default: {} },
  thumbnail: { type: String }, // 缩略图URL
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseVersion: { type: Number, default: 1 },
  // 审核相关字段
  reviewStatus: { type: String, enum: ['draft', 'pending', 'approved', 'rejected'], default: 'draft' },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewComment: { type: String },
  submittedAt: { type: Date }
}, { timestamps: true });

// 暂时移除所有索引，避免冲突
// AICourseSchema.index({ title: 1 });
// AICourseSchema.index({ theme: 1 });
// AICourseSchema.index({ createdBy: 1, status: 1 });

export const AICourseModel = mongoose.model<IAICourse>('AICourse', AICourseSchema);



