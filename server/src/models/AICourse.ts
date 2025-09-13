import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IVoiceConfig {
  provider?: string;
  voice?: string;
  rate?: number;
  style?: string;
}

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
  assets?: {
    images?: any[];
    audio?: any[];
  };
  status: 'draft' | 'published';
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  courseVersion: number;
}

const VoiceConfigSchema = new Schema({
  provider: { type: String },
  voice: { type: String },
  rate: { type: Number },
  style: { type: String }
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
  assets: { type: Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  courseVersion: { type: Number, default: 1 }
}, { timestamps: true });

// AICourseSchema.index({ title: 'text', theme: 'text' }); // 暂时注释掉文本索引
AICourseSchema.index({ createdBy: 1, status: 1 });

export const AICourseModel = mongoose.model<IAICourse>('AICourse', AICourseSchema);



