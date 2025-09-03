import mongoose, { Schema, Document, Types } from 'mongoose';

// 标注数据结构（简化版：仅标题+简介）
export interface IAnnotation {
  id: string;
  nodeKey: string;
  title: string;
  description: string;
  position: { x: number; y: number; z: number };
}

// 动画步骤
export interface IAnimationStep {
  id: string;
  name: string;
  description: string;
  time: number;
}

// 关键帧数据
export interface ICameraKeyframe {
  time: number;
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  easing: string;
}

export interface IVisibilityKeyframe {
  time: number;
  visible: boolean;
  easing: string;
}

export interface ITransformKeyframe {
  time: number;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  easing: string;
}

// 动画轨道
export interface IVisibilityTrack {
  nodeKey: string;
  keys: IVisibilityKeyframe[];
}

export interface ITransformTrack {
  nodeKey: string;
  keys: ITransformKeyframe[];
}

// 时间线数据
export interface ITimeline {
  duration: number;
  cameraKeys: ICameraKeyframe[];
  visTracks: IVisibilityTrack[];
  trsTracks: ITransformTrack[];
}

// 动画数据
export interface IAnimation {
  id: string;
  name: string;
  description: string;
  timeline: ITimeline;
  steps: IAnimationStep[];
}

// 模型结构数据（用于保存重命名、层级等信息）
export interface IModelStructureItem {
  path: string[];
  uuid: string;
  name: string;
  visible: boolean;
  type: string;
}

export interface IModelStructure {
  objects: IModelStructureItem[];
  deletedUUIDs: string[];
}

// 三维课件数据结构
export interface ICourseware extends Document {
  name: string;
  description: string;
  modelUrl: string; // GLB文件URL
  modifiedModelUrl?: string; // 修改后的GLB文件URL（可选）
  annotations: IAnnotation[];
  animations: IAnimation[];
  settings: {
    cameraPosition?: { x: number; y: number; z: number };
    cameraTarget?: { x: number; y: number; z: number };
    background?: string;
    lighting?: any;
  };
  modelStructure?: IModelStructure | IModelStructureItem[]; // 模型结构信息（支持新旧格式）
  createdBy: Types.ObjectId; // 创建者
  updatedBy: Types.ObjectId; // 最后修改者
  version: number; // 版本号
}

// MongoDB Schema 定义
const AnnotationSchema = new Schema({
  id: { type: String, required: true },
  nodeKey: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
  }
}, { _id: false });

const AnimationStepSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  time: { type: Number, required: true }
}, { _id: false });

const CameraKeyframeSchema = new Schema({
  time: { type: Number, required: true },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
  },
  target: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
  },
  easing: { type: String, default: 'linear' }
}, { _id: false });

const VisibilityKeyframeSchema = new Schema({
  time: { type: Number, required: true },
  visible: { type: Boolean, required: true },
  easing: { type: String, default: 'linear' }
}, { _id: false });

const TransformKeyframeSchema = new Schema({
  time: { type: Number, required: true },
  position: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
  },
  rotation: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
  },
  scale: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    z: { type: Number, required: true }
  },
  easing: { type: String, default: 'linear' }
}, { _id: false });

const VisibilityTrackSchema = new Schema({
  nodeKey: { type: String, required: true },
  keys: [VisibilityKeyframeSchema]
}, { _id: false });

const TransformTrackSchema = new Schema({
  nodeKey: { type: String, required: true },
  keys: [TransformKeyframeSchema]
}, { _id: false });

const TimelineSchema = new Schema({
  duration: { type: Number, required: true, default: 10 },
  cameraKeys: [CameraKeyframeSchema],
  visTracks: [VisibilityTrackSchema],
  trsTracks: [TransformTrackSchema]
}, { _id: false });

const AnimationSchema = new Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  timeline: TimelineSchema,
  steps: [AnimationStepSchema]
}, { _id: false });

const ModelStructureItemSchema = new Schema({
  path: [String],
  uuid: { type: String, required: true },
  name: { type: String, required: true },
  visible: { type: Boolean, required: true },
  type: { type: String, required: true }
}, { _id: false });

const ModelStructureSchema = new Schema({
  objects: [ModelStructureItemSchema],
  deletedUUIDs: [String]
}, { _id: false });

const CoursewareSchema = new Schema<ICourseware>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    modelUrl: { type: String, required: true },
    modifiedModelUrl: { type: String },
    annotations: [AnnotationSchema],
    animations: [AnimationSchema],
    settings: {
      cameraPosition: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        z: { type: Number, default: 5 }
      },
      cameraTarget: {
        x: { type: Number, default: 0 },
        y: { type: Number, default: 0 },
        z: { type: Number, default: 0 }
      },
      background: { type: String, default: '#919191' },
      lighting: { type: Schema.Types.Mixed }
    },
    modelStructure: { type: Schema.Types.Mixed }, // 支持新旧格式
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    version: { type: Number, default: 1 }
  },
  { timestamps: true }
);

// 索引
CoursewareSchema.index({ createdBy: 1 });
CoursewareSchema.index({ name: 'text', description: 'text' });

export const CoursewareModel = mongoose.model<ICourseware>('Courseware', CoursewareSchema);

